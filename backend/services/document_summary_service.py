# backend/services/document_summary_service.py
"""
Document Summary Service
Generates AI-powered summaries for documents using LLM
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from .ai_service import ai_service
from .token_service import token_service

logger = logging.getLogger(__name__)


class DocumentSummaryService:
    """Service for generating and managing document summaries"""
    
    def __init__(self):
        self.default_max_chars = 15000  # Max chars to send to LLM for summary
        self.summary_system_prompt = """Sen bir döküman özetleme asistanısın. 
Verilen döküman içeriğini analiz et ve Türkçe olarak kısa, öz ve bilgilendirici bir özet oluştur.

Özet şunları içermeli:
- Dökümanın ana konusu
- Önemli noktalar ve bulgular
- Hedef kitle veya kullanım amacı (varsa)

Özet 2-4 paragraf uzunluğunda olmalı. Teknik terimleri koru ama anlaşılır bir dil kullan."""

    async def generate_summary(
        self,
        db: Session,
        document_id: int,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        force_regenerate: bool = False
    ) -> Dict[str, Any]:
        """
        Generate summary for a document
        
        Args:
            db: Database session
            document_id: Document ID
            model: LLM model to use (optional, uses default if not specified)
            provider: AI provider (optional)
            force_regenerate: Force regeneration even if summary exists
        
        Returns:
            Dict with summary and metadata
        """
        try:
            # Get document with chunks
            doc_result = db.execute(
                text("""
                    SELECT d.id, d.name, d.summary, d.summary_generated_at, d.status
                    FROM documents d
                    WHERE d.id = :doc_id
                """),
                {"doc_id": document_id}
            )
            doc = doc_result.fetchone()
            
            if not doc:
                return {"error": "Döküman bulunamadı", "success": False}
            
            if doc.status != "processed":
                return {"error": "Döküman henüz işlenmemiş", "success": False}
            
            # Check if summary already exists
            if doc.summary and not force_regenerate:
                return {
                    "success": True,
                    "summary": doc.summary,
                    "generated_at": doc.summary_generated_at.isoformat() if doc.summary_generated_at else None,
                    "cached": True
                }
            
            # Get document chunks for content
            chunks_result = db.execute(
                text("""
                    SELECT content, chunk_index
                    FROM document_chunks
                    WHERE document_id = :doc_id
                    ORDER BY chunk_index ASC
                """),
                {"doc_id": document_id}
            )
            chunks = chunks_result.fetchall()
            
            if not chunks:
                return {"error": "Döküman içeriği bulunamadı", "success": False}
            
            # Combine chunks (limit to max chars)
            full_content = "\n\n".join([c.content for c in chunks])
            if len(full_content) > self.default_max_chars:
                full_content = full_content[:self.default_max_chars] + "\n\n[... içerik kısaltıldı ...]"
            
            logger.info(f"📄 Generating summary for document {document_id}: {doc.name}")
            
            # Initialize tokens
            ai_service.initialize_tokens(db)
            
            # Get default model if not specified
            if not model:
                model, provider = await self._get_default_model(db)
                if not model:
                    return {"error": "Aktif AI modeli bulunamadı", "success": False}
            
            # Generate summary using LLM
            messages = [
                {"role": "system", "content": self.summary_system_prompt},
                {"role": "user", "content": f"Aşağıdaki dökümanı özetle:\n\nDöküman Adı: {doc.name}\n\nİçerik:\n{full_content}"}
            ]
            
            response = await ai_service.generate_response(
                model=model,
                provider=provider or "huggingface",
                messages=messages,
                temperature=0.3,
                max_tokens=1024
            )
            
            if response.get("error"):
                logger.error(f"❌ Summary generation failed: {response.get('error')}")
                return {"error": response.get("error"), "success": False}
            
            summary = response.get("response", "").strip()
            
            if not summary:
                return {"error": "Özet oluşturulamadı", "success": False}
            
            # Save summary to database
            db.execute(
                text("""
                    UPDATE documents
                    SET summary = :summary, summary_generated_at = NOW()
                    WHERE id = :doc_id
                """),
                {"summary": summary, "doc_id": document_id}
            )
            db.commit()
            
            logger.info(f"✅ Summary generated for document {document_id}")
            
            return {
                "success": True,
                "summary": summary,
                "generated_at": datetime.now().isoformat(),
                "cached": False,
                "model": model,
                "provider": provider or "huggingface"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error generating summary: {e}")
            return {"error": str(e), "success": False}
    
    async def _get_default_model(self, db: Session) -> tuple:
        """Get default active model and provider"""
        try:
            # Get active provider with default model
            result = db.execute(
                text("""
                    SELECT name, default_model
                    FROM ai_providers
                    WHERE is_active = true AND is_enabled = true
                    ORDER BY priority ASC
                    LIMIT 1
                """)
            )
            row = result.fetchone()
            
            if row and row.default_model:
                return row.default_model, row.name
            
            return None, None
        except Exception as e:
            logger.error(f"Error getting default model: {e}")
            return None, None
    
    def get_summary(self, db: Session, document_id: int) -> Optional[Dict[str, Any]]:
        """Get existing summary for a document"""
        try:
            result = db.execute(
                text("""
                    SELECT summary, summary_generated_at, name
                    FROM documents
                    WHERE id = :doc_id
                """),
                {"doc_id": document_id}
            )
            row = result.fetchone()
            
            if not row:
                return None
            
            return {
                "document_id": document_id,
                "document_name": row.name,
                "summary": row.summary,
                "generated_at": row.summary_generated_at.isoformat() if row.summary_generated_at else None,
                "has_summary": bool(row.summary)
            }
        except Exception as e:
            logger.error(f"Error getting summary: {e}")
            return None
    
    def delete_summary(self, db: Session, document_id: int) -> bool:
        """Delete summary for a document"""
        try:
            db.execute(
                text("""
                    UPDATE documents
                    SET summary = NULL, summary_generated_at = NULL
                    WHERE id = :doc_id
                """),
                {"doc_id": document_id}
            )
            db.commit()
            logger.info(f"🗑️ Summary deleted for document {document_id}")
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting summary: {e}")
            return False


# Global instance
document_summary_service = DocumentSummaryService()
