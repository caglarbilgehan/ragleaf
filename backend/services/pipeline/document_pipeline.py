"""
Document Processing Pipeline
Single orchestrator for all document processing operations
Replaces: document_processor.py, async_document_processor.py, professional_document_processor.py
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from .progress_tracker import ProgressTracker
from .extractors import PDFExtractor, TextExtractor, ExtractionResult
from .processors import OCRProcessor, TextCleaner

logger = logging.getLogger(__name__)


@dataclass
class PipelineConfig:
    """Configuration for document processing pipeline"""
    # OCR settings
    ocr_languages: str = "tur+eng"
    ocr_config: str = "--psm 6"
    ocr_threshold: int = 50  # Min chars before OCR is triggered
    
    # Image settings
    min_image_size: tuple = (50, 50)
    image_dpi: int = 300
    
    # Processing settings
    enable_ocr: bool = True
    enable_image_extraction: bool = True
    save_intermediate_files: bool = True


@dataclass
class PipelineResult:
    """Result of document processing pipeline"""
    success: bool
    text: str = ""
    total_pages: int = 0
    images_extracted: int = 0
    ocr_operations: int = 0
    text_length: int = 0
    chunks_created: int = 0
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class DocumentPipeline:
    """
    Unified document processing pipeline
    
    Stages:
    1. Extraction - Extract text and images from document
    2. OCR - Apply OCR to images/scanned pages if needed
    3. Cleaning - Clean and normalize text
    4. Output - Save processed text and metadata
    """
    
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        
        # Initialize extractors
        self.pdf_extractor = PDFExtractor(
            min_image_size=self.config.min_image_size,
            image_dpi=self.config.image_dpi
        )
        self.text_extractor = TextExtractor()
        
        # Initialize processors
        self.ocr_processor = OCRProcessor(
            languages=self.config.ocr_languages,
            config=self.config.ocr_config
        )
        self.text_cleaner = TextCleaner()
        
        # Base documents directory
        from backend.services.storage_service import get_storage
        _storage = get_storage()
        import os
        self.base_dir = _storage.get_document_root(os.getenv("DEFAULT_TENANT_SLUG", "default"))
        
        # Task control for pause/cancel
        self.task_controls: Dict[int, Dict[str, Any]] = {}
    
    async def process(
        self,
        document_id: int,
        file_path: Path,
        folder_name: str,
        db: Session,
        progress_callback: Optional[Callable] = None
    ) -> PipelineResult:
        """
        Process a document through the full pipeline
        
        Args:
            document_id: Database document ID
            file_path: Path to the document file
            folder_name: Document folder name for output
            db: SQLAlchemy database session
            progress_callback: Optional callback for progress updates
        
        Returns:
            PipelineResult with processing results
        """
        # Initialize progress tracker
        tracker = ProgressTracker(document_id)
        
        # Initialize task control
        self.task_controls[document_id] = {
            "paused": False,
            "cancelled": False,
            "pause_event": asyncio.Event()
        }
        self.task_controls[document_id]["pause_event"].set()
        
        try:
            # Stage 0: Initialization
            tracker.update("initialization", 5, "📄 Döküman işleme başlatıldı!")
            
            # Prepare output directories
            doc_folder = self.base_dir / folder_name
            output_dirs = self._prepare_directories(doc_folder)
            
            tracker.update("initialization", 10, "🔧 Klasör yapısı hazırlandı")
            
            # Check for pause/cancel
            await self._check_pause_cancel(document_id)
            
            # Stage 1: Extraction
            tracker.update("extraction", 15, "📖 Döküman açılıyor...")
            
            extraction_result = await self._extract(
                file_path, 
                output_dirs,
                lambda s, p, d: tracker.update(s, p, d)
            )
            
            if not extraction_result.success:
                tracker.error(extraction_result.error or "Extraction failed")
                return PipelineResult(
                    success=False,
                    error=extraction_result.error
                )
            
            await self._check_pause_cancel(document_id)
            
            # Stage 2: OCR (if needed)
            text = extraction_result.text
            ocr_count = 0
            
            if self.config.enable_ocr:
                tracker.update("ocr_processing", 55, "🔍 OCR kontrolü yapılıyor...")
                
                # Check if OCR is needed for main text
                if self.pdf_extractor.needs_ocr(text, self.config.ocr_threshold):
                    tracker.update("ocr_processing", 60, "🔍 OCR uygulanıyor...")
                    # OCR would be applied here if needed
                    ocr_count += 1
                
                # OCR extracted images
                if extraction_result.images and self.config.enable_image_extraction:
                    image_texts = []
                    for i, img_info in enumerate(extraction_result.images):
                        await self._check_pause_cancel(document_id)
                        
                        progress = 60 + int((i / len(extraction_result.images)) * 10)
                        tracker.update(
                            "image_ocr", 
                            progress, 
                            f"🔍 Görsel {i+1}/{len(extraction_result.images)} OCR..."
                        )
                        
                        img_path = Path(img_info['path'])
                        ocr_result = await self.ocr_processor.ocr_image_file(img_path)
                        
                        if ocr_result.success and ocr_result.text:
                            image_texts.append(
                                f"\n[Görsel {img_info['index']} metni: {ocr_result.text}]"
                            )
                            ocr_count += 1
                        
                        # Allow event loop to process other tasks
                        await asyncio.sleep(0)
                    
                    # Append image texts to main text
                    if image_texts:
                        text += "\n".join(image_texts)
            
            await self._check_pause_cancel(document_id)
            
            # Stage 3: Text Cleaning
            tracker.update("text_processing", 75, "🧹 Metin temizleniyor...")
            cleaned_text = self.text_cleaner.clean(text)
            
            # Stage 4: Save outputs
            if self.config.save_intermediate_files:
                tracker.update("saving", 80, "💾 Dosyalar kaydediliyor...")
                await self._save_outputs(
                    document_id,
                    db,
                    cleaned_text,
                    extraction_result,
                    ocr_count,
                    output_dirs
                )
            
            await self._check_pause_cancel(document_id)
            
            # Stage 5: Embedding (delegated to embedding service)
            tracker.update("embedding_generation", 85, "🧠 Embedding'ler oluşturuluyor...")
            
            # Import new services
            from ..chunking import chunking_service, ChunkingConfig
            from ..embedding.embedding_service import embedding_service
            from ..vectorstore import vector_store_manager
            
            # Create chunks
            chunking_config = ChunkingConfig(chunk_size=512, chunk_overlap=100)
            chunking_result = chunking_service.chunk(cleaned_text, config=chunking_config)
            
            if not chunking_result.chunks:
                tracker.error("No valid chunks created")
                return PipelineResult(success=False, error="No valid chunks created")
            
            chunks = chunking_result.to_dict_list()
            
            # Create embeddings
            texts = [chunk['text'] for chunk in chunks]
            embeddings = embedding_service.encode(texts=texts, db=db, batch_size=32)
            
            # Get model info
            model = embedding_service.get_active_model(db)
            dimension = model.dimension
            
            # Add to vector stores
            from ...database.models import Document
            document = db.query(Document).filter(Document.id == document_id).first()
            
            vector_result = vector_store_manager.add_document(
                document_id=document_id,
                document_name=document.name if document else f"doc_{document_id}",
                folder_name=folder_name,
                chunks=chunks,
                embeddings=embeddings,
                dimension=dimension
            )
            
            if not vector_result.get('success'):
                tracker.error(vector_result.get('error', 'Vector store failed'))
                return PipelineResult(success=False, error=vector_result.get('error'))
            
            chunks_created = len(chunks)
            tracker.complete(
                total_pages=extraction_result.pages,
                total_chunks=chunks_created,
                images_extracted=extraction_result.image_count
            )
            
            return PipelineResult(
                success=True,
                text=cleaned_text,
                total_pages=extraction_result.pages,
                images_extracted=extraction_result.image_count,
                ocr_operations=ocr_count,
                text_length=len(cleaned_text),
                chunks_created=chunks_created,
                metadata={
                    "extraction_method": extraction_result.metadata.get("extraction_method"),
                    "processing_method": "unified_pipeline"
                }
            )
            
        except asyncio.CancelledError:
            logger.warning(f"⚠️ Processing cancelled for document {document_id}")
            tracker.error("İşlem kullanıcı tarafından iptal edildi")
            return PipelineResult(
                success=False,
                error="Processing cancelled"
            )
            
        except Exception as e:
            logger.error(f"❌ Pipeline failed for document {document_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            tracker.error(str(e))
            return PipelineResult(
                success=False,
                error=str(e)
            )
            
        finally:
            # Cleanup task control
            if document_id in self.task_controls:
                del self.task_controls[document_id]
    
    async def _extract(
        self,
        file_path: Path,
        output_dirs: Dict[str, Path],
        progress_callback: Optional[Callable]
    ) -> ExtractionResult:
        """Extract text and images based on file type"""
        
        extension = file_path.suffix.lower().lstrip('.')
        
        if extension == 'pdf':
            return await self.pdf_extractor.extract(
                file_path,
                output_dir=output_dirs.get('base'),
                progress_callback=progress_callback
            )
        elif extension in ['txt', 'md', 'markdown']:
            return await self.text_extractor.extract(
                file_path,
                progress_callback=progress_callback
            )
        else:
            return ExtractionResult(
                success=False,
                error=f"Unsupported file type: {extension}"
            )
    
    def _prepare_directories(self, doc_folder: Path) -> Dict[str, Path]:
        """Prepare output directories for document processing"""
        
        dirs = {
            'base': doc_folder,
            'original': doc_folder / 'original',
            'images': doc_folder / 'images',
            'processed': doc_folder / 'processed',
            'vectors': doc_folder / 'vectors',
            'analysis': doc_folder / 'analysis'
        }
        
        for path in dirs.values():
            path.mkdir(parents=True, exist_ok=True)
        
        return dirs
    
    async def _save_outputs(
        self,
        document_id: int,
        db: Session,
        text: str,
        extraction_result: ExtractionResult,
        ocr_count: int,
        output_dirs: Dict[str, Path]
    ):
        """Save processed outputs to files and database assets"""
        
        # Save full text
        text_file = output_dirs['processed'] / 'full_text.txt'
        with open(text_file, 'w', encoding='utf-8') as f:
            f.write(text)
        
        # Save assets to database
        if extraction_result.images:
            from ...database.models_v2 import DocumentAsset
            
            # Clear old assets for this document if any (re-processing)
            db.query(DocumentAsset).filter(DocumentAsset.document_id == document_id).delete()
            
            for img_info in extraction_result.images:
                asset = DocumentAsset(
                    document_id=document_id,
                    asset_type="image",
                    file_path=img_info['path'],
                    asset_metadata={
                        'page': img_info.get('page'),
                        'index': img_info.get('index'),
                        'width': img_info.get('width'),
                        'height': img_info.get('height'),
                        'size_bytes': img_info.get('size_bytes')
                    }
                )
                db.add(asset)
            
            db.commit()
            logger.info(f"Saved {len(extraction_result.images)} assets for document {document_id}")
        
        # Save processing summary
        summary_file = output_dirs['analysis'] / 'processing_summary.json'
        summary = {
            'processed_at': datetime.now().isoformat(),
            'total_pages': extraction_result.pages,
            'images_extracted': extraction_result.image_count,
            'ocr_operations': ocr_count,
            'total_text_length': len(text),
            'extraction_metadata': extraction_result.metadata,
            'processing_method': 'unified_pipeline'
        }
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
    
    async def _check_pause_cancel(self, document_id: int):
        """Check if processing should be paused or cancelled"""
        
        if document_id not in self.task_controls:
            return
        
        control = self.task_controls[document_id]
        
        # Check if cancelled
        if control.get("cancelled", False):
            raise asyncio.CancelledError("Processing was cancelled by user")
        
        # Check if paused
        if control.get("paused", False):
            logger.info(f"Document {document_id} processing paused, waiting...")
            pause_event = control.get("pause_event")
            if pause_event:
                await pause_event.wait()
                # Check again if cancelled while paused
                if control.get("cancelled", False):
                    raise asyncio.CancelledError("Processing was cancelled while paused")
    
    # Control methods
    def pause(self, document_id: int) -> bool:
        """Pause document processing"""
        if document_id in self.task_controls:
            control = self.task_controls[document_id]
            if not control["paused"]:
                control["paused"] = True
                control["pause_event"].clear()
                logger.info(f"Document {document_id} processing paused")
                return True
        return False
    
    def resume(self, document_id: int) -> bool:
        """Resume document processing"""
        if document_id in self.task_controls:
            control = self.task_controls[document_id]
            if control["paused"]:
                control["paused"] = False
                control["pause_event"].set()
                logger.info(f"Document {document_id} processing resumed")
                return True
        return False
    
    def cancel(self, document_id: int) -> bool:
        """Cancel document processing"""
        if document_id in self.task_controls:
            self.task_controls[document_id]["cancelled"] = True
            self.task_controls[document_id]["pause_event"].set()
            logger.info(f"Document {document_id} processing cancelled")
            return True
        return False


# Global instance
document_pipeline = DocumentPipeline()
