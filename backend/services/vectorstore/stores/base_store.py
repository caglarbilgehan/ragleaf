"""
Base Vector Store
Abstract base class for vector store implementations
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import numpy as np


@dataclass
class SearchResult:
    """Result from vector search"""
    id: str
    text: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'text': self.text,
            'score': self.score,
            **self.metadata
        }


class BaseVectorStore(ABC):
    """Abstract base class for vector stores"""
    
    name: str = "base"
    
    @abstractmethod
    def add(
        self,
        ids: List[str],
        embeddings: np.ndarray,
        texts: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> int:
        """
        Add vectors to the store
        
        Args:
            ids: Unique identifiers for each vector
            embeddings: Embedding vectors (n_vectors, dimension)
            texts: Original text for each vector
            metadatas: Optional metadata for each vector
        
        Returns:
            Number of vectors added
        """
        pass
    
    @abstractmethod
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """
        Search for similar vectors
        
        Args:
            query_embedding: Query vector (1, dimension) or (dimension,)
            top_k: Number of results to return
            filter_metadata: Optional metadata filter
        
        Returns:
            List of SearchResult objects
        """
        pass
    
    @abstractmethod
    def delete(
        self,
        ids: Optional[List[str]] = None,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Delete vectors from the store
        
        Args:
            ids: Specific IDs to delete
            filter_metadata: Delete by metadata filter
        
        Returns:
            Number of vectors deleted
        """
        pass
    
    @abstractmethod
    def count(self) -> int:
        """Get total number of vectors in store"""
        pass
    
    @abstractmethod
    def clear(self) -> bool:
        """Clear all vectors from store"""
        pass
    
    def get_stats(self) -> Dict[str, Any]:
        """Get store statistics"""
        return {
            'name': self.name,
            'count': self.count()
        }
