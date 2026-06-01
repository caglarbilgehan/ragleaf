# backend/services/multimodal/openai_provider.py
"""
OpenAI GPT-4V (Vision) provider for Multi-Modal RAG.
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


class OpenAIVisionProvider(MultiModalProvider):
    """
    OpenAI GPT-4V implementation for vision analysis.
    Supports GPT-4 Vision Preview and GPT-4o models.
    """
    
    DEFAULT_API_URL = "https://api.openai.com/v1/chat/completions"
    
    # Pricing per 1K tokens (as of 2024)
    PRICING = {
        "gpt-4-vision-preview": {
            "input": 0.01,
            "output": 0.03,
            "image_base": 0.00765,  # Base cost per image (low detail)
            "image_high": 0.01275,  # High detail cost per 512x512 tile
        },
        "gpt-4o": {
            "input": 0.005,
            "output": 0.015,
            "image_base": 0.00765,
            "image_high": 0.01275,
        },
        "gpt-4o-mini": {
            "input": 0.00015,
            "output": 0.0006,
            "image_base": 0.001275,
            "image_high": 0.002125,
        },
    }
    
    def __init__(self, config: ProviderConfig):
        """Initialize OpenAI Vision provider"""
        super().__init__(config)
        
        # Set default model if not specified
        if not self.config.model:
            self.config.model = "gpt-4o"
        
        # Set API URL
        if not self.config.api_url:
            self.config.api_url = self.DEFAULT_API_URL
        
        # HTTP client
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def provider_name(self) -> str:
        return "openai"
    
    @property
    def supported_models(self) -> List[str]:
        return ["gpt-4-vision-preview", "gpt-4o", "gpt-4o-mini"]
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.config.timeout_seconds),
                headers={
                    "Authorization": f"Bearer {self.config.api_key}",
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
    
    def _get_mime_type(self, image: ImageInput) -> str:
        """Get MIME type for image"""
        if image.mime_type:
            return image.mime_type
        
        path = Path(image.image_path)
        suffix = path.suffix.lower()
        mime_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        return mime_types.get(suffix, "image/jpeg")
    
    def _build_image_content(self, image: ImageInput) -> dict:
        """Build image content for API request"""
        base64_data = self._encode_image(image)
        mime_type = self._get_mime_type(image)
        
        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{base64_data}",
                "detail": "auto"  # Let OpenAI decide detail level
            }
        }
    
    async def analyze_image(
        self,
        image: ImageInput,
        prompt: str,
        analysis_type: AnalysisType = AnalysisType.GENERAL,
        max_tokens: int = 1000
    ) -> VisionResponse:
        """Analyze a single image with GPT-4V"""
        
        if not self.is_available():
            raise ProviderUnavailableError("OpenAI Vision provider is not available")
        
        start_time = time.time()
        
        # Build message content
        content = [
            {"type": "text", "text": prompt},
            self._build_image_content(image)
        ]
        
        # Add context if available
        if image.caption:
            content.insert(1, {"type": "text", "text": f"Görsel açıklaması: {image.caption}"})
        if image.ocr_text:
            content.insert(1, {"type": "text", "text": f"OCR metni: {image.ocr_text}"})
        
        # Build request
        request_body = {
            "model": self.config.model,
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ],
            "max_tokens": max_tokens,
            "temperature": self.config.temperature,
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
            description = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            
            # Calculate cost
            cost = self._calculate_cost(
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
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
            error_msg = f"OpenAI API error: {e.response.status_code}"
            self._set_error(error_msg)
            raise ProviderUnavailableError(error_msg)
        except Exception as e:
            error_msg = f"OpenAI request failed: {str(e)}"
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
            raise ProviderUnavailableError("OpenAI Vision provider is not available")
        
        if not images:
            raise ImageProcessingError("No images provided for analysis")
        
        start_time = time.time()
        
        # Build RAG prompt
        prompt = self.get_rag_prompt(query, context)
        
        # Build message content
        content = [{"type": "text", "text": prompt}]
        
        # Add images with their metadata
        for i, image in enumerate(images):
            # Add image metadata as text
            if image.caption or image.ocr_text:
                metadata_text = f"\n--- Görsel {i+1} ---"
                if image.caption:
                    metadata_text += f"\nAçıklama: {image.caption}"
                if image.ocr_text:
                    metadata_text += f"\nOCR: {image.ocr_text[:500]}..."  # Limit OCR text
                content.append({"type": "text", "text": metadata_text})
            
            # Add image
            content.append(self._build_image_content(image))
        
        # Build request
        request_body = {
            "model": self.config.model,
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ],
            "max_tokens": max_tokens,
            "temperature": self.config.temperature,
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
            description = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            
            # Calculate cost
            cost = self._calculate_cost(
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
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
            error_msg = f"OpenAI API error: {e.response.status_code}"
            self._set_error(error_msg)
            raise ProviderUnavailableError(error_msg)
        except Exception as e:
            error_msg = f"OpenAI request failed: {str(e)}"
            self._set_error(error_msg)
            raise ImageProcessingError(error_msg)
    
    def _calculate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        image_count: int
    ) -> float:
        """Calculate cost based on usage"""
        pricing = self.PRICING.get(self.config.model, self.PRICING["gpt-4o"])
        
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
        pricing = self.PRICING.get(self.config.model, self.PRICING["gpt-4o"])
        
        input_cost = (prompt_tokens / 1000) * pricing["input"]
        output_cost = (max_output_tokens / 1000) * pricing["output"]
        image_cost = len(images) * pricing["image_base"]
        
        return input_cost + output_cost + image_cost
    
    async def validate_connection(self) -> bool:
        """Validate API connection"""
        try:
            client = await self._get_client()
            
            # Simple models list request to validate API key
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {self.config.api_key}"}
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
