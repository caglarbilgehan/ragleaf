# backend/api/multimodal_rag.py
"""
Multi-Modal RAG API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import logging

from backend.database.connection_v2 import get_db
from backend.services.multimodal_rag_service import MultiModalRAGService
from backend.services.cost_tracker import CostTracker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/multimodal", tags=["Multi-Modal RAG"])


# ============================================================================
# Request/Response Models
# ============================================================================

class MultiModalSettingsUpdate(BaseModel):
    """Settings update request"""
    enabled: Optional[bool] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    max_images_per_query: Optional[int] = None
    max_image_size: Optional[int] = None
    include_ocr: Optional[bool] = None
    include_caption: Optional[bool] = None
    daily_budget_usd: Optional[float] = None
    monthly_budget_usd: Optional[float] = None
    cache_enabled: Optional[bool] = None
    cache_ttl_hours: Optional[int] = None


class ImageAnalysisRequest(BaseModel):
    """Image analysis request"""
    image_id: int
    query: str


class MultiModalChatRequest(BaseModel):
    """Multi-modal chat request"""
    query: str
    rag_context: str
    chunk_ids: Optional[List[int]] = None
    document_id: Optional[int] = None
    image_ids: Optional[List[int]] = None


# ============================================================================
# Settings Endpoints
# ============================================================================

@router.get("/settings")
async def get_multimodal_settings(db: Session = Depends(get_db)):
    """Get multi-modal RAG settings"""
    from backend.services.vision_analysis_service import VisionAnalysisService
    
    service = VisionAnalysisService(db)
    return service.get_settings()


@router.put("/settings")
async def update_multimodal_settings(
    settings: MultiModalSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Update multi-modal RAG settings"""
    from backend.services.vision_analysis_service import VisionAnalysisService
    
    service = VisionAnalysisService(db)
    
    # Filter out None values
    update_data = {k: v for k, v in settings.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No settings to update")
    
    return service.update_settings(**update_data)


# ============================================================================
# Status Endpoints
# ============================================================================

@router.get("/status")
async def get_multimodal_status(db: Session = Depends(get_db)):
    """Get multi-modal RAG service status"""
    service = MultiModalRAGService(db)
    return service.get_status()


@router.get("/providers")
async def get_available_providers():
    """Get list of available multi-modal providers"""
    return {
        "providers": [
            {
                "name": "openai",
                "display_name": "OpenAI GPT-4V",
                "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-vision-preview"],
                "default_model": "gpt-4o",
            },
            {
                "name": "anthropic",
                "display_name": "Anthropic Claude 3",
                "models": [
                    "claude-3-5-sonnet-20241022",
                    "claude-3-opus-20240229",
                    "claude-3-sonnet-20240229",
                    "claude-3-haiku-20240307",
                ],
                "default_model": "claude-3-5-sonnet-20241022",
            },
            {
                "name": "google",
                "display_name": "Google Gemini",
                "models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro-vision"],
                "default_model": "gemini-1.5-flash",
            },
        ]
    }


# ============================================================================
# Usage Endpoints
# ============================================================================

@router.get("/usage")
async def get_usage_stats(db: Session = Depends(get_db)):
    """Get multi-modal usage statistics"""
    service = MultiModalRAGService(db)
    return await service.get_usage_stats()


@router.get("/usage/daily")
async def get_daily_usage(db: Session = Depends(get_db)):
    """Get daily usage statistics"""
    tracker = CostTracker(db)
    return await tracker.get_daily_usage()


@router.get("/usage/monthly")
async def get_monthly_usage(db: Session = Depends(get_db)):
    """Get monthly usage statistics"""
    tracker = CostTracker(db)
    return await tracker.get_monthly_usage()


@router.get("/usage/by-provider")
async def get_usage_by_provider(days: int = 30, db: Session = Depends(get_db)):
    """Get usage breakdown by provider"""
    tracker = CostTracker(db)
    return await tracker.get_usage_by_provider(days=days)


@router.get("/usage/recent")
async def get_recent_usage(limit: int = 50, db: Session = Depends(get_db)):
    """Get recent usage records"""
    tracker = CostTracker(db)
    return await tracker.get_recent_usage(limit=limit)


@router.get("/budget")
async def get_budget_status(db: Session = Depends(get_db)):
    """Get budget status"""
    tracker = CostTracker(db)
    return await tracker.get_remaining_budget()


# ============================================================================
# Analysis Endpoints
# ============================================================================

@router.post("/analyze-image")
async def analyze_image(
    request: ImageAnalysisRequest,
    db: Session = Depends(get_db)
):
    """Analyze a specific image with a query"""
    service = MultiModalRAGService(db)
    
    result = await service.analyze_specific_image(
        image_id=request.image_id,
        query=request.query,
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Analysis failed")
        )
    
    return result


@router.post("/chat")
async def multimodal_chat(
    request: MultiModalChatRequest,
    db: Session = Depends(get_db)
):
    """Process a multi-modal RAG chat request"""
    service = MultiModalRAGService(db)
    
    result = await service.process_query_with_images(
        query=request.query,
        rag_context=request.rag_context,
        chunk_ids=request.chunk_ids,
        document_id=request.document_id,
        image_ids=request.image_ids,
    )
    
    return result


# ============================================================================
# Cache Management
# ============================================================================

@router.delete("/cache")
async def clear_analysis_cache(db: Session = Depends(get_db)):
    """Clear image analysis cache"""
    from backend.database.models_v2 import ImageAnalysisCache
    
    deleted = db.query(ImageAnalysisCache).delete()
    db.commit()
    
    return {
        "success": True,
        "deleted_entries": deleted,
    }


@router.get("/cache/stats")
async def get_cache_stats(db: Session = Depends(get_db)):
    """Get cache statistics"""
    from backend.database.models_v2 import ImageAnalysisCache
    from sqlalchemy import func
    
    total = db.query(func.count(ImageAnalysisCache.id)).scalar()
    
    by_type = db.query(
        ImageAnalysisCache.analysis_type,
        func.count(ImageAnalysisCache.id)
    ).group_by(ImageAnalysisCache.analysis_type).all()
    
    return {
        "total_entries": total,
        "by_type": {t: c for t, c in by_type},
    }
