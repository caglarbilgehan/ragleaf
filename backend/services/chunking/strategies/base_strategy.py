"""
Base Chunking Strategy
Abstract base class for all chunking strategies
"""

from abc import ABC, abstractmethod
from typing import List
import re
import logging
import time

from ..chunk_models import Chunk, ChunkingConfig

logger = logging.getLogger(__name__)


class BaseChunkingStrategy(ABC):
    """Abstract base class for chunking strategies"""
    
    name: str = "base"
    
    def __init__(self, config: ChunkingConfig):
        self.config = config
    
    @abstractmethod
    def chunk(self, text: str) -> List[Chunk]:
        """
        Split text into chunks
        
        Args:
            text: Input text to chunk
        
        Returns:
            List of Chunk objects
        """
        pass
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text before chunking"""
        if not text:
            return ""
        
        # Remove extra horizontal whitespace but preserve newlines
        text = re.sub(r'[ \t]+', ' ', text)
        
        # Remove control characters (keep newlines for paragraph detection)
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        
        return text.strip()
    
    def split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        start_time = time.time()
        logger.debug(f"🔍 split_sentences starting with {len(text)} chars")
        
        # Simplified regex - split on sentence endings followed by space
        # This is safer for large texts and avoids complex lookahead
        sentences = re.split(r'(?<=[.!?])\s+', text)
        result = [s.strip() for s in sentences if s.strip()]
        
        elapsed = time.time() - start_time
        logger.debug(f"✅ split_sentences completed in {elapsed:.3f}s, {len(result)} sentences")
        return result
    
    def split_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs"""
        start_time = time.time()
        logger.debug(f"🔍 split_paragraphs starting with {len(text)} chars")
        
        # Split on double newlines or multiple newlines
        paragraphs = re.split(r'\n\s*\n', text)
        result = [p.strip() for p in paragraphs if p.strip()]
        
        elapsed = time.time() - start_time
        logger.debug(f"✅ split_paragraphs completed in {elapsed:.3f}s, {len(result)} paragraphs")
        return result
    
    def get_overlap_text(self, text: str) -> str:
        """Get overlap text from end of chunk for continuity"""
        if len(text) <= self.config.chunk_overlap:
            return text
        
        overlap_text = text[-self.config.chunk_overlap:]
        
        # Try to find a good breaking point (sentence end)
        sentence_ends = list(re.finditer(r'[.!?]+', overlap_text))
        if sentence_ends:
            last_end = sentence_ends[-1].end()
            overlap_text = overlap_text[last_end:].strip()
        
        return overlap_text
    
    def create_chunk(
        self, 
        text: str, 
        chunk_id: int,
        start_char: int = 0,
        paragraph_index: int = 0,
        sentence_index: int = 0,
        page_numbers: List[int] = None,
        **metadata
    ) -> Chunk:
        """Create a Chunk object with metadata"""
        return Chunk(
            id=chunk_id,
            text=text,
            start_char=start_char,
            end_char=start_char + len(text),
            paragraph_index=paragraph_index,
            sentence_index=sentence_index,
            page_numbers=page_numbers or [],
            metadata=metadata
        )
