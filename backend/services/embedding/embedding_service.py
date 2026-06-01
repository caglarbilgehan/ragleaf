"""
Unified Embedding Service
Single service for all embedding operations
Replaces: embeddings.py, professional_embedding_service.py (embedding parts), unified_embedding_service.py

Supports three deployment types:
- local: Load model directly in API container (slow, high memory)
- remote: External API (OpenAI, Cohere, etc.)
- microservice: Internal embedding-service container (recommended for Docker)
"""

import os
import logging
from typing import List, Optional, Dict, Any

import numpy as np
import httpx
from sqlalchemy.orm import Session

from .model_loader import ModelLoader

logger = logging.getLogger(__name__)

# Embedding service URL (Docker internal)
EMBEDDING_SERVICE_URL = os.getenv("EMBEDDING_SERVICE_URL", "http://embedding-service:8002")


class EmbeddingService:
    """
    Unified embedding service
    
    Provides a single interface for:
    - Loading embedding models (local and remote)
    - Encoding texts to embeddings
    - Batch processing with progress
    - Model management
    """
    
    def __init__(self):
        self.model_loader = ModelLoader()
        self._active_model_id: Optional[str] = None
        self._active_dimension: Optional[int] = None
    
    def get_active_model(self, db: Session) -> 'EmbeddingModel':
        """
        Get the active embedding model from database
        
        Args:
            db: SQLAlchemy session
        
        Returns:
            Active EmbeddingModel
        """
        from ...database.models import EmbeddingModel
        
        # Try default model first
        model = db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True,
            EmbeddingModel.is_active == True
        ).first()
        
        if not model:
            # Fallback to any active model
            model = db.query(EmbeddingModel).filter(
                EmbeddingModel.is_active == True
            ).first()
        
        if not model:
            raise ValueError(
                "No active embedding model found. "
                "Please configure an embedding model in admin panel."
            )
        
        return model
    
    def encode(
        self,
        texts: List[str],
        db: Session,
        model_id: Optional[str] = None,
        batch_size: int = 32,
        normalize: bool = True,
        show_progress: bool = False
    ) -> np.ndarray:
        """
        Encode texts to embeddings
        
        Args:
            texts: List of text strings
            db: SQLAlchemy session
            model_id: Specific model to use (None = use active model)
            batch_size: Batch size for encoding
            normalize: Normalize embeddings for cosine similarity
            show_progress: Show progress bar
        
        Returns:
            np.ndarray of shape (len(texts), dimension)
        """
        # Get model
        if model_id:
            from ...database.models import EmbeddingModel
            model = db.query(EmbeddingModel).filter(
                EmbeddingModel.model_id == model_id
            ).first()
            if not model:
                raise ValueError(f"Model not found: {model_id}")
        else:
            model = self.get_active_model(db)
        
        # Handle empty input
        if not texts:
            return np.array([]).reshape(0, model.dimension)
        
        # Route to appropriate encoder based on deployment type
        if model.deployment_type == "local":
            return self._encode_local(
                texts, model, batch_size, normalize, show_progress
            )
        elif model.deployment_type == "remote":
            return self._encode_remote(
                texts, model, batch_size, normalize
            )
        elif model.deployment_type == "microservice":
            return self._encode_microservice(
                texts, model, batch_size, normalize
            )
        else:
            raise ValueError(f"Unknown deployment type: {model.deployment_type}")
    
    def _encode_microservice(
        self,
        texts: List[str],
        model: 'EmbeddingModel',
        batch_size: int,
        normalize: bool
    ) -> np.ndarray:
        """
        Encode using internal embedding-service microservice (Docker).
        This is the recommended approach for Docker deployments.
        
        The embedding-service runs as a separate container with the model
        pre-loaded, providing fast inference without loading models in API.
        """
        import time
        start_time = time.time()
        
        logger.info(f"🚀 Encoding {len(texts)} texts via microservice ({EMBEDDING_SERVICE_URL})")
        
        try:
            # Use httpx for HTTP requests (sync client)
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    f"{EMBEDDING_SERVICE_URL}/embed",
                    json={
                        "texts": texts,
                        "use_cache": True
                    }
                )
                response.raise_for_status()
                
                result = response.json()
                embeddings = np.array(result["embeddings"], dtype='float32')
                
                duration = time.time() - start_time
                cache_hits = result.get("cache_hits", 0)
                
                logger.info(
                    f"✅ Microservice embeddings: {embeddings.shape} "
                    f"({duration:.2f}s, cache_hits={cache_hits})"
                )
                
                # Update active model tracking
                self._active_model_id = model.model_id
                self._active_dimension = result.get("dimensions", model.dimension)
                
                return embeddings
                
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ Microservice HTTP error: {e.response.status_code} - {e.response.text}")
            raise ValueError(f"Embedding service error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"❌ Microservice connection error: {e}")
            raise ValueError(f"Cannot connect to embedding service at {EMBEDDING_SERVICE_URL}")
    
    def _encode_local(
        self,
        texts: List[str],
        model: 'EmbeddingModel',
        batch_size: int,
        normalize: bool,
        show_progress: bool
    ) -> np.ndarray:
        """Encode using local SentenceTransformer model"""
        
        # Load model
        st_model = self.model_loader.load_local_model(model.model_id)
        
        logger.info(f"📝 Encoding {len(texts)} texts with {model.model_id}")
        
        # Encode
        embeddings = st_model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=normalize,
            show_progress_bar=show_progress,
            convert_to_numpy=True
        )
        
        # Ensure float32 for FAISS compatibility
        embeddings = embeddings.astype('float32')
        
        logger.info(f"✅ Created embeddings: {embeddings.shape}")
        
        # Update active model tracking
        self._active_model_id = model.model_id
        self._active_dimension = model.dimension
        
        return embeddings
    
    def _encode_remote(
        self,
        texts: List[str],
        model: 'EmbeddingModel',
        batch_size: int,
        normalize: bool
    ) -> np.ndarray:
        """Encode using remote API"""
        
        # Get API key
        api_key = None
        if model.requires_api_key and model.api_key_env_var:
            api_key = os.getenv(model.api_key_env_var)
            if not api_key:
                raise ValueError(
                    f"API key required for {model.model_id} but "
                    f"{model.api_key_env_var} not set"
                )
        
        # Import remote provider
        from ..remote_embedding_provider import RemoteEmbeddingProvider
        
        provider = RemoteEmbeddingProvider(
            model_id=model.model_id,
            api_endpoint=model.api_endpoint,
            api_key=api_key
        )
        
        logger.info(f"📝 Encoding {len(texts)} texts with remote model {model.model_id}")
        
        embeddings = provider.encode(
            texts,
            batch_size=batch_size,
            normalize=normalize
        )
        
        # Update active model tracking
        self._active_model_id = model.model_id
        self._active_dimension = model.dimension
        
        return embeddings
    
    def encode_single(
        self,
        text: str,
        db: Session,
        model_id: Optional[str] = None,
        normalize: bool = True
    ) -> np.ndarray:
        """
        Encode a single text
        
        Args:
            text: Text string
            db: SQLAlchemy session
            model_id: Specific model to use
            normalize: Normalize embedding
        
        Returns:
            np.ndarray of shape (dimension,)
        """
        embeddings = self.encode(
            [text], db, model_id, 
            batch_size=1, normalize=normalize
        )
        return embeddings[0]
    
    def encode_query(
        self,
        query: str,
        db: Session,
        model_id: Optional[str] = None
    ) -> np.ndarray:
        """
        Encode query for retrieval (normalized, reshaped for search)
        
        Args:
            query: Query string
            db: SQLAlchemy session
            model_id: Specific model to use
        
        Returns:
            np.ndarray of shape (1, dimension)
        """
        embedding = self.encode_single(query, db, model_id, normalize=True)
        return embedding.reshape(1, -1)
    
    @property
    def active_model_id(self) -> Optional[str]:
        """Get currently active model ID"""
        return self._active_model_id
    
    @property
    def active_dimension(self) -> Optional[int]:
        """Get dimension of active model"""
        return self._active_dimension
    
    def get_model_info(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get info about a loaded model"""
        return self.model_loader.get_model_info(model_id)
    
    def unload_model(self, model_id: str) -> bool:
        """Unload a model to free memory"""
        return self.model_loader.unload_model(model_id)
    
    def unload_all(self):
        """Unload all models"""
        self.model_loader.unload_all()
        self._active_model_id = None
        self._active_dimension = None
    
    def change_model(
        self, 
        new_model_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Change the active (default) embedding model.
        
        Args:
            new_model_id: New model ID to activate
            db: Database session
            
        Returns:
            dict: Change result with status and affected documents
        """
        from ...database.models import EmbeddingModel, Document
        
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


# Global instance
embedding_service = EmbeddingService()
