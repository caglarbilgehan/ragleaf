from __future__ import annotations
"""
Professional Document Processor
Advanced PDF processing with OCR, image extraction, and professional embedding

⚠️ DEPRECATED: This module is deprecated and will be removed in a future version.
Use backend/services/pipeline/document_pipeline.py instead.

Migration guide:
    from backend.services.pipeline import document_pipeline
    result = await document_pipeline.process(document_id, file_path, folder_name, db)
"""

import warnings
warnings.warn(
    "professional_document_processor is deprecated. Use pipeline.document_pipeline instead.",
    DeprecationWarning,
    stacklevel=2
)
import os
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
# import fitz  # Lazy import
# import pytesseract  # Lazy import
# from PIL import Image  # Lazy import
import io
# import numpy as np  # Lazy import
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database.models import Document
from ..database.connection import SessionLocal
from .professional_embedding_service_v2 import professional_embedding_service_v2

logger = logging.getLogger(__name__)

class ProfessionalDocumentProcessor:
    """Professional document processor with OCR and image extraction"""
    
    def __init__(self):
        # Use StorageService for multi-tenant document paths
        from backend.services.storage_service import get_storage
        _storage = get_storage()
        org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
        self.base_dir = _storage.get_document_root(org_slug)
        
        # OCR settings
        self.ocr_languages = "tur+eng"  # Turkish and English
        self.ocr_config = "--psm 6"  # Simplified config without char whitelist
        
        # Image settings
        self.image_dpi = 300
        self.min_image_size = (50, 50)  # Minimum image size to process (lowered to catch more images)
        
        # Task control reference (will be set by async processor)
        self.task_controls = None
    
    def set_task_controls(self, task_controls):
        """Set reference to async processor's task controls"""
        self.task_controls = task_controls
    
    def _update_progress(self, document_id: int, stage: str, progress: int, details: str):
        """Update document progress using PostgreSQL for immediate visibility"""
        try:
            # Clean, single-line progress log
            logger.info(f"📊 [Doc:{document_id}] {stage} | {progress}% | {details}")
            
            # Create log entry
            timestamp = datetime.now().isoformat()
            log_entry = {
                "timestamp": timestamp,
                "level": "info",
                "stage": stage,
                "progress": progress,
                "message": details
            }
            
            # Use PostgreSQL session
            db = SessionLocal()
            try:
                # Get existing logs
                result = db.execute(
                    text("SELECT processing_logs FROM documents WHERE id = :doc_id"),
                    {"doc_id": document_id}
                )
                row = result.fetchone()
                existing_logs = []
                if row and row[0]:
                    try:
                        existing_logs = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                    except:
                        existing_logs = []
                
                # Append new log entry (keep last 50 logs)
                existing_logs.append(log_entry)
                if len(existing_logs) > 50:
                    existing_logs = existing_logs[-50:]
                
                # Update document
                result = db.execute(
                    text("""
                        UPDATE documents 
                        SET processing_stage = :stage,
                            processing_progress = :progress,
                            processing_details = :details,
                            processing_logs = :logs,
                            updated_at = :updated_at
                        WHERE id = :doc_id
                    """),
                    {
                        "stage": stage,
                        "progress": progress,
                        "details": details,
                        "logs": json.dumps(existing_logs, ensure_ascii=False),
                        "updated_at": timestamp,
                        "doc_id": document_id
                    }
                )
                db.commit()
                
                if result.rowcount == 0:
                    logger.warning(f"⚠️ [Doc:{document_id}] Progress update failed - document may not exist")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Failed to update progress: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    async def _check_pause_cancel(self, document_id: int):
        """Check if processing should be paused or cancelled"""
        if not self.task_controls or document_id not in self.task_controls:
            return
        
        control = self.task_controls[document_id]
        
        # Check if cancelled
        if control.get("cancelled", False):
            raise asyncio.CancelledError("Processing was cancelled by user")
        
        # Check if paused
        if control.get("paused", False):
            logger.info(f"Document {document_id} processing paused, waiting for resume...")
            pause_event = control.get("pause_event")
            if pause_event:
                await pause_event.wait()
                # Check again if cancelled while paused
                if control.get("cancelled", False):
                    raise asyncio.CancelledError("Processing was cancelled while paused")
        
    async def process_document_advanced(
        self, 
        document_id: int, 
        file_path: Path, 
        db: Session
    ) -> Dict[str, Any]:
        """Process document with advanced OCR and image extraction"""
        
        try:
            # Get document from database
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return {"success": False, "error": "Document not found"}
            
            logger.info(f"🚀 Starting advanced processing for document {document_id}: {file_path}")
            
            # Immediate initial update - use direct SQLite for visibility
            self._update_progress(document_id, "initialization", 5, "📄 Döküman işleme başlatıldı! Sistem hazırlanıyor...")
            
            # Quick follow-up update
            self._update_progress(document_id, "initialization", 8, "🔧 Klasör yapısı oluşturuluyor ve dosya hazırlanıyor...")
            
            # Prepare for image extraction
            self._update_progress(document_id, "initialization", 12, "🖼️ Görsel çıkarma sistemi hazırlanıyor...")
            
            # Create document folder structure (only essential folders)
            doc_folder = self.base_dir / document.folder_name
            essential_folders = {
                'original': doc_folder / 'original',
                'images': doc_folder / 'images',  # Directly under images, no extracted subfolder
                'processed': doc_folder / 'processed',
                'vectors': doc_folder / 'vectors',
                'analysis': doc_folder / 'analysis'
            }
            
            # Create only essential folders
            for folder in essential_folders.values():
                folder.mkdir(parents=True, exist_ok=True)
            
            # Optional folders (created only when needed)
            optional_folders = {
                'chunks': doc_folder / 'processed' / 'chunks'  # Only if chunk files are saved
            }
            
            # Move original file if not already moved
            original_file_path = essential_folders['original'] / file_path.name
            if file_path.exists() and not original_file_path.exists():
                import shutil
                shutil.move(str(file_path), str(original_file_path))
                logger.info(f"📄 Moved original file to {original_file_path}")
            elif original_file_path.exists():
                file_path = original_file_path
            
            # Process based on file type
            file_extension = file_path.suffix.lower()
            
            if file_extension == '.pdf':
                result = await self._process_pdf_advanced(
                    file_path, document, essential_folders, db
                )
            elif file_extension in ['.txt', '.md']:
                result = await self._process_text_file(
                    file_path, document, essential_folders, db
                )
            else:
                return {"success": False, "error": f"Unsupported file type: {file_extension}"}
            
            if result['success']:
                # Final update already done in _process_pdf_advanced
                logger.info(f"✅ Advanced processing completed for document {document_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Advanced processing failed for document {document_id}: {e}")
            
            # Update document with error using direct PostgreSQL
            try:
                db_session = SessionLocal()
                try:
                    db_session.execute(
                        text("""
                            UPDATE documents 
                            SET status = 'error',
                                processing_details = :details,
                                updated_at = :updated_at
                            WHERE id = :doc_id
                        """),
                        {
                            "details": f"Hata: {str(e)}",
                            "updated_at": datetime.now().isoformat(),
                            "doc_id": document_id
                        }
                    )
                    db_session.commit()
                finally:
                    db_session.close()
            except Exception as ex:
                logger.error(f"Failed to update error status: {ex}")
            
            return {"success": False, "error": str(e)}
    
    async def _process_pdf_advanced(
        self, 
        file_path: Path, 
        document: Document, 
        essential_folders: Dict[str, Path], 
        db: Session
    ) -> Dict[str, Any]:
        """Advanced PDF processing with OCR and image extraction"""
        
        try:
            document_id = document.id
            
            # Update progress for PDF opening
            self._update_progress(document_id, "pdf_analysis", 15, "📖 PDF dosyası açılıyor ve analiz ediliyor...")
            
            # Open PDF document
            logger.info(f"📂 Opening PDF: {file_path}")
            if not file_path.exists():
                logger.error(f"❌ PDF file does not exist: {file_path}")
                return {"success": False, "error": f"PDF file not found: {file_path}"}
            
            import fitz
            pdf_doc = fitz.open(str(file_path))
            total_pages = pdf_doc.page_count
            
            logger.info(f"📖 PDF opened successfully: {total_pages} pages found")
            
            # Update after PDF analysis
            self._update_progress(document_id, "pdf_analysis", 18, f"📖 PDF analizi tamamlandı - {total_pages} sayfa tespit edildi")
            
            # Initialize tracking variables
            all_text = ""
            images_extracted = 0
            ocr_results = []
            page_data = []  # Store page info for batch processing
            
            # PHASE 1: Extract images and text from all pages
            self._update_progress(document_id, "image_extraction", 20, f"🖼️ Görsel çıkarma başlatılıyor... (Toplam {total_pages} sayfa)")
            
            logger.info(f"🔄 Starting page loop for {total_pages} pages, document_id={document_id}")
            
            for page_num in range(total_pages):
                try:
                    # Check for pause/cancel before processing each page
                    await self._check_pause_cancel(document_id)
                    
                    page = pdf_doc[page_num]
                    
                    # Update progress for image extraction
                    progress = 20 + (page_num / total_pages) * 30  # 30% for image extraction
                    self._update_progress(document_id, "image_extraction", int(progress), f"🖼️ Sayfa {page_num + 1}/{total_pages} - Görseller çıkarılıyor...")
                    
                    logger.info(f"📄 Processing page {page_num + 1}/{total_pages} for image extraction")
                    
                    # Extract images from page
                    images_folder = essential_folders['images']
                    logger.info(f"📁 Images folder: {images_folder}")
                    
                    page_images = await self._extract_images_from_page(
                        page, page_num, images_folder
                    )
                    images_extracted += len(page_images)
                    
                    logger.info(f"✅ Extracted {len(page_images)} images from page {page_num + 1}, total: {images_extracted}")
                    
                    # Extract text directly from PDF
                    page_text = page.get_text()
                    text_len = len(page_text) if page_text else 0
                    logger.info(f"📝 Extracted {text_len} chars of text from page {page_num + 1}")
                    
                    # Store page data for later processing
                    page_data.append({
                        'page_num': page_num,
                        'page': page,
                        'images': page_images,
                        'text': page_text
                    })
                    
                except asyncio.CancelledError:
                    logger.warning(f"⚠️ Processing cancelled at page {page_num + 1}")
                    raise
                except Exception as e:
                    logger.error(f"❌ Error processing page {page_num + 1} during image extraction: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    # Continue with next page instead of failing completely
                    # Add empty page data to maintain page numbering
                    page_data.append({
                        'page_num': page_num,
                        'page': None,
                        'images': [],
                        'text': ''
                    })
                    continue
                
                if len(page_images) > 0:
                    self._update_progress(document_id, "image_extraction", int(progress), f"✅ Sayfa {page_num + 1}/{total_pages} - {len(page_images)} görsel çıkarıldı (Toplam: {images_extracted})")
            
            # Update after all images extracted
            self._update_progress(document_id, "image_extraction", 50, f"✅ Tüm görseller çıkarıldı! Toplam {images_extracted} görsel. Metin işleme başlıyor...")
            
            # PHASE 2: Process text and OCR (batch processing)
            self._update_progress(document_id, "text_extraction", 55, "📄 Metin çıkarma ve OCR işlemleri başlatılıyor...")
            
            for idx, page_info in enumerate(page_data):
                try:
                    # Check for pause/cancel before processing each page
                    await self._check_pause_cancel(document_id)
                    
                    page_num = page_info['page_num']
                    page = page_info['page']
                    page_images = page_info['images']
                    page_text = page_info['text']
                    
                    # Skip if page is None (error during extraction)
                    if page is None:
                        logger.warning(f"Skipping page {page_num + 1} due to previous extraction error")
                        continue
                    
                    # Update progress for text processing
                    progress = 55 + (idx / total_pages) * 25  # 25% for text/OCR processing
                    self._update_progress(document_id, "text_extraction", int(progress), f"📄 Sayfa {page_num + 1}/{total_pages} - Metin işleniyor...")
                    
                    logger.info(f"Processing page {page_num + 1}/{total_pages} for text/OCR")
                    
                except Exception as e:
                    logger.error(f"Error processing page {page_num + 1} during text/OCR: {e}")
                    continue
                
                # If no text or very little text, use OCR
                if len(page_text.strip()) < 50:
                    logger.info(f"📸 Using OCR for page {page_num + 1} (little text found)")
                    
                    self._update_progress(document_id, "ocr_processing", int(progress), f"🔍 Sayfa {page_num + 1}/{total_pages} - OCR ile metin çıkarılıyor...")
                    
                    # Render page as image for OCR
                    import fitz
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
                    img_data = pix.tobytes("png")
                    
                    # OCR the page
                    ocr_text = await self._ocr_image_data(img_data, page_num)
                    if ocr_text:
                        page_text = ocr_text
                        ocr_results.append({
                            'page': page_num + 1,
                            'method': 'full_page_ocr',
                            'text_length': len(ocr_text)
                        })
                
                # OCR extracted images for additional text
                if len(page_images) > 0:
                    self._update_progress(document_id, "image_ocr", int(progress), f"🔍 Sayfa {page_num + 1}/{total_pages} - {len(page_images)} görselde metin aranıyor...")
                    
                    for img_info in page_images:
                        img_ocr_text = await self._ocr_image_file(img_info['path'])
                        # Store OCR text in img_info for later database save
                        img_info['ocr_text'] = img_ocr_text if img_ocr_text else None
                        
                        if img_ocr_text and len(img_ocr_text.strip()) > 10:
                            page_text += f"\n[Görsel {img_info['index']} metni: {img_ocr_text}]"
                            ocr_results.append({
                                'page': page_num + 1,
                                'image_index': img_info['index'],
                                'method': 'image_ocr',
                                'text_length': len(img_ocr_text),
                                'ocr_text': img_ocr_text  # Store for reference
                            })
                
                all_text += f"\n--- Sayfa {page_num + 1} ---\n{page_text}\n"
            
            pdf_doc.close()
            
            # Save OCR results
            ocr_results_file = essential_folders['processed'] / 'ocr_results.json'
            with open(ocr_results_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'total_pages': total_pages,
                    'images_extracted': images_extracted,
                    'ocr_operations': ocr_results,
                    'total_text_length': len(all_text)
                }, f, ensure_ascii=False, indent=2)
            
            # Save extracted images to database as DocumentAsset records with OCR text
            try:
                from ..database.models_v2 import DocumentAsset
                from ..database.connection_v2 import SessionLocal as SessionLocalV2
                
                db_v2 = SessionLocalV2()
                try:
                    # Clear old assets for this document (re-processing case)
                    db_v2.query(DocumentAsset).filter(DocumentAsset.document_id == document_id).delete()
                    
                    # Collect all images from page_data with their OCR text
                    for page_info in page_data:
                        for img_info in page_info.get('images', []):
                            asset = DocumentAsset(
                                document_id=document_id,
                                asset_type="image",
                                file_path=str(img_info['path']),
                                ocr_text=img_info.get('ocr_text'),  # Save OCR text from processing
                                asset_metadata={
                                    'page': img_info.get('page', page_info['page_num'] + 1),
                                    'index': img_info.get('index', 0),
                                    'width': img_info.get('width', 0),
                                    'height': img_info.get('height', 0),
                                    'filename': Path(img_info['path']).name if img_info.get('path') else None,
                                    'tags': []
                                }
                            )
                            db_v2.add(asset)
                    
                    db_v2.commit()
                    logger.info(f"✅ Saved {images_extracted} assets with OCR text to database for document {document_id}")
                finally:
                    db_v2.close()
            except Exception as e:
                logger.error(f"⚠️ Failed to save assets to database: {e}")
                # Don't fail the whole process for asset saving failure
            
            # Update progress for text processing
            self._update_progress(document_id, "text_processing", 70, f"Metin işleniyor... ({len(all_text):,} karakter, {images_extracted} görsel)")
            
            # Process with professional embedding service v2
            self._update_progress(document_id, "embedding_generation", 80, "Embedding'ler oluşturuluyor ve FAISS index hazırlanıyor...")
            
            # Pass controls to embedding service
            professional_embedding_service_v2.set_task_controls(self.task_controls)
            
            embedding_result = await professional_embedding_service_v2.process_document_professional(
                document.id, all_text, db, start_progress=80, end_progress=95
            )
            
            if not embedding_result['success']:
                return embedding_result
            
            # Update document with final results using PostgreSQL for immediate visibility
            try:
                db_session = SessionLocal()
                try:
                    db_session.execute(
                        text("""
                            UPDATE documents 
                            SET status = 'processed',
                                processing_stage = 'completed',
                                processing_progress = 100,
                                processing_details = :details,
                                total_pages = :pages,
                                total_chunks = :chunks,
                                ocr_completed = 1,
                                vector_indexed = 1,
                                processed_at = :processed_at,
                                updated_at = :updated_at
                            WHERE id = :doc_id
                        """),
                        {
                            "details": f"✅ İşlem tamamlandı! {embedding_result.get('chunks_created', 0)} chunk, {images_extracted} görsel",
                            "pages": total_pages,
                            "chunks": embedding_result.get('chunks_created', 0),
                            "processed_at": datetime.now().isoformat(),
                            "updated_at": datetime.now().isoformat(),
                            "doc_id": document_id
                        }
                    )
                    db_session.commit()
                finally:
                    db_session.close()
            except Exception as e:
                logger.error(f"Failed to update final status: {e}")
            
            # Save processed text
            processed_text_file = essential_folders['processed'] / 'full_text.txt'
            with open(processed_text_file, 'w', encoding='utf-8') as f:
                f.write(all_text)
            
            # Create analysis summary
            analysis_file = essential_folders['analysis'] / 'processing_summary.json'
            with open(analysis_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'document_id': document.id,
                    'file_name': file_path.name,
                    'total_pages': total_pages,
                    'images_extracted': images_extracted,
                    'ocr_operations': len(ocr_results),
                    'total_text_length': len(all_text),
                    'chunks_created': embedding_result.get('chunks_created', 0),
                    'processing_method': 'advanced_pdf_with_ocr'
                }, f, ensure_ascii=False, indent=2)
            
            return {
                "success": True,
                "total_pages": total_pages,
                "images_extracted": images_extracted,
                "ocr_operations": len(ocr_results),
                "total_text_length": len(all_text),
                "total_chunks": embedding_result.get('chunks_created', 0),
                "processing_method": "advanced_pdf_with_ocr"
            }
            
        except Exception as e:
            logger.error(f"❌ PDF processing failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _extract_images_from_page(
        self, 
        page, 
        page_num: int, 
        images_folder: Path
    ) -> List[Dict[str, Any]]:
        """Extract images from a PDF page"""
        
        images = []
        image_list = page.get_images()
        
        logger.info(f"📄 Page {page_num + 1}: Found {len(image_list)} raw images to process")
        
        for img_index, img in enumerate(image_list):
            try:
                import fitz
                xref = img[0]
                pix = fitz.Pixmap(page.parent, xref)
                
                logger.info(f"🔍 Image {img_index + 1} from page {page_num + 1}: {pix.width}x{pix.height}, n={pix.n}, alpha={pix.alpha}")
                
                # Skip if image is too small
                if pix.width < self.min_image_size[0] or pix.height < self.min_image_size[1]:
                    logger.info(f"⏭️ Skipping small image {img_index + 1} from page {page_num + 1}: {pix.width}x{pix.height} (min: {self.min_image_size[0]}x{self.min_image_size[1]})")
                    pix = None
                    continue
                
                # Handle CMYK images by converting to RGB
                if pix.n - pix.alpha >= 4:  # CMYK
                    logger.info(f"🔄 Converting CMYK image to RGB: page {page_num + 1}, image {img_index + 1}")
                    import fitz
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                
                # Save as PNG
                img_data = pix.tobytes("png")
                img_path = images_folder / f"page_{page_num + 1}_img_{img_index + 1}.png"
                
                with open(img_path, "wb") as f:
                    f.write(img_data)
                
                images.append({
                    'path': img_path,
                    'page': page_num + 1,
                    'index': img_index + 1,
                    'width': pix.width,
                    'height': pix.height,
                    'size_bytes': len(img_data)
                })
                
                logger.info(f"✅ Extracted image {img_index + 1} from page {page_num + 1}: {pix.width}x{pix.height}")
                
                pix = None
                
            except Exception as e:
                logger.warning(f"⚠️ Could not extract image {img_index} from page {page_num + 1}: {e}")
                continue
        
        logger.info(f"📄 Page {page_num + 1}: Successfully extracted {len(images)} images")
        return images
    
    async def _ocr_image_data(self, img_data: bytes, page_num: int) -> str:
        """Perform OCR on image data"""
        try:
            # Convert bytes to PIL Image
            from PIL import Image
            import pytesseract
            image = Image.open(io.BytesIO(img_data))
            
            # Perform OCR
            text = pytesseract.image_to_string(
                image, 
                lang=self.ocr_languages,
                config=self.ocr_config
            )
            
            return text.strip()
            
        except Exception as e:
            logger.warning(f"⚠️ OCR failed for page {page_num + 1}: {e}")
            return ""
    
    async def _ocr_image_file(self, img_path: Path) -> str:
        """Perform OCR on image file"""
        try:
            if not img_path.exists():
                return ""
            
            # Open image
            from PIL import Image
            import pytesseract
            image = Image.open(img_path)
            
            # Perform OCR
            text = pytesseract.image_to_string(
                image, 
                lang=self.ocr_languages,
                config=self.ocr_config
            )
            
            return text.strip()
            
        except Exception as e:
            logger.warning(f"⚠️ OCR failed for image {img_path}: {e}")
            return ""
    
    async def _process_text_file(
        self, 
        file_path: Path, 
        document: Document, 
        essential_folders: Dict[str, Path], 
        db: Session
    ) -> Dict[str, Any]:
        """Process text file"""
        
        try:
            # Read text file
            with open(file_path, 'r', encoding='utf-8') as f:
                text_content = f.read()
            
            # Update progress
            self._update_progress(document.id, "text_processing", 50, "Metin dosyası işleniyor...")
            
            # Process with professional embedding service v2
            embedding_result = await professional_embedding_service_v2.process_document(
                document.id, text_content, db
            )
            
            if not embedding_result['success']:
                return embedding_result
            
            # Save processed text
            processed_text_file = essential_folders['processed'] / 'full_text.txt'
            with open(processed_text_file, 'w', encoding='utf-8') as f:
                f.write(text_content)
            
            return {
                "success": True,
                "total_text_length": len(text_content),
                "total_chunks": embedding_result.get('chunks_created', 0),
                "processing_method": "text_file"
            }
            
        except Exception as e:
            logger.error(f"❌ Text file processing failed: {e}")
            return {"success": False, "error": str(e)}

# Global instance
professional_document_processor = ProfessionalDocumentProcessor()
