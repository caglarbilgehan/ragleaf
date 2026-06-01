"""
Text Cleaner - Handles text normalization and cleaning
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class TextCleaner:
    """Clean and normalize extracted text"""
    
    def __init__(
        self,
        remove_extra_whitespace: bool = True,
        normalize_unicode: bool = True,
        remove_control_chars: bool = True
    ):
        self.remove_extra_whitespace = remove_extra_whitespace
        self.normalize_unicode = normalize_unicode
        self.remove_control_chars = remove_control_chars
    
    def clean(self, text: str) -> str:
        """
        Clean and normalize text
        
        Args:
            text: Raw text to clean
        
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        result = text
        
        # Remove control characters (except newlines and tabs)
        if self.remove_control_chars:
            result = self._remove_control_chars(result)
        
        # Normalize unicode
        if self.normalize_unicode:
            result = self._normalize_unicode(result)
        
        # Remove extra whitespace
        if self.remove_extra_whitespace:
            result = self._remove_extra_whitespace(result)
        
        return result.strip()
    
    def _remove_control_chars(self, text: str) -> str:
        """Remove control characters except newlines and tabs"""
        # Keep \n (newline), \t (tab), \r (carriage return)
        return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    def _normalize_unicode(self, text: str) -> str:
        """Normalize unicode characters"""
        import unicodedata
        # Normalize to NFC form (composed characters)
        return unicodedata.normalize('NFC', text)
    
    def _remove_extra_whitespace(self, text: str) -> str:
        """Remove extra whitespace while preserving paragraph structure"""
        # Replace multiple spaces with single space
        result = re.sub(r'[ \t]+', ' ', text)
        # Replace 3+ newlines with 2 newlines (preserve paragraphs)
        result = re.sub(r'\n{3,}', '\n\n', result)
        # Remove trailing whitespace from lines
        result = re.sub(r' +\n', '\n', result)
        return result
    
    def clean_ocr_text(self, text: str) -> str:
        """
        Clean OCR-specific artifacts
        
        Args:
            text: OCR output text
        
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        result = text
        
        # Fix common OCR errors
        result = self._fix_ocr_errors(result)
        
        # Apply standard cleaning
        result = self.clean(result)
        
        return result
    
    def _fix_ocr_errors(self, text: str) -> str:
        """Fix common OCR errors"""
        # Common OCR substitutions
        replacements = {
            '|': 'I',  # Pipe often misread as I
            '0': 'O',  # Zero sometimes misread as O (context dependent)
            '1': 'l',  # One sometimes misread as l (context dependent)
        }
        
        # Only apply in specific contexts (e.g., within words)
        # For now, just return as-is to avoid false corrections
        return text
    
    def extract_sentences(self, text: str) -> list:
        """
        Extract sentences from text
        
        Args:
            text: Input text
        
        Returns:
            List of sentences
        """
        if not text:
            return []
        
        # Simple sentence splitting (handles Turkish and English)
        # Split on . ! ? followed by space and capital letter or end of string
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])', text)
        
        # Clean and filter empty sentences
        return [s.strip() for s in sentences if s.strip()]
    
    def extract_paragraphs(self, text: str) -> list:
        """
        Extract paragraphs from text
        
        Args:
            text: Input text
        
        Returns:
            List of paragraphs
        """
        if not text:
            return []
        
        # Split on double newlines
        paragraphs = re.split(r'\n\s*\n', text)
        
        # Clean and filter empty paragraphs
        return [p.strip() for p in paragraphs if p.strip()]
