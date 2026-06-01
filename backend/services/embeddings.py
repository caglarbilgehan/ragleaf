"""
Standardized Embedding Service
Single point of access for embedding models with env-based configuration
"""

import os
import logging
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from pathlib import Path

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Centralized embedding service with environment-based configuration.
    Supports CPU/GPU automatic detection and efficient batch processing.
    """

    def __init__(self, model_name: Optional[str] = None):
        """
        Initialize embedding service.

        Args:
            model_name: Model to use. If None, uses EMBEDDING_MODEL from env.
                       Default: 'intfloat/multilingual-e5-base'
        """
        self.model_name = model_name or os.getenv(
            'EMBEDDING_MODEL',
            'intfloat/multilingual-e5-base'
        )
        self.model: Optional[SentenceTransformer] = None
        self._vector_dim: Optional[int] = None

        logger.info(f"Embedding service initialized with model: {self.model_name}")

    @property
    def vector_dim(self) -> int:
        """Get vector dimension (lazy load model if needed)"""
        if self._vector_dim is None:
            model = self.get_model()
            self._vector_dim = model.get_sentence_embedding_dimension()
        return self._vector_dim

    @property
    def device(self) -> str:
        """Get device where model is loaded"""
        if self.model is None:
            return "not_loaded"
        return str(self.model.device)

    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.model is not None

    def get_model(self) -> SentenceTransformer:
        """
        Lazy load embedding model with CPU/GPU auto-detection.

        Returns:
            SentenceTransformer: Loaded model
        """
        if self.model is None:
            try:
                logger.info(f"Loading embedding model: {self.model_name}")
                self.model = SentenceTransformer(self.model_name)

                # Auto-detect device
                device = self.model.device
                logger.info(f"✅ Embedding model loaded on device: {device}")

            except Exception as e:
                logger.error(f"❌ Failed to load embedding model: {e}")
                raise

        return self.model

    def encode(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
        show_progress: bool = False
    ) -> np.ndarray:
        """
        Encode texts to embeddings with batch processing.

        Args:
            texts: List of text strings to encode
            batch_size: Batch size for encoding (default: 32)
            normalize: Normalize embeddings for cosine similarity (default: True)
            show_progress: Show progress bar (default: False)

        Returns:
            np.ndarray: Embeddings array of shape (len(texts), vector_dim)
        """
        if not texts:
            return np.array([]).reshape(0, self.vector_dim)

        model = self.get_model()

        logger.info(f"Encoding {len(texts)} texts with batch_size={batch_size}")

        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=normalize,
            show_progress_bar=show_progress,
            convert_to_numpy=True
        )

        # Ensure float32 for FAISS compatibility
        embeddings = embeddings.astype('float32')

        logger.info(f"✅ Created embeddings with shape: {embeddings.shape}")
        return embeddings

    def encode_single(self, text: str, normalize: bool = True) -> np.ndarray:
        """
        Encode a single text to embedding.

        Args:
            text: Text string to encode
            normalize: Normalize embedding for cosine similarity

        Returns:
            np.ndarray: Embedding vector of shape (vector_dim,)
        """
        embeddings = self.encode([text], batch_size=1, normalize=normalize)
        return embeddings[0]

    def encode_query(self, query: str) -> np.ndarray:
        """
        Encode query for retrieval (normalized by default).

        Args:
            query: Query string

        Returns:
            np.ndarray: Query embedding of shape (1, vector_dim)
        """
        embedding = self.encode_single(query, normalize=True)
        return embedding.reshape(1, -1)


# Global singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service(model_name: Optional[str] = None) -> EmbeddingService:
    """
    Get global embedding service instance (singleton pattern).

    Args:
        model_name: Optional model name. If provided on first call, sets the model.

    Returns:
        EmbeddingService: Global embedding service instance
    """
    global _embedding_service

    if _embedding_service is None:
        _embedding_service = EmbeddingService(model_name=model_name)

    return _embedding_service
