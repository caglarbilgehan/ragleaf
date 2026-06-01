# backend/services/multimodal/base_provider.py
"""
Base provider interface for Multi-Modal LLM providers.
Supports vision analysis with images and text.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# Exceptions
# ============================================================================

class MultiModalError(Exception):
    """Base exception for multi-modal errors"""
    pass


class ProviderUnavailableError(MultiModalError):
    """Raised when provider is not available"""
    pass


class BudgetExceededError(MultiModalError):
    """Raised when budget limit is exceeded"""
    pass


class ImageProcessingError(MultiModalError):
    """Raised when image cannot be processed"""
    pass


# ============================================================================
# Data Classes
# ============================================================================

class AnalysisType(str, Enum):
    """Types of image analysis"""
    GENERAL = "general"
    TECHNICAL = "technical"
    TABLE = "table"
    CHART = "chart"
    DIAGRAM = "diagram"


@dataclass
class ImageInput:
    """Image input for vision analysis"""
    image_path: str
    image_base64: Optional[str] = None
    caption: Optional[str] = None
    ocr_text: Optional[str] = None
    asset_id: Optional[int] = None
    
    # Image metadata
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None


@dataclass
class VisionResponse:
    """Response from vision analysis"""
    description: str
    tokens_used: int
    cost_usd: float
    provider: str
    model: str
    
    # Additional metadata
    analysis_type: str = "general"
    cached: bool = False
    processing_time_ms: float = 0.0
    raw_response: Optional[Dict[str, Any]] = None


@dataclass
class ProviderConfig:
    """Configuration for a multi-modal provider"""
    api_key: str
    model: str = ""
    api_url: Optional[str] = None
    max_tokens: int = 2000
    temperature: float = 0.3
    timeout_seconds: int = 60
    
    # Cost configuration (per 1K tokens)
    input_cost_per_1k: float = 0.01
    output_cost_per_1k: float = 0.03
    image_cost_per_image: float = 0.00765  # GPT-4V default


# ============================================================================
# Abstract Base Class
# ============================================================================

class MultiModalProvider(ABC):
    """
    Abstract base class for multi-modal LLM providers.
    Implementations: OpenAI GPT-4V, Anthropic Claude 3, Google Gemini.
    """
    
    def __init__(self, config: ProviderConfig):
        """
        Initialize provider with configuration.
        
        Args:
            config: Provider configuration including API key and model
        """
        self.config = config
        self._available = False
        self._last_error: Optional[str] = None
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider name (e.g., 'openai', 'anthropic', 'google')"""
        pass
    
    @property
    @abstractmethod
    def supported_models(self) -> List[str]:
        """Return list of supported model names"""
        pass
    
    @abstractmethod
    async def analyze_image(
        self,
        image: ImageInput,
        prompt: str,
        analysis_type: AnalysisType = AnalysisType.GENERAL,
        max_tokens: int = 1000
    ) -> VisionResponse:
        """
        Analyze a single image with a prompt.
        
        Args:
            image: Image input with path or base64 data
            prompt: Analysis prompt
            analysis_type: Type of analysis to perform
            max_tokens: Maximum tokens in response
            
        Returns:
            VisionResponse with analysis result
            
        Raises:
            ImageProcessingError: If image cannot be processed
            ProviderUnavailableError: If provider is not available
        """
        pass
    
    @abstractmethod
    async def analyze_with_context(
        self,
        images: List[ImageInput],
        query: str,
        context: str,
        max_tokens: int = 2000
    ) -> VisionResponse:
        """
        Analyze multiple images with RAG context.
        
        Args:
            images: List of images to analyze
            query: User's query
            context: Retrieved text context from RAG
            max_tokens: Maximum tokens in response
            
        Returns:
            VisionResponse with combined analysis
            
        Raises:
            ImageProcessingError: If images cannot be processed
            ProviderUnavailableError: If provider is not available
        """
        pass
    
    @abstractmethod
    def estimate_cost(
        self,
        images: List[ImageInput],
        prompt_tokens: int,
        max_output_tokens: int = 1000
    ) -> float:
        """
        Estimate cost before making API call.
        
        Args:
            images: List of images to analyze
            prompt_tokens: Estimated prompt tokens
            max_output_tokens: Maximum output tokens
            
        Returns:
            Estimated cost in USD
        """
        pass
    
    @abstractmethod
    async def validate_connection(self) -> bool:
        """
        Validate API connection and credentials.
        
        Returns:
            True if connection is valid
        """
        pass
    
    def is_available(self) -> bool:
        """Check if provider is configured and available"""
        return self._available and bool(self.config.api_key)
    
    def get_last_error(self) -> Optional[str]:
        """Get last error message"""
        return self._last_error
    
    def _set_error(self, error: str) -> None:
        """Set error message and mark as unavailable"""
        self._last_error = error
        self._available = False
        logger.error(f"🔴 {self.provider_name} error: {error}")
    
    def _set_available(self) -> None:
        """Mark provider as available"""
        self._available = True
        self._last_error = None
        logger.info(f"✅ {self.provider_name} provider is available")
    
    def get_analysis_prompt(self, analysis_type: AnalysisType) -> str:
        """
        Get default prompt for analysis type.
        
        Args:
            analysis_type: Type of analysis
            
        Returns:
            Default prompt string
        """
        prompts = {
            AnalysisType.GENERAL: (
                "Bu görseli detaylı olarak analiz et. "
                "İçeriği, önemli öğeleri ve bağlamı açıkla."
            ),
            AnalysisType.TECHNICAL: (
                "Bu teknik çizimi/diyagramı analiz et. "
                "Bileşenleri, bağlantıları ve teknik detayları açıkla."
            ),
            AnalysisType.TABLE: (
                "Bu tablodaki verileri analiz et. "
                "Sütunları, satırları ve önemli değerleri listele."
            ),
            AnalysisType.CHART: (
                "Bu grafiği/çizelgeyi analiz et. "
                "Veri noktalarını, trendleri ve önemli bulguları açıkla."
            ),
            AnalysisType.DIAGRAM: (
                "Bu diyagramı analiz et. "
                "Akışı, bileşenleri ve ilişkileri açıkla."
            ),
        }
        return prompts.get(analysis_type, prompts[AnalysisType.GENERAL])
    
    def get_rag_prompt(self, query: str, context: str) -> str:
        """
        Generate RAG prompt with context.
        
        Args:
            query: User's query
            context: Retrieved text context
            
        Returns:
            Combined prompt for RAG analysis
        """
        return f"""Aşağıdaki bağlam bilgisi ve görseller kullanarak soruyu yanıtla.

BAĞLAM:
{context}

SORU:
{query}

Yanıtını Türkçe olarak ver. Görsellerdeki bilgileri de kullanarak kapsamlı bir cevap oluştur.
Eğer görsellerde ilgili bilgi varsa, bunu belirt."""
