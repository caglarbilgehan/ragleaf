"""
Paragraph-based Chunking Strategy
Chunks text while preserving paragraph boundaries where possible
"""

from typing import List, Set
import logging
import time
import re

from .base_strategy import BaseChunkingStrategy
from ..chunk_models import Chunk, ChunkingConfig

logger = logging.getLogger(__name__)

# Regex pattern for page markers: --- Sayfa X ---
PAGE_MARKER_PATTERN = re.compile(r'---\s*Sayfa\s+(\d+)\s*---', re.IGNORECASE)


class ParagraphChunkingStrategy(BaseChunkingStrategy):
    """
    Chunk text based on paragraphs
    
    This strategy:
    1. Splits text into paragraphs
    2. Combines small paragraphs into chunks up to chunk_size
    3. Splits large paragraphs into sentences if needed
    4. Maintains overlap between chunks for context continuity
    """
    
    name: str = "paragraph"
    
    def chunk(self, text: str) -> List[Chunk]:
        """Split text into chunks based on paragraphs with page tracking"""
        start_time = time.time()
        logger.info(f"📝 ParagraphStrategy.chunk starting with {len(text)} chars")
        
        if not text or len(text.strip()) < self.config.min_chunk_length:
            return []
        
        # Clean text
        logger.info(f"🧹 Step 1: Cleaning text...")
        clean_start = time.time()
        text = self.clean_text(text)
        logger.info(f"🧹 Step 1 Done: clean_text took {time.time() - clean_start:.3f}s, now {len(text)} chars")
        
        # Build page position map: character position -> page number
        logger.info(f"📄 Step 1.5: Building page position map...")
        page_map = self._build_page_position_map(text)
        logger.info(f"📄 Found {len(set(page_map.values()))} unique pages in document")
        
        # Split into paragraphs
        logger.info(f"📄 Step 2: Splitting paragraphs...")
        split_start = time.time()
        paragraphs = self.split_paragraphs(text)
        logger.info(f"📄 Step 2 Done: split_paragraphs took {time.time() - split_start:.3f}s, found {len(paragraphs)} paragraphs")
        
        if not paragraphs:
            # If no paragraphs found, treat entire text as one
            paragraphs = [text]
        
        logger.info(f"🔨 Step 3: Starting chunk loop with {len(paragraphs)} paragraphs")
        chunks: List[Chunk] = []
        current_text = ""
        current_start = 0
        current_pages: Set[int] = set()
        chunk_id = 0
        char_position = 0
        
        for para_idx, paragraph in enumerate(paragraphs):
            para_length = len(paragraph)
            
            # Get pages for this paragraph
            para_pages = self._get_pages_for_range(char_position, char_position + para_length, page_map)
            
            # If paragraph is too long, split it into sentences
            if para_length > self.config.chunk_size:
                # First, save current chunk if exists
                if current_text.strip():
                    chunks.append(self.create_chunk(
                        text=current_text.strip(),
                        chunk_id=chunk_id,
                        start_char=current_start,
                        paragraph_index=para_idx,
                        page_numbers=sorted(list(current_pages))
                    ))
                    chunk_id += 1
                    current_text = ""
                    current_pages = set()
                
                # Split long paragraph into sentence-based chunks
                sentence_chunks = self._chunk_long_paragraph(
                    paragraph, 
                    chunk_id, 
                    para_idx,
                    char_position,
                    page_map
                )
                chunks.extend(sentence_chunks)
                chunk_id += len(sentence_chunks)
                
            else:
                # Check if adding this paragraph exceeds chunk size
                potential_length = len(current_text) + para_length + 2  # +2 for \n\n
                
                if potential_length > self.config.chunk_size and current_text.strip():
                    # Save current chunk
                    chunks.append(self.create_chunk(
                        text=current_text.strip(),
                        chunk_id=chunk_id,
                        start_char=current_start,
                        paragraph_index=para_idx,
                        page_numbers=sorted(list(current_pages))
                    ))
                    chunk_id += 1
                    
                    # Start new chunk with overlap
                    overlap = self.get_overlap_text(current_text)
                    current_text = overlap + " " + paragraph if overlap else paragraph
                    current_start = char_position
                    current_pages = para_pages.copy()
                else:
                    # Add paragraph to current chunk
                    if current_text:
                        current_text += "\n\n" + paragraph
                    else:
                        current_text = paragraph
                        current_start = char_position
                    current_pages.update(para_pages)
            
            char_position += para_length + 2  # Account for paragraph separator
        
        # Add final chunk
        if current_text.strip() and len(current_text.strip()) >= self.config.min_chunk_length:
            chunks.append(self.create_chunk(
                text=current_text.strip(),
                chunk_id=chunk_id,
                start_char=current_start,
                paragraph_index=len(paragraphs),
                page_numbers=sorted(list(current_pages))
            ))
        
        elapsed = time.time() - start_time
        # Log page coverage stats
        chunks_with_pages = sum(1 for c in chunks if c.page_numbers)
        logger.info(f"📝 Created {len(chunks)} chunks using paragraph strategy in {elapsed:.3f}s ({chunks_with_pages} with page info)")
        return chunks
    
    def _build_page_position_map(self, text: str) -> dict:
        """
        Build a map of character positions to page numbers.
        Scans for --- Sayfa X --- markers and tracks which page each position belongs to.
        
        Returns:
            Dict mapping start_position -> page_number for each page marker found
        """
        page_positions = {}
        current_page = 1  # Default to page 1 if no markers found
        
        for match in PAGE_MARKER_PATTERN.finditer(text):
            page_num = int(match.group(1))
            start_pos = match.start()
            page_positions[start_pos] = page_num
        
        # If no page markers found, return empty (will default to no page info)
        if not page_positions:
            return {}
        
        return page_positions
    
    def _get_pages_for_range(self, start: int, end: int, page_map: dict) -> Set[int]:
        """
        Get all page numbers that a character range spans.
        
        Args:
            start: Start character position
            end: End character position
            page_map: Dict of position -> page_number from _build_page_position_map
        
        Returns:
            Set of page numbers this range covers
        """
        if not page_map:
            return set()
        
        pages = set()
        sorted_positions = sorted(page_map.keys())
        
        # Find which page(s) this range falls into
        current_page = None
        for pos in sorted_positions:
            if pos <= start:
                current_page = page_map[pos]
            elif pos < end:
                # This page marker is within our range
                pages.add(page_map[pos])
        
        # Add the page we started on
        if current_page is not None:
            pages.add(current_page)
        
        return pages
    
    def _chunk_long_paragraph(
        self, 
        paragraph: str, 
        start_chunk_id: int,
        para_idx: int,
        char_offset: int,
        page_map: dict = None
    ) -> List[Chunk]:
        """Split a long paragraph into sentence-based chunks with page tracking"""
        
        sentences = self.split_sentences(paragraph)
        
        if not sentences:
            # If no sentences found, force split by character
            return self._force_split(paragraph, start_chunk_id, para_idx, char_offset, page_map)
        
        chunks: List[Chunk] = []
        current_text = ""
        current_start = char_offset
        current_pages: Set[int] = set()
        chunk_id = start_chunk_id
        sentence_idx = 0
        local_offset = 0
        
        for sentence in sentences:
            sentence_length = len(sentence)
            sentence_start = char_offset + local_offset
            sentence_end = sentence_start + sentence_length
            
            # Get pages for this sentence
            sentence_pages = self._get_pages_for_range(sentence_start, sentence_end, page_map) if page_map else set()
            
            # If single sentence is too long, force split it
            if sentence_length > self.config.chunk_size:
                if current_text.strip():
                    chunks.append(self.create_chunk(
                        text=current_text.strip(),
                        chunk_id=chunk_id,
                        start_char=current_start,
                        paragraph_index=para_idx,
                        sentence_index=sentence_idx,
                        page_numbers=sorted(list(current_pages))
                    ))
                    chunk_id += 1
                    current_text = ""
                    current_pages = set()
                
                # Force split the long sentence
                forced_chunks = self._force_split(
                    sentence, chunk_id, para_idx, current_start, page_map
                )
                chunks.extend(forced_chunks)
                chunk_id += len(forced_chunks)
                sentence_idx += 1
                local_offset += sentence_length + 1
                continue
            
            potential_length = len(current_text) + sentence_length + 1
            
            if potential_length > self.config.chunk_size and current_text.strip():
                # Save current chunk
                chunks.append(self.create_chunk(
                    text=current_text.strip(),
                    chunk_id=chunk_id,
                    start_char=current_start,
                    paragraph_index=para_idx,
                    sentence_index=sentence_idx,
                    page_numbers=sorted(list(current_pages))
                ))
                chunk_id += 1
                
                # Start new chunk with overlap
                overlap = self.get_overlap_text(current_text)
                current_text = overlap + " " + sentence if overlap else sentence
                current_start += len(current_text) - len(sentence)
                current_pages = sentence_pages.copy()
            else:
                if current_text:
                    current_text += " " + sentence
                else:
                    current_text = sentence
                current_pages.update(sentence_pages)
            
            local_offset += sentence_length + 1
            sentence_idx += 1
        
        # Add final chunk from this paragraph
        if current_text.strip() and len(current_text.strip()) >= self.config.min_chunk_length:
            chunks.append(self.create_chunk(
                text=current_text.strip(),
                chunk_id=chunk_id,
                start_char=current_start,
                paragraph_index=para_idx,
                sentence_index=sentence_idx,
                page_numbers=sorted(list(current_pages))
            ))
        
        return chunks
    
    def _force_split(
        self, 
        text: str, 
        start_chunk_id: int,
        para_idx: int,
        char_offset: int,
        page_map: dict = None
    ) -> List[Chunk]:
        """Force split text by character count when no natural breaks exist
        
        Memory-efficient version that handles very large texts.
        """
        import gc
        
        text_length = len(text)
        logger.info(f"⚡ Force splitting text of {text_length} chars")
        
        # For very large texts, use more aggressive chunking
        chunk_size = self.config.chunk_size
        min_chunk_len = self.config.min_chunk_length
        overlap = self.config.chunk_overlap
        
        # Limit overlap for very large texts to prevent memory issues
        if text_length > 100000:  # 100KB
            overlap = min(overlap, 50)  # Reduce overlap for huge texts
            logger.warning(f"⚠️ Large text detected ({text_length} chars), reducing overlap to {overlap}")
        
        chunks: List[Chunk] = []
        chunk_id = start_chunk_id
        position = 0
        chunk_count = 0
        max_chunks = 10000  # Safety limit
        
        while position < text_length and chunk_count < max_chunks:
            end_position = min(position + chunk_size, text_length)
            
            # Try to find a word boundary
            if end_position < text_length:
                # Look for last space before end_position
                # Use limited search range to avoid scanning huge strings
                search_start = max(position, end_position - 200)
                last_space = text.rfind(' ', search_start, end_position)
                if last_space > position:
                    end_position = last_space
            
            chunk_text = text[position:end_position].strip()
            
            if chunk_text and len(chunk_text) >= min_chunk_len:
                # Get pages for this chunk range
                chunk_start = char_offset + position
                chunk_end = char_offset + end_position
                chunk_pages = self._get_pages_for_range(chunk_start, chunk_end, page_map) if page_map else set()
                
                chunks.append(self.create_chunk(
                    text=chunk_text,
                    chunk_id=chunk_id,
                    start_char=chunk_start,
                    paragraph_index=para_idx,
                    page_numbers=sorted(list(chunk_pages)),
                    force_split=True
                ))
                chunk_id += 1
                chunk_count += 1
                
                # Periodic garbage collection for very large texts
                if chunk_count % 100 == 0:
                    gc.collect()
                    logger.debug(f"   Processed {chunk_count} chunks, position {position}/{text_length}")
            
            # Move position forward
            # CRITICAL: Ensure we always make progress to avoid infinite loop
            next_position = end_position - overlap
            if next_position <= position:
                # If overlap would cause no progress, just move to end_position
                position = end_position
            else:
                position = next_position
            
            # Safety check: if we're not making progress, break
            if end_position == position and position < text_length:
                logger.warning(f"⚠️ Force split not making progress at position {position}, breaking")
                break
        
        if chunk_count >= max_chunks:
            logger.warning(f"⚠️ Reached max chunk limit ({max_chunks}) for force split")
        
        logger.info(f"⚡ Force split completed: {len(chunks)} chunks from {text_length} chars")
        return chunks

