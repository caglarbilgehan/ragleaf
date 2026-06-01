"""
Async Document Processor
Asynchronous document processing with progress tracking

⚠️ DEPRECATED: This module is deprecated and will be removed in a future version.
Use backend/services/pipeline/async_processor.py instead.

Migration guide:
    from backend.services.pipeline import async_pipeline_processor
    result = await async_pipeline_processor.process_document(document_id, db)
"""

import warnings
warnings.warn(
    "async_document_processor is deprecated. Use pipeline.async_processor instead.",
    DeprecationWarning,
    stacklevel=2
)

import asyncio
import os
import time
import json
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database.models import Document
from .document_processor import DocumentProcessor
from .vector_service import vector_service
from .resource_manager import resource_manager
from .document_storage import document_storage
from .professional_embedding_service_v2 import professional_embedding_service_v2
from .professional_document_processor import professional_document_processor
import logging

logger = logging.getLogger(__name__)

# Note: This module uses PostgreSQL via SQLAlchemy (no longer SQLite)
logger.info("📁 AsyncDocumentProcessor using PostgreSQL via SQLAlchemy")

# Semaphore for limiting concurrent CLIP embedding operations
CLIP_EMBEDDING_SEMAPHORE = asyncio.Semaphore(2)  # Max 2 concurrent CLIP operations

class AsyncDocumentProcessor:
    def __init__(self):
        self.document_processor = DocumentProcessor()
        self.processing_tasks = {}  # Track running tasks
        self.paused_tasks = {}     # Track paused tasks
        self.task_controls = {}    # Control flags for tasks
        
    async def process_document_async(self, document_id: int, db: Session) -> Dict[str, Any]:
        """Process document asynchronously with progress tracking and resource management"""
        try:
            # Get document
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return {"success": False, "error": "Document not found"}
            
            # Clear any stuck processing tasks for this document
            if document_id in self.processing_tasks:
                old_task = self.processing_tasks[document_id]
                if old_task.done() or old_task.cancelled():
                    del self.processing_tasks[document_id]
                    print(f"🧹 Cleared completed task for document {document_id}")
                else:
                    return {"success": False, "error": "Document is already being processed"}
            
            # Check system resources
            can_start, reason = resource_manager.can_start_task()
            if not can_start:
                return {"success": False, "error": f"System resources insufficient: {reason}"}
            
            # Initialize task controls
            self.task_controls[document_id] = {
                "paused": False,
                "cancelled": False,
                "pause_event": asyncio.Event()
            }
            self.task_controls[document_id]["pause_event"].set()  # Start unpaused
            
            # Start async processing
            print(f"🚀 Creating async task for document {document_id}")
            task = asyncio.create_task(self._process_document_with_progress(document_id, db))
            self.processing_tasks[document_id] = task
            print(f"✅ Task created and stored for document {document_id}")
            
            return {"success": True, "message": "Processing started", "document_id": document_id}
            
        except Exception as e:
            logger.error(f"Error starting async processing for document {document_id}: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _process_document_with_progress(self, document_id: int, db: Session):
        """Internal method to process document with simplified approach"""
        print(f"🔄 _process_document_with_progress started for document {document_id}")
        task_acquired = False
        
        try:
            # Acquire task slot
            task_acquired = await resource_manager.acquire_task_slot()
            if not task_acquired:
                logger.error(f"Could not acquire task slot for document {document_id}")
                return
            
            # Run processing in thread to avoid session issues
            import asyncio
            import concurrent.futures
            
            async def run_sync_processing():
                """Run synchronous processing with PostgreSQL via SQLAlchemy"""
                # Use fresh SQLAlchemy session for background task
                from ..database.connection import get_db
                db_session = next(get_db())
                
                try:
                    # İlk log kaydı - işlem başladı
                    timestamp = datetime.now().isoformat()
                    initial_log = [{
                        "timestamp": timestamp,
                        "level": "info",
                        "stage": "initialization",
                        "progress": 0,
                        "message": "🚀 Döküman işleme başlatıldı!"
                    }]
                    
                    db_session.execute(text("""
                        UPDATE documents 
                        SET status = 'processing', 
                            processing_stage = 'initialization',
                            processing_progress = 0,
                            processing_details = '🚀 Döküman işleme başlatıldı!',
                            processing_logs = :logs,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :doc_id
                    """), {"logs": json.dumps(initial_log, ensure_ascii=False), "doc_id": document_id})
                    db_session.commit()
                    print(f"📊 [Doc:{document_id}] İlk progress kaydı yapıldı")
                    
                    # Get document info
                    result = db_session.execute(text(
                        "SELECT folder_name, original_filename FROM documents WHERE id = :doc_id"
                    ), {"doc_id": document_id}).fetchone()
                    
                    if not result:
                        raise Exception("Document not found")
                    
                    folder_name, original_filename = result[0], result[1]
                    # Construct file path from folder_name and original_filename
                    file_path = Path(f"./documents/{folder_name}/original/{original_filename}").resolve()
                    
                    print(f"📁 [Doc:{document_id}] Dosya yolu: {file_path}")
                    
                    if not file_path.exists():
                        raise Exception(f"File not found: {file_path}")
                    
                    # İkinci log - dosya bulundu
                    timestamp = datetime.now().isoformat()
                    initial_log.append({
                        "timestamp": timestamp,
                        "level": "info",
                        "stage": "initialization",
                        "progress": 5,
                        "message": f"📄 Dosya bulundu: {original_filename}"
                    })
                    
                    db_session.execute(text("""
                        UPDATE documents 
                        SET processing_stage = 'initialization',
                            processing_progress = 5,
                            processing_details = :details,
                            processing_logs = :logs,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :doc_id
                    """), {
                        "details": f"📄 Dosya bulundu: {original_filename}",
                        "logs": json.dumps(initial_log, ensure_ascii=False),
                        "doc_id": document_id
                    })
                    db_session.commit()
                    
                    # Progress callback with PostgreSQL update
                    def progress_callback(data):
                        stage = data.get('stage', 'Unknown')
                        progress = data.get('progress', 0)
                        details = data.get('details', '')
                        print(f"📊 Progress: {stage} - {progress}% - {details}")
                        
                        # Create log entry
                        timestamp = datetime.now().isoformat()
                        log_entry = {
                            "timestamp": timestamp,
                            "level": "info",
                            "stage": stage,
                            "progress": progress,
                            "message": details
                        }
                        
                        # Get existing logs from PostgreSQL
                        result = db_session.execute(text(
                            "SELECT processing_logs FROM documents WHERE id = :doc_id"
                        ), {"doc_id": document_id}).fetchone()
                        
                        existing_logs = []
                        if result and result[0]:
                            try:
                                existing_logs = json.loads(result[0]) if isinstance(result[0], str) else result[0]
                            except:
                                existing_logs = []
                        
                        # Append new log entry (keep last 50 logs)
                        existing_logs.append(log_entry)
                        if len(existing_logs) > 50:
                            existing_logs = existing_logs[-50:]
                        
                        # Update PostgreSQL database
                        db_session.execute(text("""
                            UPDATE documents 
                            SET processing_stage = :stage,
                                processing_progress = :progress,
                                processing_details = :details,
                                processing_logs = :logs,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = :doc_id
                        """), {
                            "stage": stage,
                            "progress": progress,
                            "details": details,
                            "logs": json.dumps(existing_logs, ensure_ascii=False),
                            "doc_id": document_id
                        })
                        db_session.commit()
                    
                    try:
                        print(f"🚀 Starting professional document processing for: {file_path}")
                        
                        # Pass task controls to professional processor for pause/cancel support
                        professional_document_processor.set_task_controls(self.task_controls)
                        
                        result = await professional_document_processor.process_document_advanced(
                            document_id, file_path, db_session
                        )
                        
                        print(f"✅ Professional document processing result: {result.get('success', False)}")
                        
                        if result.get('success'):
                            # Generate CLIP embeddings for extracted images (async, non-blocking)
                            try:
                                from .image_embedding_service import get_image_embedding_service
                                embedding_service = get_image_embedding_service()
                                
                                if embedding_service.clip_service.is_available():
                                    # Use semaphore to limit concurrent CLIP operations
                                    async with CLIP_EMBEDDING_SEMAPHORE:
                                        logger.info(f"🖼️ Generating CLIP embeddings for document {document_id}")
                                        clip_result = await embedding_service.generate_embeddings_for_document(
                                            document_id, db_session
                                        )
                                        logger.info(f"✅ CLIP embeddings: {clip_result.get('success', 0)} generated, {clip_result.get('failed', 0)} failed")
                                else:
                                    logger.info(f"⏭️ CLIP service not available, skipping embedding generation")
                            except Exception as clip_error:
                                logger.warning(f"⚠️ CLIP embedding generation failed (non-critical): {clip_error}")
                            
                            return {"success": True, "message": f"Document processed successfully: {result.get('total_chunks', 0)} chunks, {result.get('images_extracted', 0)} images"}
                        else:
                            return {"success": False, "error": result.get('error', 'Professional processing failed')}
                    
                    finally:
                        db_session.close()
                        
                except Exception as e:
                    logger.error(f"❌ Processing error for document {document_id}: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    
                    # Update PostgreSQL database with error
                    try:
                        # Get existing logs and add error
                        result = db_session.execute(text(
                            "SELECT processing_logs FROM documents WHERE id = :doc_id"
                        ), {"doc_id": document_id}).fetchone()
                        
                        existing_logs = []
                        if result and result[0]:
                            try:
                                existing_logs = json.loads(result[0]) if isinstance(result[0], str) else result[0]
                            except:
                                existing_logs = []
                        
                        existing_logs.append({
                            "timestamp": datetime.now().isoformat(),
                            "level": "error",
                            "stage": "error",
                            "progress": 0,
                            "message": f"❌ Hata: {str(e)}"
                        })
                        
                        db_session.execute(text("""
                            UPDATE documents 
                            SET status = 'error',
                                processing_details = :details,
                                processing_logs = :logs,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = :doc_id
                        """), {
                            "details": f"❌ Hata: {str(e)}",
                            "logs": json.dumps(existing_logs, ensure_ascii=False),
                            "doc_id": document_id
                        })
                        db_session.commit()
                    except Exception as db_error:
                        logger.error(f"Failed to update error status: {db_error}")
                    
                    return False
                
                finally:
                    db_session.close()
            
            # Run async processing
            success = await run_sync_processing()
                
            if success:
                logger.info(f"Document {document_id} processing completed successfully")
            else:
                logger.error(f"Document {document_id} processing failed")
            
        except Exception as e:
            logger.error(f"Error processing document {document_id}: {str(e)}")
        
        finally:
            # Cleanup
            if task_acquired:
                resource_manager.release_task_slot()
            
            # Remove from processing tasks
            if document_id in self.processing_tasks:
                del self.processing_tasks[document_id]
            
            if document_id in self.task_controls:
                del self.task_controls[document_id]
    
    async def _update_progress(self, document: Document, db: Session, stage: str, progress: int, details: str):
        """Update document processing progress with resource monitoring and pause control"""
        try:
            # Check if task is cancelled
            if document.id in self.task_controls and self.task_controls[document.id]["cancelled"]:
                raise asyncio.CancelledError("Task was cancelled")
            
            # Wait if task is paused
            if document.id in self.task_controls:
                control = self.task_controls[document.id]
                if control["paused"]:
                    document.processing_details = "İşlem duraklatıldı..."
                    db.commit()
                    logger.info(f"Document {document.id} processing paused")
                
                # Wait for resume signal
                await control["pause_event"].wait()
                
                # Check if cancelled while paused
                if control["cancelled"]:
                    raise asyncio.CancelledError("Task was cancelled while paused")
            
            # Check resources before update
            stats = resource_manager.get_system_stats()
            memory_percent = stats.get("memory", {}).get("percent", 0)
            
            if memory_percent > 85:
                logger.warning(f"High memory usage during progress update: {memory_percent:.1f}%")
                resource_manager.optimize_memory()
            
            # Refresh document from database
            db.refresh(document)
            
            document.processing_stage = stage
            document.processing_progress = progress
            document.processing_details = details
            document.updated_at = db.execute(text("SELECT datetime('now')")).scalar()
            
            db.commit()
            
            # Small delay to make progress visible and reduce DB load
            await asyncio.sleep(0.5)
            
            logger.info(f"Document {document.id} progress: {stage} - {progress}% - {details}")
            
        except Exception as e:
            logger.error(f"Error updating progress for document {document.id}: {str(e)}")
    
    def get_processing_status(self, document_id: int) -> Dict[str, Any]:
        """Get current processing status of a document"""
        is_processing = document_id in self.processing_tasks
        task = self.processing_tasks.get(document_id)
        
        # Get system stats
        system_stats = resource_manager.get_system_stats()
        
        return {
            "is_processing": is_processing,
            "task_done": task.done() if task else True,
            "task_cancelled": task.cancelled() if task else False,
            "system_stats": system_stats
        }
    
    async def pause_processing(self, document_id: int) -> bool:
        """Pause document processing"""
        if document_id in self.task_controls and document_id in self.processing_tasks:
            control = self.task_controls[document_id]
            if not control["paused"]:
                control["paused"] = True
                control["pause_event"].clear()  # Block the task
                logger.info(f"Document {document_id} processing paused")
                return True
        return False
    
    async def resume_processing(self, document_id: int) -> bool:
        """Resume document processing"""
        if document_id in self.task_controls and document_id in self.processing_tasks:
            control = self.task_controls[document_id]
            if control["paused"]:
                control["paused"] = False
                control["pause_event"].set()  # Unblock the task
                logger.info(f"Document {document_id} processing resumed")
                return True
        return False
    
    async def cancel_processing(self, document_id: int) -> bool:
        """Cancel document processing and cleanup resources"""
        if document_id in self.processing_tasks:
            # Set cancellation flag
            if document_id in self.task_controls:
                self.task_controls[document_id]["cancelled"] = True
                self.task_controls[document_id]["pause_event"].set()  # Unblock if paused
            
            # Cancel the task
            task = self.processing_tasks[document_id]
            task.cancel()
            
            # Cleanup resources
            resource_manager.optimize_memory()
            
            # Cleanup tracking
            if document_id in self.processing_tasks:
                del self.processing_tasks[document_id]
            if document_id in self.task_controls:
                del self.task_controls[document_id]
            if document_id in self.paused_tasks:
                del self.paused_tasks[document_id]
                
            logger.info(f"Document {document_id} processing cancelled")
            return True
        return False
    
    async def _restore_enrichments(self, document_id: int, enrichment_backup: dict, db_session: Session):
        """Restore chunk and asset enrichments after reprocessing"""
        try:
            from ..database.models_v2 import DocumentChunk, DocumentAsset
            from ..database.connection_v2 import SessionLocal as SessionLocalV2
            import hashlib
            
            db_v2 = SessionLocalV2()
            try:
                chunk_enrichments = enrichment_backup.get('chunks', {})
                asset_enrichments = enrichment_backup.get('assets', {})
                
                restored_chunks = 0
                restored_assets = 0
                
                # Restore chunk enrichments by matching content hash
                if chunk_enrichments:
                    new_chunks = db_v2.query(DocumentChunk).filter(
                        DocumentChunk.document_id == document_id
                    ).all()
                    
                    for chunk in new_chunks:
                        content_hash = hashlib.md5(chunk.content.encode()).hexdigest()
                        if content_hash in chunk_enrichments:
                            backup = chunk_enrichments[content_hash]
                            chunk.enrichment_data = backup.get('enrichment_data')
                            chunk.image_relations = backup.get('image_relations')
                            restored_chunks += 1
                
                # Restore asset enrichments by matching file path
                if asset_enrichments:
                    new_assets = db_v2.query(DocumentAsset).filter(
                        DocumentAsset.document_id == document_id
                    ).all()
                    
                    for asset in new_assets:
                        if asset.file_path in asset_enrichments:
                            backup = asset_enrichments[asset.file_path]
                            asset.caption = backup.get('caption')
                            # Only restore OCR text if it was manually edited (not auto-generated)
                            if backup.get('ocr_text') and not asset.ocr_text:
                                asset.ocr_text = backup.get('ocr_text')
                            # Restore tags
                            if backup.get('tags'):
                                metadata = asset.asset_metadata or {}
                                metadata['tags'] = backup.get('tags')
                                asset.asset_metadata = metadata
                            restored_assets += 1
                
                db_v2.commit()
                logger.info(f"✅ Restored enrichments: {restored_chunks} chunks, {restored_assets} assets")
                
            finally:
                db_v2.close()
                
        except Exception as e:
            logger.error(f"⚠️ Failed to restore enrichments: {e}")
    
    async def reprocess_document_async(
        self, 
        document_id: int, 
        db: Session,
        reextract_images: bool = False,
        rerun_image_ocr: bool = False,
        enrichment_backup: dict = None
    ) -> Dict[str, Any]:
        """Reprocess document with options"""
        try:
            # Get document
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return {"success": False, "error": "Document not found"}
            
            # Check if already processing
            if document_id in self.processing_tasks:
                old_task = self.processing_tasks[document_id]
                if not (old_task.done() or old_task.cancelled()):
                    return {"success": False, "error": "Document is already being processed"}
                del self.processing_tasks[document_id]
            
            # Check system resources
            can_start, reason = resource_manager.can_start_task()
            if not can_start:
                return {"success": False, "error": f"System resources insufficient: {reason}"}
            
            # Initialize task controls
            self.task_controls[document_id] = {
                "paused": False,
                "cancelled": False,
                "pause_event": asyncio.Event()
            }
            self.task_controls[document_id]["pause_event"].set()
            
            # Start async reprocessing with options
            logger.info(f"🔄 Creating reprocess task for document {document_id} (reextract_images={reextract_images}, rerun_ocr={rerun_image_ocr})")
            task = asyncio.create_task(
                self._reprocess_document_with_progress(
                    document_id, db, 
                    reextract_images=reextract_images,
                    rerun_image_ocr=rerun_image_ocr,
                    enrichment_backup=enrichment_backup
                )
            )
            self.processing_tasks[document_id] = task
            
            return {"success": True, "message": "Reprocessing started", "document_id": document_id}
            
        except Exception as e:
            logger.error(f"Error starting reprocessing for document {document_id}: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _reprocess_document_with_progress(
        self, 
        document_id: int, 
        db: Session,
        reextract_images: bool = False,
        rerun_image_ocr: bool = False,
        enrichment_backup: dict = None
    ):
        """Internal method to reprocess document using cached text"""
        logger.info(f"🔄 _reprocess_document_with_progress started for document {document_id}")
        task_acquired = False
        
        try:
            # Acquire task slot
            task_acquired = await resource_manager.acquire_task_slot()
            if not task_acquired:
                logger.error(f"Could not acquire task slot for document {document_id}")
                return
            
            async def run_reprocessing():
                """Run reprocessing with cached text using PostgreSQL"""
                # Use fresh SQLAlchemy session
                from ..database.connection import get_db
                db_session = next(get_db())
                
                try:
                    # Get document info
                    result = db_session.execute(text(
                        "SELECT folder_name, original_filename FROM documents WHERE id = :doc_id"
                    ), {"doc_id": document_id}).fetchone()
                    
                    if not result:
                        raise Exception("Document not found")
                    
                    folder_name, original_filename = result[0], result[1]
                    
                    # Update status to reprocessing
                    db_session.execute(text("""
                        UPDATE documents 
                        SET status = 'processing', 
                            processing_stage = 'reprocessing',
                            processing_progress = 10,
                            processing_details = '🔄 Yeniden işleme başlatıldı (cache kullanılıyor)...',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :doc_id
                    """), {"doc_id": document_id})
                    db_session.commit()
                    
                    # Read cached text - try all possible locations
                    possible_paths = [
                        Path(f"./documents/{folder_name}/processed/full_text.txt"),
                        Path(f"./documents/{folder_name}/processed/ocr_results/full_text.txt"),
                        Path(f"./documents/{folder_name}/processed/extracted_text.txt"),
                        Path(f"./documents/{folder_name}/text/extracted_text.txt"),
                    ]
                    
                    actual_text_path = None
                    for path in possible_paths:
                        if path.exists():
                            actual_text_path = path
                            logger.info(f"[Reprocess] Found text at: {actual_text_path}")
                            break
                    
                    if not actual_text_path:
                        raise Exception(f"Cached text not found. Tried: {[str(p) for p in possible_paths]}")
                    
                    with open(actual_text_path, 'r', encoding='utf-8') as f:
                        cached_text = f.read()
                    
                    logger.info(f"📄 Loaded cached text: {len(cached_text)} characters")
                    
                    # Update progress
                    db_session.execute(text("""
                        UPDATE documents 
                        SET processing_stage = 'chunking',
                            processing_progress = 30,
                            processing_details = '✂️ Metin parçalara bölünüyor (yeniden)...',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :doc_id
                    """), {"doc_id": document_id})
                    db_session.commit()
                    
                    try:
                        logger.info(f"🚀 Starting reprocessing with professional embedding service v2")
                        
                        # Process with professional embedding service v2 (will override old vectors)
                        result = await professional_embedding_service_v2.process_document(
                            document_id, cached_text, db_session
                        )
                        
                        logger.info(f"✅ Reprocessing result: {result.get('success', False)}")
                        
                        # Restore enrichments if backup exists
                        if result.get('success') and enrichment_backup:
                            await self._restore_enrichments(document_id, enrichment_backup, db_session)
                        
                        if result.get('success'):
                            return {"success": True, "message": f"Document reprocessed: {result.get('chunks_created', 0)} chunks"}
                        else:
                            return {"success": False, "error": result.get('error', 'Reprocessing failed')}
                    
                    finally:
                        db_session.close()
                        
                except Exception as e:
                    logger.error(f"Reprocessing error: {e}")
                    
                    # Update PostgreSQL database with error
                    try:
                        db_session.execute(text("""
                            UPDATE documents 
                            SET status = 'error',
                                processing_details = :details,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = :doc_id
                        """), {
                            "details": f"Yeniden işleme hatası: {str(e)}",
                            "doc_id": document_id
                        })
                        db_session.commit()
                    except Exception as ex:
                        logger.error(f"Failed to update error status: {ex}")
                    return False
                
                finally:
                    db_session.close()
            
            # Run reprocessing
            success = await run_reprocessing()
                
            if success:
                logger.info(f"Document {document_id} reprocessing completed successfully")
            else:
                logger.error(f"Document {document_id} reprocessing failed")
            
        except Exception as e:
            logger.error(f"Error reprocessing document {document_id}: {str(e)}")
        
        finally:
            # Cleanup
            if task_acquired:
                resource_manager.release_task_slot()
            
            if document_id in self.processing_tasks:
                del self.processing_tasks[document_id]
            
            if document_id in self.task_controls:
                del self.task_controls[document_id]

# Global instance
async_document_processor = AsyncDocumentProcessor()
