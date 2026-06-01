"""
Document Pipeline API Router
Provides endpoints for the 3-stage document processing pipeline.

Endpoints:
- POST /admin/documents/{id}/process - Stage 1: Parse and chunk
- POST /admin/documents/{id}/index - Stage 3: Generate embeddings
- POST /admin/documents/{id}/reindex - Re-generate embeddings
- GET /admin/documents/{id}/pipeline-status - Get pipeline status

Requirements: 7.1-7.6
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from ..database.connection_v2 import get_db
from ..database.models_v2 import Document
from ..services.document_pipeline_service import document_pipeline_service
from ..auth.dependencies import get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/documents", tags=["document-pipeline"])


# ============================================================================
# Request/Response Models
# ============================================================================

class ProcessRequest(BaseModel):
    """Request model for process endpoint"""
    reextract_images: bool = False
    rerun_ocr: bool = False


class IndexRequest(BaseModel):
    """Request model for index endpoint"""
    batch_size: int = 32


class ReindexRequest(BaseModel):
    """Request model for reindex endpoint"""
    batch_size: int = 32


class PipelineResponse(BaseModel):
    """Response model for pipeline operations"""
    success: bool
    document_id: int
    status: str
    message: str
    details: Optional[dict] = None


class PipelineStatusResponse(BaseModel):
    """Response model for pipeline status"""
    document_id: int
    document_name: str
    status: str
    processing_stage: Optional[str]
    processing_progress: Optional[int]
    processing_details: Optional[str]
    vector_indexed: bool
    statistics: dict
    available_actions: dict
    timestamps: dict


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/{document_id}/process", response_model=PipelineResponse)
async def process_document(
    document_id: int,
    request: ProcessRequest = ProcessRequest(),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Stage 1: Process document (parse, extract text/images, OCR, chunk).
    
    This endpoint:
    - Parses the PDF document
    - Extracts text and images
    - Runs OCR on images
    - Creates chunks
    - Does NOT generate embeddings (that's Stage 3)
    
    Status transitions:
    - uploaded → processing → processed
    - error → processing → processed (retry)
    - indexed → processing → processed (reprocess)
    
    Args:
        document_id: ID of document to process
        request: Processing options
    
    Returns:
        PipelineResponse with operation status
    """
    logger.info(f"🚀 Process request for document {document_id} by user {current_user.username}")
    
    # Validate document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if can process
    can_process, error = document_pipeline_service.can_process(document)
    if not can_process:
        raise HTTPException(status_code=400, detail=error)
    
    # Start processing
    result = await document_pipeline_service.process_document(document_id, db)
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.message)
    
    return PipelineResponse(
        success=result.success,
        document_id=result.document_id,
        status=result.status,
        message=result.message,
        details=result.details
    )


@router.post("/{document_id}/index", response_model=PipelineResponse)
async def index_document(
    document_id: int,
    request: IndexRequest = IndexRequest(),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Stage 3: Index document (generate embeddings from enriched content).
    
    This endpoint:
    - Builds enriched content for each chunk (original + enrichments)
    - Generates embeddings using the embedding service
    - Stores embeddings in PgVector
    - Makes document available for RAG queries
    
    Status transitions:
    - processed → indexing → indexed
    - enriched → indexing → indexed
    
    Args:
        document_id: ID of document to index
        request: Indexing options (batch_size)
    
    Returns:
        PipelineResponse with operation status
    """
    logger.info(f"🚀 Index request for document {document_id} by user {current_user.username}")
    
    # Validate document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if can index
    can_index, error = document_pipeline_service.can_index(document)
    if not can_index:
        raise HTTPException(status_code=400, detail=error)
    
    # Start indexing
    result = await document_pipeline_service.index_document(
        document_id, db, batch_size=request.batch_size
    )
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.message)
    
    return PipelineResponse(
        success=result.success,
        document_id=result.document_id,
        status=result.status,
        message=result.message,
        details=result.details
    )


@router.post("/{document_id}/reindex", response_model=PipelineResponse)
async def reindex_document(
    document_id: int,
    request: ReindexRequest = ReindexRequest(),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Re-index document (clear existing embeddings and regenerate).
    
    Use this when:
    - Enrichment data has been updated
    - Embedding model has changed
    - User wants to refresh embeddings
    
    This endpoint:
    - Clears existing embeddings (sets to NULL)
    - Rebuilds enriched content with latest enrichments
    - Generates new embeddings
    - Updates PgVector
    
    Status transitions:
    - indexed → indexing → indexed
    - enriched → indexing → indexed
    - processed → indexing → indexed
    
    Args:
        document_id: ID of document to re-index
        request: Re-indexing options (batch_size)
    
    Returns:
        PipelineResponse with operation status
    """
    logger.info(f"🔄 Reindex request for document {document_id} by user {current_user.username}")
    
    # Validate document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check status
    if document.status not in ['indexed', 'enriched', 'processed']:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot re-index document with status '{document.status}'. Must be processed, enriched, or indexed."
        )
    
    # Start re-indexing
    result = await document_pipeline_service.reindex_document(
        document_id, db, batch_size=request.batch_size
    )
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.message)
    
    return PipelineResponse(
        success=result.success,
        document_id=result.document_id,
        status=result.status,
        message=result.message,
        details=result.details
    )


@router.get("/{document_id}/pipeline-status", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    document_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get comprehensive pipeline status for a document.
    
    Returns:
    - Current status and processing progress
    - Chunk/enrichment/indexing statistics
    - Available actions (can_process, can_index, can_reindex)
    - Timestamps
    
    Args:
        document_id: ID of document
    
    Returns:
        PipelineStatusResponse with detailed status information
    """
    status = document_pipeline_service.get_pipeline_status(document_id, db)
    
    if "error" in status:
        raise HTTPException(status_code=404, detail=status["error"])
    
    return PipelineStatusResponse(**status)


# ============================================================================
# Batch Operations (Optional - for future use)
# ============================================================================

class BatchIndexRequest(BaseModel):
    """Request model for batch index operation"""
    document_ids: list[int]
    batch_size: int = 32


class BatchIndexResponse(BaseModel):
    """Response model for batch index operation"""
    total: int
    successful: int
    failed: int
    results: list[PipelineResponse]


@router.post("/batch/index", response_model=BatchIndexResponse)
async def batch_index_documents(
    request: BatchIndexRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Index multiple documents in batch.
    
    Useful for:
    - Initial indexing of all processed documents
    - Re-indexing after embedding model update
    
    Args:
        request: List of document IDs and batch size
    
    Returns:
        BatchIndexResponse with results for each document
    """
    logger.info(f"📦 Batch index request for {len(request.document_ids)} documents by user {current_user.username}")
    
    results = []
    successful = 0
    failed = 0
    
    for doc_id in request.document_ids:
        try:
            result = await document_pipeline_service.index_document(
                doc_id, db, batch_size=request.batch_size
            )
            
            results.append(PipelineResponse(
                success=result.success,
                document_id=result.document_id,
                status=result.status,
                message=result.message,
                details=result.details
            ))
            
            if result.success:
                successful += 1
            else:
                failed += 1
                
        except Exception as e:
            logger.error(f"❌ Batch index failed for document {doc_id}: {e}")
            results.append(PipelineResponse(
                success=False,
                document_id=doc_id,
                status="error",
                message=str(e)
            ))
            failed += 1
    
    return BatchIndexResponse(
        total=len(request.document_ids),
        successful=successful,
        failed=failed,
        results=results
    )
