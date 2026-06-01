"""
LLM Enrichment Generator Service
Generates Q&A pairs from document content using LLM
"""

import logging
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from ..database.models_v2 import Document, DocumentChunk

logger = logging.getLogger(__name__)


class LLMEnrichmentGenerator:
    """Service for generating Q&A enrichments using LLM"""
    
    def __init__(self):
        self._llm_service = None
    
    @property
    def llm_service(self):
        """Lazy load LLM service"""
        if self._llm_service is None:
            try:
                from .ai_service import AIService
                self._llm_service = AIService()
            except Exception as e:
                logger.error(f"❌ Failed to load AI service: {e}")
                raise
        return self._llm_service
    
    def _build_qa_generation_prompt(self, content: str, count: int = 5) -> str:
        """
        Build prompt for Q&A generation.
        
        Args:
            content: Document content to generate Q&A from
            count: Number of Q&A pairs to generate
            
        Returns:
            Formatted prompt string
        """
        return f"""Aşağıdaki döküman içeriğinden {count} adet soru-cevap çifti oluştur.

Kurallar:
1. Sorular döküman içeriğine dayalı olmalı
2. Cevaplar kısa ve öz olmalı (1-3 cümle)
3. Sorular farklı konuları kapsamalı
4. Teknik terimler varsa açıklayıcı olmalı
5. Türkçe olarak yanıtla

Döküman İçeriği:
{content[:4000]}

Yanıtı aşağıdaki JSON formatında ver:
{{
    "qa_pairs": [
        {{"question": "Soru 1?", "answer": "Cevap 1"}},
        {{"question": "Soru 2?", "answer": "Cevap 2"}}
    ]
}}

Sadece JSON döndür, başka açıklama ekleme."""
    
    async def generate_qa_pairs(
        self,
        document_id: int,
        db: Session,
        count: int = 5
    ) -> List[Dict[str, str]]:
        """
        Generate Q&A pairs from document content.
        
        Args:
            document_id: ID of the document
            db: Database session
            count: Number of Q&A pairs to generate (default: 5)
            
        Returns:
            List of dicts with 'question' and 'answer' keys
            
        Raises:
            Exception: If document not found or LLM fails
        """
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception(f"Döküman bulunamadı: {document_id}")
        
        # Get document chunks for content
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.enrichment_type.is_(None)  # Only original chunks
        ).order_by(DocumentChunk.chunk_index).limit(10).all()
        
        if not chunks:
            raise Exception("Döküman içeriği bulunamadı")
        
        # Combine chunk content
        content = "\n\n".join([c.content for c in chunks])
        
        # Build prompt
        prompt = self._build_qa_generation_prompt(content, count)
        
        # Call LLM
        try:
            response = await self.llm_service.generate_response(
                prompt=prompt,
                system_prompt="Sen bir döküman analiz asistanısın. Verilen içerikten soru-cevap çiftleri oluşturuyorsun.",
                max_tokens=2000,
                temperature=0.7
            )
            
            # Parse JSON response
            qa_pairs = self._parse_qa_response(response)
            
            logger.info(f"✅ Generated {len(qa_pairs)} Q&A pairs for document {document_id}")
            return qa_pairs
            
        except Exception as e:
            logger.error(f"❌ LLM generation failed: {e}")
            raise Exception(f"Soru-cevap üretimi başarısız: {str(e)}")
    
    def _parse_qa_response(self, response: str) -> List[Dict[str, str]]:
        """
        Parse LLM response to extract Q&A pairs.
        
        Args:
            response: LLM response string
            
        Returns:
            List of Q&A dicts
        """
        try:
            # Try to find JSON in response
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("JSON bulunamadı")
            
            json_str = response[start_idx:end_idx]
            data = json.loads(json_str)
            
            qa_pairs = data.get('qa_pairs', [])
            
            # Validate structure
            validated_pairs = []
            for pair in qa_pairs:
                if isinstance(pair, dict) and 'question' in pair and 'answer' in pair:
                    validated_pairs.append({
                        'question': str(pair['question']).strip(),
                        'answer': str(pair['answer']).strip()
                    })
            
            return validated_pairs
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON parse error: {e}")
            raise ValueError(f"LLM yanıtı geçersiz JSON: {str(e)}")


# Singleton instance
llm_enrichment_generator = LLMEnrichmentGenerator()
