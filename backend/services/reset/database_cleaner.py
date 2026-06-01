"""
Database Cleaner Service
Handles granular deletion of database records for document reset operations
"""
import logging
from sqlalchemy.orm import Session
from backend.database.models_v2 import Document, DocumentChunk, DocumentAsset, DocumentEnrichment

logger = logging.getLogger(__name__)


class DatabaseCleaner:
    """Service for cleaning database records with granular control"""
    
    async def delete_chunks(self, document_id: int, db: Session) -> int:
        """Delete all chunks for a document"""
        try:
            count = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).delete(synchronize_session=False)
            logger.info(f"🗑️ Deleted {count} DocumentChunk records for document {document_id}")
            return count
        except Exception as e:
            logger.error(f"❌ Error deleting chunks: {e}")
            raise
    
    async def delete_chunk_enrichments(self, document_id: int, db: Session) -> int:
        """Delete chunk enrichments (suggested_questions, tags, instructions)"""
        try:
            # Get all chunks for this document
            chunks = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).all()
            
            count = 0
            for chunk in chunks:
                if chunk.suggested_questions or chunk.tags or chunk.instructions:
                    chunk.suggested_questions = None
                    chunk.tags = None
                    chunk.instructions = None
                    count += 1
            
            logger.info(f"🗑️ Cleared enrichments from {count} chunks for document {document_id}")
            return count
        except Exception as e:
            logger.error(f"❌ Error deleting chunk enrichments: {e}")
            raise
    
    async def delete_doc_enrichments(self, document_id: int, db: Session) -> int:
        """Delete document-level enrichments (JSON, Q&A)"""
        try:
            count = db.query(DocumentEnrichment).filter(
                DocumentEnrichment.document_id == document_id
            ).delete(synchronize_session=False)
            logger.info(f"🗑️ Deleted {count} DocumentEnrichment records for document {document_id}")
            return count
        except Exception as e:
            logger.error(f"❌ Error deleting document enrichments: {e}")
            raise
    
    async def delete_assets(self, document_id: int, db: Session) -> int:
        """Delete all assets (images) for a document"""
        try:
            count = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id
            ).delete(synchronize_session=False)
            logger.info(f"🗑️ Deleted {count} DocumentAsset records for document {document_id}")
            return count
        except Exception as e:
            logger.error(f"❌ Error deleting assets: {e}")
            raise
    
    async def clear_ocr_texts(self, document_id: int, db: Session) -> int:
        """Clear OCR text from assets without deleting the asset records"""
        try:
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id,
                DocumentAsset.ocr_text.isnot(None)
            ).all()
            
            count = 0
            for asset in assets:
                asset.ocr_text = None
                count += 1
            
            logger.info(f"🗑️ Cleared OCR texts from {count} assets for document {document_id}")
            return count
        except Exception as e:
            logger.error(f"❌ Error clearing OCR texts: {e}")
            raise
    
    async def delete_all(self, document_id: int, db: Session) -> dict:
        """Delete all processing data for a document"""
        try:
            result = {
                "chunks": await self.delete_chunks(document_id, db),
                "enrichments": await self.delete_doc_enrichments(document_id, db),
                "assets": await self.delete_assets(document_id, db)
            }
            logger.info(f"🗑️ Deleted all data for document {document_id}: {result}")
            return result
        except Exception as e:
            logger.error(f"❌ Error deleting all data: {e}")
            raise
