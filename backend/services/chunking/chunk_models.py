"""
Chunk Data Models
Data classes for text chunks and chunking configuration
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List


@dataclass
class ChunkingConfig:
    """Configuration for text chunking"""
    chunk_size: int = 512
    chunk_overlap: int = 100
    min_chunk_length: int = 10
    preserve_paragraphs: bool = True
    preserve_sentences: bool = True
    
    def __post_init__(self):
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")
        if self.min_chunk_length < 1:
            raise ValueError("min_chunk_length must be at least 1")


@dataclass
class Chunk:
    """Represents a text chunk with metadata"""
    id: int
    text: str
    start_char: int = 0
    end_char: int = 0
    paragraph_index: int = 0
    sentence_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_numbers: List[int] = field(default_factory=list)  # Pages this chunk spans
    
    @property
    def length(self) -> int:
        return len(self.text)
    
    @property
    def word_count(self) -> int:
        return len(self.text.split())
    
    @property
    def char_count(self) -> int:
        return len(self.text)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert chunk to dictionary for serialization"""
        return {
            'id': self.id,
            'text': self.text,
            'length': self.length,
            'start_char': self.start_char,
            'end_char': self.end_char,
            'paragraph_index': self.paragraph_index,
            'sentence_index': self.sentence_index,
            'word_count': self.word_count,
            'char_count': self.char_count,
            'page_numbers': self.page_numbers,
            **self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Chunk':
        """Create chunk from dictionary"""
        return cls(
            id=data.get('id', 0),
            text=data.get('text', ''),
            start_char=data.get('start_char', 0),
            end_char=data.get('end_char', 0),
            paragraph_index=data.get('paragraph_index', 0),
            sentence_index=data.get('sentence_index', 0),
            page_numbers=data.get('page_numbers', []),
            metadata={k: v for k, v in data.items() 
                     if k not in ['id', 'text', 'start_char', 'end_char', 
                                  'paragraph_index', 'sentence_index', 'length',
                                  'word_count', 'char_count', 'page_numbers']}
        )


@dataclass
class ChunkingResult:
    """Result of chunking operation"""
    chunks: List[Chunk]
    total_chunks: int
    total_characters: int
    strategy_used: str
    config: ChunkingConfig
    
    @property
    def average_chunk_size(self) -> float:
        if not self.chunks:
            return 0.0
        return sum(c.length for c in self.chunks) / len(self.chunks)
    
    def to_dict_list(self) -> List[Dict[str, Any]]:
        """Convert all chunks to list of dictionaries"""
        return [chunk.to_dict() for chunk in self.chunks]
