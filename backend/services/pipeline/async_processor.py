"""
Async Document Processor - Wrapper for DocumentPipeline
Handles async task management, resource control, and database session management
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

from .document_pipeline import document_pipeline, PipelineConfig
from ..resource_manager import resource_manager

logger = logging.getLogger(__name__)


class AsyncPipelineProcessor:
    """
    Async wrapper for DocumentPipeline
    Manages task lifecycle, resources, and database sessions
    """
    
    def __init__(self):
        self.processing_tasks: Dict[int, asyncio.Task] = {}
        self.pipeline = document_pipeline
    
    async def process_document(
        self, 
        document_id: int, 
        db: Session
    ) -> Dict[str, Any]:
        """
        Start async document processing
        
        Args:
            document_id: Database document ID
            db: SQLAlchemy session (used only for initial validation)
        
        Returns:
            Dict with success status and message
        """
        try:
            # Import here to avoid circular imports
            from ...database.models import Document
            
            # Validate document exists
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return {"success": False, "error": "Document not found"}
            
            # Check if already processing
            if document_id in self.processing_tasks:
                task = self.processing_tasks[document_id]
                if not (task.done() or task.cancelled()):
                    return {"success": False, "error": "Document is already being processed"}
                del self.processing_tasks[document_id]
            
            # Check system resources
            can_start, reason = resource_manager.can_start_task()
            if not can_start:
                return {"success": False, "error": f"System resources insufficient: {reason}"}
            
            # Get document info for processing
            folder_name = document.folder_name
            original_filename = document.original_filename
            
            # Start async task
            logger.info(f"🚀 Starting pipeline for document {document_id}")
            task = asyncio.create_task(
                self._run_pipeline(document_id, folder_name, original_filename)
            )
            self.processing_tasks[document_id] = task
            
            return {
                "success": True, 
                "message": "Processing started", 
                "document_id": document_id
            }
            
        except Exception as e:
            logger.error(f"❌ Error starting processing for document {document_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def _run_pipeline(
        self, 
        document_id: int, 
        folder_name: str,
        original_filename: str
    ):
        """Run the document pipeline with proper resource management"""
        task_acquired = False
        
        try:
            # Acquire task slot
            task_acquired = await resource_manager.acquire_task_slot()
            if not task_acquired:
                logger.error(f"Could not acquire task slot for document {document_id}")
                self._update_error(document_id, "Could not acquire processing slot")
                return
            
            # Construct file path
            file_path = Path(f"./documents/{folder_name}/original/{original_filename}").resolve()
            
            if not file_path.exists():
                logger.error(f"❌ File not found: {file_path}")
                self._update_error(document_id, f"File not found: {file_path}")
                return
            
            # Get fresh database session
            from ...database.connection import get_db
            db_session = next(get_db())
            
            try:
                # Run pipeline
                result = await self.pipeline.process(
                    document_id=document_id,
                    file_path=file_path,
                    folder_name=folder_name,
                    db=db_session
                )
                
                if result.success:
                    logger.info(f"✅ Document {document_id} processed: {result.chunks_created} chunks")
                else:
                    logger.error(f"❌ Document {document_id} failed: {result.error}")
                    
            finally:
                db_session.close()
                
        except asyncio.CancelledError:
            logger.warning(f"⚠️ Processing cancelled for document {document_id}")
            self._update_error(document_id, "Processing cancelled")
            
        except Exception as e:
            logger.error(f"❌ Pipeline error for document {document_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self._update_error(document_id, str(e))
            
        finally:
            # Release resources
            if task_acquired:
                resource_manager.release_task_slot()
            
            # Cleanup task tracking
            if document_id in self.processing_tasks:
                del self.processing_tasks[document_id]
    
    def _update_error(self, document_id: int, error_message: str):
        """Update document with error status using SQLAlchemy"""
        try:
            from ...database.connection import SessionLocal
            from ...database.models import Document
            
            db = SessionLocal()
            try:
                document = db.query(Document).filter(Document.id == document_id).first()
                if document:
                    document.status = "error"
                    document.processing_details = f"❌ Hata: {error_message}"
                    document.updated_at = datetime.now()
                    db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to update error status: {e}")
    
    # Control methods
    async def pause(self, document_id: int) -> bool:
        """Pause document processing"""
        return self.pipeline.pause(document_id)
    
    async def resume(self, document_id: int) -> bool:
        """Resume document processing"""
        return self.pipeline.resume(document_id)
    
    async def cancel(self, document_id: int) -> bool:
        """Cancel document processing"""
        if document_id in self.processing_tasks:
            self.pipeline.cancel(document_id)
            task = self.processing_tasks[document_id]
            task.cancel()
            
            # Cleanup
            resource_manager.optimize_memory()
            del self.processing_tasks[document_id]
            
            logger.info(f"Document {document_id} processing cancelled")
            return True
        return False
    
    def get_status(self, document_id: int) -> Dict[str, Any]:
        """Get processing status for a document"""
        is_processing = document_id in self.processing_tasks
        task = self.processing_tasks.get(document_id)
        
        return {
            "is_processing": is_processing,
            "task_done": task.done() if task else True,
            "task_cancelled": task.cancelled() if task else False,
            "system_stats": resource_manager.get_system_stats()
        }


# Global instance
async_pipeline_processor = AsyncPipelineProcessor()
