from typing import Dict, Any, Optional, List, AsyncGenerator
from .huggingface_service import huggingface_service
from .token_service import token_service
from sqlalchemy.orm import Session
import logging
import asyncio

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        # Provider services - şu anda sadece HuggingFace, ileride genişletilebilir
        self.providers = {
            "huggingface": huggingface_service
            # Gelecekte eklenebilir:
            # "openai": openai_service,
            # "anthropic": anthropic_service,
            # "google": google_service
        }
    
    def get_provider_for_model(self, model_name: str) -> str:
        """Model'in provider'ını belirle"""
        # Model name'e göre provider detection
        model_lower = model_name.lower()
        
        # OpenAI models
        if any(prefix in model_lower for prefix in ['gpt-', 'text-davinci', 'text-curie', 'text-babbage']):
            return "openai"
        
        # Anthropic models  
        if any(prefix in model_lower for prefix in ['claude-', 'claude']):
            return "anthropic"
            
        # Google models
        if any(prefix in model_lower for prefix in ['gemini-', 'palm-', 'bard']):
            return "google"
            
        # Cohere models
        if any(prefix in model_lower for prefix in ['command-', 'embed-']):
            return "cohere"
            
        # Mistral models
        if any(prefix in model_lower for prefix in ['mistral-', 'mixtral-']):
            return "mistral"
        
        # Default to HuggingFace for all other models (including openai/gpt-oss-*)
        return "huggingface"
    
    def initialize_tokens_for_model(self, db: Session, model_provider: str):
        """Initialize API tokens for specific model provider"""
        try:
            # Model'in provider'ına göre token al
            token = token_service.get_token_for_provider(db, model_provider)
            
            if token and model_provider in self.providers:
                provider_service = self.providers[model_provider]
                if hasattr(provider_service, 'set_api_token'):
                    provider_service.set_api_token(token)
                    logger.info(f"Token initialized for provider: {model_provider}")
                else:
                    logger.warning(f"Provider {model_provider} doesn't support dynamic token setting")
            else:
                logger.warning(f"No token found for provider: {model_provider}")
                
        except Exception as e:
            logger.error(f"Error initializing tokens for {model_provider}: {e}")
    
    def initialize_tokens(self, db: Session):
        """Initialize API tokens from AI services for all providers"""
        # Tüm provider'lar için token'ları initialize et
        for provider_name in self.providers.keys():
            self.initialize_tokens_for_model(db, provider_name)
    
    async def list_all_models(self) -> Dict[str, Any]:
        """List models from all available providers"""
        all_models = []
        provider_status = {}
        
        for provider_name, provider_service in self.providers.items():
            try:
                models_data = await provider_service.list_models()
                models = models_data.get("models", [])
                
                # Add provider info to each model
                for model in models:
                    if isinstance(model, dict):
                        model["provider"] = provider_name
                        model["provider_display"] = provider_name.upper()
                    else:
                        # Handle string model names
                        model = {
                            "name": model,
                            "id": model,
                            "provider": provider_name,
                            "provider_display": provider_name.upper()
                        }
                    all_models.append(model)
                
                provider_status[provider_name] = {
                    "available": True,
                    "model_count": len(models)
                }
                
            except Exception as e:
                provider_status[provider_name] = {
                    "available": False,
                    "error": str(e),
                    "model_count": 0
                }
        
        return {
            "models": all_models,
            "providers": provider_status,
            "total_models": len(all_models)
        }
    
    async def generate_response(
        self,
        model: str,
        provider: str,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = 0.7,
        max_tokens: Optional[int] = 512,
        top_p: Optional[float] = 0.9,
        max_retries: int = 2,
        top_k: Optional[int] = None,
        repeat_penalty: Optional[float] = None,
        num_ctx: Optional[int] = None,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate response using the appropriate provider with configurable parameters"""
        
        # Determine provider if not specified
        if not provider:
            provider = self.get_provider_for_model(model)
        
        if provider not in self.providers:
            return {
                "error": f"Unknown provider: {provider}",
                "model": model,
                "available_providers": list(self.providers.keys())
            }
        
        provider_service = self.providers[provider]
        
        # Retry mechanism for connection issues
        for attempt in range(max_retries + 1):
            try:
                response = await provider_service.generate_response(
                    model=model,
                    messages=messages,
                    context=context,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    top_p=top_p,
                    top_k=top_k,
                    repeat_penalty=repeat_penalty,
                    num_ctx=num_ctx,
                    max_tokens=max_tokens
                )
                
                # Check if response has error and should retry
                if isinstance(response, dict) and response.get("error"):
                    error_msg = response.get("error", "").lower()
                    
                    # Retry on connection/timeout errors, but not on model loading
                    if attempt < max_retries and ("disconnected" in error_msg or "timeout" in error_msg):
                        logger.warning(f"Attempt {attempt + 1} failed for {model}: {response.get('error')}. Retrying...")
                        await asyncio.sleep(1)  # Wait 1 second before retry
                        continue
                
                # Add provider info to response
                response["provider"] = provider
                return response
                
            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1} failed for {model}: {str(e)}. Retrying...")
                    await asyncio.sleep(1)
                    continue
                else:
                    return {
                        "error": f"Error with {provider} provider after {max_retries + 1} attempts: {str(e)}",
                        "model": model,
                        "provider": provider
                    }
        
        # This shouldn't be reached, but just in case
        return {
            "error": f"All {max_retries + 1} attempts failed",
            "model": model,
            "provider": provider
        }
    
    async def generate_stream(
        self,
        model: str,
        prompt: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        provider: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate streaming response using the appropriate provider"""
        
        # Determine provider if not specified
        if not provider:
            provider = self.get_provider_for_model(model)
        
        if provider not in self.providers:
            yield {
                "error": f"Unknown provider: {provider}",
                "model": model,
                "available_providers": list(self.providers.keys())
            }
            return
        
        provider_service = self.providers[provider]
        
        try:
            async for chunk in provider_service.generate_stream(
                model=model,
                prompt=prompt,
                context=context,
                system_prompt=system_prompt
            ):
                # Add provider info to each chunk
                chunk["provider"] = provider
                yield chunk
                
        except Exception as e:
            yield {
                "error": f"Error with {provider} provider: {str(e)}",
                "model": model,
                "provider": provider
            }
    
    async def check_provider_health(self, provider: str) -> Dict[str, Any]:
        """Check health of a specific provider"""
        if provider not in self.providers:
            return {
                "provider": provider,
                "healthy": False,
                "error": "Unknown provider"
            }
        
        try:
            provider_service = self.providers[provider]
            is_healthy = await provider_service.check_health()
            
            return {
                "provider": provider,
                "healthy": is_healthy,
                "message": f"{provider.upper()} service is {'running' if is_healthy else 'not accessible'}"
            }
            
        except Exception as e:
            return {
                "provider": provider,
                "healthy": False,
                "error": str(e)
            }
    
    async def check_all_providers_health(self) -> Dict[str, Any]:
        """Check health of all providers"""
        health_status = {}
        
        for provider_name in self.providers.keys():
            health_status[provider_name] = await self.check_provider_health(provider_name)
        
        # Overall system health
        healthy_providers = [p for p, status in health_status.items() if status["healthy"]]
        
        return {
            "providers": health_status,
            "healthy_count": len(healthy_providers),
            "total_count": len(self.providers),
            "overall_healthy": len(healthy_providers) > 0,
            "available_providers": healthy_providers
        }

# Global instance
ai_service = AIService()
