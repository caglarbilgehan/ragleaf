import asyncio
import json
import aiohttp
from typing import Dict, Any, Optional, AsyncGenerator, List
from decouple import config
from huggingface_hub import HfApi, list_models
import logging

logger = logging.getLogger(__name__)

class HuggingFaceService:
    def __init__(self):
        # Don't initialize token here, get it dynamically from AI services
        self.api_token = None
        # Use the new HuggingFace OpenAI-compatible endpoint
        self.api_url = "https://router.huggingface.co/v1"
        self.old_api_url = "https://api-inference.huggingface.co/models"
        self.session: Optional[aiohttp.ClientSession] = None
        self.timeout = aiohttp.ClientTimeout(total=300)  # 5 minute timeout for HF API
        self.hf_api = None  # Will be initialized when token is available
        
        logger.info("HuggingFace service initialized - will get token from AI services")
    
    def set_api_token(self, token: str):
        """Set API token dynamically from AI services"""
        self.api_token = token
        self.hf_api = HfApi(token=token) if token else None
        # Close existing session to force recreation with new token
        if self.session and not self.session.closed:
            asyncio.create_task(self.session.close())
            self.session = None
        logger.info(f"HuggingFace API token updated: {'***' if token else 'None'}")
        
    async def get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            headers = {}
            if self.api_token:
                headers["Authorization"] = f"Bearer {self.api_token}"
            self.session = aiohttp.ClientSession(
                timeout=self.timeout,
                headers=headers
            )
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def list_models(self) -> Dict[str, Any]:
        """List popular text generation models from Hugging Face"""
        try:
            # Popular text generation models
            popular_models = [
                {
                    "name": "microsoft/DialoGPT-medium",
                    "id": "microsoft/DialoGPT-medium",
                    "description": "Conversational AI model",
                    "size": "medium",
                    "type": "text-generation"
                },
                {
                    "name": "microsoft/DialoGPT-large",
                    "id": "microsoft/DialoGPT-large", 
                    "description": "Large conversational AI model",
                    "size": "large",
                    "type": "text-generation"
                },
                {
                    "name": "gpt2",
                    "id": "gpt2",
                    "description": "GPT-2 base model",
                    "size": "small",
                    "type": "text-generation"
                },
                {
                    "name": "gpt2-medium",
                    "id": "gpt2-medium",
                    "description": "GPT-2 medium model",
                    "size": "medium", 
                    "type": "text-generation"
                },
                {
                    "name": "distilgpt2",
                    "id": "distilgpt2",
                    "description": "Distilled GPT-2 model",
                    "size": "small",
                    "type": "text-generation"
                },
                {
                    "name": "facebook/blenderbot-400M-distill",
                    "id": "facebook/blenderbot-400M-distill",
                    "description": "BlenderBot conversational model",
                    "size": "medium",
                    "type": "text-generation"
                },
                {
                    "name": "microsoft/GODEL-v1_1-base-seq2seq",
                    "id": "microsoft/GODEL-v1_1-base-seq2seq",
                    "description": "Goal-oriented dialog model",
                    "size": "medium",
                    "type": "text2text-generation"
                }
            ]
            
            return {"models": popular_models}
            
        except Exception as e:
            logger.error(f"Error listing Hugging Face models: {e}")
            return {"models": []}
    
    async def health_check(self) -> bool:
        """Check if Hugging Face API is accessible"""
        try:
            session = await self.get_session()
            # Test with OpenAI-compatible endpoint
            async with session.get(
                f"{self.api_url}/models"
            ) as response:
                return response.status in [200, 503]  # 503 is model loading
        except Exception as e:
            logger.error(f"Hugging Face health check failed: {e}")
            return False
    
    async def check_health(self) -> bool:
        """Alias for health_check for backward compatibility"""
        return await self.health_check()
    
    async def generate_response(
        self,
        model: str,
        messages: List[Dict[str, str]],
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9,
        top_k: Optional[int] = 50,
        repeat_penalty: Optional[float] = 1.1,
        num_ctx: Optional[int] = 1024,
        max_tokens: Optional[int] = 512
    ) -> Dict[str, Any]:
        """Generate response using Hugging Face Inference API"""
        
        try:
            # Use OpenAI-compatible chat completions format
            session = await self.get_session()
            
            # Prepare messages for OpenAI format
            formatted_messages = []
            
            if system_prompt:
                formatted_messages.append({"role": "system", "content": system_prompt})
            
            if context:
                formatted_messages.append({"role": "system", "content": f"Context: {context}"})
            
            # Add conversation messages
            formatted_messages.extend(messages)
            
            # Prepare OpenAI-compatible payload
            payload = {
                "model": model,
                "messages": formatted_messages,
                "max_tokens": max_tokens or 512,
                "temperature": temperature or 0.7,
                "top_p": top_p or 0.9,
                "stream": False
            }
            
            # Use OpenAI-compatible chat completions endpoint
            api_endpoint = f"{self.api_url}/chat/completions"
            logger.info(f"Making request to: {api_endpoint}")
            logger.info(f"Payload: {payload}")
            
            # Add timeout and retry mechanism
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            
            async with session.post(
                api_endpoint,
                json=payload,
                timeout=timeout
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"HF API Response for {model}: {result}")
                    
                    # Handle OpenAI-compatible response format
                    generated_text = ""
                    
                    if isinstance(result, dict):
                        # OpenAI chat completion response format
                        choices = result.get("choices", [])
                        if choices and len(choices) > 0:
                            message = choices[0].get("message", {})
                            generated_text = message.get("content", "")
                        
                        # Fallback to other formats if needed
                        if not generated_text:
                            generated_text = result.get("generated_text", "")
                            if not generated_text:
                                generated_text = result.get("text", "")
                            if not generated_text:
                                generated_text = result.get("output", "")
                    
                    logger.info(f"Processed response: '{generated_text}'")
                    
                    return {
                        "response": generated_text.strip() if generated_text else "Yeni Sohbet",
                        "model": model,
                        "provider": "huggingface",
                        "success": True
                    }
                
                elif response.status == 503:
                    # Model is loading
                    error_data = await response.json()
                    estimated_time = error_data.get("estimated_time", 60)
                    
                    return {
                        "error": f"Model is loading. Estimated time: {estimated_time} seconds",
                        "model": model,
                        "provider": "huggingface",
                        "success": False,
                        "retry_after": estimated_time
                    }
                
                else:
                    error_text = await response.text()
                    logger.error(f"HF API Error {response.status}: {error_text}")
                    return {
                        "error": f"API request failed ({response.status}): {error_text}",
                        "model": model,
                        "provider": "huggingface", 
                        "success": False
                    }
                    
        except asyncio.TimeoutError:
            logger.error(f"Timeout error for model {model}")
            return {
                "error": "Request timeout - please try again",
                "model": model,
                "provider": "huggingface",
                "success": False
            }
        except aiohttp.ClientConnectionError as e:
            logger.error(f"Connection error for model {model}: {e}")
            return {
                "error": "Server disconnected - please try again",
                "model": model,
                "provider": "huggingface",
                "success": False
            }
        except Exception as e:
            logger.error(f"Error generating response with Hugging Face: {e}")
            return {
                "error": f"Generation failed: {str(e)}",
                "model": model,
                "provider": "huggingface",
                "success": False
            }
    
    async def generate_stream(
        self,
        model: str,
        prompt: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = 0.7,
        max_tokens: Optional[int] = 512
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate streaming response (fallback to non-streaming for HF API)"""
        
        # Hugging Face Inference API doesn't support streaming by default
        # So we'll generate the full response and yield it in chunks
        
        try:
            response = await self.generate_response(
                model=model,
                prompt=prompt,
                context=context,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            if response.get("success"):
                # Simulate streaming by yielding chunks
                text = response.get("response", "")
                words = text.split()
                
                current_chunk = ""
                for i, word in enumerate(words):
                    current_chunk += word + " "
                    
                    # Yield every few words
                    if (i + 1) % 3 == 0 or i == len(words) - 1:
                        yield {
                            "response": current_chunk.strip(),
                            "model": model,
                            "provider": "huggingface",
                            "done": i == len(words) - 1
                        }
                        current_chunk = ""
                        await asyncio.sleep(0.1)  # Small delay for streaming effect
            else:
                yield response
                
        except Exception as e:
            yield {
                "error": f"Streaming generation failed: {str(e)}",
                "model": model,
                "provider": "huggingface"
            }

# Global instance
huggingface_service = HuggingFaceService()
