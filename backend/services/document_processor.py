from __future__ import annotations
"""
Document Processor
Basic document processing with text extraction and OCR

⚠️ DEPRECATED: This module is deprecated and will be removed in a future version.
Use backend/services/pipeline/document_pipeline.py instead.

Migration guide:
    from backend.services.pipeline import document_pipeline
    result = await document_pipeline.process(document_id, file_path, folder_name, db)
"""

import warnings
warnings.warn(
    "document_processor is deprecated. Use pipeline.document_pipeline instead.",
    DeprecationWarning,
    stacklevel=2
)

import os
import io
import asyncio
import logging
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
# import pytesseract  # Lazy import
# from PIL import Image  # Lazy import
# import pypdf  # Lazy import
# from pdf2image import convert_from_path, convert_from_bytes  # Lazy import
try:
    import magic
    HAS_MAGIC = True
except ImportError:
    HAS_MAGIC = False
from sqlalchemy.orm import Session
from ..database.models import Document
# from .vector_service import vector_service  # Lazy import in method

logger = logging.getLogger(__name__)

class DocumentProcessor:
    def __init__(self):
        # Configure Tesseract path for Docker
        if os.path.exists('/usr/bin/tesseract'):
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'
        
        self.supported_formats = {
            'pdf': self._process_pdf,
            'txt': self._process_text,
            'md': self._process_text,
            'docx': self._process_docx,
            'jpg': self._process_image,
            'jpeg': self._process_image,
            'png': self._process_image,
            'bmp': self._process_image,
            'tiff': self._process_image,
        }
    
    async def process_document(
        self,
        file_path: str,
        document_id: int,
        db: Session,
        use_ocr: bool = True
    ) -> Dict[str, Any]:
        """Process a document and extract text with professional embedding"""
        try:
            # Get file info
            file_extension = Path(file_path).suffix.lower().lstrip('.')
            file_size = os.path.getsize(file_path)
            
            logger.info(f"🔄 Processing document {document_id}: {file_path} ({file_extension}, {file_size} bytes)")
            
            # Update document status
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "processing"
                db.commit()
            
            # Detect file type if not recognized by extension
            if file_extension not in self.supported_formats:
                file_type = self._detect_file_type(file_path)
                file_extension = file_type
            
            if file_extension not in self.supported_formats:
                raise ValueError(f"Unsupported file format: {file_extension}")
            
            # Process the document
            processor = self.supported_formats[file_extension]
            result = await processor(file_path, use_ocr)
            
            # Update document with extracted text
            if document:
                document.content = result['text']
                document.metadata = result.get('metadata', {})
                document.status = "processed"
                db.commit()
            
            return {
                "success": True,
                "text": result['text'],
                "metadata": result.get('metadata', {}),
                "file_size": file_size,
                "pages": result.get('pages', 1),
                "processing_time": result.get('processing_time', 0)
            }
            
        except Exception as e:
            # Update document status to error
            if document:
                document.status = "error"
                document.metadata = {"error": str(e)}
                db.commit()
            
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_vector_index(
        self,
        document_id: int,
        db: Session,
        index_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create vector index for a processed document"""
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document or not document.content:
                return {"success": False, "error": "Document not found or not processed"}
            
            if not index_name:
                index_name = f"doc_{document_id}"
            
            # Split document into chunks
            from .vector_service import vector_service
            chunks = vector_service.process_document_for_indexing(
                document.content,
                chunk_size=1000,
                chunk_overlap=200
            )
            
            # Create metadata for each chunk
            metadatas = []
            for i, chunk in enumerate(chunks):
                metadatas.append({
                    "document_id": document_id,
                    "document_name": document.name,
                    "chunk_id": i,
                    "chunk_text": chunk[:100] + "..." if len(chunk) > 100 else chunk
                })
            
            # Add to vector index
            from .vector_service import vector_service
            success = vector_service.add_documents_to_index(
                index_name, chunks, metadatas
            )
            
            if success:
                # Save index to disk
                from .vector_service import vector_service
                from backend.services.storage_service import get_storage
                _storage = get_storage()
                org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
                index_path = str(_storage.get_tenant_indexes_dir(org_slug) / index_name)
                vector_service.save_index(index_name, index_path)
                
                return {
                    "success": True,
                    "index_name": index_name,
                    "chunks_count": len(chunks),
                    "index_stats": vector_service.get_index_stats(index_name)
                }
            else:
                return {"success": False, "error": "Failed to create vector index"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _detect_file_type(self, file_path: str) -> str:
        """Detect file type using python-magic"""
        try:
            mime = magic.Magic(mime=True)
            file_mime = mime.from_file(file_path)
            
            mime_to_ext = {
                'application/pdf': 'pdf',
                'text/plain': 'txt',
                'text/markdown': 'md',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/bmp': 'bmp',
                'image/tiff': 'tiff',
            }
            
            return mime_to_ext.get(file_mime, 'unknown')
        except:
            return 'unknown'
    
    async def _process_pdf(self, file_path: str, use_ocr: bool = True) -> Dict[str, Any]:
        """Process PDF file"""
        text_content = ""
        metadata = {"pages": 0, "method": "text_extraction"}
        
        try:
            # First try text extraction
            import pypdf
            with open(file_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                metadata["pages"] = len(pdf_reader.pages)
                
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
            
            # If no text found and OCR is enabled, use OCR
            if (not text_content.strip() or len(text_content.strip()) < 50) and use_ocr:
                text_content = await self._process_pdf_with_ocr(file_path)
                metadata["method"] = "ocr"
            
            return {
                "text": text_content,
                "metadata": metadata
            }
            
        except Exception as e:
            raise Exception(f"PDF processing failed: {str(e)}")
    
    async def _process_pdf_with_ocr(self, file_path: str) -> str:
        """Process PDF using OCR"""
        try:
            # Convert PDF to images
            from pdf2image import convert_from_path
            import pytesseract
            images = convert_from_path(file_path, dpi=300)
            
            text_content = ""
            for i, image in enumerate(images):
                # Perform OCR on each page
                page_text = pytesseract.image_to_string(
                    image, 
                    lang='tur+eng',  # Turkish and English
                    config='--psm 6'
                )
                text_content += f"\n--- Page {i+1} ---\n{page_text}\n"
            
            return text_content
            
        except Exception as e:
            raise Exception(f"PDF OCR processing failed: {str(e)}")
    
    async def _process_text(self, file_path: str, use_ocr: bool = True) -> Dict[str, Any]:
        """Process text files (txt, md)"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            return {
                "text": content,
                "metadata": {"method": "text_read", "encoding": "utf-8"}
            }
            
        except UnicodeDecodeError:
            # Try different encodings
            for encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    with open(file_path, 'r', encoding=encoding) as file:
                        content = file.read()
                    return {
                        "text": content,
                        "metadata": {"method": "text_read", "encoding": encoding}
                    }
                except:
                    continue
            
            raise Exception("Could not decode text file with any supported encoding")
    
    async def _process_docx(self, file_path: str, use_ocr: bool = True) -> Dict[str, Any]:
        """Process DOCX files"""
        try:
            # This is a placeholder - you'd need python-docx library
            # For now, return empty text
            return {
                "text": "DOCX processing not implemented yet",
                "metadata": {"method": "placeholder"}
            }
        except Exception as e:
            raise Exception(f"DOCX processing failed: {str(e)}")
    
    async def _process_image(self, file_path: str, use_ocr: bool = True) -> Dict[str, Any]:
        """Process image files with OCR"""
        if not use_ocr:
            return {
                "text": "",
                "metadata": {"method": "no_ocr", "message": "OCR disabled for image"}
            }
        
        try:
            # Open image
            from PIL import Image
            import pytesseract
            image = Image.open(file_path)
            
            # Perform OCR
            text_content = pytesseract.image_to_string(
                image,
                lang='tur+eng',  # Turkish and English
                config='--psm 6'
            )
            
            return {
                "text": text_content,
                "metadata": {
                    "method": "ocr",
                    "image_size": image.size,
                    "image_mode": image.mode
                }
            }
            
        except Exception as e:
            raise Exception(f"Image OCR processing failed: {str(e)}")

# Global instance
document_processor = DocumentProcessor()
