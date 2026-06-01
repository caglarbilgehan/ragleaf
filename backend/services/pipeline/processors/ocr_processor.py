"""
OCR Processor - Handles OCR operations for images and scanned documents
Performance optimized with async thread execution to prevent UI freezing
"""

import asyncio
import gc
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)

# Thread pool for CPU-intensive OCR operations
_ocr_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ocr_worker")


@dataclass
class OCRResult:
    """Result of OCR operation"""
    success: bool
    text: str = ""
    confidence: float = 0.0
    error: Optional[str] = None


class OCRProcessor:
    """Handle OCR operations for images and scanned documents"""
    
    def __init__(
        self,
        languages: str = "tur+eng",
        config: str = "--psm 6"
    ):
        """
        Initialize OCR processor
        
        Args:
            languages: Tesseract language codes (e.g., "tur+eng" for Turkish and English)
            config: Tesseract configuration string
        """
        self.languages = languages
        self.config = config
        
        # Configure Tesseract path for Docker
        import os
        if os.path.exists('/usr/bin/tesseract'):
            pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'
    
    async def ocr_image_bytes(self, image_data: bytes) -> OCRResult:
        """
        Perform OCR on image bytes (async, runs in thread pool)
        
        Args:
            image_data: Image data as bytes (PNG, JPEG, etc.)
        
        Returns:
            OCRResult with extracted text
        """
        def _do_ocr():
            """Blocking OCR operation to run in thread"""
            try:
                image = Image.open(io.BytesIO(image_data))
                text = pytesseract.image_to_string(
                    image,
                    lang=self.languages,
                    config=self.config
                )
                # Close image to free memory
                if hasattr(image, 'close'):
                    image.close()
                return OCRResult(
                    success=True,
                    text=text.strip()
                )
            except Exception as e:
                return OCRResult(
                    success=False,
                    error=str(e)
                )
        
        try:
            # Run OCR in thread pool to prevent blocking event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(_ocr_executor, _do_ocr)
            return result
            
        except Exception as e:
            logger.warning(f"⚠️ OCR failed: {e}")
            return OCRResult(
                success=False,
                error=str(e)
            )
    
    async def ocr_image_file(self, image_path: Path) -> OCRResult:
        """
        Perform OCR on image file (async, runs in thread pool)
        
        Args:
            image_path: Path to image file
        
        Returns:
            OCRResult with extracted text
        """
        if not image_path.exists():
            return OCRResult(
                success=False,
                error=f"Image file not found: {image_path}"
            )
        
        def _do_ocr():
            """Blocking OCR operation to run in thread"""
            try:
                image = Image.open(image_path)
                text = pytesseract.image_to_string(
                    image,
                    lang=self.languages,
                    config=self.config
                )
                # Close image to free memory
                if hasattr(image, 'close'):
                    image.close()
                return OCRResult(
                    success=True,
                    text=text.strip()
                )
            except Exception as e:
                return OCRResult(
                    success=False,
                    error=str(e)
                )
        
        try:
            # Run OCR in thread pool to prevent blocking event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(_ocr_executor, _do_ocr)
            
            # Periodic garbage collection to prevent memory buildup
            gc.collect()
            
            return result
            
        except Exception as e:
            logger.warning(f"⚠️ OCR failed for {image_path}: {e}")
            return OCRResult(
                success=False,
                error=str(e)
            )
    
    async def ocr_pdf_page(
        self,
        page,
        scale: float = 2.0
    ) -> OCRResult:
        """
        Perform OCR on a PDF page (using PyMuPDF page object)
        Runs in thread pool to prevent blocking.
        
        Args:
            page: PyMuPDF page object
            scale: Scale factor for rendering (higher = better quality but slower)
        
        Returns:
            OCRResult with extracted text
        """
        def _render_and_ocr():
            """Render page and perform OCR in thread"""
            try:
                import fitz
                
                # Render page as image
                matrix = fitz.Matrix(scale, scale)
                pix = page.get_pixmap(matrix=matrix)
                img_data = pix.tobytes("png")
                
                # Clean up pixmap
                pix = None
                
                # Perform OCR
                image = Image.open(io.BytesIO(img_data))
                text = pytesseract.image_to_string(
                    image,
                    lang=self.languages,
                    config=self.config
                )
                
                # Clean up
                if hasattr(image, 'close'):
                    image.close()
                img_data = None
                
                return OCRResult(
                    success=True,
                    text=text.strip()
                )
            except Exception as e:
                return OCRResult(
                    success=False,
                    error=str(e)
                )
        
        try:
            # Run in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(_ocr_executor, _render_and_ocr)
            
            return result
            
        except Exception as e:
            logger.warning(f"⚠️ PDF page OCR failed: {e}")
            return OCRResult(
                success=False,
                error=str(e)
            )
    
    async def ocr_images_batch(
        self,
        image_paths: List[Path],
        progress_callback: Optional[callable] = None
    ) -> List[OCRResult]:
        """
        Perform OCR on multiple images with progress tracking.
        Each OCR runs in thread pool to prevent blocking.
        
        Args:
            image_paths: List of image file paths
            progress_callback: Optional callback for progress updates
        
        Returns:
            List of OCRResult objects
        """
        results = []
        total = len(image_paths)
        
        for i, path in enumerate(image_paths):
            if progress_callback:
                progress = int((i / total) * 100)
                progress_callback("ocr_processing", progress, f"🔍 OCR {i + 1}/{total}...")
            
            result = await self.ocr_image_file(path)
            results.append(result)
            
            # Allow event loop to process other tasks
            await asyncio.sleep(0)
            
            # Periodic garbage collection every 5 images
            if (i + 1) % 5 == 0:
                gc.collect()
        
        return results
