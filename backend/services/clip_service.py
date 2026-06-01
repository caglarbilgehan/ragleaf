"""
CLIP Service for Semantic Image Search
Provides image and text embedding generation using OpenAI CLIP model.
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image
import torch

logger = logging.getLogger(__name__)

# Singleton instance
_clip_service: Optional["CLIPService"] = None

# LRU Cache for text embeddings (frequently used queries)
@lru_cache(maxsize=256)
def _cached_text_embedding(text: str, model_name: str) -> tuple:
    """Cache text embeddings as tuples (hashable)."""
    service = get_clip_service(model_name)
    if service._model is None:
        service._load_model()
    embedding = service._encode_text_internal(text)
    return tuple(embedding.tolist())


class CLIPServiceError(Exception):
    """Base exception for CLIP service errors"""
    pass


class CLIPModelLoadError(CLIPServiceError):
    """Raised when CLIP model fails to load"""
    pass


class CLIPEncodingError(CLIPServiceError):
    """Raised when encoding fails"""
    pass


class CLIPService:
    """
    CLIP model service for generating image and text embeddings.
    Singleton pattern with lazy loading.
    
    Uses OpenAI CLIP model (ViT-B/32) for generating 512-dimensional embeddings.
    Supports both GPU and CPU processing with automatic device detection.
    """
    
    SUPPORTED_MODELS = {
        "ViT-B/32": 512,   # Fast, good quality
        "ViT-B/16": 512,   # Better quality, slower
        "ViT-L/14": 768,   # Best quality, slowest
    }
    
    def __init__(self, model_name: str = "ViT-B/32", device: Optional[str] = None):
        """
        Initialize CLIP service.
        
        Args:
            model_name: CLIP model variant (ViT-B/32, ViT-B/16, ViT-L/14)
            device: cuda or cpu (auto-detect if None)
        """
        self.model_name = model_name
        self._model = None
        self._preprocess = None
        self._device = None
        self._is_available = False
        self._load_error: Optional[str] = None
        
        # Validate model name
        if model_name not in self.SUPPORTED_MODELS:
            raise ValueError(f"Unsupported model: {model_name}. Supported: {list(self.SUPPORTED_MODELS.keys())}")
        
        self._dimension = self.SUPPORTED_MODELS[model_name]
        
        # Set device
        if device:
            self._device = device
        else:
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
        
        logger.info(f"🖼️ CLIPService initialized (model={model_name}, device={self._device})")
    
    def _load_model(self) -> bool:
        """
        Lazy load CLIP model.
        
        Returns:
            True if model loaded successfully, False otherwise
        """
        if self._model is not None:
            return True
        
        try:
            import clip
            
            logger.info(f"📥 Loading CLIP model: {self.model_name}...")
            self._model, self._preprocess = clip.load(self.model_name, device=self._device)
            self._model.eval()  # Set to evaluation mode
            self._is_available = True
            logger.info(f"✅ CLIP model loaded successfully on {self._device}")
            return True
            
        except ImportError as e:
            self._load_error = f"CLIP library not installed: {e}"
            logger.error(f"❌ {self._load_error}")
            logger.error("   Install with: pip install git+https://github.com/openai/CLIP.git")
            return False
            
        except Exception as e:
            self._load_error = f"Failed to load CLIP model: {e}"
            logger.error(f"❌ {self._load_error}")
            return False
    
    def is_available(self) -> bool:
        """
        Check if CLIP service is available.
        
        Returns:
            True if model is loaded and ready
        """
        if self._model is None:
            self._load_model()
        return self._is_available
    
    def get_dimension(self) -> int:
        """Get embedding dimension for current model."""
        return self._dimension
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information including dimension and device.
        
        Returns:
            Dictionary with model info
        """
        return {
            "model_name": self.model_name,
            "dimension": self._dimension,
            "device": self._device,
            "is_available": self.is_available(),
            "load_error": self._load_error,
            "gpu_available": torch.cuda.is_available(),
            "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        }
    
    def encode_image(self, image_path: str) -> np.ndarray:
        """
        Generate normalized embedding for a single image.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Normalized embedding vector (512 or 768 dim based on model)
            
        Raises:
            CLIPModelLoadError: If model fails to load
            CLIPEncodingError: If encoding fails
        """
        if not self._load_model():
            raise CLIPModelLoadError(self._load_error or "Failed to load CLIP model")
        
        try:
            import clip
            
            # Load and preprocess image
            image_path = Path(image_path)
            if not image_path.exists():
                raise CLIPEncodingError(f"Image file not found: {image_path}")
            
            image = Image.open(image_path).convert("RGB")
            image_input = self._preprocess(image).unsqueeze(0).to(self._device)
            
            # Generate embedding
            with torch.no_grad():
                image_features = self._model.encode_image(image_input)
                # Normalize embedding (L2 normalization)
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            # Convert to numpy
            embedding = image_features.cpu().numpy().flatten()
            
            return embedding
            
        except CLIPEncodingError:
            raise
        except Exception as e:
            raise CLIPEncodingError(f"Failed to encode image {image_path}: {e}")
    
    def encode_images_batch(
        self, 
        image_paths: List[str], 
        batch_size: int = 32
    ) -> np.ndarray:
        """
        Generate embeddings for multiple images.
        
        Args:
            image_paths: List of image file paths
            batch_size: Batch size for processing
            
        Returns:
            Array of normalized embeddings (N x dimension)
            
        Raises:
            CLIPModelLoadError: If model fails to load
            CLIPEncodingError: If encoding fails
        """
        if not self._load_model():
            raise CLIPModelLoadError(self._load_error or "Failed to load CLIP model")
        
        if not image_paths:
            return np.array([]).reshape(0, self._dimension)
        
        try:
            all_embeddings = []
            failed_indices = []
            
            # Process in batches
            for i in range(0, len(image_paths), batch_size):
                batch_paths = image_paths[i:i + batch_size]
                batch_images = []
                batch_valid_indices = []
                
                # Load images in batch
                for j, path in enumerate(batch_paths):
                    try:
                        image_path = Path(path)
                        if not image_path.exists():
                            logger.warning(f"⚠️ Image not found: {path}")
                            failed_indices.append(i + j)
                            continue
                        
                        image = Image.open(image_path).convert("RGB")
                        batch_images.append(self._preprocess(image))
                        batch_valid_indices.append(i + j)
                        
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to load image {path}: {e}")
                        failed_indices.append(i + j)
                
                if not batch_images:
                    continue
                
                # Stack and encode batch
                image_input = torch.stack(batch_images).to(self._device)
                
                with torch.no_grad():
                    image_features = self._model.encode_image(image_input)
                    # Normalize embeddings
                    image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                
                batch_embeddings = image_features.cpu().numpy()
                all_embeddings.append(batch_embeddings)
            
            if not all_embeddings:
                return np.array([]).reshape(0, self._dimension)
            
            embeddings = np.vstack(all_embeddings)
            
            if failed_indices:
                logger.warning(f"⚠️ {len(failed_indices)} images failed to process")
            
            return embeddings
            
        except Exception as e:
            raise CLIPEncodingError(f"Failed to encode image batch: {e}")
    
    def _encode_text_internal(self, text: str) -> np.ndarray:
        """Internal text encoding without caching."""
        import clip
        
        text_input = clip.tokenize([text], truncate=True).to(self._device)
        
        with torch.no_grad():
            text_features = self._model.encode_text(text_input)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        
        return text_features.cpu().numpy().flatten()
    
    def encode_text(self, text: str, use_cache: bool = True) -> np.ndarray:
        """
        Generate normalized embedding for text query.
        
        Args:
            text: Text query string
            use_cache: Whether to use LRU cache for repeated queries
            
        Returns:
            Normalized embedding vector (512 or 768 dim based on model)
            
        Raises:
            CLIPModelLoadError: If model fails to load
            CLIPEncodingError: If encoding fails
        """
        if not self._load_model():
            raise CLIPModelLoadError(self._load_error or "Failed to load CLIP model")
        
        try:
            if use_cache:
                # Use cached version
                cached_tuple = _cached_text_embedding(text, self.model_name)
                return np.array(cached_tuple, dtype=np.float32)
            else:
                return self._encode_text_internal(text)
            
        except Exception as e:
            raise CLIPEncodingError(f"Failed to encode text: {e}")
    
    def encode_texts_batch(
        self, 
        texts: List[str], 
        batch_size: int = 32
    ) -> np.ndarray:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of text strings
            batch_size: Batch size for processing
            
        Returns:
            Array of normalized embeddings (N x dimension)
        """
        if not self._load_model():
            raise CLIPModelLoadError(self._load_error or "Failed to load CLIP model")
        
        if not texts:
            return np.array([]).reshape(0, self._dimension)
        
        try:
            import clip
            
            all_embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                
                # Tokenize batch
                text_input = clip.tokenize(batch_texts, truncate=True).to(self._device)
                
                with torch.no_grad():
                    text_features = self._model.encode_text(text_input)
                    text_features = text_features / text_features.norm(dim=-1, keepdim=True)
                
                batch_embeddings = text_features.cpu().numpy()
                all_embeddings.append(batch_embeddings)
            
            return np.vstack(all_embeddings)
            
        except Exception as e:
            raise CLIPEncodingError(f"Failed to encode text batch: {e}")
    
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
    
    def cleanup(self) -> None:
        """Release model resources."""
        if self._model is not None:
            del self._model
            del self._preprocess
            self._model = None
            self._preprocess = None
            self._is_available = False
            
            # Clear CUDA cache if using GPU
            if self._device == "cuda":
                torch.cuda.empty_cache()
            
            logger.info("🧹 CLIP model resources released")


def get_clip_service(model_name: str = "ViT-B/32") -> CLIPService:
    """
    Get singleton instance of CLIP service.
    
    Args:
        model_name: CLIP model variant
        
    Returns:
        CLIPService instance
    """
    global _clip_service
    
    if _clip_service is None:
        _clip_service = CLIPService(model_name=model_name)
    
    return _clip_service


def reset_clip_service() -> None:
    """Reset singleton instance (useful for testing)."""
    global _clip_service
    
    if _clip_service is not None:
        _clip_service.cleanup()
        _clip_service = None
