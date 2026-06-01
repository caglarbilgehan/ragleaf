"""
Hybrid Search Service for Combined Text and Semantic Search
Combines text-based and CLIP semantic search for optimal results.
"""

import logging
from typing import List, Dict, Any, Optional
from collections import defaultdict

from sqlalchemy.orm import Session

from .semantic_search_service import SemanticSearchService, get_semantic_search_service

logger = logging.getLogger(__name__)


class HybridSearchService:
    """
    Service for combining text-based and semantic search.
    Uses configurable weights to balance both search methods.
    """
    
    DEFAULT_TEXT_WEIGHT = 0.3
    DEFAULT_SEMANTIC_WEIGHT = 0.7
    DUAL_MATCH_BOOST = 1.2  # 20% boost for results matching both criteria
    
    def __init__(
        self,
        semantic_service: Optional[SemanticSearchService] = None,
        text_weight: float = DEFAULT_TEXT_WEIGHT,
        semantic_weight: float = DEFAULT_SEMANTIC_WEIGHT
    ):
        """
        Initialize hybrid search service.
        
        Args:
            semantic_service: Semantic search service
            text_weight: Weight for text-based scores (default: 0.3)
            semantic_weight: Weight for semantic scores (default: 0.7)
        """
        self._semantic_service = semantic_service
        self.text_weight = text_weight
        self.semantic_weight = semantic_weight
    
    @property
    def semantic_service(self) -> SemanticSearchService:
        """Get semantic search service (lazy initialization)."""
        if self._semantic_service is None:
            self._semantic_service = get_semantic_search_service()
        return self._semantic_service
    
    def search(
        self,
        query: str,
        document_id: int,
        db: Session,
        top_k: int = 10,
        text_weight: Optional[float] = None,
        semantic_weight: Optional[float] = None,
        semantic_threshold: float = 0.2
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search combining text and semantic results.
        
        Args:
            query: Search query
            document_id: Document to search in
            db: Database session
            top_k: Maximum results
            text_weight: Override default text weight
            semantic_weight: Override default semantic weight
            semantic_threshold: Minimum semantic similarity threshold
            
        Returns:
            Combined and ranked results
        """
        from ..database.models_v2 import DocumentAsset
        
        # Use provided weights or defaults
        tw = text_weight if text_weight is not None else self.text_weight
        sw = semantic_weight if semantic_weight is not None else self.semantic_weight
        
        # Normalize weights to sum to 1.0
        total = tw + sw
        if total > 0:
            tw = tw / total
            sw = sw / total
        
        logger.info(f"🔍 Hybrid search: '{query}' (text_weight={tw:.2f}, semantic_weight={sw:.2f})")
        
        # Get text-based results
        text_results = self._text_search(query, document_id, db, top_k * 2)
        
        # Get semantic results
        semantic_results = []
        if self.semantic_service.is_available():
            semantic_results = self.semantic_service.search(
                query, document_id, db, top_k * 2, semantic_threshold
            )
        else:
            logger.warning("⚠️ Semantic search not available, using text-only")
        
        # Combine results
        combined = self._combine_scores(text_results, semantic_results, tw, sw)
        
        # Sort by combined score and limit
        combined.sort(key=lambda x: x["combined_score"], reverse=True)
        results = combined[:top_k]
        
        logger.info(f"✅ Hybrid search found {len(results)} results")
        return results

    def _text_search(
        self,
        query: str,
        document_id: int,
        db: Session,
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Perform text-based search on OCR text, caption, and tags.
        
        Args:
            query: Search query
            document_id: Document ID
            db: Database session
            limit: Maximum results
            
        Returns:
            List of text search results with scores
        """
        from ..database.models_v2 import DocumentAsset
        
        try:
            query_lower = query.lower()
            query_terms = query_lower.split()
            
            # Get all image assets for document
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id,
                DocumentAsset.asset_type == "image"
            ).all()
            
            results = []
            for asset in assets:
                score = 0.0
                matches = []
                
                # Search in OCR text
                if asset.ocr_text:
                    ocr_lower = asset.ocr_text.lower()
                    for term in query_terms:
                        if term in ocr_lower:
                            score += 2.0
                            matches.append(f"ocr:{term}")
                
                # Search in caption
                if asset.caption:
                    caption_lower = asset.caption.lower()
                    for term in query_terms:
                        if term in caption_lower:
                            score += 3.0
                            matches.append(f"caption:{term}")
                
                # Search in tags
                metadata = asset.asset_metadata or {}
                tags = metadata.get("tags", [])
                if tags:
                    tags_lower = [t.lower() for t in tags]
                    for term in query_terms:
                        if any(term in tag for tag in tags_lower):
                            score += 4.0
                            matches.append(f"tag:{term}")
                
                if score > 0:
                    results.append({
                        "asset_id": asset.id,
                        "file_path": asset.file_path,
                        "caption": asset.caption,
                        "ocr_text": asset.ocr_text,
                        "page": metadata.get("page_number"),
                        "text_score": score,
                        "matches": matches,
                        "search_type": "text"
                    })
            
            # Sort by score and limit
            results.sort(key=lambda x: x["text_score"], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"❌ Text search error: {e}")
            return []
    
    def _combine_scores(
        self,
        text_results: List[Dict],
        semantic_results: List[Dict],
        text_weight: float,
        semantic_weight: float
    ) -> List[Dict]:
        """
        Combine and normalize scores from both search methods.
        
        Args:
            text_results: Results from text search
            semantic_results: Results from semantic search
            text_weight: Weight for text scores
            semantic_weight: Weight for semantic scores
            
        Returns:
            Combined results with normalized scores
        """
        # Create lookup by asset_id
        combined_map: Dict[int, Dict] = {}
        
        # Normalize text scores to 0-1 range
        max_text_score = max((r["text_score"] for r in text_results), default=1.0)
        if max_text_score == 0:
            max_text_score = 1.0
        
        # Add text results
        for result in text_results:
            asset_id = result["asset_id"]
            normalized_text = result["text_score"] / max_text_score
            
            combined_map[asset_id] = {
                "asset_id": asset_id,
                "file_path": result["file_path"],
                "caption": result.get("caption"),
                "ocr_text": result.get("ocr_text"),
                "page": result.get("page"),
                "text_score": normalized_text,
                "semantic_score": None,
                "matches": result.get("matches", []),
                "search_type": "hybrid"
            }
        
        # Add/merge semantic results
        for result in semantic_results:
            asset_id = result["asset_id"]
            
            if asset_id in combined_map:
                # Dual match - update semantic score
                combined_map[asset_id]["semantic_score"] = result["similarity_score"]
            else:
                # Semantic only
                combined_map[asset_id] = {
                    "asset_id": asset_id,
                    "file_path": result["file_path"],
                    "caption": result.get("caption"),
                    "ocr_text": result.get("ocr_text"),
                    "page": result.get("page"),
                    "text_score": None,
                    "semantic_score": result["similarity_score"],
                    "matches": [],
                    "search_type": "hybrid"
                }
        
        # Calculate combined scores
        results = []
        for asset_id, data in combined_map.items():
            text_score = data["text_score"] or 0.0
            semantic_score = data["semantic_score"] or 0.0
            
            # Calculate weighted score
            combined_score = (text_weight * text_score) + (semantic_weight * semantic_score)
            
            # Apply dual match boost
            is_dual_match = data["text_score"] is not None and data["semantic_score"] is not None
            if is_dual_match:
                combined_score = min(combined_score * self.DUAL_MATCH_BOOST, 1.0)
            
            data["combined_score"] = combined_score
            data["is_dual_match"] = is_dual_match
            results.append(data)
        
        return results
    
    def is_available(self) -> bool:
        """Check if hybrid search is available (semantic component)."""
        return self.semantic_service.is_available()


# Singleton instance
_hybrid_search_service: Optional[HybridSearchService] = None


def get_hybrid_search_service() -> HybridSearchService:
    """Get singleton instance of HybridSearchService."""
    global _hybrid_search_service
    
    if _hybrid_search_service is None:
        _hybrid_search_service = HybridSearchService()
    
    return _hybrid_search_service
