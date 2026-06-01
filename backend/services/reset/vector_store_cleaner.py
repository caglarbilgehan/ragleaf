"""
Vector Store Cleaner Service
Handles deletion of vector embeddings from ChromaDB and pgvector
"""
import logging
from sqlalchemy.orm import Session
from backend.database.models_v2 import DocumentChunk

logger = logging.getLogger(__name__)


class VectorStoreCleaner:
    """Service for cleaning vector stores"""
    
    def __init__(self):
        self.chroma_client = None
        self.pgvector_store = None
    
    async def delete_vectors(self, document_id: int) -> dict:
        """Delete vectors from both ChromaDB and pgvector"""
        result = {
            "chroma": 0,
            "pgvector": 0
        }
        
        try:
            # Delete from ChromaDB
            chroma_count = await self._delete_from_chroma(document_id)
            result["chroma"] = chroma_count
            
            # Delete from pgvector (handled by database cascade)
            # When DocumentChunk is deleted, the embedding column is also deleted
            logger.info(f"🗑️ Vector deletion for document {document_id}: ChromaDB={chroma_count}")
            
        except Exception as e:
            logger.error(f"❌ Error deleting vectors: {e}")
            raise
        
        return result
    
    async def _delete_from_chroma(self, document_id: int) -> int:
        """Delete vectors from ChromaDB"""
        try:
            # Import here to avoid circular dependency
            from backend.services.vectorstore.vector_store_manager import vector_store_manager
            
            deleted = vector_store_manager.delete_document(document_id)
            chroma_count = deleted.get("chroma", 0)
            
            logger.info(f"🗑️ Deleted {chroma_count} vectors from ChromaDB for document {document_id}")
            return chroma_count
            
        except Exception as e:
            logger.warning(f"⚠️ Could not delete from ChromaDB: {e}")
            return 0
