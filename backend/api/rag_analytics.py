# backend/api/rag_analytics.py
"""
RAG Analytics API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging

from ..database.connection import get_db
from ..auth.dependencies import get_current_admin_user
from ..services.rag_analytics_service import RAGAnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/analytics", tags=["RAG Analytics"])


# ==================== Request/Response Models ====================

class FeedbackRequest(BaseModel):
    query_id: str
    rating: int  # -1 or 1
    comment: Optional[str] = None


class FeedbackResponse(BaseModel):
    success: bool
    message: str


# ==================== Admin Endpoints ====================

@router.get("/overview")
async def get_analytics_overview(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get RAG analytics overview for dashboard"""
    try:
        service = RAGAnalyticsService(db)
        return service.get_overview_stats()
    except Exception as e:
        logger.error(f"❌ Error getting analytics overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents")
async def get_document_analytics(
    period: int = 30,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get document usage analytics"""
    try:
        service = RAGAnalyticsService(db)
        return service.get_document_stats(period_days=period)
    except Exception as e:
        logger.error(f"❌ Error getting document analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queries/unfound")
async def get_unfound_queries(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get queries that didn't find relevant results"""
    try:
        service = RAGAnalyticsService(db)
        return service.get_unfound_queries(limit=limit)
    except Exception as e:
        logger.error(f"❌ Error getting unfound queries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/performance")
async def get_performance_metrics(
    period: int = 7,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get RAG performance metrics"""
    try:
        service = RAGAnalyticsService(db)
        return service.get_performance_metrics(period_days=period)
    except Exception as e:
        logger.error(f"❌ Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feedback")
async def get_feedback_stats(
    period: int = 30,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get feedback statistics"""
    try:
        service = RAGAnalyticsService(db)
        return service.get_feedback_stats(period_days=period)
    except Exception as e:
        logger.error(f"❌ Error getting feedback stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Public Feedback Endpoint ====================

feedback_router = APIRouter(prefix="/api/v2/chat", tags=["Chat Feedback"])


@feedback_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    request: FeedbackRequest,
    db: Session = Depends(get_db)
):
    """Submit feedback for a RAG response"""
    try:
        if request.rating not in [-1, 1]:
            raise HTTPException(status_code=400, detail="Rating must be -1 or 1")
        
        service = RAGAnalyticsService(db)
        result = await service.log_feedback(
            query_id=request.query_id,
            rating=request.rating,
            comment=request.comment,
        )
        
        if result:
            return FeedbackResponse(success=True, message="Geri bildiriminiz kaydedildi")
        else:
            return FeedbackResponse(success=False, message="Sorgu bulunamadı")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error submitting feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))
