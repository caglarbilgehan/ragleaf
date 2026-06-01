# backend/services/multimodal/anthropic_provider.py
"""
Anthropic Claude 3 Vision provider for Multi-Modal RAG.
"""

import base64
import time
import httpx
from pathlib import Path
from typing import List, Optional
import logging

from .base_provider import (
    MultiModalProvider,
    ProviderConfig,
    ImageInput,
    VisionResponse,
    AnalysisType,
    ImageProcessingError,
    ProviderUnavailableError,
)

logger = logging.getLogger(__name__)


class AnthropicVisionProvider(MultiModalProvider):
    """
    Anthropic Claude 3 implementation for vision analysis.
    Supports Claude 3 Opus, Sonnet, and Haiku models.
    """
    
    DEFAULT_API_URL = "https://api.anthropic.com/v1/messages"
    API_VERSION = "2023-06-01"
    
    # Pricing per 1K tokens (as of 2024)
    PRICING = {
        "claude-3-opus-20240229": {
            "input": 0.015,
            "output": 0.075,
            "image_base": 0.024,  # Estimated per image
        },
        "claude-3-sonnet-20240229": {
            "input": 0.003,
            "output": 0.015,
            "image_base": 0.0048,
        },
        "claude-3-haiku-20240307": {
            "input": 0.00025,
            "output": 0.00125,
            "image_base": 0.0004,
        },
        "claude-3-5-sonnet-20241022": {
            "input": 0.003,
            "output": 0.015,
            "image_base": 0.0048,
        },
    }
    
    def __init__(self, config: ProviderConfig):
        """Initialize Anthropic Vision provider"""
        super().__init__(config)
        
        # Set default model if not specified
        if not self.config.model:
            self.config.model = "claude-3-5-sonnet-20241022"
        
        # Set API URL
        if not self.config.api_url:
            self.config.api_url = self.DEFAULT_API_URL
        
        # HTTP client
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def provider_name(self) -> str:
        return "anthropic"
    
    @property
    def supported_models(self) -> List[str]:
        return list(self.PRICING.keys())
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.config.timeout_seconds),
                headers={
                    "x-api-key": self.config.api_key,
                    "anthropic-version": self.API_VERSION,
                    "Content-Type": "application/json",
                }
            )
        return self._client
    
    def _encode_image(self, image: ImageInput) -> str:
        """Encode image to base64"""
        if image.image_base64:
            return image.image_base64
        
        try:
            image_path = Path(image.image_path)
            if not image_path.exists():
                raise ImageProcessingError(f"Image not found: {image.image_path}")
            
            with open(image_path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
        except Exception as e:
            raise ImageProcessingError(f"Failed to encode image: {e}")
    
    def _get_media_type(self, image: ImageInput) -> str:
        """Get media type for image"""
        if image.mime_type:
            return image.mime_type
        
        path = Path(image.image_path)
        suffix = path.suffix.lower()
        media_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        return media_types.get(suffix, "image/jpeg")
    
    def _build_image_content(self, image: ImageInput) -> dict:
        """Build image content for API request"""
        base64_data = self._encode_image(image)
        media_type = self._get_media_type(image)
        
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64_data,
            }
        }
    
    async def analyze_image(
        self,
        image: ImageInput,
        prompt: str,
        analysis_type: AnalysisType = AnalysisType.GENERAL,
        max_tokens: int = 1000
    ) -> VisionResponse:
        """Analyze a single image with Claude 3"""
        
        if not self.is_available():
            raise ProviderUnavailableError("Anthropic Vision provider is not available")
        
        start_time = time.time()
        
        # Build message content
        content = []
        
        # Add image first (Claude prefers image before text)
        content.append(self._build_image_content(image))
        
        # Add context if available
        context_text = ""
        if image.caption:
            context_text += f"Görsel açıklaması: {image.caption}\n"
        if image.ocr_text:
            context_text += f"OCR metni: {image.ocr_text}\n"
        
        if context_text:
            content.append({"type": "text", "text": context_text})
        
        # Add prompt
        content.append({"type": "text", "text": prompt})
        
        # Build request
        request_body = {
            "model": self.config.model,
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ],
        }
        
        try:
            client = await self._get_client()
            response = await client.post(
                self.config.api_url,
                json=request_body
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Extract response
            description = data["content"][0]["text"]
            usage = data.get("usage", {})
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)
            tokens_used = input_tokens + output_tokens
            
            # Calculate cost
            cost = self._calculate_cost(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                image_count=1
            )
            
            processing_time = (time.time() - start_time) * 1000
            
            self._set_available()
            
            return VisionResponse(
                description=description,
                tokens_used=tokens_used,
                cost_usd=cost,
                provider=self.provider_name,
                model=self.config.model,
                analysis_type=analysis_type.value,
                processing_time_ms=processing_time,
                raw_response=data
            )
            
        except httpx.HTTPStatusError as e:
            error_msg = f"Anthropic API error: {e.response.status_code}"
            self._set_error(error_msg)
            raise ProviderUnavailableError(error_msg)
        except Exception as e:
            error_msg = f"Anthropic request failed: {str(e)}"
            self._set_error(error_msg)
            raise ImageProcessingError(error_msg)
    
    async def analyze_with_context(
        self,
        images: List[ImageInput],
        query: str,
        context: str,
        max_tokens: int = 2000
    ) -> VisionResponse:
        """Analyze multiple images with RAG context"""
        
        if not self.is_available():
            raise ProviderUnavailableError("Anthropic Vision provider is not available")
        
        if not images:
            raise ImageProcessingError("No images provided for analysis")
        
        start_time = time.time()
        
        # Build message content
        content = []
        
        # Add images with their metadata
        for i, image in enumerate(images):
            content.append(self._build_image_content(image))
            
            # Add image metadata as text
            if image.caption or image.ocr_text:
                metadata_text = f"--- Görsel {i+1} ---"
                if image.caption:
                    metadata_text += f"\nAçıklama: {image.caption}"
                if image.ocr_text:
                    metadata_text += f"\nOCR: {image.ocr_text[:500]}..."
                content.append({"type": "text", "text": metadata_text})
        
        # Add RAG prompt
        prompt = self.get_rag_prompt(query, context)
        content.append({"type": "text", "text": prompt})
        
        # Build request
        request_body = {
            "model": self.config.model,
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ],
        }
        
        try:
            client = await self._get_client()
            response = await client.post(
                self.config.api_url,
                json=request_body
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Extract response
            description = data["content"][0]["text"]
            usage = data.get("usage", {})
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)
            tokens_used = input_tokens + output_tokens
            
            # Calculate cost
            cost = self._calculate_cost(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                image_count=len(images)
            )
            
            processing_time = (time.time() - start_time) * 1000
            
            self._set_available()
            
            return VisionResponse(
                description=description,
                tokens_used=tokens_used,
                cost_usd=cost,
                provider=self.provider_name,
                model=self.config.model,
                analysis_type="rag_context",
                processing_time_ms=processing_time,
                raw_response=data
            )
            
        except httpx.HTTPStatusError as e:
            error_msg = f"Anthropic API error: {e.response.status_code}"
            self._set_error(error_msg)
            raise ProviderUnavailableError(error_msg)
        except Exception as e:
            error_msg = f"Anthropic request failed: {str(e)}"
            self._set_error(error_msg)
            raise ImageProcessingError(error_msg)
    
    def _calculate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        image_count: int
    ) -> float:
        """Calculate cost based on usage"""
        pricing = self.PRICING.get(self.config.model, self.PRICING["claude-3-5-sonnet-20241022"])
        
        input_cost = (input_tokens / 1000) * pricing["input"]
        output_cost = (output_tokens / 1000) * pricing["output"]
        image_cost = image_count * pricing["image_base"]
        
        return input_cost + output_cost + image_cost
    
    def estimate_cost(
        self,
        images: List[ImageInput],
        prompt_tokens: int,
        max_output_tokens: int = 1000
    ) -> float:
        """Estimate cost before making API call"""
        pricing = self.PRICING.get(self.config.model, self.PRICING["claude-3-5-sonnet-20241022"])
        
        input_cost = (prompt_tokens / 1000) * pricing["input"]
        output_cost = (max_output_tokens / 1000) * pricing["output"]
        image_cost = len(images) * pricing["image_base"]
        
        return input_cost + output_cost + image_cost
    
    async def validate_connection(self) -> bool:
        """Validate API connection"""
        try:
            # Simple request to validate API key
            client = await self._get_client()
            
            # Send a minimal request
            response = await client.post(
                self.config.api_url,
                json={
                    "model": self.config.model,
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Hi"}]
                }
            )
            
            if response.status_code == 200:
                self._set_available()
                return True
            else:
                self._set_error(f"API validation failed: {response.status_code}")
                return False
                
        except Exception as e:
            self._set_error(f"Connection validation failed: {str(e)}")
            return False
    
    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
