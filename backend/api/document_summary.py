# backend/api/document_summary.py
"""
Document Summary API Endpoints
Generates and manages AI-powered document summaries
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database.connection import get_db
from ..services.document_summary_service import document_summary_service
import logging

logger = logging.getLogger(__name__)

summary_router = APIRouter()


class SummaryGenerateRequest(BaseModel):
    """Request model for summary generation"""
    model: Optional[str] = None
    provider: Optional[str] = None
    force_regenerate: bool = False


class SummaryResponse(BaseModel):
    """Response model for summary"""
    document_id: int
    document_name: Optional[str] = None
    summary: Optional[str] = None
    generated_at: Optional[str] = None
    has_summary: bool = False
    success: bool = True
    error: Optional[str] = None
    cached: bool = False
    model: Optional[str] = None
    provider: Optional[str] = None


@summary_router.get("/documents/{document_id}/summary", response_model=SummaryResponse)
async def get_document_summary(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Get existing summary for a document"""
    result = document_summary_service.get_summary(db, document_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Döküman bulunamadı"
        )
    
    return SummaryResponse(
        document_id=document_id,
        document_name=result.get("document_name"),
        summary=result.get("summary"),
        generated_at=result.get("generated_at"),
        has_summary=result.get("has_summary", False),
        success=True
    )


@summary_router.post("/documents/{document_id}/summary/generate", response_model=SummaryResponse)
async def generate_document_summary(
    document_id: int,
    request: Optional[SummaryGenerateRequest] = None,
    db: Session = Depends(get_db)
):
    """Generate AI summary for a document"""
    if request is None:
        request = SummaryGenerateRequest()
    
    logger.info(f"📄 Summary generation requested for document {document_id}")
    
    result = await document_summary_service.generate_summary(
        db=db,
        document_id=document_id,
        model=request.model,
        provider=request.provider,
        force_regenerate=request.force_regenerate
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Özet oluşturulamadı")
        )
    
    return SummaryResponse(
        document_id=document_id,
        summary=result.get("summary"),
        generated_at=result.get("generated_at"),
        has_summary=True,
        success=True,
        cached=result.get("cached", False),
        model=result.get("model"),
        provider=result.get("provider")
    )


@summary_router.delete("/documents/{document_id}/summary")
async def delete_document_summary(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Delete summary for a document"""
    success = document_summary_service.delete_summary(db, document_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Özet silinemedi"
        )
    
    return {"message": "Özet silindi", "document_id": document_id}
