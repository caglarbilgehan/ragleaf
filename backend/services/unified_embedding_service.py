"""
Unified Embedding Service
Manages both local and remote embedding providers
"""

from typing import List, Optional, Dict, Any
import numpy as np
from sqlalchemy.orm import Session
import logging
import os

from .embedding_interface import EmbeddingInterface
from .local_embedding_provider import LocalEmbeddingProvider
from .remote_embedding_provider import RemoteEmbeddingProvider
from ..database.models import EmbeddingModel

logger = logging.getLogger(__name__)


class UnifiedEmbeddingService:
    """
    Unified service for managing embedding providers.
    Automatically selects between local and remote providers based on model configuration.
    """
    
    def __init__(self):
        """Initialize unified embedding service"""
        self._providers: Dict[str, EmbeddingInterface] = {}
        self._active_model_id: Optional[str] = None
        logger.info("UnifiedEmbeddingService initialized")
    
    def _get_provider(
        self, 
        model: EmbeddingModel,
        db: Optional[Session] = None
    ) -> EmbeddingInterface:
        """
        Get or create provider for a model.
        
        Args:
            model: EmbeddingModel instance
            db: Database session (for future use)
            
        Returns:
            EmbeddingInterface: Provider instance
        """
        model_id = model.model_id
        
        # Return cached provider if exists
        if model_id in self._providers:
            logger.debug(f"Using cached provider for {model_id}")
            return self._providers[model_id]
        
        # Create new provider based on deployment type
        logger.info(f"Creating new provider for {model_id} (type: {model.deployment_type})")
        
        if model.deployment_type == "local":
            provider = LocalEmbeddingProvider(
                model_id=model_id,
                cache_dir=None,  # Use default cache
                device=None  # Auto-detect
            )
        elif model.deployment_type == "remote":
            # Check if API key is required
            if model.requires_api_key:
                api_key_env_var = model.api_key_env_var
                api_key = os.getenv(api_key_env_var) if api_key_env_var else None
                
                if not api_key:
                    raise ValueError(
                        f"API key required for {model_id} but {api_key_env_var} not set in environment"
                    )
            else:
                api_key = None
            
            provider = RemoteEmbeddingProvider(
                model_id=model_id,
                api_endpoint=model.api_endpoint,
                api_key=api_key
            )
        else:
            raise ValueError(f"Unknown deployment type: {model.deployment_type}")
        
        # Cache provider
        self._providers[model_id] = provider
        
        return provider
    
    def get_active_model(self, db: Session) -> EmbeddingModel:
        """
        Get the active (default) embedding model.
        
        Args:
            db: Database session
            
        Returns:
            EmbeddingModel: Active model
        """
        model = db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True,
            EmbeddingModel.is_active == True
        ).first()
        
        if not model:
            # Fallback to first active model
            model = db.query(EmbeddingModel).filter(
                EmbeddingModel.is_active == True
            ).first()
        
        if not model:
            raise ValueError("No active embedding model found in database")
        
        return model
    
    def encode(
        self, 
        texts: List[str],
        model_id: Optional[str] = None,
        db: Optional[Session] = None,
        batch_size: int = 32,
        normalize: bool = True,
        show_progress: bool = False,
        **kwargs
    ) -> np.ndarray:
        """
        Encode texts using specified or default model.
        
        Args:
            texts: List of text strings to encode
            model_id: Model ID to use (None = use default)
            db: Database session
            batch_size: Batch size for encoding
            normalize: Normalize embeddings
            show_progress: Show progress bar
            
        Returns:
            np.ndarray: Embeddings array
        """
        if not texts:
            # Need dimension, so get model first
            if db:
                model = self.get_active_model(db) if not model_id else db.query(EmbeddingModel).filter(
                    EmbeddingModel.model_id == model_id
                ).first()
                if model:
                    provider = self._get_provider(model, db)
                    return np.array([]).reshape(0, provider.get_dimension())
            return np.array([])
        
        # Get model from database
        if db:
            if model_id:
                model = db.query(EmbeddingModel).filter(
                    EmbeddingModel.model_id == model_id
                ).first()
                if not model:
                    raise ValueError(f"Model not found: {model_id}")
            else:
                model = self.get_active_model(db)
        else:
            raise ValueError("Database session required for unified embedding service")
        
        # Get provider
        provider = self._get_provider(model, db)
        
        # Encode
        logger.info(f"Encoding {len(texts)} texts with {model.model_id}")
        embeddings = provider.encode(
            texts,
            batch_size=batch_size,
            normalize=normalize,
            show_progress=show_progress,
            **kwargs
        )
        
        return embeddings
    
    def encode_single(
        self, 
        text: str,
        model_id: Optional[str] = None,
        db: Optional[Session] = None,
        normalize: bool = True,
        **kwargs
    ) -> np.ndarray:
        """
        Encode a single text.
        
        Args:
            text: Text string to encode
            model_id: Model ID to use (None = use default)
            db: Database session
            normalize: Normalize embedding
            
        Returns:
            np.ndarray: Embedding array
        """
        embeddings = self.encode(
            [text],
            model_id=model_id,
            db=db,
            batch_size=1,
            normalize=normalize,
            show_progress=False,
            **kwargs
        )
        return embeddings[0]
    
    def change_model(
        self, 
        new_model_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Change the active embedding model.
        
        Args:
            new_model_id: New model ID to activate
            db: Database session
            
        Returns:
            dict: Change result with status and affected documents
        """
        # Get new model
        new_model = db.query(EmbeddingModel).filter(
            EmbeddingModel.model_id == new_model_id
        ).first()
        
        if not new_model:
            raise ValueError(f"Model not found: {new_model_id}")
        
        if not new_model.is_active:
            raise ValueError(f"Model is not active: {new_model_id}")
        
        # Get current default model
        current_default = db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True
        ).first()
        
        # Check if already default
        if current_default and current_default.model_id == new_model_id:
            return {
                "success": True,
                "message": f"{new_model_id} is already the default model",
                "requires_reindex": False,
                "affected_documents": 0
            }
        
        # Unset current default
        if current_default:
            current_default.is_default = False
        
        # Set new default
        new_model.is_default = True
        
        # Count documents that need reindexing
        from ..database.models import Document
        affected_docs = db.query(Document).filter(
            Document.embedding_model_id != new_model.id
        ).count()
        
        db.commit()
        
        logger.info(f"✅ Changed default embedding model to {new_model_id}")
        logger.info(f"   {affected_docs} documents may need reindexing")
        
        return {
            "success": True,
            "message": f"Default model changed to {new_model_id}",
            "requires_reindex": affected_docs > 0,
            "affected_documents": affected_docs,
            "old_model": current_default.model_id if current_default else None,
            "new_model": new_model_id
        }
    
    def get_model_info(
        self, 
        model_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Get information about a model.
        
        Args:
            model_id: Model ID
            db: Database session
            
        Returns:
            dict: Model information
        """
        model = db.query(EmbeddingModel).filter(
            EmbeddingModel.model_id == model_id
        ).first()
        
        if not model:
            raise ValueError(f"Model not found: {model_id}")
        
        # Get provider info
        provider = self._get_provider(model, db)
        provider_info = provider.get_model_info()
        
        # Combine with database info
        info = {
            "id": model.id,
            "model_id": model.model_id,
            "display_name": model.display_name,
            "description": model.description,
            "dimension": model.dimension,
            "deployment_type": model.deployment_type,
            "is_default": model.is_default,
            "is_active": model.is_active,
            "is_downloaded": model.is_downloaded,
            "provider_info": provider_info
        }
        
        return info
    
    def cleanup(self, model_id: Optional[str] = None) -> None:
        """
        Cleanup providers.
        
        Args:
            model_id: Specific model to cleanup (None = cleanup all)
        """
        if model_id:
            if model_id in self._providers:
                logger.info(f"Cleaning up provider: {model_id}")
                self._providers[model_id].cleanup()
                del self._providers[model_id]
        else:
            logger.info("Cleaning up all providers")
            for provider in self._providers.values():
                provider.cleanup()
            self._providers.clear()


# Singleton instance
_unified_service: Optional[UnifiedEmbeddingService] = None

def get_unified_embedding_service() -> UnifiedEmbeddingService:
    """Get singleton instance of unified embedding service"""
    global _unified_service
    if _unified_service is None:
        _unified_service = UnifiedEmbeddingService()
    return _unified_service
