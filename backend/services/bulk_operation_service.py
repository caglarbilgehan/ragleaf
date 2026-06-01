"""
Bulk Operation Service
Handles bulk operations on multiple documents (process, index, reset)
"""

import logging
import asyncio
import uuid
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from backend.database.models_v2 import Document, Operation
from backend.services.action_history_service import ActionHistoryService

logger = logging.getLogger(__name__)


class BulkOperationService:
    """Service for managing bulk operations on documents"""
    
    def __init__(self, db: Session):
        self.db = db
        self.action_history = ActionHistoryService(db)
        self.max_concurrent = 5  # Maximum concurrent operations
    
    async def bulk_process(
        self,
        document_ids: List[int],
        user_id: int,
        options: Dict
    ) -> Dict:
        """
        Process multiple documents in bulk
        
        Args:
            document_ids: List of document IDs to process
            user_id: User ID performing the operation
            options: Processing options (extract_text, extract_images, run_ocr, etc.)
        
        Returns:
            Bulk operation result with success/failure counts
        """
        operation_id = str(uuid.uuid4())
        logger.info(f"🚀 Starting bulk process: operation_id={operation_id}, count={len(document_ids)}")
        
        # Validate documents
        valid_docs, invalid_docs = await self._validate_documents_for_process(document_ids)
        
        # Process valid documents
        results = await self._execute_bulk_operation(
            valid_docs,
            user_id,
            "process",
            self._process_single_document,
            options
        )
        
        # Prepare result summary
        result = {
            "operation_id": operation_id,
            "total_count": len(document_ids),
            "success_count": results["success_count"],
            "failure_count": results["failure_count"] + len(invalid_docs),
            "errors": results["errors"] + [
                {
                    "document_id": doc_id,
                    "document_name": "Unknown",
                    "error": "Document not found or invalid status"
                }
                for doc_id in invalid_docs
            ]
        }
        
        logger.info(
            f"✅ Bulk process completed: operation_id={operation_id}, "
            f"success={result['success_count']}, failure={result['failure_count']}"
        )
        
        return result
    
    async def bulk_index(
        self,
        document_ids: List[int],
        user_id: int,
        options: Dict
    ) -> Dict:
        """
        Index multiple documents in bulk
        
        Args:
            document_ids: List of document IDs to index
            user_id: User ID performing the operation
            options: Indexing options (force_reindex, etc.)
        
        Returns:
            Bulk operation result with success/failure counts
        """
        operation_id = str(uuid.uuid4())
        logger.info(f"🚀 Starting bulk index: operation_id={operation_id}, count={len(document_ids)}")
        
        # Validate documents
        valid_docs, invalid_docs = await self._validate_documents_for_index(document_ids)
        
        # Index valid documents
        results = await self._execute_bulk_operation(
            valid_docs,
            user_id,
            "index",
            self._index_single_document,
            options
        )
        
        # Prepare result summary
        result = {
            "operation_id": operation_id,
            "total_count": len(document_ids),
            "success_count": results["success_count"],
            "failure_count": results["failure_count"] + len(invalid_docs),
            "errors": results["errors"] + [
                {
                    "document_id": doc_id,
                    "document_name": "Unknown",
                    "error": "Document not found or invalid status"
                }
                for doc_id in invalid_docs
            ]
        }
        
        logger.info(
            f"✅ Bulk index completed: operation_id={operation_id}, "
            f"success={result['success_count']}, failure={result['failure_count']}"
        )
        
        return result
    
    async def bulk_reset(
        self,
        document_ids: List[int],
        user_id: int,
        reset_level: str,
        reset_options: Dict,
        auto_process: bool = False,
        auto_index: bool = False
    ) -> Dict:
        """
        Reset multiple documents in bulk
        
        Args:
            document_ids: List of document IDs to reset
            user_id: User ID performing the operation
            reset_level: Reset level (indexing, processing, all)
            reset_options: Reset options (chunks, enrichments, images, etc.)
            auto_process: Auto-process after reset
            auto_index: Auto-index after reset
        
        Returns:
            Bulk operation result with success/failure counts
        """
        operation_id = str(uuid.uuid4())
        logger.info(f"🚀 Starting bulk reset: operation_id={operation_id}, count={len(document_ids)}")
        
        # Import reset service
        from backend.services.reset.reset_service import ResetService
        reset_service = ResetService(self.db)
        
        # Validate documents
        valid_docs = []
        invalid_docs = []
        for doc_id in document_ids:
            doc = self.db.query(Document).filter(Document.id == doc_id).first()
            if doc:
                valid_docs.append(doc_id)
            else:
                invalid_docs.append(doc_id)
        
        # Reset valid documents
        success_count = 0
        failure_count = 0
        errors = []
        
        # Process in batches
        for i in range(0, len(valid_docs), self.max_concurrent):
            batch = valid_docs[i:i + self.max_concurrent]
            tasks = []
            
            for doc_id in batch:
                task = self._reset_single_document(
                    reset_service,
                    doc_id,
                    user_id,
                    reset_level,
                    reset_options,
                    auto_process,
                    auto_index
                )
                tasks.append(task)
            
            # Execute batch
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for doc_id, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    failure_count += 1
                    doc = self.db.query(Document).filter(Document.id == doc_id).first()
                    errors.append({
                        "document_id": doc_id,
                        "document_name": doc.name if doc else "Unknown",
                        "error": str(result)
                    })
                    
                    # Log failure
                    await self.action_history.log_action(
                        document_id=doc_id,
                        action="reset",
                        user_id=user_id,
                        result="failure",
                        error_message=str(result)
                    )
                else:
                    success_count += 1
                    
                    # Log success
                    await self.action_history.log_action(
                        document_id=doc_id,
                        action="reset",
                        user_id=user_id,
                        result="success"
                    )
        
        # Prepare result summary
        result = {
            "operation_id": operation_id,
            "total_count": len(document_ids),
            "success_count": success_count,
            "failure_count": failure_count + len(invalid_docs),
            "errors": errors + [
                {
                    "document_id": doc_id,
                    "document_name": "Unknown",
                    "error": "Document not found"
                }
                for doc_id in invalid_docs
            ]
        }
        
        logger.info(
            f"✅ Bulk reset completed: operation_id={operation_id}, "
            f"success={result['success_count']}, failure={result['failure_count']}"
        )
        
        return result
    
    async def _validate_documents_for_process(self, document_ids: List[int]) -> tuple:
        """Validate documents can be processed"""
        valid_docs = []
        invalid_docs = []
        
        for doc_id in document_ids:
            doc = self.db.query(Document).filter(Document.id == doc_id).first()
            if doc and doc.status in ["uploaded", "error"]:
                valid_docs.append(doc_id)
            else:
                invalid_docs.append(doc_id)
        
        return valid_docs, invalid_docs
    
    async def _validate_documents_for_index(self, document_ids: List[int]) -> tuple:
        """Validate documents can be indexed"""
        valid_docs = []
        invalid_docs = []
        
        for doc_id in document_ids:
            doc = self.db.query(Document).filter(Document.id == doc_id).first()
            if doc and doc.status in ["processed", "enriched", "indexed"]:
                valid_docs.append(doc_id)
            else:
                invalid_docs.append(doc_id)
        
        return valid_docs, invalid_docs
    
    async def _execute_bulk_operation(
        self,
        document_ids: List[int],
        user_id: int,
        action: str,
        operation_func,
        options: Dict
    ) -> Dict:
        """Execute bulk operation with concurrency control"""
        success_count = 0
        failure_count = 0
        errors = []
        
        # Process in batches
        for i in range(0, len(document_ids), self.max_concurrent):
            batch = document_ids[i:i + self.max_concurrent]
            tasks = []
            
            for doc_id in batch:
                task = operation_func(doc_id, user_id, options)
                tasks.append(task)
            
            # Execute batch
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for doc_id, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    failure_count += 1
                    doc = self.db.query(Document).filter(Document.id == doc_id).first()
                    errors.append({
                        "document_id": doc_id,
                        "document_name": doc.name if doc else "Unknown",
                        "error": str(result)
                    })
                    
                    # Log failure
                    await self.action_history.log_action(
                        document_id=doc_id,
                        action=action,
                        user_id=user_id,
                        result="failure",
                        error_message=str(result)
                    )
                else:
                    success_count += 1
                    
                    # Log success
                    await self.action_history.log_action(
                        document_id=doc_id,
                        action=action,
                        user_id=user_id,
                        result="success",
                        duration_ms=result.get("duration_ms")
                    )
        
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }
    
    async def _process_single_document(self, doc_id: int, user_id: int, options: Dict) -> Dict:
        """Process a single document"""
        start_time = datetime.utcnow()
        
        # Import document pipeline
        from backend.services.pipeline.document_pipeline import DocumentPipeline
        
        # Get document
        doc = self.db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            raise ValueError(f"Document {doc_id} not found")
        
        # Process document
        pipeline = DocumentPipeline(self.db)
        await pipeline.process_document(
            document_id=doc_id,
            extract_text=options.get("extract_text", True),
            extract_images=options.get("extract_images", True),
            run_ocr=options.get("run_ocr", True),
            ocr_languages=options.get("ocr_languages", ["tur", "eng"]),
            chunking_strategy=options.get("chunking_strategy", "paragraph"),
            chunk_size=options.get("chunk_size", 512),
            chunk_overlap=options.get("chunk_overlap", 100)
        )
        
        # Calculate duration
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        return {"duration_ms": duration_ms}
    
    async def _index_single_document(self, doc_id: int, user_id: int, options: Dict) -> Dict:
        """Index a single document"""
        start_time = datetime.utcnow()
        
        # Import indexing service
        from backend.services.vectorstore.vector_store_manager import VectorStoreManager
        
        # Get document
        doc = self.db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            raise ValueError(f"Document {doc_id} not found")
        
        # Index document
        vector_store = VectorStoreManager(self.db)
        await vector_store.index_document(
            document_id=doc_id,
            force_reindex=options.get("force_reindex", False)
        )
        
        # Calculate duration
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        return {"duration_ms": duration_ms}
    
    async def _reset_single_document(
        self,
        reset_service,
        doc_id: int,
        user_id: int,
        reset_level: str,
        reset_options: Dict,
        auto_process: bool,
        auto_index: bool
    ) -> Dict:
        """Reset a single document"""
        # Reset document
        await reset_service.reset_and_reprocess(
            document_id=doc_id,
            reset_level=reset_level,
            reset_options=reset_options,
            auto_process=auto_process,
            auto_index=auto_index
        )
        
        return {}
