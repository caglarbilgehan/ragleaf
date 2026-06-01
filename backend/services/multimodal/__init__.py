# Multi-Modal RAG Services
"""
Multi-Modal RAG services for vision analysis and image understanding.
Supports multiple providers: OpenAI GPT-4V, Anthropic Claude 3, Google Gemini.
"""

from .base_provider import (
    MultiModalProvider,
    ProviderConfig,
    ImageInput,
    VisionResponse,
    AnalysisType,
    MultiModalError,
    ProviderUnavailableError,
    BudgetExceededError,
    ImageProcessingError,
)
from .openai_provider import OpenAIVisionProvider
from .anthropic_provider import AnthropicVisionProvider
from .gemini_provider import GeminiVisionProvider

__all__ = [
    # Base classes
    "MultiModalProvider",
    "ProviderConfig",
    "ImageInput",
    "VisionResponse",
    "AnalysisType",
    # Exceptions
    "MultiModalError",
    "ProviderUnavailableError",
    "BudgetExceededError",
    "ImageProcessingError",
    # Providers
    "OpenAIVisionProvider",
    "AnthropicVisionProvider",
    "GeminiVisionProvider",
]
