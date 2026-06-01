"""
AI Router Service
Handles provider selection, token failover, and request routing
"""

import logging
import asyncio
import httpx
from typing import Dict, Any, List, Optional, AsyncGenerator
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..database.models import Settings

logger = logging.getLogger(__name__)

# Settings keys
PROVIDER_CONFIG_KEY = "ai_provider_config"
AI_SERVICES_KEY = "ai_services"
NOTIFICATIONS_KEY = "system_notifications"


class AIRouterService:
    """
    Manages AI provider routing with automatic failover
    
    Flow:
    1. Get active provider from config
    2. Get tokens for that provider (sorted by priority)
    3. Try each token until success
    4. If all tokens fail, move to next provider (if fallback enabled)
    5. If all providers fail, notify admins and return error
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._provider_config = None
        self._ai_services = None
        self._current_provider_index = 0
        self._current_token_index = 0
        self._failed_tokens = set()
        
    def _get_provider_config(self) -> Dict[str, Any]:
        """Get provider configuration"""
        if self._provider_config is None:
            setting = self.db.query(Settings).filter(Settings.key == PROVIDER_CONFIG_KEY).first()
            if setting:
                self._provider_config = setting.value
            else:
                self._provider_config = {}
        return self._provider_config
    
    def _get_ai_services(self) -> List[Dict[str, Any]]:
        """Get AI services (tokens)"""
        if self._ai_services is None:
            setting = self.db.query(Settings).filter(Settings.key == AI_SERVICES_KEY).first()
            if setting and isinstance(setting.value, list):
                self._ai_services = setting.value
            else:
                self._ai_services = []
        return self._ai_services
    
    def _save_ai_services(self, services: List[Dict[str, Any]]):
        """Save AI services back to database"""
        setting = self.db.query(Settings).filter(Settings.key == AI_SERVICES_KEY).first()
        if setting:
            setting.value = services
            flag_modified(setting, 'value')
            self.db.commit()
    
    def get_active_provider(self) -> Optional[Dict[str, Any]]:
        """Get the currently active provider"""
        config = self._get_provider_config()
        providers = config.get("providers", [])
        active_name = config.get("active_provider")
        
        if not active_name or not providers:
            return None
        
        # Find active provider
        provider = next((p for p in providers if p.get("name") == active_name), None)
        
        if not provider or not provider.get("is_enabled", True):
            # Fallback to first enabled provider
            enabled = [p for p in providers if p.get("is_enabled", True)]
            enabled.sort(key=lambda x: x.get("priority", 999))
            provider = enabled[0] if enabled else None
        
        return provider
    
    def get_tokens_for_provider(self, provider_name: str) -> List[Dict[str, Any]]:
        """Get all active tokens for a specific provider"""
        services = self._get_ai_services()
        
        # Filter tokens for this provider
        tokens = [
            s for s in services
            if (s.get("name") == provider_name and
                s.get("is_active", True) and
                s.get("api_key"))
        ]
        
        # Sort by priority
        tokens.sort(key=lambda x: x.get("priority", 999))
        
        return tokens
    
    def get_ordered_providers(self) -> List[Dict[str, Any]]:
        """Get all enabled providers in priority order"""
        config = self._get_provider_config()
        providers = config.get("providers", [])
        
        enabled = [p for p in providers if p.get("is_enabled", True)]
        enabled.sort(key=lambda x: x.get("priority", 999))
        
        return enabled
    
    def mark_token_failed(self, service_id: int, error: str):
        """Mark a token as failed"""
        services = self._get_ai_services()
        
        for service in services:
            if service.get("id") == service_id:
                service["is_available"] = False
                service["last_error"] = error
                service["failed_requests"] = service.get("failed_requests", 0) + 1
                service["last_failed_at"] = datetime.utcnow().isoformat()
                break
        
        self._save_ai_services(services)
        self._failed_tokens.add(service_id)
        logger.warning(f"Token {service_id} marked as failed: {error}")
    
    def mark_token_success(self, service_id: int):
        """Mark a token as successful"""
        services = self._get_ai_services()
        
        for service in services:
            if service.get("id") == service_id:
                service["is_available"] = True
                service["last_error"] = None
                service["total_requests"] = service.get("total_requests", 0) + 1
                service["last_used_at"] = datetime.utcnow().isoformat()
                break
        
        self._save_ai_services(services)
    
    def get_next_available_token(self, provider_name: str, exclude_ids: List[int] = None) -> Optional[Dict[str, Any]]:
        """Get next available token for a provider"""
        tokens = self.get_tokens_for_provider(provider_name)
        exclude_ids = exclude_ids or []
        
        for token in tokens:
            token_id = token.get("id")
            if token_id not in exclude_ids and token_id not in self._failed_tokens:
                if token.get("is_available", True):
                    return token
        
        return None
    
    async def create_notification(self, notification_type: str, title: str, message: str):
        """Create a system notification for admins"""
        setting = self.db.query(Settings).filter(Settings.key == NOTIFICATIONS_KEY).first()
        
        if setting:
            notifications = setting.value if isinstance(setting.value, list) else []
        else:
            notifications = []
        
        # Generate new ID
        max_id = max([n.get("id", 0) for n in notifications], default=0)
        
        new_notification = {
            "id": max_id + 1,
            "type": notification_type,
            "title": title,
            "message": message,
            "created_at": datetime.utcnow().isoformat(),
            "read": False
        }
        
        notifications.insert(0, new_notification)
        
        # Keep only last 100 notifications
        notifications = notifications[:100]
        
        if setting:
            setting.value = notifications
            flag_modified(setting, 'value')
        else:
            setting = Settings(
                key=NOTIFICATIONS_KEY,
                value=notifications,
                description="System notifications for admins"
            )
            self.db.add(setting)
        
        self.db.commit()
        logger.info(f"Created notification: {title}")
    
    async def route_request(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 512,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Route a request through the provider chain with failover
        
        Returns:
            Dict with response or error
        """
        config = self._get_provider_config()
        fallback_enabled = config.get("fallback_enabled", True)
        max_retry = config.get("max_retry_per_provider", 3)
        
        providers = self.get_ordered_providers()
        
        if not providers:
            return {
                "success": False,
                "error": "No AI providers configured",
                "error_type": "no_providers"
            }
        
        tried_providers = []
        last_error = None
        
        for provider in providers:
            provider_name = provider.get("name")
            provider_model = model or provider.get("default_model")
            
            if not provider_model:
                logger.warning(f"No model configured for provider {provider_name}")
                continue
            
            tokens = self.get_tokens_for_provider(provider_name)
            
            if not tokens:
                logger.warning(f"No tokens available for provider {provider_name}")
                tried_providers.append(provider_name)
                continue
            
            # Try each token
            tried_tokens = []
            for token in tokens:
                token_id = token.get("id")
                
                if token_id in self._failed_tokens:
                    continue
                
                try:
                    result = await self._make_request(
                        provider=provider,
                        token=token,
                        prompt=prompt,
                        model=provider_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        stream=stream
                    )
                    
                    if result.get("success"):
                        self.mark_token_success(token_id)
                        result["provider_used"] = provider_name
                        result["model_used"] = provider_model
                        return result
                    else:
                        last_error = result.get("error", "Unknown error")
                        self.mark_token_failed(token_id, last_error)
                        tried_tokens.append(token_id)
                        
                except Exception as e:
                    last_error = str(e)
                    self.mark_token_failed(token_id, last_error)
                    tried_tokens.append(token_id)
                    logger.error(f"Request failed with token {token_id}: {e}")
            
            tried_providers.append(provider_name)
            
            if not fallback_enabled:
                break
        
        # All providers failed
        config = self._get_provider_config()
        if config.get("notify_on_all_fail", True):
            await self.create_notification(
                notification_type="error",
                title="Tüm AI Servisleri Başarısız",
                message=f"Denenen sağlayıcılar: {', '.join(tried_providers)}. Son hata: {last_error}"
            )
        
        return {
            "success": False,
            "error": "all_providers_failed",
            "error_type": "all_providers_failed",
            "message": "Şu anda tüm AI servisleri meşgul. Sistem yöneticisi bilgilendirildi.",
            "tried_providers": tried_providers,
            "last_error": last_error
        }
    
    async def route_request_stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 512
    ) -> AsyncGenerator[str, None]:
        """
        Route a streaming request through the provider chain with failover
        """
        config = self._get_provider_config()
        fallback_enabled = config.get("fallback_enabled", True)
        
        providers = self.get_ordered_providers()
        
        if not providers:
            yield f"data: {{'error': 'No AI providers configured'}}\n\n"
            return
        
        tried_providers = []
        last_error = None
        
        for provider in providers:
            provider_name = provider.get("name")
            provider_model = model or provider.get("default_model")
            
            if not provider_model:
                continue
            
            tokens = self.get_tokens_for_provider(provider_name)
            
            if not tokens:
                tried_providers.append(provider_name)
                continue
            
            for token in tokens:
                token_id = token.get("id")
                
                if token_id in self._failed_tokens:
                    continue
                
                try:
                    async for chunk in self._make_stream_request(
                        provider=provider,
                        token=token,
                        prompt=prompt,
                        model=provider_model,
                        temperature=temperature,
                        max_tokens=max_tokens
                    ):
                        yield chunk
                    
                    self.mark_token_success(token_id)
                    return
                    
                except Exception as e:
                    last_error = str(e)
                    self.mark_token_failed(token_id, last_error)
                    logger.error(f"Stream request failed with token {token_id}: {e}")
            
            tried_providers.append(provider_name)
            
            if not fallback_enabled:
                break
        
        # All providers failed
        yield f"data: {{'error': 'all_providers_failed', 'message': 'Şu anda tüm AI servisleri meşgul. Sistem yöneticisi bilgilendirildi.'}}\n\n"
    
    async def _make_request(
        self,
        provider: Dict[str, Any],
        token: Dict[str, Any],
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Make actual API request to provider"""
        provider_name = provider.get("name")
        api_key = token.get("api_key")
        api_url = token.get("api_url") or provider.get("config", {}).get("api_base")
        
        if provider_name == "huggingface":
            return await self._huggingface_request(api_key, api_url, model, prompt, temperature, max_tokens)
        elif provider_name == "openai":
            return await self._openai_request(api_key, api_url, model, prompt, temperature, max_tokens)
        elif provider_name == "deepseek":
            return await self._deepseek_request(api_key, api_url, model, prompt, temperature, max_tokens)
        elif provider_name == "anthropic":
            return await self._anthropic_request(api_key, api_url, model, prompt, temperature, max_tokens)
        else:
            return {"success": False, "error": f"Unknown provider: {provider_name}"}
    
    async def _make_stream_request(
        self,
        provider: Dict[str, Any],
        token: Dict[str, Any],
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int
    ) -> AsyncGenerator[str, None]:
        """Make streaming API request to provider"""
        provider_name = provider.get("name")
        api_key = token.get("api_key")
        api_url = token.get("api_url") or provider.get("config", {}).get("api_base")
        
        if provider_name == "huggingface":
            async for chunk in self._huggingface_stream(api_key, api_url, model, prompt, temperature, max_tokens):
                yield chunk
        elif provider_name == "openai":
            async for chunk in self._openai_stream(api_key, api_url, model, prompt, temperature, max_tokens):
                yield chunk
        elif provider_name == "deepseek":
            async for chunk in self._deepseek_stream(api_key, api_url, model, prompt, temperature, max_tokens):
                yield chunk
        else:
            yield f"data: {{'error': 'Unknown provider: {provider_name}'}}\n\n"
    
    # ===== Provider-specific implementations =====
    
    async def _huggingface_request(
        self,
        api_key: str,
        api_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> Dict[str, Any]:
        """HuggingFace Inference API request"""
        url = api_url or f"https://api-inference.huggingface.co/models/{model}"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "temperature": temperature,
                "max_new_tokens": max_tokens,
                "return_full_text": False
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0:
                        text = data[0].get("generated_text", "")
                    else:
                        text = str(data)
                    
                    return {
                        "success": True,
                        "response": text,
                        "usage": {}
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HuggingFace API error: {response.status_code} - {response.text}"
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _huggingface_stream(
        self,
        api_key: str,
        api_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> AsyncGenerator[str, None]:
        """HuggingFace streaming request"""
        url = api_url or f"https://api-inference.huggingface.co/models/{model}"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "temperature": temperature,
                "max_new_tokens": max_tokens,
                "return_full_text": False
            },
            "stream": True
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                async for line in response.aiter_lines():
                    if line:
                        yield f"data: {line}\n\n"
    
    async def _openai_request(
        self,
        api_key: str,
        api_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> Dict[str, Any]:
        """OpenAI API request"""
        url = f"{api_url or 'https://api.openai.com/v1'}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    text = data["choices"][0]["message"]["content"]
                    
                    return {
                        "success": True,
                        "response": text,
                        "usage": data.get("usage", {})
                    }
                else:
                    return {
                        "success": False,
                        "error": f"OpenAI API error: {response.status_code} - {response.text}"
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _openai_stream(
        self,
        api_key: str,
        api_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> AsyncGenerator[str, None]:
        """OpenAI streaming request"""
        url = f"{api_url or 'https://api.openai.com/v1'}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield f"{line}\n\n"
    
    async def _deepseek_request(
        self,
        api_key: str,
        api_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> Dict[str, Any]:
        """DeepSeek API request (OpenAI compatible)"""
        url = f"{api_url or 'https://api.deepseek.com/v1'}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    text = data["choices"][0]["message"]["content"]
                    
                    return {
                        "success": True,
                        "response": text,
                        "usage": data.get("usage", {})
                    }
                else:
                    return {
                        "success": False,
                        "error": f"DeepSeek API error: {response.status_code} - {response.text}"
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _deepseek_stream(
        self,
        api_key: str,
        api_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> AsyncGenerator[str, None]:
        """DeepSeek streaming request"""
        url = f"{api_url or 'https://api.deepseek.com/v1'}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield f"{line}\n\n"
    
    async def _anthropic_request(
        self,
        api_key: str,
        api_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> Dict[str, Any]:
        """Anthropic API request"""
        url = f"{api_url or 'https://api.anthropic.com/v1'}/messages"
        
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    text = data["content"][0]["text"]
                    
                    return {
                        "success": True,
                        "response": text,
                        "usage": data.get("usage", {})
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Anthropic API error: {response.status_code} - {response.text}"
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton-like function to get router service
def get_ai_router(db: Session) -> AIRouterService:
    """Get AI Router Service instance"""
    return AIRouterService(db)
