"""
Text Extractor - Handles plain text and markdown files
"""

import logging
from pathlib import Path
from typing import Optional

from .base_extractor import BaseExtractor, ExtractionResult

logger = logging.getLogger(__name__)


class TextExtractor(BaseExtractor):
    """Extract text from plain text and markdown files"""
    
    supported_extensions = ['txt', 'md', 'markdown', 'text']
    
    # Encodings to try in order
    ENCODINGS = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1', 'cp1254']
    
    async def extract(
        self,
        file_path: Path,
        output_dir: Optional[Path] = None,
        progress_callback: Optional[callable] = None
    ) -> ExtractionResult:
        """Extract text from text file"""
        
        try:
            if not file_path.exists():
                return ExtractionResult(
                    success=False,
                    error=f"Text file not found: {file_path}"
                )
            
            self._report_progress(
                progress_callback, 
                "text_extraction", 
                30, 
                "📄 Metin dosyası okunuyor..."
            )
            
            # Try different encodings
            content = None
            used_encoding = None
            
            for encoding in self.ENCODINGS:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        content = f.read()
                    used_encoding = encoding
                    break
                except UnicodeDecodeError:
                    continue
            
            if content is None:
                return ExtractionResult(
                    success=False,
                    error="Could not decode text file with any supported encoding"
                )
            
            self._report_progress(
                progress_callback,
                "text_extraction",
                70,
                f"✅ Metin okundu - {len(content):,} karakter"
            )
            
            return ExtractionResult(
                success=True,
                text=content,
                pages=1,
                images=[],
                metadata={
                    "file_name": file_path.name,
                    "extraction_method": "text_read",
                    "encoding": used_encoding,
                    "text_length": len(content)
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Text extraction failed: {e}")
            return ExtractionResult(
                success=False,
                error=str(e)
            )
