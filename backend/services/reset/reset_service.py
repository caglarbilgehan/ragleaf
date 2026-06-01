"""
Reset Service
Main service orchestrating document reset and reprocess operations
"""
import logging
import uuid
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database.models_v2 import Document, Operation
from .database_cleaner import DatabaseCleaner
from .vector_store_cleaner import VectorStoreCleaner
from .file_system_cleaner import FileSystemCleaner

logger = logging.getLogger(__name__)


class ResetService:
    """Service for resetting documents with granular control"""
    
    def __init__(self):
        self.db_cleaner = DatabaseCleaner()
        self.vector_cleaner = VectorStoreCleaner()
        self.fs_cleaner = FileSystemCleaner()
    
    async def reset_and_reprocess(
        self,
        document_id: int,
        reset_level: str,
        reset_options: dict,
        reprocess_options: dict,
        auto_process: bool,
        auto_index: bool,
        db: Session
    ) -> dict:
        """Main entry point for reset and reprocess"""
        
        # Generate operation ID
        operation_id = f"op_{uuid.uuid4().hex[:12]}"
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Create operation record
        operation = Operation(
            operation_id=operation_id,
            operation_type="reset_and_reprocess",
            document_id=document_id,
            status="pending",
            options={
                "reset_level": reset_level,
                "reset_options": reset_options,
                "reprocess_options": reprocess_options,
                "auto_process": auto_process,
                "auto_index": auto_index
            }
        )
        db.add(operation)
        db.commit()
        
        # Start async task
        asyncio.create_task(
            self._execute_reset_and_reprocess(
                operation_id, document_id, reset_level,
                reset_options, reprocess_options,
                auto_process, auto_index
            )
        )
        
        # Calculate estimated time
        estimated_time = self._calculate_estimated_time(
            document, reset_level, reprocess_options
        )
        
        # Get steps description
        steps = self._get_steps_description(
            reset_level, reprocess_options, auto_process, auto_index
        )
        
        return {
            "success": True,
            "operation_id": operation_id,
            "document_id": document_id,
            "estimated_time_seconds": estimated_time,
            "message": "Reset and reprocess started",
            "steps": steps
        }

    
    async def _execute_reset_and_reprocess(
        self,
        operation_id: str,
        document_id: int,
        reset_level: str,
        reset_options: dict,
        reprocess_options: dict,
        auto_process: bool,
        auto_index: bool
    ):
        """Execute reset and reprocess with progress tracking"""
        
        # Get new DB session for async task
        from backend.database.connection_v2 import SessionLocal
        db = SessionLocal()
        
        try:
            # Update operation status
            self._update_operation(operation_id, "running", 0, "resetting", db)
            
            logger.info(f"🔄 [op:{operation_id}] Starting reset for document {document_id} with level={reset_level}")
            
            # Step 1: Reset
            await self._reset_document(
                document_id, reset_level, reset_options, operation_id, db
            )
            
            if not auto_process:
                self._update_operation(operation_id, "completed", 100, "completed", db)
                logger.info(f"✅ [op:{operation_id}] Reset completed (auto_process=false)")
                return
            
            # Step 2: Process (if auto_process=true)
            self._update_operation(operation_id, "running", 33, "processing", db)
            logger.info(f"🔄 [op:{operation_id}] Starting processing")
            
            await self._process_document(
                document_id, reprocess_options, operation_id, db
            )
            
            if not auto_index:
                self._update_operation(operation_id, "completed", 100, "completed", db)
                logger.info(f"✅ [op:{operation_id}] Processing completed (auto_index=false)")
                return
            
            # Step 3: Index (if auto_index=true)
            self._update_operation(operation_id, "running", 66, "indexing", db)
            logger.info(f"🔄 [op:{operation_id}] Starting indexing")
            
            await self._index_document(document_id, operation_id, db)
            
            # Complete
            self._update_operation(operation_id, "completed", 100, "completed", db)
            logger.info(f"✅ [op:{operation_id}] Reset and reprocess completed successfully")
            
        except Exception as e:
            logger.error(f"❌ [op:{operation_id}] Reset and reprocess failed: {e}")
            self._update_operation(
                operation_id, "error", 0, "error",
                db, error=str(e)
            )
        finally:
            db.close()

    
    async def _reset_document(
        self,
        document_id: int,
        reset_level: str,
        reset_options: dict,
        operation_id: str,
        db: Session
    ):
        """Reset document based on level and options"""
        
        logger.info(f"🔄 [op:{operation_id}] Resetting document {document_id} with level={reset_level}")
        
        if reset_level == "indexing":
            await self._reset_indexing(document_id, operation_id, db)
        elif reset_level == "processing":
            await self._reset_processing(document_id, reset_options, operation_id, db)
        elif reset_level == "all":
            await self._reset_all(document_id, operation_id, db)
        else:
            raise ValueError(f"Invalid reset_level: {reset_level}")
    
    async def _reset_indexing(self, document_id: int, operation_id: str, db: Session):
        """Reset only indexing data (Level 1 - Hafif)"""
        
        logger.info(f"🔄 [op:{operation_id}] Reset Level: Indexing (Hafif)")
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        
        # Delete vectors
        deleted = await self.vector_cleaner.delete_vectors(document_id)
        logger.info(f"🗑️ [op:{operation_id}] Deleted {deleted['chroma']} ChromaDB vectors")
        
        # Delete vectors/ folder
        if document.folder_name:
            await self.fs_cleaner.delete_folder(document_id, "vectors", document.folder_name)
        
        # Update document status
        if document.status == "indexed":
            # Check if enrichments exist
            from backend.database.models_v2 import DocumentEnrichment
            has_enrichments = db.query(DocumentEnrichment).filter(
                DocumentEnrichment.document_id == document_id
            ).count() > 0
            
            document.status = "enriched" if has_enrichments else "processed"
        
        document.vector_indexed = False
        document.embedding_model_id = None
        db.commit()
        
        logger.info(f"✅ [op:{operation_id}] Indexing reset completed, status: {document.status}")

    
    async def _reset_processing(
        self,
        document_id: int,
        reset_options: dict,
        operation_id: str,
        db: Session
    ):
        """Reset processing data with granular control (Level 2 - Orta)"""
        
        logger.info(f"🔄 [op:{operation_id}] Reset Level: Processing (Orta)")
        logger.info(f"🔧 [op:{operation_id}] Reset options: {reset_options}")
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        
        # Always delete vectors
        deleted = await self.vector_cleaner.delete_vectors(document_id)
        logger.info(f"🗑️ [op:{operation_id}] Deleted {deleted['chroma']} ChromaDB vectors")
        
        if document.folder_name:
            await self.fs_cleaner.delete_folder(document_id, "vectors", document.folder_name)
            await self.fs_cleaner.delete_folder(document_id, "analysis", document.folder_name)
        
        # Delete based on options
        if reset_options.get("chunks", True):
            count = await self.db_cleaner.delete_chunks(document_id, db)
            logger.info(f"🗑️ [op:{operation_id}] Deleted {count} chunks")
            if document.folder_name:
                await self.fs_cleaner.delete_folder(document_id, "processed", document.folder_name)
        
        if reset_options.get("chunk_enrichments", True):
            count = await self.db_cleaner.delete_chunk_enrichments(document_id, db)
            logger.info(f"🗑️ [op:{operation_id}] Cleared {count} chunk enrichments")
        
        if reset_options.get("doc_enrichments", True):
            count = await self.db_cleaner.delete_doc_enrichments(document_id, db)
            logger.info(f"🗑️ [op:{operation_id}] Deleted {count} document enrichments")
        
        if reset_options.get("images", False):
            count = await self.db_cleaner.delete_assets(document_id, db)
            logger.info(f"🗑️ [op:{operation_id}] Deleted {count} assets")
            if document.folder_name:
                await self.fs_cleaner.delete_folder(document_id, "images", document.folder_name)
        
        if reset_options.get("ocr_texts", False):
            count = await self.db_cleaner.clear_ocr_texts(document_id, db)
            logger.info(f"🗑️ [op:{operation_id}] Cleared OCR texts from {count} assets")
        
        # Update document status
        document.status = "uploaded"
        document.processing_stage = None
        document.processing_progress = 0
        document.total_pages = None
        document.total_chunks = None
        document.ocr_completed = False
        document.vector_indexed = False
        document.embedding_model_id = None
        db.commit()
        
        logger.info(f"✅ [op:{operation_id}] Processing reset completed")

    
    async def _reset_all(self, document_id: int, operation_id: str, db: Session):
        """Reset everything except original file (Level 3 - Tam)"""
        
        logger.info(f"🔄 [op:{operation_id}] Reset Level: All (Tam)")
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        
        # Delete all database records
        result = await self.db_cleaner.delete_all(document_id, db)
        logger.info(f"🗑️ [op:{operation_id}] Deleted all data: {result}")
        
        # Delete all vectors
        deleted = await self.vector_cleaner.delete_vectors(document_id)
        logger.info(f"🗑️ [op:{operation_id}] Deleted {deleted['chroma']} ChromaDB vectors")
        
        # Delete all folders except original
        if document.folder_name:
            deleted_folders = await self.fs_cleaner.delete_all_except_original(
                document_id, document.folder_name
            )
            logger.info(f"🗑️ [op:{operation_id}] Deleted folders: {deleted_folders}")
        
        # Reset document
        document.status = "uploaded"
        document.processing_stage = None
        document.processing_progress = 0
        document.processing_details = None
        document.total_pages = None
        document.total_chunks = None
        document.ocr_completed = False
        document.vector_indexed = False
        document.processed_at = None
        document.embedding_model_id = None
        db.commit()
        
        logger.info(f"✅ [op:{operation_id}] Full reset completed")
    
    async def _process_document(
        self,
        document_id: int,
        reprocess_options: dict,
        operation_id: str,
        db: Session
    ):
        """Process document with given options"""
        
        logger.info(f"🔄 [op:{operation_id}] Processing document {document_id}")
        logger.info(f"🔧 [op:{operation_id}] Reprocess options: {reprocess_options}")
        
        # Import document pipeline
        from backend.services.pipeline.document_pipeline import DocumentPipeline
        
        pipeline = DocumentPipeline()
        
        # Process document
        # Note: DocumentPipeline will handle the reprocess options
        # For now, we'll use the standard process method
        result = await pipeline.process_document(document_id)
        
        logger.info(f"✅ [op:{operation_id}] Processing completed: {result}")
    
    async def _index_document(
        self,
        document_id: int,
        operation_id: str,
        db: Session
    ):
        """Index document (generate embeddings)"""
        
        logger.info(f"🔄 [op:{operation_id}] Indexing document {document_id}")
        
        # Import embedding service
        from backend.services.pipeline.embedding_service import EmbeddingService
        
        embedding_service = EmbeddingService()
        
        # Generate embeddings
        result = await embedding_service.generate_embeddings(document_id)
        
        logger.info(f"✅ [op:{operation_id}] Indexing completed: {result}")

    
    def _update_operation(
        self,
        operation_id: str,
        status: str,
        progress: int,
        stage: str,
        db: Session,
        error: str = None
    ):
        """Update operation status"""
        
        operation = db.query(Operation).filter(
            Operation.operation_id == operation_id
        ).first()
        
        if operation:
            operation.status = status
            operation.progress = progress
            operation.stage = stage
            
            if error:
                operation.error = error
            
            if status == "running" and not operation.started_at:
                operation.started_at = datetime.utcnow()
            
            if status in ["completed", "error", "cancelled"]:
                operation.completed_at = datetime.utcnow()
            
            db.commit()
    
    def _calculate_estimated_time(
        self,
        document: Document,
        reset_level: str,
        reprocess_options: dict
    ) -> int:
        """Calculate estimated time in seconds"""
        
        # Base reset times
        reset_times = {
            "indexing": 5,
            "processing": 10 + (document.total_chunks or 0) * 0.1,
            "all": 20 + (document.total_pages or 0) * 2
        }
        
        base_time = reset_times.get(reset_level, 10)
        
        # Add reprocess times
        if reprocess_options.get("extract_text"):
            base_time += (document.total_pages or 10) * 1
        
        if reprocess_options.get("extract_images"):
            base_time += (document.total_pages or 10) * 2
        
        if reprocess_options.get("run_ocr"):
            # Estimate images count
            images_count = (document.total_pages or 10) * 2
            base_time += images_count * 3
        
        # Chunking time
        if reprocess_options.get("chunking_strategy") == "semantic":
            base_time += 30  # AI-powered is slower
        else:
            base_time += 5
        
        # Indexing time
        chunks_count = document.total_chunks or 50
        base_time += chunks_count * 0.5
        
        return int(base_time)
    
    def _get_steps_description(
        self,
        reset_level: str,
        reprocess_options: dict,
        auto_process: bool,
        auto_index: bool
    ) -> list:
        """Get human-readable steps description"""
        
        steps = []
        
        # Reset step
        if reset_level == "indexing":
            steps.append("Reset: Delete embeddings only")
        elif reset_level == "processing":
            steps.append("Reset: Delete chunks and enrichments")
        elif reset_level == "all":
            steps.append("Reset: Delete everything except original file")
        
        # Process step
        if auto_process:
            process_desc = "Process: "
            if reprocess_options.get("extract_text"):
                process_desc += "Re-extract text, "
            else:
                process_desc += "Use cached text, "
            
            if reprocess_options.get("extract_images"):
                process_desc += "re-extract images, "
            else:
                process_desc += "use cached images, "
            
            if reprocess_options.get("run_ocr"):
                process_desc += "run OCR, "
            
            strategy = reprocess_options.get("chunking_strategy", "paragraph")
            process_desc += f"chunk with {strategy} strategy"
            
            steps.append(process_desc)
        
        # Index step
        if auto_index:
            steps.append("Index: Generate embeddings and store in vector DB")
        
        return steps


# Singleton instance
reset_service = ResetService()
