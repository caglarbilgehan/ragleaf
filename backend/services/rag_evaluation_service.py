# backend/services/rag_evaluation_service.py
"""
RAG Evaluation Service.
Manages test sets and runs evaluations using Ragas metrics.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
import logging
import asyncio
import time

from backend.database.models_v2 import (
    EvaluationTestSet,
    EvaluationQuestion,
    EvaluationRun,
    EvaluationResult,
)
from .ragas_metrics import RagasMetricsCalculator

logger = logging.getLogger(__name__)


class RAGEvaluationService:
    """Service for RAG evaluation management"""
    
    def __init__(self, db: Session):
        self.db = db
        self.metrics_calculator = RagasMetricsCalculator(db)
    
    # ==================== Test Set Management ====================
    
    def create_test_set(
        self,
        name: str,
        description: str = None,
        category: str = None,
        questions: List[Dict] = None,
    ) -> EvaluationTestSet:
        """Create a new test set with optional questions"""
        test_set = EvaluationTestSet(
            name=name,
            description=description,
            category=category,
        )
        self.db.add(test_set)
        self.db.commit()
        self.db.refresh(test_set)
        
        # Add questions if provided
        if questions:
            for q in questions:
                self.add_question(
                    test_set_id=test_set.id,
                    question=q.get("question"),
                    expected_answer=q.get("expected_answer"),
                    reference_doc_ids=q.get("reference_doc_ids", []),
                )
        
        logger.info(f"✅ Created test set: {name} with {len(questions or [])} questions")
        return test_set
    
    def get_test_sets(self) -> List[EvaluationTestSet]:
        """Get all test sets"""
        return self.db.query(EvaluationTestSet).order_by(desc(EvaluationTestSet.created_at)).all()
    
    def get_test_set(self, test_set_id: int) -> Optional[EvaluationTestSet]:
        """Get a specific test set"""
        return self.db.query(EvaluationTestSet).filter(EvaluationTestSet.id == test_set_id).first()
    
    def update_test_set(
        self,
        test_set_id: int,
        name: str = None,
        description: str = None,
        category: str = None,
    ) -> Optional[EvaluationTestSet]:
        """Update a test set"""
        test_set = self.get_test_set(test_set_id)
        if not test_set:
            return None
        
        if name:
            test_set.name = name
        if description is not None:
            test_set.description = description
        if category is not None:
            test_set.category = category
        
        self.db.commit()
        return test_set
    
    def delete_test_set(self, test_set_id: int) -> bool:
        """Delete a test set and all related data"""
        test_set = self.get_test_set(test_set_id)
        if not test_set:
            return False
        
        self.db.delete(test_set)
        self.db.commit()
        logger.info(f"🗑️ Deleted test set: {test_set.name}")
        return True
    
    # ==================== Question Management ====================
    
    def add_question(
        self,
        test_set_id: int,
        question: str,
        expected_answer: str = None,
        reference_doc_ids: List[int] = None,
    ) -> EvaluationQuestion:
        """Add a question to a test set"""
        q = EvaluationQuestion(
            test_set_id=test_set_id,
            question=question,
            expected_answer=expected_answer,
            reference_doc_ids=reference_doc_ids or [],
        )
        self.db.add(q)
        self.db.commit()
        return q
    
    def update_question(
        self,
        question_id: int,
        question: str = None,
        expected_answer: str = None,
        reference_doc_ids: List[int] = None,
    ) -> Optional[EvaluationQuestion]:
        """Update a question"""
        q = self.db.query(EvaluationQuestion).filter(EvaluationQuestion.id == question_id).first()
        if not q:
            return None
        
        if question:
            q.question = question
        if expected_answer is not None:
            q.expected_answer = expected_answer
        if reference_doc_ids is not None:
            q.reference_doc_ids = reference_doc_ids
        
        self.db.commit()
        return q
    
    def delete_question(self, question_id: int) -> bool:
        """Delete a question"""
        q = self.db.query(EvaluationQuestion).filter(EvaluationQuestion.id == question_id).first()
        if not q:
            return False
        
        self.db.delete(q)
        self.db.commit()
        return True
    
    # ==================== Evaluation Runs ====================
    
    async def run_evaluation(
        self,
        test_set_id: int,
        language: str = "tr",
    ) -> EvaluationRun:
        """Run evaluation on a test set"""
        test_set = self.get_test_set(test_set_id)
        if not test_set:
            raise ValueError(f"Test set {test_set_id} not found")
        
        questions = test_set.questions
        if not questions:
            raise ValueError("Test set has no questions")
        
        # Create run record
        run = EvaluationRun(
            test_set_id=test_set_id,
            status="running",
            started_at=datetime.utcnow(),
            total_questions=len(questions),
            completed_questions=0,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        
        logger.info(f"🚀 Starting evaluation run {run.id} for test set: {test_set.name}")
        
        try:
            # Import RAG service
            from .vectorstore.vector_store_manager import vector_store_manager
            from .embedding.embedding_service import embedding_service
            from .llm_router import llm_router
            
            # Get model info
            model = llm_router.get_default_model(self.db)
            if model:
                run.model_name = model.model_name
            
            # Process each question
            all_metrics = []
            
            for i, question in enumerate(questions):
                try:
                    result = await self._evaluate_question(
                        run_id=run.id,
                        question=question,
                        language=language,
                    )
                    
                    if result:
                        all_metrics.append({
                            "faithfulness": result.faithfulness,
                            "relevancy": result.answer_relevancy,
                            "precision": result.context_precision,
                            "recall": result.context_recall,
                        })
                    
                    # Update progress
                    run.completed_questions = i + 1
                    self.db.commit()
                    
                except Exception as e:
                    logger.error(f"❌ Error evaluating question {question.id}: {e}")
            
            # Calculate aggregate scores
            if all_metrics:
                run.avg_faithfulness = sum(m["faithfulness"] or 0 for m in all_metrics) / len(all_metrics)
                run.avg_relevancy = sum(m["relevancy"] or 0 for m in all_metrics) / len(all_metrics)
                run.avg_precision = sum(m["precision"] or 0 for m in all_metrics) / len(all_metrics)
                
                recall_values = [m["recall"] for m in all_metrics if m["recall"] is not None]
                run.avg_recall = sum(recall_values) / len(recall_values) if recall_values else None
                
                # Overall score
                scores = [run.avg_faithfulness, run.avg_relevancy, run.avg_precision]
                if run.avg_recall is not None:
                    scores.append(run.avg_recall)
                run.overall_score = sum(scores) / len(scores)
            
            run.status = "completed"
            run.completed_at = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"❌ Evaluation run failed: {e}")
            run.status = "failed"
            run.completed_at = datetime.utcnow()
        
        self.db.commit()
        logger.info(f"✅ Evaluation run {run.id} completed with score: {run.overall_score:.2f}" if run.overall_score else f"❌ Evaluation run {run.id} failed")
        
        return run
    
    async def _evaluate_question(
        self,
        run_id: int,
        question: EvaluationQuestion,
        language: str = "tr",
    ) -> Optional[EvaluationResult]:
        """Evaluate a single question"""
        start_time = time.time()
        
        try:
            # Get RAG response
            from .vectorstore.vector_store_manager import vector_store_manager
            from .embedding.embedding_service import embedding_service
            from .llm_router import llm_router
            
            # Encode query
            query_embedding = embedding_service.encode_query(question.question, self.db)
            
            # Search for relevant chunks
            search_results = vector_store_manager.pg_store.search(
                query_embedding=query_embedding,
                top_k=5,
                filter_metadata={"language": language},
            )
            
            # Extract contexts
            contexts = [r.text for r in search_results]
            retrieved_doc_ids = list(set(r.metadata.get("document_id") for r in search_results if r.metadata.get("document_id")))
            
            # Build RAG prompt
            context_text = "\n\n".join(contexts)
            rag_prompt = f"""Aşağıdaki bağlam bilgilerini kullanarak soruyu yanıtla.

BAĞLAM:
{context_text}

SORU: {question.question}

YANIT:"""

            # Get LLM response
            model = llm_router.get_default_model(self.db)
            if not model:
                raise ValueError("No LLM model available")
            
            messages = [{"role": "user", "content": rag_prompt}]
            response, _ = await llm_router.make_request_with_failover(
                db=self.db,
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=1000,
                stream=False,
            )
            
            # Extract answer
            if isinstance(response, dict):
                rag_answer = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            else:
                rag_answer = str(response)
            
            # Calculate metrics
            metrics = await self.metrics_calculator.calculate_all_metrics(
                question=question.question,
                answer=rag_answer,
                contexts=contexts,
                expected_answer=question.expected_answer,
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Save result
            result = EvaluationResult(
                run_id=run_id,
                question_id=question.id,
                rag_answer=rag_answer,
                retrieved_contexts=[{"text": ctx, "score": sr.score} for ctx, sr in zip(contexts, search_results)],
                retrieved_doc_ids=retrieved_doc_ids,
                faithfulness=metrics.get("faithfulness"),
                answer_relevancy=metrics.get("answer_relevancy"),
                context_precision=metrics.get("context_precision"),
                context_recall=metrics.get("context_recall"),
                duration_ms=duration_ms,
            )
            self.db.add(result)
            self.db.commit()
            
            logger.info(f"📊 Question {question.id}: faithfulness={metrics.get('faithfulness'):.2f}, relevancy={metrics.get('answer_relevancy'):.2f}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error evaluating question {question.id}: {e}")
            return None
    
    def get_runs(self, test_set_id: int = None) -> List[EvaluationRun]:
        """Get evaluation runs"""
        query = self.db.query(EvaluationRun)
        if test_set_id:
            query = query.filter(EvaluationRun.test_set_id == test_set_id)
        return query.order_by(desc(EvaluationRun.created_at)).all()
    
    def get_run(self, run_id: int) -> Optional[EvaluationRun]:
        """Get a specific run with results"""
        return self.db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    
    def get_run_results(self, run_id: int) -> List[EvaluationResult]:
        """Get results for a run"""
        return self.db.query(EvaluationResult).filter(EvaluationResult.run_id == run_id).all()
    
    def compare_runs(self, run_id_1: int, run_id_2: int) -> Dict[str, Any]:
        """Compare two evaluation runs"""
        run1 = self.get_run(run_id_1)
        run2 = self.get_run(run_id_2)
        
        if not run1 or not run2:
            return {"error": "One or both runs not found"}
        
        def calc_diff(v1, v2):
            if v1 is None or v2 is None:
                return None
            return v2 - v1
        
        return {
            "run1": {
                "id": run1.id,
                "created_at": run1.created_at.isoformat() if run1.created_at else None,
                "overall_score": run1.overall_score,
                "faithfulness": run1.avg_faithfulness,
                "relevancy": run1.avg_relevancy,
                "precision": run1.avg_precision,
                "recall": run1.avg_recall,
            },
            "run2": {
                "id": run2.id,
                "created_at": run2.created_at.isoformat() if run2.created_at else None,
                "overall_score": run2.overall_score,
                "faithfulness": run2.avg_faithfulness,
                "relevancy": run2.avg_relevancy,
                "precision": run2.avg_precision,
                "recall": run2.avg_recall,
            },
            "diff": {
                "overall_score": calc_diff(run1.overall_score, run2.overall_score),
                "faithfulness": calc_diff(run1.avg_faithfulness, run2.avg_faithfulness),
                "relevancy": calc_diff(run1.avg_relevancy, run2.avg_relevancy),
                "precision": calc_diff(run1.avg_precision, run2.avg_precision),
                "recall": calc_diff(run1.avg_recall, run2.avg_recall),
            }
        }
