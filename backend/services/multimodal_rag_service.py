# backend/services/multimodal_rag_service.py
"""
Multi-Modal RAG Service.
Integrates vision analysis with RAG for image-enhanced responses.
"""

import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging

from .vision_analysis_service import VisionAnalysisService
from .image_context_manager import ImageContextManager
from .cost_tracker import CostTracker
from .multimodal import (
    ImageInput,
    BudgetExceededError,
    ProviderUnavailableError,
    ImageProcessingError,
)
from backend.database.models_v2 import MultiModalSettings

logger = logging.getLogger(__name__)


class MultiModalRAGService:
    """
    Multi-Modal RAG Service.
    Combines vision analysis with RAG for image-enhanced responses.
    """
    
    def __init__(self, db: Session):
        """
        Initialize Multi-Modal RAG Service.
        
        Args:
            db: Database session
        """
        self.db = db
        self.vision_service = VisionAnalysisService(db)
        self.image_manager = ImageContextManager(db)
        self.cost_tracker = CostTracker(db)
        self._settings: Optional[MultiModalSettings] = None
    
    def _load_settings(self) -> MultiModalSettings:
        """Load settings from database"""
        if self._settings is None:
            self._settings = self.db.query(MultiModalSettings).first()
            if self._settings is None:
                self._settings = MultiModalSettings(enabled=False)
                self.db.add(self._settings)
                self.db.commit()
        return self._settings
    
    def is_enabled(self) -> bool:
        """Check if multi-modal RAG is enabled"""
        settings = self._load_settings()
        return settings.enabled
    
    async def process_query_with_images(
        self,
        query: str,
        rag_context: str,
        chunk_ids: List[int] = None,
        document_id: int = None,
        image_ids: List[int] = None,
        user_id: int = None,
    ) -> Dict[str, Any]:
        """
        Process RAG query with image context.
        
        Args:
            query: User's query
            rag_context: Retrieved text context from RAG
            chunk_ids: Optional list of chunk IDs (to get related images)
            document_id: Optional document ID (to search for relevant images)
            image_ids: Optional explicit list of image asset IDs
            user_id: Optional user ID for tracking
            
        Returns:
            Enhanced response with vision analysis
        """
        settings = self._load_settings()
        
        if not settings.enabled:
            logger.info("⚠️ Multi-modal RAG is disabled, returning text-only response")
            return {
                "multimodal_enabled": False,
                "fallback_reason": "disabled",
                "vision_response": None,
            }
        
        # Generate query ID for tracking
        query_id = str(uuid.uuid4())[:8]
        
        try:
            # Get images to analyze
            images = await self._get_images_for_query(
                query=query,
                chunk_ids=chunk_ids,
                document_id=document_id,
                image_ids=image_ids,
            )
            
            if not images:
                logger.info("📷 No images found for query")
                return {
                    "multimodal_enabled": True,
                    "fallback_reason": "no_images",
                    "vision_response": None,
                }
            
            # Get provider and estimate cost
            provider = await self.vision_service.get_active_provider()
            if not provider:
                logger.warning("⚠️ No multi-modal provider available")
                return {
                    "multimodal_enabled": True,
                    "fallback_reason": "no_provider",
                    "vision_response": None,
                }
            
            # Estimate cost
            estimated_cost = provider.estimate_cost(
                images=images,
                prompt_tokens=len(rag_context.split()) * 2,  # Rough estimate
                max_output_tokens=settings.max_images_per_query * 500
            )
            
            # Check budget
            try:
                await self.cost_tracker.check_budget(estimated_cost)
            except BudgetExceededError as e:
                logger.warning(f"⚠️ Budget exceeded: {e}")
                return {
                    "multimodal_enabled": True,
                    "fallback_reason": "budget_exceeded",
                    "vision_response": None,
                    "error": str(e),
                }
            
            # Analyze images with RAG context
            result = await self.vision_service.analyze_for_rag(
                images=images,
                query=query,
                rag_context=rag_context,
            )
            
            # Log usage
            await self.cost_tracker.log_usage(
                provider=result["provider"],
                model=result["model"],
                tokens_used=result["tokens_used"],
                cost_usd=result["cost_usd"],
                image_count=result["images_analyzed"],
                query_id=query_id,
                user_id=user_id,
            )
            
            return {
                "multimodal_enabled": True,
                "fallback_reason": None,
                "vision_response": result["description"],
                "images_analyzed": result["images_analyzed"],
                "tokens_used": result["tokens_used"],
                "cost_usd": result["cost_usd"],
                "provider": result["provider"],
                "model": result["model"],
                "processing_time_ms": result["processing_time_ms"],
                "query_id": query_id,
            }
            
        except ProviderUnavailableError as e:
            logger.error(f"❌ Provider unavailable: {e}")
            return {
                "multimodal_enabled": True,
                "fallback_reason": "provider_error",
                "vision_response": None,
                "error": str(e),
            }
        except ImageProcessingError as e:
            logger.error(f"❌ Image processing error: {e}")
            return {
                "multimodal_enabled": True,
                "fallback_reason": "image_error",
                "vision_response": None,
                "error": str(e),
            }
        except Exception as e:
            logger.error(f"❌ Unexpected error in multi-modal RAG: {e}")
            return {
                "multimodal_enabled": True,
                "fallback_reason": "unexpected_error",
                "vision_response": None,
                "error": str(e),
            }
    
    async def _get_images_for_query(
        self,
        query: str,
        chunk_ids: List[int] = None,
        document_id: int = None,
        image_ids: List[int] = None,
    ) -> List[ImageInput]:
        """
        Get images for the query from various sources.
        
        Priority:
        1. Explicit image_ids
        2. Images from chunk_ids
        3. Relevant images from document_id
        """
        settings = self._load_settings()
        max_images = settings.max_images_per_query
        
        # 1. Explicit image IDs
        if image_ids:
            return self.image_manager.prepare_images_from_assets(
                asset_ids=image_ids[:max_images]
            )
        
        # 2. Images from chunks
        if chunk_ids:
            asset_ids = self.image_manager.get_images_for_chunks(
                chunk_ids=chunk_ids,
                max_count=max_images
            )
            if asset_ids:
                return self.image_manager.prepare_images_from_assets(
                    asset_ids=asset_ids
                )
        
        # 3. Relevant images from document
        if document_id:
            asset_ids = self.image_manager.select_relevant_images(
                query=query,
                document_id=document_id,
                max_count=max_images
            )
            if asset_ids:
                return self.image_manager.prepare_images_from_assets(
                    asset_ids=asset_ids
                )
        
        return []
    
    async def analyze_specific_image(
        self,
        image_id: int,
        query: str,
        user_id: int = None,
    ) -> Dict[str, Any]:
        """
        Analyze a specific image with a query.
        
        Args:
            image_id: Asset ID of the image
            query: User's query about the image
            user_id: Optional user ID for tracking
            
        Returns:
            Analysis result
        """
        settings = self._load_settings()
        
        if not settings.enabled:
            return {
                "success": False,
                "error": "Multi-modal RAG is disabled",
            }
        
        query_id = str(uuid.uuid4())[:8]
        
        try:
            # Prepare image
            images = self.image_manager.prepare_images_from_assets(
                asset_ids=[image_id]
            )
            
            if not images:
                return {
                    "success": False,
                    "error": "Image not found",
                }
            
            # Get provider
            provider = await self.vision_service.get_active_provider()
            if not provider:
                return {
                    "success": False,
                    "error": "No multi-modal provider available",
                }
            
            # Estimate and check budget
            estimated_cost = provider.estimate_cost(
                images=images,
                prompt_tokens=len(query.split()) * 2,
                max_output_tokens=1000
            )
            
            await self.cost_tracker.check_budget(estimated_cost)
            
            # Analyze
            from .multimodal import AnalysisType
            result = await self.vision_service.analyze_image(
                image_path=images[0].image_path,
                analysis_type=AnalysisType.GENERAL,
                prompt=query,
            )
            
            # Log usage
            await self.cost_tracker.log_usage(
                provider=result["provider"],
                model=result["model"],
                tokens_used=result["tokens_used"],
                cost_usd=result["cost_usd"],
                image_count=1,
                query_id=query_id,
                user_id=user_id,
            )
            
            return {
                "success": True,
                "analysis": result["description"],
                "tokens_used": result["tokens_used"],
                "cost_usd": result["cost_usd"],
                "cached": result.get("cached", False),
                "query_id": query_id,
            }
            
        except BudgetExceededError as e:
            return {
                "success": False,
                "error": f"Budget exceeded: {e}",
            }
        except Exception as e:
            logger.error(f"❌ Error analyzing image: {e}")
            return {
                "success": False,
                "error": str(e),
            }
    
    def get_status(self) -> Dict[str, Any]:
        """Get service status"""
        settings = self._load_settings()
        
        return {
            "enabled": settings.enabled,
            "provider": settings.provider,
            "model": settings.model,
            "max_images_per_query": settings.max_images_per_query,
            "max_image_size": settings.max_image_size,
            "cache_enabled": settings.cache_enabled,
        }
    
    async def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics"""
        daily = await self.cost_tracker.get_daily_usage()
        monthly = await self.cost_tracker.get_monthly_usage()
        budget = await self.cost_tracker.get_remaining_budget()
        
        return {
            "daily": daily,
            "monthly": monthly,
            "budget": budget,
        }
    
    async def close(self):
        """Close service connections"""
        await self.vision_service.close()
