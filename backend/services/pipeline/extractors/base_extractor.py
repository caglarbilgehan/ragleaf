"""
Base Extractor - Abstract base class for all document extractors
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional


@dataclass
class ExtractionResult:
    """Result of document extraction"""
    success: bool
    text: str = ""
    pages: int = 0
    images: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    
    @property
    def text_length(self) -> int:
        return len(self.text)
    
    @property
    def image_count(self) -> int:
        return len(self.images)


class BaseExtractor(ABC):
    """Abstract base class for document extractors"""
    
    # Supported file extensions for this extractor
    supported_extensions: List[str] = []
    
    def can_extract(self, file_path: Path) -> bool:
        """Check if this extractor can handle the given file"""
        return file_path.suffix.lower().lstrip('.') in self.supported_extensions
    
    @abstractmethod
    async def extract(
        self, 
        file_path: Path,
        output_dir: Optional[Path] = None,
        progress_callback: Optional[callable] = None
    ) -> ExtractionResult:
        """
        Extract text and images from document
        
        Args:
            file_path: Path to the document file
            output_dir: Optional directory to save extracted images
            progress_callback: Optional callback for progress updates
                              Signature: callback(stage: str, progress: int, details: str)
        
        Returns:
            ExtractionResult with extracted text, images, and metadata
        """
        pass
    
    def _report_progress(
        self, 
        callback: Optional[callable],
        stage: str,
        progress: int,
        details: str
    ):
        """Helper to report progress if callback is provided"""
        if callback:
            callback(stage, progress, details)
