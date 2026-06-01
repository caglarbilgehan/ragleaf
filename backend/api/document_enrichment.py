"""
Document Enrichment API endpoints for Admin Panel
Handles CRUD operations for JSON and Q&A enrichments
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import logging

from ..database.connection_v2 import get_db
from ..database.models_v2 import DocumentEnrichment, Document
from ..auth.dependencies import get_current_admin_user
from ..database.models import User
from ..services.enrichment_service import enrichment_service
from ..services.enrichment_embedding_service import enrichment_embedding_service
from ..services.llm_enrichment_generator import llm_enrichment_generator

logger = logging.getLogger(__name__)

enrichment_router = APIRouter(prefix="/api/admin", tags=["document-enrichment"])


# === Request/Response Models ===

class EnrichmentCreateRequest(BaseModel):
    """Request model for creating an enrichment"""
    type: str  # 'json' or 'qa'
    title: str  # JSON başlık veya QA soru
    content: str  # JSON içerik veya QA cevap


class EnrichmentUpdateRequest(BaseModel):
    """Request model for updating an enrichment"""
    title: str
    content: str


class EnrichmentResponse(BaseModel):
    """Response model for an enrichment"""
    id: int
    document_id: int
    type: str
    title: str
    content: str
    embedding_chunk_id: Optional[int] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class EnrichmentListResponse(BaseModel):
    """Response model for enrichment list"""
    success: bool
    enrichments: List[EnrichmentResponse]
    total: int
    json_count: int
    qa_count: int


# === API Endpoints ===

@enrichment_router.post("/documents/{document_id}/enrichments")
async def create_enrichment(
    document_id: int,
    request: EnrichmentCreateRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create a new enrichment for a document.
    
    - **type**: 'json' for structured data, 'qa' for question-answer pairs
    - **title**: Title for JSON or question for Q&A
    - **content**: JSON content or answer
    """
    try:
        # Validate type
        if request.type not in ['json', 'qa']:
            raise HTTPException(
                status_code=400,
                detail="Geçersiz zenginleştirme tipi. 'json' veya 'qa' olmalı."
            )
        
        # Create enrichment
        enrichment = await enrichment_service.create_enrichment(
            document_id=document_id,
            enrichment_type=request.type,
            title=request.title,
            content=request.content,
            db=db
        )
        
        # Create embedding for the enrichment
        embedding_chunk = await enrichment_embedding_service.create_embedding(
            document_id=document_id,
            enrichment_id=enrichment.id,
            enrichment_type=request.type,
            title=request.title,
            content=request.content,
            db=db
        )
        
        logger.info(f"✅ Created enrichment {enrichment.id} with embedding chunk {embedding_chunk.id}")
        
        return {
            "success": True,
            "enrichment": EnrichmentResponse(
                id=enrichment.id,
                document_id=enrichment.document_id,
                type=enrichment.type,
                title=enrichment.title,
                content=enrichment.content,
                embedding_chunk_id=enrichment.embedding_chunk_id,
                created_at=enrichment.created_at.isoformat() if enrichment.created_at else "",
                updated_at=enrichment.updated_at.isoformat() if enrichment.updated_at else ""
            ),
            "embedding_chunk_id": embedding_chunk.id
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Error creating enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/documents/{document_id}/enrichments", response_model=EnrichmentListResponse)
async def get_enrichments(
    document_id: int,
    type: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all enrichments for a document.
    
    - **type**: Optional filter by type ('json' or 'qa')
    """
    try:
        # Check document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Döküman bulunamadı")
        
        # Get enrichments
        enrichments = await enrichment_service.get_enrichments(
            document_id=document_id,
            db=db,
            enrichment_type=type
        )
        
        # Get counts
        counts = await enrichment_service.get_enrichment_count(document_id, db)
        
        return EnrichmentListResponse(
            success=True,
            enrichments=[
                EnrichmentResponse(
                    id=e.id,
                    document_id=e.document_id,
                    type=e.type,
                    title=e.title,
                    content=e.content,
                    embedding_chunk_id=e.embedding_chunk_id,
                    created_at=e.created_at.isoformat() if e.created_at else "",
                    updated_at=e.updated_at.isoformat() if e.updated_at else ""
                )
                for e in enrichments
            ],
            total=counts['total'],
            json_count=counts['json'],
            qa_count=counts['qa']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching enrichments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.put("/enrichments/{enrichment_id}")
async def update_enrichment(
    enrichment_id: int,
    request: EnrichmentUpdateRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing enrichment.
    
    - **title**: New title/question
    - **content**: New content/answer
    """
    try:
        # Update enrichment
        enrichment = await enrichment_service.update_enrichment(
            enrichment_id=enrichment_id,
            title=request.title,
            content=request.content,
            db=db
        )
        
        # Update embedding
        await enrichment_embedding_service.update_embedding(
            enrichment_id=enrichment_id,
            title=request.title,
            content=request.content,
            db=db
        )
        
        logger.info(f"✅ Updated enrichment {enrichment_id}")
        
        return {
            "success": True,
            "enrichment": EnrichmentResponse(
                id=enrichment.id,
                document_id=enrichment.document_id,
                type=enrichment.type,
                title=enrichment.title,
                content=enrichment.content,
                embedding_chunk_id=enrichment.embedding_chunk_id,
                created_at=enrichment.created_at.isoformat() if enrichment.created_at else "",
                updated_at=enrichment.updated_at.isoformat() if enrichment.updated_at else ""
            )
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if "bulunamadı" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        logger.error(f"❌ Error updating enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.delete("/enrichments/{enrichment_id}")
async def delete_enrichment(
    enrichment_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Delete an enrichment and its associated embedding.
    """
    try:
        # Delete embedding first
        await enrichment_embedding_service.delete_embedding(enrichment_id, db)
        
        # Delete enrichment
        await enrichment_service.delete_enrichment(enrichment_id, db)
        
        logger.info(f"✅ Deleted enrichment {enrichment_id}")
        
        return {
            "success": True,
            "deleted_id": enrichment_id
        }
        
    except Exception as e:
        if "bulunamadı" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        logger.error(f"❌ Error deleting enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/enrichments/{enrichment_id}")
async def get_enrichment(
    enrichment_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get a single enrichment by ID.
    """
    try:
        enrichment = await enrichment_service.get_enrichment_by_id(enrichment_id, db)
        
        if not enrichment:
            raise HTTPException(status_code=404, detail="Zenginleştirme bulunamadı")
        
        return {
            "success": True,
            "enrichment": EnrichmentResponse(
                id=enrichment.id,
                document_id=enrichment.document_id,
                type=enrichment.type,
                title=enrichment.title,
                content=enrichment.content,
                embedding_chunk_id=enrichment.embedding_chunk_id,
                created_at=enrichment.created_at.isoformat() if enrichment.created_at else "",
                updated_at=enrichment.updated_at.isoformat() if enrichment.updated_at else ""
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === LLM Generation Endpoints ===

class GenerateQARequest(BaseModel):
    """Request model for Q&A generation"""
    count: int = 5  # Number of Q&A pairs to generate


class GeneratedQAResponse(BaseModel):
    """Response model for generated Q&A pairs"""
    success: bool
    qa_pairs: List[dict]
    count: int


@enrichment_router.post("/documents/{document_id}/enrichments/generate")
async def generate_qa_enrichments(
    document_id: int,
    request: GenerateQARequest = GenerateQARequest(),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Generate Q&A pairs from document content using LLM.
    
    - **count**: Number of Q&A pairs to generate (default: 5, max: 10)
    
    Returns generated Q&A pairs for preview before saving.
    """
    try:
        # Validate count
        count = min(max(request.count, 1), 10)  # Between 1 and 10
        
        # Check document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Döküman bulunamadı")
        
        # Generate Q&A pairs
        qa_pairs = await llm_enrichment_generator.generate_qa_pairs(
            document_id=document_id,
            db=db,
            count=count
        )
        
        logger.info(f"✅ Generated {len(qa_pairs)} Q&A pairs for document {document_id}")
        
        return GeneratedQAResponse(
            success=True,
            qa_pairs=qa_pairs,
            count=len(qa_pairs)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating Q&A: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/documents/{document_id}/enrichments/bulk")
async def create_bulk_enrichments(
    document_id: int,
    enrichments: List[EnrichmentCreateRequest],
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create multiple enrichments at once (for saving generated Q&A pairs).
    """
    try:
        # Check document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Döküman bulunamadı")
        
        created = []
        errors = []
        
        for idx, req in enumerate(enrichments):
            try:
                # Validate type
                if req.type not in ['json', 'qa']:
                    errors.append(f"#{idx+1}: Geçersiz tip")
                    continue
                
                # Create enrichment
                enrichment = await enrichment_service.create_enrichment(
                    document_id=document_id,
                    enrichment_type=req.type,
                    title=req.title,
                    content=req.content,
                    db=db
                )
                
                # Create embedding
                await enrichment_embedding_service.create_embedding(
                    document_id=document_id,
                    enrichment_id=enrichment.id,
                    enrichment_type=req.type,
                    title=req.title,
                    content=req.content,
                    db=db
                )
                
                created.append(enrichment.id)
                
            except Exception as e:
                errors.append(f"#{idx+1}: {str(e)}")
        
        logger.info(f"✅ Bulk created {len(created)} enrichments for document {document_id}")
        
        return {
            "success": True,
            "created_count": len(created),
            "created_ids": created,
            "errors": errors if errors else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in bulk create: {e}")
        raise HTTPException(status_code=500, detail=str(e))
