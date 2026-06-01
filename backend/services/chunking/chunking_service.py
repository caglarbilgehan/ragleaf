"""
Chunking Service
Unified text chunking service with pluggable strategies
"""

import logging
from typing import List, Dict, Any, Optional, Type

from .chunk_models import Chunk, ChunkingConfig, ChunkingResult
from .strategies import (
    BaseChunkingStrategy,
    ParagraphChunkingStrategy,
    SentenceChunkingStrategy
)

logger = logging.getLogger(__name__)


class ChunkingService:
    """
    Unified chunking service
    
    Provides a single interface for text chunking with multiple strategies.
    Replaces scattered chunking logic in:
    - professional_embedding_service.py
    - vector_service.py
    """
    
    # Available strategies
    STRATEGIES: Dict[str, Type[BaseChunkingStrategy]] = {
        'paragraph': ParagraphChunkingStrategy,
        'sentence': SentenceChunkingStrategy,
    }
    
    DEFAULT_STRATEGY = 'paragraph'
    
    def __init__(self, config: Optional[ChunkingConfig] = None):
        self.config = config or ChunkingConfig()
        self._strategy_cache: Dict[str, BaseChunkingStrategy] = {}
    
    def chunk(
        self, 
        text: str, 
        strategy: Optional[str] = None,
        config: Optional[ChunkingConfig] = None
    ) -> ChunkingResult:
        """
        Chunk text using specified strategy
        
        Args:
            text: Input text to chunk
            strategy: Strategy name ('paragraph', 'sentence'). Default: 'paragraph'
            config: Optional config override for this operation
        
        Returns:
            ChunkingResult with chunks and metadata
        """
        strategy_name = strategy or self.DEFAULT_STRATEGY
        effective_config = config or self.config
        
        # Get or create strategy instance
        strategy_instance = self._get_strategy(strategy_name, effective_config)
        
        # Perform chunking
        chunks = strategy_instance.chunk(text)
        
        # Calculate total characters
        total_chars = sum(c.length for c in chunks)
        
        logger.info(
            f"✂️ Chunked text into {len(chunks)} chunks "
            f"(strategy: {strategy_name}, avg size: {total_chars/len(chunks):.0f} chars)"
            if chunks else f"✂️ No chunks created from text"
        )
        
        return ChunkingResult(
            chunks=chunks,
            total_chunks=len(chunks),
            total_characters=total_chars,
            strategy_used=strategy_name,
            config=effective_config
        )
    
    def chunk_to_dicts(
        self, 
        text: str, 
        strategy: Optional[str] = None,
        config: Optional[ChunkingConfig] = None
    ) -> List[Dict[str, Any]]:
        """
        Chunk text and return as list of dictionaries
        
        Convenience method for backward compatibility with existing code
        that expects list of dicts.
        
        Args:
            text: Input text to chunk
            strategy: Strategy name
            config: Optional config override
        
        Returns:
            List of chunk dictionaries
        """
        result = self.chunk(text, strategy, config)
        return result.to_dict_list()
    
    def _get_strategy(
        self, 
        name: str, 
        config: ChunkingConfig
    ) -> BaseChunkingStrategy:
        """Get or create strategy instance"""
        
        if name not in self.STRATEGIES:
            logger.warning(f"Unknown strategy '{name}', using default '{self.DEFAULT_STRATEGY}'")
            name = self.DEFAULT_STRATEGY
        
        # Create cache key based on strategy name and config
        cache_key = f"{name}_{config.chunk_size}_{config.chunk_overlap}"
        
        if cache_key not in self._strategy_cache:
            strategy_class = self.STRATEGIES[name]
            self._strategy_cache[cache_key] = strategy_class(config)
        
        return self._strategy_cache[cache_key]
    
    def get_available_strategies(self) -> List[str]:
        """Get list of available strategy names"""
        return list(self.STRATEGIES.keys())
    
    def create_smart_chunks(self, text: str) -> List[Dict[str, Any]]:
        """
        Create intelligent chunks (backward compatible method)
        
        This method provides backward compatibility with
        ProfessionalEmbeddingService.create_smart_chunks()
        
        Args:
            text: Input text
        
        Returns:
            List of chunk dictionaries
        """
        return self.chunk_to_dicts(text, strategy='paragraph')
    
    @classmethod
    def with_config(
        cls,
        chunk_size: int = 512,
        chunk_overlap: int = 100,
        min_chunk_length: int = 10
    ) -> 'ChunkingService':
        """
        Create ChunkingService with custom configuration
        
        Args:
            chunk_size: Maximum chunk size in characters
            chunk_overlap: Overlap between chunks
            min_chunk_length: Minimum chunk length
        
        Returns:
            Configured ChunkingService instance
        """
        config = ChunkingConfig(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            min_chunk_length=min_chunk_length
        )
        return cls(config)


# Global instance with default config
chunking_service = ChunkingService()
