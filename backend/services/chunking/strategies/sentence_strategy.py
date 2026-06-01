"""
Sentence-based Chunking Strategy
Chunks text at sentence boundaries for maximum coherence
"""

from typing import List
import logging

from .base_strategy import BaseChunkingStrategy
from ..chunk_models import Chunk, ChunkingConfig

logger = logging.getLogger(__name__)


class SentenceChunkingStrategy(BaseChunkingStrategy):
    """
    Chunk text based on sentences
    
    This strategy:
    1. Splits text into sentences
    2. Combines sentences into chunks up to chunk_size
    3. Never breaks mid-sentence (unless sentence > chunk_size)
    4. Maintains overlap between chunks
    
    Best for: Technical documents, legal texts, precise retrieval
    """
    
    name: str = "sentence"
    
    def chunk(self, text: str) -> List[Chunk]:
        """Split text into chunks based on sentences"""
        
        if not text or len(text.strip()) < self.config.min_chunk_length:
            return []
        
        # Clean text
        text = self.clean_text(text)
        
        # Split into sentences
        sentences = self.split_sentences(text)
        
        if not sentences:
            # If no sentences found, treat entire text as one chunk
            if len(text) <= self.config.chunk_size:
                return [self.create_chunk(text=text, chunk_id=0)]
            else:
                # Force split
                return self._force_split_text(text)
        
        chunks: List[Chunk] = []
        current_sentences: List[str] = []
        current_length = 0
        chunk_id = 0
        char_position = 0
        
        for sent_idx, sentence in enumerate(sentences):
            sentence_length = len(sentence)
            
            # If single sentence is too long, handle specially
            if sentence_length > self.config.chunk_size:
                # First, save current accumulated sentences
                if current_sentences:
                    chunk_text = " ".join(current_sentences)
                    chunks.append(self.create_chunk(
                        text=chunk_text,
                        chunk_id=chunk_id,
                        start_char=char_position - current_length,
                        sentence_index=sent_idx - len(current_sentences)
                    ))
                    chunk_id += 1
                    current_sentences = []
                    current_length = 0
                
                # Split long sentence
                long_chunks = self._split_long_sentence(
                    sentence, chunk_id, sent_idx, char_position
                )
                chunks.extend(long_chunks)
                chunk_id += len(long_chunks)
                char_position += sentence_length + 1
                continue
            
            # Check if adding this sentence exceeds chunk size
            potential_length = current_length + sentence_length + 1  # +1 for space
            
            if potential_length > self.config.chunk_size and current_sentences:
                # Save current chunk
                chunk_text = " ".join(current_sentences)
                chunks.append(self.create_chunk(
                    text=chunk_text,
                    chunk_id=chunk_id,
                    start_char=char_position - current_length,
                    sentence_index=sent_idx - len(current_sentences)
                ))
                chunk_id += 1
                
                # Calculate overlap sentences
                overlap_sentences = self._get_overlap_sentences(current_sentences)
                current_sentences = overlap_sentences + [sentence]
                current_length = sum(len(s) for s in current_sentences) + len(current_sentences) - 1
            else:
                current_sentences.append(sentence)
                current_length = potential_length
            
            char_position += sentence_length + 1
        
        # Add final chunk
        if current_sentences:
            chunk_text = " ".join(current_sentences)
            if len(chunk_text) >= self.config.min_chunk_length:
                chunks.append(self.create_chunk(
                    text=chunk_text,
                    chunk_id=chunk_id,
                    start_char=char_position - current_length,
                    sentence_index=len(sentences) - len(current_sentences)
                ))
        
        logger.info(f"📝 Created {len(chunks)} chunks using sentence strategy")
        return chunks
    
    def _get_overlap_sentences(self, sentences: List[str]) -> List[str]:
        """Get sentences for overlap from end of chunk"""
        if not sentences:
            return []
        
        overlap_sentences = []
        overlap_length = 0
        
        # Work backwards through sentences
        for sentence in reversed(sentences):
            if overlap_length + len(sentence) > self.config.chunk_overlap:
                break
            overlap_sentences.insert(0, sentence)
            overlap_length += len(sentence) + 1
        
        return overlap_sentences
    
    def _split_long_sentence(
        self, 
        sentence: str, 
        start_chunk_id: int,
        sent_idx: int,
        char_offset: int
    ) -> List[Chunk]:
        """Split a sentence that exceeds chunk_size"""
        
        chunks: List[Chunk] = []
        chunk_id = start_chunk_id
        position = 0
        
        while position < len(sentence):
            end_position = min(position + self.config.chunk_size, len(sentence))
            
            # Try to find a word boundary
            if end_position < len(sentence):
                # Look for punctuation or space
                for sep in [',', ';', ':', ' ']:
                    last_sep = sentence.rfind(sep, position, end_position)
                    if last_sep > position + self.config.chunk_size // 2:
                        end_position = last_sep + 1
                        break
            
            chunk_text = sentence[position:end_position].strip()
            
            if chunk_text and len(chunk_text) >= self.config.min_chunk_length:
                chunks.append(self.create_chunk(
                    text=chunk_text,
                    chunk_id=chunk_id,
                    start_char=char_offset + position,
                    sentence_index=sent_idx,
                    is_partial_sentence=True
                ))
                chunk_id += 1
            
            # Move with overlap
            position = max(position + 1, end_position - self.config.chunk_overlap)
        
        return chunks
    
    def _force_split_text(self, text: str) -> List[Chunk]:
        """Force split text when no sentences found"""
        chunks: List[Chunk] = []
        chunk_id = 0
        position = 0
        
        while position < len(text):
            end_position = min(position + self.config.chunk_size, len(text))
            
            # Try to find word boundary
            if end_position < len(text):
                last_space = text.rfind(' ', position, end_position)
                if last_space > position:
                    end_position = last_space
            
            chunk_text = text[position:end_position].strip()
            
            if chunk_text and len(chunk_text) >= self.config.min_chunk_length:
                chunks.append(self.create_chunk(
                    text=chunk_text,
                    chunk_id=chunk_id,
                    start_char=position
                ))
                chunk_id += 1
            
            position = end_position - self.config.chunk_overlap
            if position <= 0:
                position = end_position
        
        return chunks
