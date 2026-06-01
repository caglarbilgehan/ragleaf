"""
Vector Store Manager - PgVector Edition
Unified management of vector storage using PostgreSQL and pgvector
"""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np

from .stores import PgVectorStore, SearchResult

logger = logging.getLogger(__name__)


class VectorStoreManager:
    """
    Unified vector store manager using PostgreSQL pgvector
    
    Replaces previous ChromaDB + FAISS implementation with a single
    PostgreSQL-based solution for data consistency and simplicity.
    """
    
    def __init__(self, base_dir: Optional[Path] = None):
        # base_dir kept for signature compatibility but not used for storage
        self.base_dir = base_dir or Path(__file__).parent.parent.parent.parent / "documents"
        
        # PostgreSQL vector store
        self._pg_store: Optional[PgVectorStore] = None
        
        # Current dimension (tracked but handled by DB schema)
        self._dimension: Optional[int] = None
    
    @property
    def pg_store(self) -> PgVectorStore:
        """Get PgVector store (lazy init)"""
        if self._pg_store is None:
            self._pg_store = PgVectorStore()
        return self._pg_store
    
    # Legacy property for compatibility checking
    @property
    def chroma_store(self):
        """Deprecated: Returns pg_store for compatibility"""
        return self.pg_store
    
    def add_document(
        self,
        document_id: int,
        document_name: str,
        folder_name: str,
        chunks: List[Dict[str, Any]],
        embeddings: np.ndarray,
        dimension: int
    ) -> Dict[str, Any]:
        """
        Add document vectors to PostgreSQL
        
        Args:
            document_id: Document database ID
            document_name: Document name
            folder_name: Document folder name (unused in DB, kept for compat)
            chunks: List of chunk dictionaries
            embeddings: Embedding vectors
            dimension: Vector dimension
        
        Returns:
            Dict with results
        """
        try:
            self._dimension = dimension
            
            # Prepare data
            # IDs are managed by DB (auto-increment) or constructed if needed
            # We generate string IDs for compatibility with base interface, but PgStore ignores them or handles mapping
            ids = [f"doc_{document_id}_chunk_{i}" for i in range(len(chunks))]
            texts = [chunk.get('text', '') for chunk in chunks]
            
            # Prepare detailed metadata including page_numbers for image linking
            metadatas = [
                {
                    "document_id": document_id,
                    "document_name": document_name,
                    "folder_name": folder_name,  # Required for image URL building
                    "chunk_index": chunk.get('id', i),
                    "paragraph_index": chunk.get('paragraph_index', 0),
                    "word_count": chunk.get('word_count', 0),
                    "char_count": chunk.get('char_count', 0),
                    "page_numbers": chunk.get('page_numbers', [])  # For image auto-linking
                }
                for i, chunk in enumerate(chunks)
            ]
            
            # Delete existing vectors for this document first (to avoid duplicates)
            self.delete_document(document_id)
            
            # Add to PostgreSQL
            count = self.pg_store.add(
                ids=ids,
                embeddings=embeddings,
                texts=texts,
                metadatas=metadatas
            )
            
            logger.info(f"✅ Added document {document_id} to PgVector: {count} chunks")
            
            return {
                "success": True,
                "pg_count": count,
                "chroma_count": count, # Kept for API compatibility
                "faiss_count": count,  # Kept for API compatibility
                "total_chunks": len(chunks)
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to add document {document_id}: {e}")
            return {"success": False, "error": str(e)}
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        document_ids: Optional[List[int]] = None,
        use_chroma: bool = True,  # Ignored
        use_faiss: bool = False   # Ignored
    ) -> List[SearchResult]:
        """
        Search for similar vectors in PostgreSQL
        """
        filter_meta = None
        if document_ids and len(document_ids) == 1:
            filter_meta = {"document_id": document_ids[0]}
        
        # Pass document_ids filtering logic if supported by search
        # Currently PgStore.search supports filter_metadata={"document_id": ...}
        # If multiple IDs, we might need to update PgStore.search to support "in" clause
        # For now simple single-doc or all-docs search
        
        return self.pg_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            filter_metadata=filter_meta
        )
    
    def search_with_filter(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """
        Search for similar vectors with custom filter metadata.
        Supports language and document_id filtering.
        """
        return self.pg_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            filter_metadata=filter_metadata
        )
    
    def delete_document(self, document_id: int) -> Dict[str, int]:
        """Delete all vectors for a document"""
        count = self.pg_store.delete_by_document(document_id)
        
        logger.info(f"🗑️ Deleted document {document_id} vectors from PgVector")
        return {
            "chroma": count, # Compat
            "faiss": count,  # Compat
            "pgvector": count
        }
    
    def clear_all(self) -> bool:
        """Clear all vector stores (for model change)"""
        return self.pg_store.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics"""
        pg_stats = self.pg_store.get_stats()
        return {
            "chroma": pg_stats, # Compat structure
            "pgvector": pg_stats,
            "faiss_stores": 0,
            "dimension": self._dimension
        }
    
    def handle_model_change(self, new_dimension: int) -> Dict[str, Any]:
        """Handle embedding model change"""
        logger.info(f"🔄 Handling model change (new dimension: {new_dimension})")
        old_dimension = self._dimension
        
        # Clear vectors
        cleared = self.clear_all()
        self._dimension = new_dimension
        
        return {
            "success": cleared,
            "old_dimension": old_dimension,
            "new_dimension": new_dimension,
            "message": "All vectors cleared from PostgreSQL. Documents need reprocessing."
        }


# Global instance
vector_store_manager = VectorStoreManager()
