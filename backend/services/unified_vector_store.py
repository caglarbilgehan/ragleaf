# backend/services/unified_vector_store.py
"""
Unified Vector Store
Routes to pgvector (PostgreSQL) or ChromaDB/FAISS (SQLite) based on database type
"""

import logging
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_vector_store():
    """
    Get the appropriate vector store based on database configuration
    
    Returns:
        pgvector_service if using PostgreSQL
        vector_store_manager if using SQLite
    """
    from ..database.connection import is_postgresql
    
    if is_postgresql():
        from .pgvector_service import pgvector_service
        logger.info("Using pgvector (PostgreSQL)")
        return PgVectorAdapter(pgvector_service)
    else:
        from .vectorstore.vector_store_manager import vector_store_manager
        logger.info("Using ChromaDB/FAISS (SQLite)")
        return LegacyVectorAdapter(vector_store_manager)


class PgVectorAdapter:
    """Adapter for pgvector service to match VectorStoreManager interface"""
    
    def __init__(self, service):
        self.service = service
    
    def add_document(
        self,
        document_id: int,
        document_name: str,
        folder_name: str,
        chunks: List[Dict[str, Any]],
        embeddings: np.ndarray,
        dimension: int,
        db: Session
    ) -> Dict[str, Any]:
        """Add document vectors"""
        return self.service.add_document_chunks(db, document_id, chunks, embeddings)
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        document_ids: Optional[List[int]] = None,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """Search for similar vectors"""
        if db is None:
            raise ValueError("db session required for pgvector search")
        return self.service.search(db, query_embedding, top_k, document_ids)
    
    def delete_document(self, document_id: int, db: Session) -> Dict[str, int]:
        """Delete document vectors"""
        deleted = self.service.delete_document(db, document_id)
        return {"pgvector": deleted}
    
    def clear_all(self, db: Session) -> bool:
        """Clear all vectors"""
        return self.service.clear_all(db)
    
    def get_stats(self, db: Session) -> Dict[str, Any]:
        """Get store statistics"""
        return self.service.get_stats(db)


class LegacyVectorAdapter:
    """Adapter for legacy ChromaDB/FAISS to match unified interface"""
    
    def __init__(self, manager):
        self.manager = manager
    
    def add_document(
        self,
        document_id: int,
        document_name: str,
        folder_name: str,
        chunks: List[Dict[str, Any]],
        embeddings: np.ndarray,
        dimension: int,
        db: Session = None  # Not used by legacy
    ) -> Dict[str, Any]:
        """Add document vectors"""
        return self.manager.add_document(
            document_id=document_id,
            document_name=document_name,
            folder_name=folder_name,
            chunks=chunks,
            embeddings=embeddings,
            dimension=dimension
        )
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        document_ids: Optional[List[int]] = None,
        db: Session = None  # Not used by legacy
    ) -> List[Dict[str, Any]]:
        """Search for similar vectors"""
        results = self.manager.search(
            query_embedding=query_embedding,
            top_k=top_k,
            document_ids=document_ids
        )
        # Convert SearchResult objects to dicts
        return [
            {
                "id": r.id,
                "content": r.text,
                "score": r.score,
                "document_id": r.metadata.get("document_id"),
                "document_name": r.metadata.get("document_name"),
                "chunk_index": r.metadata.get("chunk_index")
            }
            for r in results
        ]
    
    def delete_document(self, document_id: int, db: Session = None) -> Dict[str, int]:
        """Delete document vectors"""
        return self.manager.delete_document(document_id)
    
    def clear_all(self, db: Session = None) -> bool:
        """Clear all vectors"""
        return self.manager.clear_all()
    
    def get_stats(self, db: Session = None) -> Dict[str, Any]:
        """Get store statistics"""
        return self.manager.get_stats()


# Lazy-loaded global instance
_vector_store = None

def get_unified_vector_store():
    """Get unified vector store (lazy initialization)"""
    global _vector_store
    if _vector_store is None:
        _vector_store = get_vector_store()
    return _vector_store
