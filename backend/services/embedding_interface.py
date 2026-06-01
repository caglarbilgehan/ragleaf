"""
Embedding Interface
Abstract base class for all embedding providers (local and remote)
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import numpy as np


class EmbeddingInterface(ABC):
    """
    Abstract interface for embedding providers.
    Supports both LOCAL (SentenceTransformers) and REMOTE (OpenAI, Cohere, etc.) providers.
    """
    
    @abstractmethod
    def encode(
        self, 
        texts: List[str], 
        batch_size: int = 32,
        normalize: bool = True,
        show_progress: bool = False,
        **kwargs
    ) -> np.ndarray:
        """
        Encode multiple texts to embeddings.
        
        Args:
            texts: List of text strings to encode
            batch_size: Batch size for encoding
            normalize: Normalize embeddings for cosine similarity
            show_progress: Show progress bar
            **kwargs: Additional provider-specific parameters
            
        Returns:
            np.ndarray: Embeddings array of shape (len(texts), dimension)
        """
        pass
    
    @abstractmethod
    def encode_single(
        self, 
        text: str, 
        normalize: bool = True,
        **kwargs
    ) -> np.ndarray:
        """
        Encode a single text to embedding.
        
        Args:
            text: Text string to encode
            normalize: Normalize embedding
            **kwargs: Additional provider-specific parameters
            
        Returns:
            np.ndarray: Embedding array of shape (dimension,)
        """
        pass
    
    @abstractmethod
    def get_dimension(self) -> int:
        """
        Get embedding dimension.
        
        Returns:
            int: Embedding dimension (e.g., 384, 768, 1024)
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if provider is available and ready.
        
        Returns:
            bool: True if provider is ready to use
        """
        pass
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information.
        
        Returns:
            dict: Model information including name, dimension, type, etc.
        """
        pass
    
    def cleanup(self) -> None:
        """
        Cleanup resources (optional).
        Override if provider needs cleanup (e.g., close connections, free memory).
        """
        pass
