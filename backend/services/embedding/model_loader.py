from __future__ import annotations
"""
Model Loader
Handles loading and caching of embedding models
"""

import os
import logging
from typing import Optional, Dict, Any
from pathlib import Path

import numpy as np
# from sentence_transformers import SentenceTransformer  # Moved to lazy import 

logger = logging.getLogger(__name__)


class ModelLoader:
    """
    Handles loading and caching of embedding models
    
    Supports:
    - Local models (SentenceTransformer)
    - Remote models (API-based)
    - Model caching and lazy loading
    """
    
    def __init__(self, cache_dir: Optional[Path] = None):
        self.cache_dir = cache_dir
        self._models: Dict[str, SentenceTransformer] = {}
        self._model_info: Dict[str, Dict[str, Any]] = {}
    
    def load_local_model(
        self, 
        model_id: str,
        device: Optional[str] = None
    ) -> SentenceTransformer:
        """
        Load a local SentenceTransformer model
        
        Args:
            model_id: HuggingFace model ID or local path
            device: Device to load on ('cpu', 'cuda', None for auto)
        
        Returns:
            Loaded SentenceTransformer model
        """
        if model_id in self._models:
            logger.debug(f"Using cached model: {model_id}")
            return self._models[model_id]
        
        logger.info(f"🔄 Loading model: {model_id}")
        
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(
                model_id,
                cache_folder=str(self.cache_dir) if self.cache_dir else None,
                device=device
            )
            
            # Cache model
            self._models[model_id] = model
            
            # Store model info
            self._model_info[model_id] = {
                'model_id': model_id,
                'dimension': model.get_sentence_embedding_dimension(),
                'device': str(model.device),
                'type': 'local'
            }
            
            logger.info(f"✅ Model loaded: {model_id} (dim={self._model_info[model_id]['dimension']}, device={model.device})")
            
            return model
            
        except Exception as e:
            logger.error(f"❌ Failed to load model {model_id}: {e}")
            raise
    
    def get_model(self, model_id: str) -> Optional[SentenceTransformer]:
        """Get cached model if available"""
        return self._models.get(model_id)
    
    def get_model_info(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get model info if available"""
        return self._model_info.get(model_id)
    
    def get_dimension(self, model_id: str) -> Optional[int]:
        """Get model dimension if loaded"""
        info = self._model_info.get(model_id)
        return info['dimension'] if info else None
    
    def is_loaded(self, model_id: str) -> bool:
        """Check if model is loaded"""
        return model_id in self._models
    
    def unload_model(self, model_id: str) -> bool:
        """
        Unload a model to free memory
        
        Args:
            model_id: Model to unload
        
        Returns:
            True if model was unloaded
        """
        if model_id in self._models:
            logger.info(f"🗑️ Unloading model: {model_id}")
            del self._models[model_id]
            if model_id in self._model_info:
                del self._model_info[model_id]
            return True
        return False
    
    def unload_all(self):
        """Unload all models"""
        logger.info("🗑️ Unloading all models")
        self._models.clear()
        self._model_info.clear()
    
    def get_loaded_models(self) -> Dict[str, Dict[str, Any]]:
        """Get info about all loaded models"""
        return self._model_info.copy()
