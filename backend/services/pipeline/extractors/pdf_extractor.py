"""
PDF Extractor - Handles PDF text and image extraction
"""

import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
import fitz  # PyMuPDF

from .base_extractor import BaseExtractor, ExtractionResult

logger = logging.getLogger(__name__)


class PDFExtractor(BaseExtractor):
    """Extract text and images from PDF files"""
    
    supported_extensions = ['pdf']
    
    def __init__(
        self,
        min_image_size: tuple = (50, 50),
        image_dpi: int = 300
    ):
        self.min_image_size = min_image_size
        self.image_dpi = image_dpi
    
    async def extract(
        self,
        file_path: Path,
        output_dir: Optional[Path] = None,
        progress_callback: Optional[callable] = None
    ) -> ExtractionResult:
        """Extract text and images from PDF"""
        
        try:
            if not file_path.exists():
                return ExtractionResult(
                    success=False,
                    error=f"PDF file not found: {file_path}"
                )
            
            self._report_progress(progress_callback, "pdf_analysis", 15, "📖 PDF dosyası açılıyor...")
            
            pdf_doc = fitz.open(str(file_path))
            total_pages = pdf_doc.page_count
            
            logger.info(f"📖 PDF opened: {total_pages} pages")
            self._report_progress(
                progress_callback, 
                "pdf_analysis", 
                18, 
                f"📖 PDF analizi tamamlandı - {total_pages} sayfa"
            )
            
            all_text = ""
            all_images: List[Dict[str, Any]] = []
            
            # Create images directory if output_dir provided
            images_dir = None
            if output_dir:
                images_dir = output_dir / "images"
                images_dir.mkdir(parents=True, exist_ok=True)
                logger.info(f"🖼️ Creating images directory: {images_dir}")
            
            for page_num in range(total_pages):
                page = pdf_doc[page_num]
                
                # Calculate progress (20-70% for extraction)
                progress = 20 + int((page_num / total_pages) * 50)
                self._report_progress(
                    progress_callback,
                    "text_extraction",
                    progress,
                    f"📄 Sayfa {page_num + 1}/{total_pages} işleniyor..."
                )
                
                # Extract text
                page_text = page.get_text()
                all_text += f"\n--- Sayfa {page_num + 1} ---\n{page_text}\n"
                
                # Extract images if output directory provided
                if images_dir:
                    page_images = await self._extract_images_from_page(
                        page, page_num, images_dir
                    )
                    all_images.extend(page_images)
            
            pdf_doc.close()
            
            self._report_progress(
                progress_callback,
                "text_extraction",
                70,
                f"✅ Metin çıkarma tamamlandı - {len(all_text):,} karakter"
            )
            
            return ExtractionResult(
                success=True,
                text=all_text,
                pages=total_pages,
                images=all_images,
                metadata={
                    "file_name": file_path.name,
                    "extraction_method": "pymupdf",
                    "text_length": len(all_text),
                    "images_extracted": len(all_images)
                }
            )
            
        except Exception as e:
            logger.error(f"❌ PDF extraction failed: {e}")
            return ExtractionResult(
                success=False,
                error=str(e)
            )
    
    async def _extract_images_from_page(
        self,
        page,
        page_num: int,
        images_dir: Path
    ) -> List[Dict[str, Any]]:
        """Extract images from a PDF page"""
        
        images = []
        image_list = page.get_images()
        
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                pix = fitz.Pixmap(page.parent, xref)
                
                # Skip small images
                if pix.width < self.min_image_size[0] or pix.height < self.min_image_size[1]:
                    pix = None
                    continue
                
                # Convert CMYK to RGB
                if pix.n - pix.alpha >= 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                
                # Save as PNG
                img_data = pix.tobytes("png")
                img_path = images_dir / f"page_{page_num + 1}_img_{img_index + 1}.png"
                
                with open(img_path, "wb") as f:
                    f.write(img_data)
                
                images.append({
                    'path': str(img_path),
                    'page': page_num + 1,
                    'index': img_index + 1,
                    'width': pix.width,
                    'height': pix.height,
                    'size_bytes': len(img_data)
                })
                
                logger.debug(f"✅ Extracted image {img_index + 1} from page {page_num + 1}")
                pix = None
                
            except Exception as e:
                logger.warning(f"⚠️ Could not extract image {img_index} from page {page_num + 1}: {e}")
                continue
        
        return images
    
    def needs_ocr(self, text: str, threshold: int = 50) -> bool:
        """Check if extracted text is too short and OCR might be needed"""
        return len(text.strip()) < threshold
