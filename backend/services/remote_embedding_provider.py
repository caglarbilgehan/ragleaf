"""
Remote Embedding Provider
Placeholder for future remote API integration (OpenAI, Cohere, etc.)
"""

from typing import List, Optional, Dict, Any
import numpy as np
import logging

from .embedding_interface import EmbeddingInterface

logger = logging.getLogger(__name__)


class RemoteEmbeddingProvider(EmbeddingInterface):
    """
    Remote embedding provider for API-based services.
    
    FUTURE IMPLEMENTATION:
    - OpenAI text-embedding-3-small, text-embedding-3-large
    - Cohere embed-multilingual-v3.0
    - HuggingFace Inference API
    """
    
    def __init__(
        self, 
        model_id: str,
        api_endpoint: str,
        api_key: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize remote embedding provider.
        
        Args:
            model_id: Remote model ID
            api_endpoint: API endpoint URL
            api_key: API key for authentication
        """
        self.model_id = model_id
        self.api_endpoint = api_endpoint
        self.api_key = api_key
        self.kwargs = kwargs
        
        logger.warning(f"RemoteEmbeddingProvider is not yet implemented for {model_id}")
        logger.info("This is a placeholder for future remote embedding support")
    
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
        
        NOT YET IMPLEMENTED - Will be added in future phases.
        """
        raise NotImplementedError(
            "Remote embedding provider is not yet implemented. "
            "This feature will be added in future updates. "
            "Please use local embedding models for now."
        )
    
    def encode_single(
        self, 
        text: str, 
        normalize: bool = True,
        **kwargs
    ) -> np.ndarray:
        """
        Encode a single text to embedding.
        
        NOT YET IMPLEMENTED - Will be added in future phases.
        """
        raise NotImplementedError(
            "Remote embedding provider is not yet implemented. "
            "This feature will be added in future updates. "
            "Please use local embedding models for now."
        )
    
    def get_dimension(self) -> int:
        """
        Get embedding dimension.
        
        NOT YET IMPLEMENTED - Will be added in future phases.
        """
        raise NotImplementedError(
            "Remote embedding provider is not yet implemented."
        )
    
    def is_available(self) -> bool:
        """
        Check if provider is available.
        
        Returns:
            bool: False (not implemented yet)
        """
        return False
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information.
        
        Returns:
            dict: Model information
        """
        return {
            "model_id": self.model_id,
            "provider": "remote",
            "deployment_type": "remote",
            "api_endpoint": self.api_endpoint,
            "status": "not_implemented",
            "message": "Remote embedding support coming in future updates"
        }
    
    def cleanup(self) -> None:
        """Cleanup resources"""
        pass


# FUTURE IMPLEMENTATION NOTES:
# 
# class OpenAIEmbeddingProvider(RemoteEmbeddingProvider):
#     """OpenAI embedding provider"""
#     
#     def encode(self, texts, **kwargs):
#         # Use openai.Embedding.create()
#         pass
# 
# class CohereEmbeddingProvider(RemoteEmbeddingProvider):
#     """Cohere embedding provider"""
#     
#     def encode(self, texts, **kwargs):
#         # Use cohere.embed()
#         pass
