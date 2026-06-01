"""
Unified Progress Tracker
Single source of truth for document processing progress updates
Uses SQLAlchemy for PostgreSQL database access
"""

import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ProgressTracker:
    """Unified progress tracking for document processing"""
    
    def __init__(self, document_id: int, max_logs: int = 50):
        self.document_id = document_id
        self.max_logs = max_logs
        self._logs: List[Dict[str, Any]] = []
    
    def _get_db_session(self) -> Session:
        """Get a new database session"""
        from ...database.connection import SessionLocal
        return SessionLocal()
    
    def update(
        self, 
        stage: str, 
        progress: int, 
        details: str,
        level: str = "info"
    ) -> bool:
        """
        Update document progress using SQLAlchemy for PostgreSQL
        
        Args:
            stage: Current processing stage (e.g., 'initialization', 'text_extraction')
            progress: Progress percentage (0-100)
            details: Human-readable progress message
            level: Log level ('info', 'warning', 'error')
        
        Returns:
            True if update successful, False otherwise
        """
        try:
            from ...database.models import Document
            
            # Clean, single-line progress log
            emoji = self._get_emoji(level)
            logger.info(f"{emoji} [Doc:{self.document_id}] {stage} | {progress}% | {details}")
            
            # Create log entry
            timestamp = datetime.now()
            log_entry = {
                "timestamp": timestamp.isoformat(),
                "level": level,
                "stage": stage,
                "progress": progress,
                "message": details
            }
            
            db = self._get_db_session()
            try:
                document = db.query(Document).filter(Document.id == self.document_id).first()
                if not document:
                    logger.warning(f"⚠️ [Doc:{self.document_id}] Document not found for progress update")
                    return False
                
                # Get existing logs
                existing_logs = self._parse_logs(document.processing_logs)
                
                # Append new log entry (keep last N logs)
                existing_logs.append(log_entry)
                if len(existing_logs) > self.max_logs:
                    existing_logs = existing_logs[-self.max_logs:]
                
                # Update document
                document.processing_stage = stage
                document.processing_progress = progress
                document.processing_details = details
                document.processing_logs = json.dumps(existing_logs, ensure_ascii=False)
                document.updated_at = timestamp
                
                db.commit()
                return True
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to update progress: {e}")
            return False
    
    def set_status(
        self, 
        status: str, 
        details: Optional[str] = None,
        extra_fields: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Update document status (processed, error, etc.)
        
        Args:
            status: Document status ('processing', 'processed', 'error')
            details: Optional status details
            extra_fields: Optional extra fields to update (e.g., total_pages, total_chunks)
        """
        try:
            from ...database.models import Document
            
            timestamp = datetime.now()
            
            db = self._get_db_session()
            try:
                document = db.query(Document).filter(Document.id == self.document_id).first()
                if not document:
                    logger.warning(f"⚠️ [Doc:{self.document_id}] Document not found for status update")
                    return False
                
                # Update status
                document.status = status
                document.updated_at = timestamp
                
                if details:
                    document.processing_details = details
                
                # Apply extra fields
                if extra_fields:
                    for key, value in extra_fields.items():
                        if hasattr(document, key):
                            setattr(document, key, value)
                
                db.commit()
                return True
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to set status: {e}")
            return False
    
    def complete(
        self, 
        total_pages: int = 0,
        total_chunks: int = 0,
        images_extracted: int = 0,
        details: Optional[str] = None
    ) -> bool:
        """Mark document processing as complete"""
        timestamp = datetime.now()
        
        if not details:
            details = f"✅ İşlem tamamlandı! {total_chunks} chunk, {images_extracted} görsel"
        
        return self.set_status(
            status="processed",
            details=details,
            extra_fields={
                "processing_stage": "completed",
                "processing_progress": 100,
                "total_pages": total_pages,
                "total_chunks": total_chunks,
                "ocr_completed": True,
                "vector_indexed": True,
                "processed_at": timestamp
            }
        )
    
    def error(self, error_message: str) -> bool:
        """Mark document processing as failed"""
        self.update("error", 0, f"❌ Hata: {error_message}", level="error")
        return self.set_status(
            status="error",
            details=f"Hata: {error_message}"
        )
    
    def _parse_logs(self, logs_data: Any) -> List[Dict[str, Any]]:
        """Parse existing logs from database"""
        if not logs_data:
            return []
        try:
            if isinstance(logs_data, str):
                return json.loads(logs_data)
            return logs_data
        except:
            return []
    
    def _get_emoji(self, level: str) -> str:
        """Get emoji for log level"""
        return {
            "info": "📊",
            "warning": "⚠️",
            "error": "❌",
            "success": "✅"
        }.get(level, "📊")
