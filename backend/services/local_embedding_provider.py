"""
Local Embedding Provider
Uses SentenceTransformers for local embedding generation
"""

from typing import List, Optional, Dict, Any
import numpy as np
from pathlib import Path
import logging

from sentence_transformers import SentenceTransformer
from .embedding_interface import EmbeddingInterface

logger = logging.getLogger(__name__)


class LocalEmbeddingProvider(EmbeddingInterface):
    """
    Local embedding provider using SentenceTransformers.
    Runs models locally on CPU/GPU.
    """
    
    def __init__(
        self, 
        model_id: str,
        cache_dir: Optional[str] = None,
        device: Optional[str] = None
    ):
        """
        Initialize local embedding provider.
        
        Args:
            model_id: HuggingFace model ID (e.g., "intfloat/multilingual-e5-base")
            cache_dir: Directory to cache downloaded models
            device: Device to use ('cpu', 'cuda', or None for auto-detect)
        """
        self.model_id = model_id
        self.cache_dir = cache_dir
        self.device = device
        self.model: Optional[SentenceTransformer] = None
        self._dimension: Optional[int] = None
        
        logger.info(f"LocalEmbeddingProvider initialized for model: {model_id}")
    
    def _load_model(self) -> SentenceTransformer:
        """Lazy load the model"""
        if self.model is None:
            try:
                logger.info(f"Loading local model: {self.model_id}")
                
                # Load model
                self.model = SentenceTransformer(
                    self.model_id,
                    cache_folder=self.cache_dir,
                    device=self.device
                )
                
                # Cache dimension
                self._dimension = self.model.get_sentence_embedding_dimension()
                
                device_info = self.model.device
                logger.info(f"✅ Local model loaded: {self.model_id} on {device_info}")
                logger.info(f"   Dimension: {self._dimension}")
                
            except Exception as e:
                logger.error(f"❌ Failed to load local model {self.model_id}: {e}")
                
                # Check for common network errors with HuggingFace
                error_str = str(e)
                if "HTTPSConnectionPool" in error_str or "NameResolutionError" in error_str or "cas-bridge" in error_str:
                    logger.error("🛑 NETWORK ERROR: Could not connect to HuggingFace servers.")
                    logger.error("   This often happens due to:")
                    logger.error("   1. Firewall or network restrictions blocking 'huggingface.co' or 'cas-bridge.xethub.hf.co'")
                    logger.error("   2. HuggingFace service outages")
                    logger.error("   3. DNS resolution issues from within the container")
                    logger.error("   SUGGESTION: Try setting 'HF_HUB_OFFLINE=1' env var if you have the model cached locally.")
                
                raise
        
        return self.model
    
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
            
        Returns:
            np.ndarray: Embeddings array of shape (len(texts), dimension)
        """
        if not texts:
            return np.array([]).reshape(0, self.get_dimension())
        
        model = self._load_model()
        
        logger.debug(f"Encoding {len(texts)} texts with batch_size={batch_size}")
        
        try:
            embeddings = model.encode(
                texts,
                batch_size=batch_size,
                normalize_embeddings=normalize,
                show_progress_bar=show_progress,
                convert_to_numpy=True
            )
            
            # Ensure float32 for FAISS compatibility
            embeddings = embeddings.astype('float32')
            
            logger.debug(f"✅ Created embeddings with shape: {embeddings.shape}")
            return embeddings
            
        except Exception as e:
            logger.error(f"❌ Encoding failed: {e}")
            raise
    
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
            
        Returns:
            np.ndarray: Embedding array of shape (dimension,)
        """
        embeddings = self.encode([text], batch_size=1, normalize=normalize, show_progress=False)
        return embeddings[0]
    
    def get_dimension(self) -> int:
        """
        Get embedding dimension.
        
        Returns:
            int: Embedding dimension
        """
        if self._dimension is None:
            model = self._load_model()
            self._dimension = model.get_sentence_embedding_dimension()
        return self._dimension
    
    def is_available(self) -> bool:
        """
        Check if provider is available.
        
        Returns:
            bool: True if model can be loaded
        """
        try:
            self._load_model()
            return True
        except Exception as e:
            logger.error(f"Provider not available: {e}")
            return False
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information.
        
        Returns:
            dict: Model information
        """
        info = {
            "model_id": self.model_id,
            "provider": "local",
            "deployment_type": "local",
            "dimension": self.get_dimension(),
            "device": str(self.model.device) if self.model else "not_loaded",
            "is_loaded": self.model is not None
        }
        
        return info
    
    def cleanup(self) -> None:
        """Cleanup resources"""
        if self.model is not None:
            logger.info(f"Cleaning up local model: {self.model_id}")
            del self.model
            self.model = None
            self._dimension = None
