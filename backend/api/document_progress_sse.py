# backend/api/document_progress_sse.py
"""
Server-Sent Events (SSE) endpoint for real-time document processing progress
"""

import asyncio
import json
import logging
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database.connection import get_db
from ..database.models import Document
from ..services.async_document_processor import async_document_processor
from ..services.resource_manager import resource_manager

logger = logging.getLogger(__name__)

progress_sse_router = APIRouter()


async def generate_progress_events(document_id: int, db: Session) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for document processing progress
    Yields events every 500ms until processing completes or errors
    """
    last_progress = -1
    last_stage = ""
    retry_count = 0
    max_retries = 600  # 5 minutes max (600 * 500ms)
    
    try:
        while retry_count < max_retries:
            try:
                # Expire cache to get fresh data
                db.expire_all()
                
                # Get document from database
                document = db.query(Document).filter(Document.id == document_id).first()
                
                if not document:
                    yield f"data: {json.dumps({'error': 'Document not found', 'type': 'error'})}\n\n"
                    break
                
                # Parse logs
                logs = []
                if document.processing_logs:
                    try:
                        logs = json.loads(document.processing_logs) if isinstance(document.processing_logs, str) else (document.processing_logs or [])
                    except:
                        logs = []
                
                # Check if actively processing
                is_processing = document_id in async_document_processor.processing_tasks
                
                # Build progress data
                progress_data = {
                    "type": "progress",
                    "document_id": document_id,
                    "status": document.status or "unknown",
                    "stage": document.processing_stage or "",
                    "progress": document.processing_progress or 0,
                    "details": document.processing_details or "",
                    "logs": logs[-10:] if logs else [],  # Last 10 logs
                    "is_processing": is_processing,
                    "total_chunks": document.total_chunks,
                    "total_pages": document.total_pages
                }
                
                # Only send if there's a change
                current_progress = document.processing_progress or 0
                current_stage = document.processing_stage or ""
                
                if current_progress != last_progress or current_stage != last_stage:
                    yield f"data: {json.dumps(progress_data, ensure_ascii=False)}\n\n"
                    last_progress = current_progress
                    last_stage = current_stage
                
                # Check if processing completed or errored
                if document.status in ["processed", "error", "cancelled"]:
                    # Send final status
                    final_data = {
                        "type": "complete" if document.status == "processed" else "error",
                        "document_id": document_id,
                        "status": document.status,
                        "stage": document.processing_stage or "complete",
                        "progress": 100 if document.status == "processed" else current_progress,
                        "details": document.processing_details or "",
                        "total_chunks": document.total_chunks,
                        "total_pages": document.total_pages,
                        "logs": logs[-10:] if logs else []
                    }
                    yield f"data: {json.dumps(final_data, ensure_ascii=False)}\n\n"
                    break
                
                # If not processing and status is uploaded, it might have been cancelled
                if not is_processing and document.status == "uploaded":
                    yield f"data: {json.dumps({'type': 'cancelled', 'document_id': document_id, 'status': 'uploaded'})}\n\n"
                    break
                
            except Exception as e:
                logger.error(f"❌ SSE progress error: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            
            retry_count += 1
            await asyncio.sleep(0.5)  # 500ms interval
        
        # Timeout reached
        if retry_count >= max_retries:
            yield f"data: {json.dumps({'type': 'timeout', 'message': 'Progress tracking timed out'})}\n\n"
            
    except asyncio.CancelledError:
        logger.info(f"📡 SSE connection cancelled for document {document_id}")
    except Exception as e:
        logger.error(f"❌ SSE generator error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


@progress_sse_router.get("/documents/{document_id}/progress/stream")
async def stream_document_progress(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    SSE endpoint for real-time document processing progress
    
    Usage:
        const eventSource = new EventSource('/admin/documents/123/progress/stream');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data.progress, data.stage, data.details);
        };
    """
    # Verify document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    logger.info(f"📡 SSE connection opened for document {document_id}")
    
    return StreamingResponse(
        generate_progress_events(document_id, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*"
        }
    )


@progress_sse_router.get("/processing/active")
async def get_active_processing(
    db: Session = Depends(get_db)
):
    """
    Get list of all currently processing documents
    """
    active_ids = list(async_document_processor.processing_tasks.keys())
    
    documents = []
    for doc_id in active_ids:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            documents.append({
                "id": doc.id,
                "name": doc.name,
                "status": doc.status,
                "stage": doc.processing_stage,
                "progress": doc.processing_progress or 0,
                "details": doc.processing_details
            })
    
    return {
        "active_count": len(documents),
        "documents": documents,
        "system_stats": resource_manager.get_system_stats()
    }
