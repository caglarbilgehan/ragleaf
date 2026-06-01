# backend/services/vision_analysis_service.py
"""
Vision Analysis Service for Multi-Modal RAG.
Handles image analysis with caching and provider management.
"""

import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
import logging

from .multimodal import (
    MultiModalProvider,
    ProviderConfig,
    ImageInput,
    VisionResponse,
    AnalysisType,
    OpenAIVisionProvider,
    AnthropicVisionProvider,
    GeminiVisionProvider,
    ImageProcessingError,
    ProviderUnavailableError,
)
from backend.database.models_v2 import ImageAnalysisCache, MultiModalSettings

logger = logging.getLogger(__name__)


class VisionAnalysisService:
    """
    Service for analyzing images using multi-modal LLMs.
    Supports caching and multiple providers.
    """
    
    def __init__(self, db: Session):
        """
        Initialize Vision Analysis Service.
        
        Args:
            db: Database session
        """
        self.db = db
        self._providers: Dict[str, MultiModalProvider] = {}
        self._settings: Optional[MultiModalSettings] = None
        self._active_provider: Optional[MultiModalProvider] = None
    
    def _load_settings(self) -> MultiModalSettings:
        """Load settings from database"""
        if self._settings is None:
            self._settings = self.db.query(MultiModalSettings).first()
            if self._settings is None:
                # Create default settings
                self._settings = MultiModalSettings(
                    enabled=False,
                    provider="openai",
                    model="gpt-4o"
                )
                self.db.add(self._settings)
                self.db.commit()
        return self._settings
    
    def _get_provider(self, provider_name: str, api_key: str, model: str = None) -> MultiModalProvider:
        """Get or create provider instance"""
        cache_key = f"{provider_name}:{model or 'default'}"
        
        if cache_key not in self._providers:
            config = ProviderConfig(
                api_key=api_key,
                model=model or "",
            )
            
            if provider_name == "openai":
                self._providers[cache_key] = OpenAIVisionProvider(config)
            elif provider_name == "anthropic":
                self._providers[cache_key] = AnthropicVisionProvider(config)
            elif provider_name == "google":
                self._providers[cache_key] = GeminiVisionProvider(config)
            else:
                raise ValueError(f"Unknown provider: {provider_name}")
        
        return self._providers[cache_key]
    
    async def get_active_provider(self, api_key: str = None) -> Optional[MultiModalProvider]:
        """
        Get the active provider based on settings.
        
        Args:
            api_key: Optional API key override
            
        Returns:
            Active provider or None if not configured
        """
        settings = self._load_settings()
        
        if not settings.enabled:
            return None
        
        if not api_key:
            # Try to get API key from environment or AI providers
            from backend.database.models_v2 import AIProvider, AIToken
            
            provider_mapping = {
                "openai": "openai",
                "anthropic": "anthropic",
                "google": "google",
            }
            
            ai_provider_name = provider_mapping.get(settings.provider)
            if ai_provider_name:
                ai_provider = self.db.query(AIProvider).filter(
                    AIProvider.name == ai_provider_name,
                    AIProvider.is_enabled == True
                ).first()
                
                if ai_provider:
                    token = self.db.query(AIToken).filter(
                        AIToken.provider_id == ai_provider.id,
                        AIToken.is_active == True
                    ).order_by(AIToken.priority).first()
                    
                    if token:
                        api_key = token.api_key
        
        if not api_key:
            logger.warning(f"⚠️ No API key found for provider: {settings.provider}")
            return None
        
        provider = self._get_provider(settings.provider, api_key, settings.model)
        provider._set_available()  # Mark as available since we have API key
        
        return provider
    
    def _compute_image_hash(self, image_path: str) -> str:
        """Compute hash for image file"""
        try:
            with open(image_path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception:
            # Fallback to path-based hash
            return hashlib.sha256(image_path.encode()).hexdigest()
    
    def _get_cached_analysis(
        self,
        image_hash: str,
        analysis_type: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached analysis if available and not expired"""
        settings = self._load_settings()
        
        if not settings.cache_enabled:
            return None
        
        cache_entry = self.db.query(ImageAnalysisCache).filter(
            ImageAnalysisCache.image_hash == image_hash,
            ImageAnalysisCache.analysis_type == analysis_type
        ).first()
        
        if cache_entry:
            # Check expiration
            if cache_entry.expires_at and cache_entry.expires_at < datetime.now(timezone.utc):
                # Expired, delete it
                self.db.delete(cache_entry)
                self.db.commit()
                return None
            
            return cache_entry.analysis_result
        
        return None
    
    def _save_to_cache(
        self,
        image_hash: str,
        analysis_type: str,
        result: Dict[str, Any],
        provider: str,
        model: str
    ) -> None:
        """Save analysis result to cache"""
        settings = self._load_settings()
        
        if not settings.cache_enabled:
            return
        
        expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.cache_ttl_hours)
        
        # Check if entry exists
        existing = self.db.query(ImageAnalysisCache).filter(
            ImageAnalysisCache.image_hash == image_hash,
            ImageAnalysisCache.analysis_type == analysis_type
        ).first()
        
        if existing:
            existing.analysis_result = result
            existing.provider = provider
            existing.model = model
            existing.expires_at = expires_at
        else:
            cache_entry = ImageAnalysisCache(
                image_hash=image_hash,
                analysis_type=analysis_type,
                analysis_result=result,
                provider=provider,
                model=model,
                expires_at=expires_at
            )
            self.db.add(cache_entry)
        
        self.db.commit()
    
    async def analyze_image(
        self,
        image_path: str,
        analysis_type: AnalysisType = AnalysisType.GENERAL,
        prompt: str = None,
        api_key: str = None
    ) -> Dict[str, Any]:
        """
        Analyze a single image.
        
        Args:
            image_path: Path to image file
            analysis_type: Type of analysis to perform
            prompt: Custom prompt (optional)
            api_key: API key override (optional)
            
        Returns:
            Analysis result with description and metadata
        """
        # Check cache first
        image_hash = self._compute_image_hash(image_path)
        cached = self._get_cached_analysis(image_hash, analysis_type.value)
        
        if cached:
            logger.info(f"📦 Using cached analysis for {image_path}")
            return {**cached, "cached": True}
        
        # Get provider
        provider = await self.get_active_provider(api_key)
        if not provider:
            raise ProviderUnavailableError("No multi-modal provider available")
        
        # Build image input
        image_input = ImageInput(image_path=image_path)
        
        # Use default prompt if not provided
        if not prompt:
            prompt = provider.get_analysis_prompt(analysis_type)
        
        # Analyze
        response = await provider.analyze_image(
            image=image_input,
            prompt=prompt,
            analysis_type=analysis_type
        )
        
        # Build result
        result = {
            "description": response.description,
            "tokens_used": response.tokens_used,
            "cost_usd": response.cost_usd,
            "provider": response.provider,
            "model": response.model,
            "analysis_type": response.analysis_type,
            "processing_time_ms": response.processing_time_ms,
        }
        
        # Save to cache
        self._save_to_cache(
            image_hash=image_hash,
            analysis_type=analysis_type.value,
            result=result,
            provider=response.provider,
            model=response.model
        )
        
        return {**result, "cached": False}
    
    async def analyze_for_rag(
        self,
        images: List[ImageInput],
        query: str,
        rag_context: str,
        api_key: str = None
    ) -> Dict[str, Any]:
        """
        Analyze images in RAG context.
        
        Args:
            images: List of images to analyze
            query: User's query
            rag_context: Retrieved text context
            api_key: API key override (optional)
            
        Returns:
            Combined analysis response
        """
        if not images:
            raise ImageProcessingError("No images provided for analysis")
        
        # Get provider
        provider = await self.get_active_provider(api_key)
        if not provider:
            raise ProviderUnavailableError("No multi-modal provider available")
        
        # Analyze with context
        response = await provider.analyze_with_context(
            images=images,
            query=query,
            context=rag_context
        )
        
        return {
            "description": response.description,
            "tokens_used": response.tokens_used,
            "cost_usd": response.cost_usd,
            "provider": response.provider,
            "model": response.model,
            "images_analyzed": len(images),
            "processing_time_ms": response.processing_time_ms,
        }
    
    def is_enabled(self) -> bool:
        """Check if multi-modal RAG is enabled"""
        settings = self._load_settings()
        return settings.enabled
    
    def get_settings(self) -> Dict[str, Any]:
        """Get current settings"""
        settings = self._load_settings()
        return {
            "enabled": settings.enabled,
            "provider": settings.provider,
            "model": settings.model,
            "max_images_per_query": settings.max_images_per_query,
            "max_image_size": settings.max_image_size,
            "include_ocr": settings.include_ocr,
            "include_caption": settings.include_caption,
            "daily_budget_usd": settings.daily_budget_usd,
            "monthly_budget_usd": settings.monthly_budget_usd,
            "cache_enabled": settings.cache_enabled,
            "cache_ttl_hours": settings.cache_ttl_hours,
        }
    
    def update_settings(self, **kwargs) -> Dict[str, Any]:
        """Update settings"""
        settings = self._load_settings()
        
        for key, value in kwargs.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
        
        settings.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        
        # Clear cached settings
        self._settings = None
        
        return self.get_settings()
    
    async def close(self):
        """Close all provider connections"""
        for provider in self._providers.values():
            await provider.close()
        self._providers.clear()
