"""
Document Pipeline Service
Orchestrates the 3-stage document processing pipeline.

Pipeline Stages:
1. PROCESS: Parse PDF, extract text/images, OCR, create chunks (no embedding)
2. ENRICH: Add questions, tags, instructions, image relations to chunks
3. INDEX: Generate embeddings from enriched content, store in PgVector

Status Flow:
uploaded → processing → processed → enriched → indexing → indexed
                ↓                       ↓           ↓
              error                   error       error

Requirements: 2.1-2.7, 5.1-5.4
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database.models_v2 import Document, DocumentChunk

logger = logging.getLogger(__name__)


class DocumentStatus(str, Enum):
    """Valid document statuses"""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    ENRICHED = "enriched"
    INDEXING = "indexing"
    INDEXED = "indexed"
    ERROR = "error"


# Valid status transitions
VALID_TRANSITIONS = {
    DocumentStatus.UPLOADED: [DocumentStatus.PROCESSING],
    DocumentStatus.PROCESSING: [DocumentStatus.PROCESSED, DocumentStatus.ERROR],
    DocumentStatus.PROCESSED: [DocumentStatus.ENRICHED, DocumentStatus.INDEXING, DocumentStatus.PROCESSING],
    DocumentStatus.ENRICHED: [DocumentStatus.INDEXING, DocumentStatus.PROCESSING],
    DocumentStatus.INDEXING: [DocumentStatus.INDEXED, DocumentStatus.ERROR],
    DocumentStatus.INDEXED: [DocumentStatus.INDEXING, DocumentStatus.PROCESSING],  # Allow re-index and reprocess
    DocumentStatus.ERROR: [DocumentStatus.PROCESSING],  # Allow retry
}


@dataclass
class PipelineResult:
    """Result of a pipeline operation"""
    success: bool
    document_id: int
    status: str
    message: str
    details: Optional[Dict[str, Any]] = None


class DocumentPipelineService:
    """
    Orchestrates the 3-stage document processing pipeline.
    
    This service coordinates between:
    - AsyncDocumentProcessor: For parsing and chunking (Stage 1)
    - ChunkEnrichmentService: For adding enrichments (Stage 2)
    - DocumentIndexerService: For embedding generation (Stage 3)
    
    Key responsibilities:
    - Status validation and transitions
    - Pipeline orchestration
    - Error handling and recovery
    """
    
    def __init__(self):
        # Lazy imports to avoid circular dependencies
        self._indexer_service = None
        self._async_processor = None
    
    @property
    def indexer_service(self):
        """Lazy load indexer service"""
        if self._indexer_service is None:
            from .document_indexer_service import document_indexer_service
            self._indexer_service = document_indexer_service
        return self._indexer_service
    
    @property
    def async_processor(self):
        """Lazy load async processor"""
        if self._async_processor is None:
            from .async_document_processor import AsyncDocumentProcessor
            self._async_processor = AsyncDocumentProcessor()
        return self._async_processor
    
    def validate_status_transition(
        self,
        current_status: str,
        target_status: str
    ) -> tuple[bool, str]:
        """
        Validate if a status transition is allowed.
        
        Args:
            current_status: Current document status
            target_status: Target status to transition to
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            current = DocumentStatus(current_status)
            target = DocumentStatus(target_status)
        except ValueError as e:
            return False, f"Invalid status: {e}"
        
        valid_targets = VALID_TRANSITIONS.get(current, [])
        
        if target in valid_targets:
            return True, ""
        
        return False, f"Cannot transition from '{current_status}' to '{target_status}'. Valid targets: {[s.value for s in valid_targets]}"
    
    def can_process(self, document: Document) -> tuple[bool, str]:
        """Check if document can be processed (Stage 1)"""
        valid_statuses = [
            DocumentStatus.UPLOADED.value,
            DocumentStatus.ERROR.value,
            DocumentStatus.PROCESSED.value,  # Reprocess
            DocumentStatus.ENRICHED.value,   # Reprocess
            DocumentStatus.INDEXED.value,    # Reprocess
        ]
        
        if document.status in valid_statuses:
            return True, ""
        
        if document.status == DocumentStatus.PROCESSING.value:
            return False, "Document is already being processed"
        
        if document.status == DocumentStatus.INDEXING.value:
            return False, "Document is being indexed, wait for completion"
        
        return False, f"Cannot process document with status '{document.status}'"
    
    def can_index(self, document: Document) -> tuple[bool, str]:
        """Check if document can be indexed (Stage 3)"""
        valid_statuses = [
            DocumentStatus.PROCESSED.value,
            DocumentStatus.ENRICHED.value,
            DocumentStatus.INDEXED.value,  # Re-index
        ]
        
        if document.status in valid_statuses:
            return True, ""
        
        if document.status == DocumentStatus.UPLOADED.value:
            return False, "Document must be processed first"
        
        if document.status == DocumentStatus.PROCESSING.value:
            return False, "Document is being processed, wait for completion"
        
        if document.status == DocumentStatus.INDEXING.value:
            return False, "Document is already being indexed"
        
        return False, f"Cannot index document with status '{document.status}'"
    
    async def process_document(
        self,
        document_id: int,
        db: Session
    ) -> PipelineResult:
        """
        Stage 1: Process document (parse, extract, chunk - NO embedding).
        
        This method:
        1. Validates document status
        2. Delegates to AsyncDocumentProcessor
        3. Sets status to 'processed' on success
        
        Args:
            document_id: ID of document to process
            db: Database session
        
        Returns:
            PipelineResult with operation status
        """
        try:
            # Get document
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status="error",
                    message="Document not found"
                )
            
            # Validate status
            can_process, error = self.can_process(document)
            if not can_process:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status=document.status,
                    message=error
                )
            
            logger.info(f"🚀 Starting document processing (Stage 1) for document {document_id}")
            
            # Delegate to async processor
            result = await self.async_processor.process_document_async(document_id, db)
            
            if result.get("success"):
                return PipelineResult(
                    success=True,
                    document_id=document_id,
                    status="processing",
                    message="Document processing started",
                    details=result
                )
            else:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status=document.status,
                    message=result.get("error", "Processing failed"),
                    details=result
                )
                
        except Exception as e:
            logger.error(f"❌ Error in process_document: {e}")
            return PipelineResult(
                success=False,
                document_id=document_id,
                status="error",
                message=str(e)
            )
    
    async def index_document(
        self,
        document_id: int,
        db: Session,
        batch_size: int = 32
    ) -> PipelineResult:
        """
        Stage 3: Index document (generate embeddings from enriched content).
        
        This method:
        1. Validates document status (must be processed or enriched)
        2. Builds enriched content for each chunk
        3. Generates embeddings
        4. Stores in PgVector
        5. Sets status to 'indexed' on success
        
        Args:
            document_id: ID of document to index
            db: Database session
            batch_size: Batch size for embedding generation
        
        Returns:
            PipelineResult with operation status
        """
        try:
            # Get document
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status="error",
                    message="Document not found"
                )
            
            # Validate status
            can_index, error = self.can_index(document)
            if not can_index:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status=document.status,
                    message=error
                )
            
            logger.info(f"🚀 Starting document indexing (Stage 3) for document {document_id}")
            
            # Delegate to indexer service
            result = await self.indexer_service.index_document(document_id, db, batch_size)
            
            if result.success:
                return PipelineResult(
                    success=True,
                    document_id=document_id,
                    status="indexed",
                    message=result.message,
                    details={
                        "chunks_indexed": result.chunks_indexed,
                        "duration_seconds": result.duration_seconds,
                        "errors": result.errors
                    }
                )
            else:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status="error",
                    message=result.message,
                    details={
                        "errors": result.errors
                    }
                )
                
        except Exception as e:
            logger.error(f"❌ Error in index_document: {e}")
            return PipelineResult(
                success=False,
                document_id=document_id,
                status="error",
                message=str(e)
            )
    
    async def reindex_document(
        self,
        document_id: int,
        db: Session,
        batch_size: int = 32
    ) -> PipelineResult:
        """
        Re-index document (clear existing embeddings and regenerate).
        
        Use this when:
        - Enrichment data has been updated
        - Embedding model has changed
        - User wants to refresh embeddings
        
        Args:
            document_id: ID of document to re-index
            db: Database session
            batch_size: Batch size for embedding generation
        
        Returns:
            PipelineResult with operation status
        """
        try:
            # Get document
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status="error",
                    message="Document not found"
                )
            
            # Must be indexed to re-index
            if document.status not in ['indexed', 'enriched', 'processed']:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status=document.status,
                    message=f"Cannot re-index document with status '{document.status}'. Must be processed, enriched, or indexed."
                )
            
            logger.info(f"🔄 Starting document re-indexing for document {document_id}")
            
            # Delegate to indexer service
            result = await self.indexer_service.reindex_document(document_id, db, batch_size)
            
            if result.success:
                return PipelineResult(
                    success=True,
                    document_id=document_id,
                    status="indexed",
                    message=result.message,
                    details={
                        "chunks_indexed": result.chunks_indexed,
                        "duration_seconds": result.duration_seconds,
                        "errors": result.errors
                    }
                )
            else:
                return PipelineResult(
                    success=False,
                    document_id=document_id,
                    status="error",
                    message=result.message,
                    details={
                        "errors": result.errors
                    }
                )
                
        except Exception as e:
            logger.error(f"❌ Error in reindex_document: {e}")
            return PipelineResult(
                success=False,
                document_id=document_id,
                status="error",
                message=str(e)
            )
    
    def get_pipeline_status(
        self,
        document_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Get comprehensive pipeline status for a document.
        
        Returns:
            Dict with status information including:
            - Current status
            - Available actions
            - Chunk/enrichment statistics
            - Indexing progress
        """
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return {"error": "Document not found"}
        
        # Get chunk statistics
        total_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).count()
        
        indexed_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.embedding != None
        ).count()
        
        enriched_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.enrichment_data != None,
            DocumentChunk.enrichment_data != {}
        ).count()
        
        # Determine available actions
        can_process, _ = self.can_process(document)
        can_index, _ = self.can_index(document)
        
        return {
            "document_id": document_id,
            "document_name": document.name,
            "status": document.status,
            "processing_stage": document.processing_stage,
            "processing_progress": document.processing_progress,
            "processing_details": document.processing_details,
            "vector_indexed": document.vector_indexed,
            "statistics": {
                "total_chunks": total_chunks,
                "indexed_chunks": indexed_chunks,
                "enriched_chunks": enriched_chunks,
                "indexing_percentage": round((indexed_chunks / total_chunks * 100) if total_chunks > 0 else 0, 1)
            },
            "available_actions": {
                "can_process": can_process,
                "can_index": can_index,
                "can_reindex": document.status == "indexed"
            },
            "timestamps": {
                "created_at": document.created_at.isoformat() if document.created_at else None,
                "updated_at": document.updated_at.isoformat() if document.updated_at else None,
                "processed_at": document.processed_at.isoformat() if document.processed_at else None
            }
        }
    
    def update_status_to_enriched(
        self,
        document_id: int,
        db: Session
    ) -> bool:
        """
        Update document status to 'enriched' after enrichment data is added.
        
        Called by chunk_enrichment API when enrichments are saved.
        
        Args:
            document_id: ID of document
            db: Database session
        
        Returns:
            True if status was updated, False otherwise
        """
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return False
            
            # Only update if currently processed
            if document.status == DocumentStatus.PROCESSED.value:
                document.status = DocumentStatus.ENRICHED.value
                document.updated_at = datetime.utcnow()
                db.commit()
                logger.info(f"📝 Document {document_id} status updated to 'enriched'")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Error updating status to enriched: {e}")
            db.rollback()
            return False


# Global instance
document_pipeline_service = DocumentPipelineService()
