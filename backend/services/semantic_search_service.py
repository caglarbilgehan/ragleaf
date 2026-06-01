"""
Semantic Search Service for CLIP-based Image Search
Provides semantic similarity search using CLIP embeddings.
"""

import logging
from typing import List, Dict, Any, Optional
import numpy as np

from sqlalchemy.orm import Session
from sqlalchemy import text

from .clip_service import get_clip_service, CLIPService, CLIPEncodingError

logger = logging.getLogger(__name__)


class SemanticSearchService:
    """
    Service for semantic image search using CLIP embeddings.
    Uses pgvector for efficient cosine similarity search.
    """
    
    def __init__(self, clip_service: Optional[CLIPService] = None):
        """
        Initialize with CLIP service dependency.
        
        Args:
            clip_service: Optional CLIPService instance (uses singleton if not provided)
        """
        self._clip_service = clip_service
    
    @property
    def clip_service(self) -> CLIPService:
        """Get CLIP service (lazy initialization)."""
        if self._clip_service is None:
            self._clip_service = get_clip_service()
        return self._clip_service
    
    def search(
        self,
        query: str,
        document_id: int,
        db: Session,
        top_k: int = 10,
        threshold: float = 0.2
    ) -> List[Dict[str, Any]]:
        """
        Search images by semantic similarity.
        
        Args:
            query: Text query
            document_id: Document to search in
            db: Database session
            top_k: Maximum results to return
            threshold: Minimum similarity threshold
            
        Returns:
            List of results with similarity scores
        """
        from ..database.models_v2 import DocumentAsset
        
        try:
            # Check CLIP availability
            if not self.clip_service.is_available():
                logger.warning("⚠️ CLIP service not available for semantic search")
                return []
            
            # Generate query embedding
            logger.info(f"🔍 Semantic search: '{query}' in document {document_id}")
            query_embedding = self.clip_service.encode_text(query)
            
            # Use pgvector cosine similarity search
            # Convert embedding to string format for pgvector
            embedding_str = "[" + ",".join(str(x) for x in query_embedding.tolist()) + "]"
            
            # Query using pgvector cosine distance operator (<=>)
            # 1 - distance = similarity (cosine distance is 1 - cosine similarity)
            sql = text("""
                SELECT 
                    id,
                    file_path,
                    caption,
                    ocr_text,
                    asset_metadata,
                    1 - (clip_embedding <=> :embedding::vector) as similarity_score
                FROM document_assets
                WHERE document_id = :doc_id
                    AND asset_type = 'image'
                    AND clip_embedding IS NOT NULL
                    AND 1 - (clip_embedding <=> :embedding::vector) >= :threshold
                ORDER BY clip_embedding <=> :embedding::vector
                LIMIT :top_k
            """)
            
            result = db.execute(sql, {
                "embedding": embedding_str,
                "doc_id": document_id,
                "threshold": threshold,
                "top_k": top_k
            })
            
            results = []
            for row in result:
                metadata = row.asset_metadata or {}
                results.append({
                    "asset_id": row.id,
                    "file_path": row.file_path,
                    "caption": row.caption,
                    "ocr_text": row.ocr_text,
                    "page": metadata.get("page_number"),
                    "similarity_score": float(row.similarity_score),
                    "search_type": "semantic"
                })
            
            logger.info(f"✅ Semantic search found {len(results)} results")
            return results
            
        except CLIPEncodingError as e:
            logger.error(f"❌ CLIP encoding error: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Semantic search error: {e}")
            return []

    def search_all_documents(
        self,
        query: str,
        db: Session,
        top_k: int = 10,
        threshold: float = 0.2
    ) -> List[Dict[str, Any]]:
        """
        Search images across all documents.
        
        Args:
            query: Text query
            db: Database session
            top_k: Maximum results to return
            threshold: Minimum similarity threshold
            
        Returns:
            List of results with similarity scores
        """
        try:
            if not self.clip_service.is_available():
                logger.warning("⚠️ CLIP service not available")
                return []
            
            query_embedding = self.clip_service.encode_text(query)
            embedding_str = "[" + ",".join(str(x) for x in query_embedding.tolist()) + "]"
            
            sql = text("""
                SELECT 
                    da.id,
                    da.document_id,
                    da.file_path,
                    da.caption,
                    da.ocr_text,
                    da.asset_metadata,
                    d.title as document_title,
                    1 - (da.clip_embedding <=> :embedding::vector) as similarity_score
                FROM document_assets da
                JOIN documents d ON da.document_id = d.id
                WHERE da.asset_type = 'image'
                    AND da.clip_embedding IS NOT NULL
                    AND 1 - (da.clip_embedding <=> :embedding::vector) >= :threshold
                ORDER BY da.clip_embedding <=> :embedding::vector
                LIMIT :top_k
            """)
            
            result = db.execute(sql, {
                "embedding": embedding_str,
                "threshold": threshold,
                "top_k": top_k
            })
            
            results = []
            for row in result:
                metadata = row.asset_metadata or {}
                results.append({
                    "asset_id": row.id,
                    "document_id": row.document_id,
                    "document_title": row.document_title,
                    "file_path": row.file_path,
                    "caption": row.caption,
                    "ocr_text": row.ocr_text,
                    "page": metadata.get("page_number"),
                    "similarity_score": float(row.similarity_score),
                    "search_type": "semantic"
                })
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Global semantic search error: {e}")
            return []
    
    def calculate_similarity(
        self,
        query_embedding: np.ndarray,
        image_embeddings: np.ndarray
    ) -> np.ndarray:
        """
        Calculate cosine similarity between query and images.
        
        Args:
            query_embedding: Query embedding (1D array)
            image_embeddings: Image embeddings (2D array, N x dimension)
            
        Returns:
            Similarity scores (1D array, N elements)
        """
        if len(image_embeddings) == 0:
            return np.array([])
        
        # Ensure query is 2D for matrix multiplication
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        # Cosine similarity (embeddings are already normalized)
        similarities = np.dot(image_embeddings, query_embedding.T).flatten()
        
        return similarities
    
    def is_available(self) -> bool:
        """Check if semantic search is available."""
        return self.clip_service.is_available()


# Singleton instance
_semantic_search_service: Optional[SemanticSearchService] = None


def get_semantic_search_service() -> SemanticSearchService:
    """Get singleton instance of SemanticSearchService."""
    global _semantic_search_service
    
    if _semantic_search_service is None:
        _semantic_search_service = SemanticSearchService()
    
    return _semantic_search_service
