# backend/services/ragas_metrics.py
"""
Ragas-style metrics calculator for RAG evaluation.
Implements faithfulness, relevancy, precision, and recall metrics.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging
import numpy as np

logger = logging.getLogger(__name__)


class RagasMetricsCalculator:
    """
    Calculate RAG evaluation metrics similar to Ragas library.
    Uses LLM-as-judge for some metrics.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._embedding_service = None
        self._llm_router = None
    
    def _get_embedding_service(self):
        """Lazy load embedding service"""
        if self._embedding_service is None:
            from .embedding.embedding_service import embedding_service
            self._embedding_service = embedding_service
        return self._embedding_service
    
    def _get_llm_router(self):
        """Lazy load LLM router"""
        if self._llm_router is None:
            from .llm_router import llm_router
            self._llm_router = llm_router
        return self._llm_router
    
    async def calculate_all_metrics(
        self,
        question: str,
        answer: str,
        contexts: List[str],
        expected_answer: str = None,
    ) -> Dict[str, float]:
        """
        Calculate all Ragas metrics for a single Q&A pair.
        
        Args:
            question: The user's question
            answer: The RAG-generated answer
            contexts: List of retrieved context texts
            expected_answer: Ground truth answer (optional)
            
        Returns:
            Dict with metric scores (0-1)
        """
        metrics = {}
        
        try:
            # Calculate each metric
            metrics["faithfulness"] = await self.calculate_faithfulness(answer, contexts)
            metrics["answer_relevancy"] = await self.calculate_answer_relevancy(question, answer)
            metrics["context_precision"] = await self.calculate_context_precision(question, contexts)
            
            if expected_answer:
                metrics["context_recall"] = await self.calculate_context_recall(
                    expected_answer, contexts
                )
            else:
                metrics["context_recall"] = None
            
            # Calculate overall score (average of available metrics)
            valid_scores = [v for v in metrics.values() if v is not None]
            metrics["overall"] = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0
            
        except Exception as e:
            logger.error(f"❌ Error calculating metrics: {e}")
            metrics = {
                "faithfulness": 0.0,
                "answer_relevancy": 0.0,
                "context_precision": 0.0,
                "context_recall": None,
                "overall": 0.0,
            }
        
        return metrics
    
    async def calculate_faithfulness(
        self,
        answer: str,
        contexts: List[str],
    ) -> float:
        """
        Calculate faithfulness score.
        Measures how much of the answer is supported by the contexts.
        
        Uses LLM to extract claims from answer and verify against contexts.
        """
        if not answer or not contexts:
            return 0.0
        
        try:
            llm_router = self._get_llm_router()
            model = llm_router.get_default_model(self.db)
            
            if not model:
                logger.warning("⚠️ No LLM model available for faithfulness calculation")
                return self._simple_faithfulness(answer, contexts)
            
            # Combine contexts
            context_text = "\n\n".join(contexts[:5])  # Limit to 5 contexts
            
            # LLM prompt for faithfulness
            prompt = f"""Aşağıdaki yanıtın, verilen bağlam bilgilerine ne kadar sadık olduğunu değerlendir.

BAĞLAM:
{context_text}

YANIT:
{answer}

Değerlendirme kriterleri:
1. Yanıttaki her iddia bağlamda destekleniyor mu?
2. Yanıtta bağlamda olmayan bilgi (hallucination) var mı?
3. Yanıt bağlamla çelişiyor mu?

Sadece 0 ile 1 arasında bir sayı döndür (örn: 0.85).
Yüksek skor = yanıt bağlama sadık, düşük skor = yanıtta desteklenmeyen bilgi var.

SKOR:"""

            messages = [{"role": "user", "content": prompt}]
            
            response, _ = await llm_router.make_request_with_failover(
                db=self.db,
                model=model,
                messages=messages,
                temperature=0.1,
                max_tokens=10,
                stream=False,
            )
            
            # Parse score from response
            score = self._parse_score(response)
            return score
            
        except Exception as e:
            logger.warning(f"⚠️ LLM faithfulness failed, using simple method: {e}")
            return self._simple_faithfulness(answer, contexts)
    
    def _simple_faithfulness(self, answer: str, contexts: List[str]) -> float:
        """Simple word overlap based faithfulness"""
        answer_words = set(answer.lower().split())
        context_words = set()
        for ctx in contexts:
            context_words.update(ctx.lower().split())
        
        if not answer_words:
            return 0.0
        
        overlap = len(answer_words & context_words)
        return min(overlap / len(answer_words), 1.0)
    
    async def calculate_answer_relevancy(
        self,
        question: str,
        answer: str,
    ) -> float:
        """
        Calculate answer relevancy score.
        Measures how relevant the answer is to the question.
        
        Uses embedding similarity between question and answer.
        """
        if not question or not answer:
            return 0.0
        
        try:
            embedding_service = self._get_embedding_service()
            
            # Get embeddings
            question_emb = embedding_service.encode_query(question, self.db)
            answer_emb = embedding_service.encode_query(answer, self.db)
            
            # Calculate cosine similarity
            similarity = self._cosine_similarity(question_emb, answer_emb)
            
            # Normalize to 0-1 range (similarity can be negative)
            score = (similarity + 1) / 2
            return float(score)
            
        except Exception as e:
            logger.warning(f"⚠️ Embedding relevancy failed: {e}")
            return self._simple_relevancy(question, answer)
    
    def _simple_relevancy(self, question: str, answer: str) -> float:
        """Simple keyword overlap based relevancy"""
        question_words = set(question.lower().split())
        answer_words = set(answer.lower().split())
        
        # Remove common words
        stopwords = {"bir", "ve", "ile", "için", "bu", "ne", "nasıl", "nedir", "mi", "mı"}
        question_words -= stopwords
        answer_words -= stopwords
        
        if not question_words:
            return 0.5
        
        overlap = len(question_words & answer_words)
        return min(overlap / len(question_words), 1.0)
    
    async def calculate_context_precision(
        self,
        question: str,
        contexts: List[str],
    ) -> float:
        """
        Calculate context precision score.
        Measures how relevant the retrieved contexts are to the question.
        
        Higher score = more relevant contexts retrieved.
        """
        if not question or not contexts:
            return 0.0
        
        try:
            embedding_service = self._get_embedding_service()
            
            # Get question embedding
            question_emb = embedding_service.encode_query(question, self.db)
            
            # Calculate relevance for each context
            relevance_scores = []
            for ctx in contexts:
                ctx_emb = embedding_service.encode_query(ctx, self.db)
                sim = self._cosine_similarity(question_emb, ctx_emb)
                relevance_scores.append((sim + 1) / 2)  # Normalize to 0-1
            
            # Precision = average relevance of retrieved contexts
            return float(np.mean(relevance_scores))
            
        except Exception as e:
            logger.warning(f"⚠️ Context precision calculation failed: {e}")
            return 0.5
    
    async def calculate_context_recall(
        self,
        expected_answer: str,
        contexts: List[str],
    ) -> float:
        """
        Calculate context recall score.
        Measures how much of the expected answer is covered by contexts.
        
        Requires ground truth expected_answer.
        """
        if not expected_answer or not contexts:
            return 0.0
        
        try:
            # Combine all contexts
            all_context = " ".join(contexts).lower()
            expected_words = set(expected_answer.lower().split())
            
            # Remove stopwords
            stopwords = {"bir", "ve", "ile", "için", "bu", "ne", "nasıl", "nedir", "mi", "mı", "olan", "olarak"}
            expected_words -= stopwords
            
            if not expected_words:
                return 1.0
            
            # Count how many expected words appear in contexts
            found = sum(1 for word in expected_words if word in all_context)
            
            return found / len(expected_words)
            
        except Exception as e:
            logger.warning(f"⚠️ Context recall calculation failed: {e}")
            return 0.5
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def _parse_score(self, response: Any) -> float:
        """Parse score from LLM response"""
        try:
            if isinstance(response, dict):
                text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            else:
                text = str(response)
            
            # Extract number from text
            import re
            numbers = re.findall(r"0?\.\d+|\d+\.?\d*", text)
            if numbers:
                score = float(numbers[0])
                return min(max(score, 0.0), 1.0)  # Clamp to 0-1
            
            return 0.5  # Default if no number found
            
        except Exception:
            return 0.5
