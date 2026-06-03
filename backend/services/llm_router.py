"""
LLM Router Service
Manages model selection, provider/token failover, and request routing
"""
import json
import logging
import httpx
import time
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class LLMRouter:
    """
    Central router for LLM requests with automatic failover support.
    
    Failover chain:
    1. Try tokens for the model's provider in priority order
    2. If all tokens fail, try next provider in global priority order
    3. Continue until success or all options exhausted
    """
    
    def __init__(self):
        self._current_token_index = {}  # Track current token index per provider
        self._failed_tokens = {}  # Track temporarily failed tokens
        self._last_success = {}  # Track last successful token per provider
    
    def get_round_robin_state(self, db: Session, provider_name: str):
        """
        Get or create round-robin state for a provider.
        
        Args:
            db: Database session
            provider_name: Provider name (e.g., "huggingface")
        
        Returns:
            RoundRobinState object
        """
        from ..database.models import RoundRobinState
        
        state = db.query(RoundRobinState).filter(
            RoundRobinState.provider_name == provider_name
        ).first()
        
        if not state:
            state = RoundRobinState(
                provider_name=provider_name,
                current_index=0,
                token_count=0
            )
            db.add(state)
            db.commit()
            db.refresh(state)
            logger.info(f"🔄 Created round-robin state for provider: {provider_name}")
        
        return state
    
    def get_next_token_round_robin(
        self, 
        db: Session, 
        provider_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get next token using round-robin selection.
        
        Args:
            db: Database session
            provider_name: Provider name
        
        Returns:
            Token config dict or None if no tokens available
        """
        # Get active tokens for provider
        tokens = self.get_tokens_for_provider(db, provider_name)
        
        if not tokens:
            logger.warning(f"⚠️ No active tokens for provider: {provider_name}")
            return None
        
        # Get or create round-robin state
        state = self.get_round_robin_state(db, provider_name)
        
        # Check if token list changed
        if state.token_count != len(tokens):
            logger.info(f"🔄 Token list changed for {provider_name}: {state.token_count} → {len(tokens)}, resetting index")
            state.current_index = 0
            state.token_count = len(tokens)
            db.commit()
        
        # Select token at current index (with wrap-around)
        selected_index = state.current_index % len(tokens)
        selected_token = tokens[selected_index]
        
        logger.info(f"🎯 Round-robin selected token '{selected_token['display_name']}' (index {selected_index}/{len(tokens)}) for {provider_name}")
        
        return selected_token
    
    def increment_round_robin_index(self, db: Session, provider_name: str) -> None:
        """
        Increment round-robin index for provider.
        Called only on successful request.
        
        Args:
            db: Database session
            provider_name: Provider name
        """
        state = self.get_round_robin_state(db, provider_name)
        state.current_index += 1
        db.commit()
        logger.debug(f"➕ Incremented round-robin index for {provider_name}: {state.current_index}")
    
    def reset_round_robin_index(self, db: Session, provider_name: str) -> None:
        """
        Reset round-robin index when token list changes.
        
        Args:
            db: Database session
            provider_name: Provider name
        """
        state = self.get_round_robin_state(db, provider_name)
        state.current_index = 0
        db.commit()
        logger.info(f"🔄 Reset round-robin index for {provider_name}")
    
    def get_next_token_round_robin(
        self, 
        db: Session, 
        provider_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get next token using round-robin selection.
        
        Args:
            db: Database session
            provider_name: Provider name
        
        Returns:
            Token config dict or None if no tokens available
        """
        # Get active tokens for provider
        tokens = self.get_tokens_for_provider(db, provider_name)
        
        if not tokens:
            logger.warning(f"⚠️ No active tokens for provider: {provider_name}")
            return None
        
        # Get or create round-robin state
        state = self.get_round_robin_state(db, provider_name)
        
        # Check if token list changed
        if state.token_count != len(tokens):
            logger.info(f"🔄 Token list changed for {provider_name}: {state.token_count} → {len(tokens)}, resetting index")
            state.current_index = 0
            state.token_count = len(tokens)
            db.commit()
        
        # Select token at current index (with wrap-around)
        selected_index = state.current_index % len(tokens)
        selected_token = tokens[selected_index]
        
        logger.info(f"🎯 Round-robin selected token '{selected_token['display_name']}' (index {selected_index}/{len(tokens)}) for {provider_name}")
        
        return selected_token
    
    def increment_round_robin_index(self, db: Session, provider_name: str) -> None:
        """
        Increment round-robin index for provider.
        Called only on successful request.
        
        Args:
            db: Database session
            provider_name: Provider name
        """
        state = self.get_round_robin_state(db, provider_name)
        state.current_index += 1
        db.commit()
        
        logger.debug(f"➕ Incremented round-robin index for {provider_name}: {state.current_index}")
    
    def reset_round_robin_index(self, db: Session, provider_name: str) -> None:
        """
        Reset round-robin index when token list changes.
        
        Args:
            db: Database session
            provider_name: Provider name
        """
        state = self.get_round_robin_state(db, provider_name)
        state.current_index = 0
        db.commit()
        
        logger.info(f"🔄 Reset round-robin index for {provider_name}")
    
    def get_default_model(self, db: Session) -> Optional[Any]:
        """
        Get the default active model based on provider priority.
        
        Logic:
        1. Get providers sorted by priority (lowest first)
        2. For each provider, check if it has active tokens
        3. Return the default model for the first provider with tokens
        4. If no provider-specific default, return any active model for that provider
        """
        from ..database.models import ModelConfig, AIProvider, AIToken
        
        # Get providers sorted by priority
        providers = db.query(AIProvider).filter(
            AIProvider.is_enabled == True
        ).order_by(AIProvider.priority.asc()).all()
        
        for provider in providers:
            # Check if provider has active tokens
            active_tokens = db.query(AIToken).filter(
                AIToken.provider_id == provider.id,
                AIToken.is_active == True,
                AIToken.is_available == True
            ).first()
            
            if not active_tokens:
                logger.debug(f"Provider {provider.name} has no active tokens, skipping")
                continue
            
            # Find default model for this provider
            model = db.query(ModelConfig).filter(
                ModelConfig.is_active == True,
                ModelConfig.is_default == True,
                ModelConfig.provider == provider.name
            ).first()
            
            if model:
                logger.info(f"Using default model '{model.name}' from provider '{provider.display_name}' (priority: {provider.priority})")
                return model
            
            # No default model for this provider, get any active model
            model = db.query(ModelConfig).filter(
                ModelConfig.is_active == True,
                ModelConfig.provider == provider.name
            ).order_by(ModelConfig.id.asc()).first()
            
            if model:
                logger.info(f"Using first active model '{model.name}' from provider '{provider.display_name}' (priority: {provider.priority})")
                return model
        
        # Fallback: try to get any default model regardless of provider
        model = db.query(ModelConfig).filter(
            ModelConfig.is_active == True,
            ModelConfig.is_default == True
        ).first()
        
        if model:
            logger.warning(f"No provider with tokens found, using fallback default model: {model.name}")
            return model
        
        # Last resort: any active model
        model = db.query(ModelConfig).filter(
            ModelConfig.is_active == True
        ).order_by(ModelConfig.id.asc()).first()
        
        if model:
            logger.warning(f"Using last resort model: {model.name}")
        
        return model
    
    def get_providers_with_tokens(self, db: Session) -> List[Dict[str, Any]]:
        """Get all providers with their tokens, sorted by priority"""
        from ..database.models import AIProvider, AIToken
        from sqlalchemy.orm import joinedload
        
        providers = db.query(AIProvider).options(
            joinedload(AIProvider.tokens)
        ).filter(
            AIProvider.is_enabled == True
        ).order_by(AIProvider.priority.asc()).all()
        
        result = []
        for provider in providers:
            active_tokens = [
                t for t in provider.tokens 
                if t.is_active and t.is_available
            ]
            
            if active_tokens:
                # Sort tokens by priority
                active_tokens.sort(key=lambda t: t.priority)
                
                result.append({
                    "id": provider.id,
                    "name": provider.name,
                    "display_name": provider.display_name,
                    "api_url": provider.api_url,
                    "priority": provider.priority,
                    "tokens": [
                        {
                            "id": t.id,
                            "display_name": t.display_name,
                            "api_key": t.api_key_plain,
                            "api_url": t.api_url or provider.api_url,
                            "priority": t.priority
                        }
                        for t in active_tokens
                    ]
                })
        
        return result
    
    def get_tokens_for_provider(self, db: Session, provider_name: str) -> List[Dict[str, Any]]:
        """Get active tokens for a specific provider, sorted by priority"""
        from ..database.models import AIProvider, AIToken
        from sqlalchemy.orm import joinedload
        
        provider = db.query(AIProvider).options(
            joinedload(AIProvider.tokens)
        ).filter(
            AIProvider.name == provider_name,
            AIProvider.is_enabled == True
        ).first()
        
        if not provider:
            return []
        
        active_tokens = [
            t for t in provider.tokens 
            if t.is_active and t.is_available
        ]
        
        # Sort by priority
        active_tokens.sort(key=lambda t: t.priority)
        
        return [
            {
                "id": t.id,
                "display_name": t.display_name,
                "api_key": t.api_key_plain,
                "api_url": t.api_url or provider.api_url,
                "priority": t.priority,
                "provider_name": provider.name,
                "provider_display_name": provider.display_name
            }
            for t in active_tokens
        ]
    
    def build_failover_chain(
        self, 
        db: Session, 
        model: Any
    ) -> List[Dict[str, Any]]:
        """
        Build the complete failover chain for a model with ROUND-ROBIN support.
        
        Round-Robin Logic:
        1. Get current index for provider from database
        2. Start from next token in sequence (round-robin)
        3. If token fails, continue to next token
        4. After successful request, update index in database
        
        Returns list of token configs to try in order:
        1. Tokens for model's provider (starting from round-robin position)
        2. Tokens for other providers (by global priority)
        """
        from ..database.models import RoundRobinState
        
        chain = []
        model_provider = model.provider
        
        # Get all providers with tokens
        all_providers = self.get_providers_with_tokens(db)
        
        # First: Add tokens for model's provider with round-robin ordering
        for provider in all_providers:
            if provider["name"] == model_provider:
                tokens = provider["tokens"]
                token_count = len(tokens)
                
                if token_count == 0:
                    continue
                
                # Get or create round-robin state for this provider
                rr_state = db.query(RoundRobinState).filter(
                    RoundRobinState.provider_name == model_provider
                ).first()
                
                if not rr_state:
                    # Create new state
                    rr_state = RoundRobinState(
                        provider_name=model_provider,
                        current_index=0,
                        token_count=token_count
                    )
                    db.add(rr_state)
                    db.commit()
                    db.refresh(rr_state)
                
                # Get starting index (round-robin position)
                start_index = rr_state.current_index % token_count
                
                logger.info(f"🔄 Round-Robin: Provider '{model_provider}' starting at token index {start_index} (of {token_count})")
                
                # Reorder tokens starting from round-robin position
                ordered_tokens = tokens[start_index:] + tokens[:start_index]
                
                for i, token in enumerate(ordered_tokens):
                    original_index = (start_index + i) % token_count
                    chain.append({
                        **token,
                        "provider_name": provider["name"],
                        "provider_display_name": provider["display_name"],
                        "is_primary_provider": True,
                        "round_robin_index": original_index,
                        "token_count": token_count
                    })
                break
        
        # Second: Add tokens for other providers (fallback) - no round-robin for fallbacks
        for provider in all_providers:
            if provider["name"] != model_provider:
                for token in provider["tokens"]:
                    chain.append({
                        **token,
                        "provider_name": provider["name"],
                        "provider_display_name": provider["display_name"],
                        "is_primary_provider": False,
                        "round_robin_index": None,
                        "token_count": None
                    })
        
        return chain
    
    def _advance_round_robin(self, db: Session, provider_name: str, token_count: int):
        """Advance round-robin index to next token for provider"""
        from ..database.models import RoundRobinState
        
        try:
            rr_state = db.query(RoundRobinState).filter(
                RoundRobinState.provider_name == provider_name
            ).first()
            
            if rr_state:
                # Advance to next token
                rr_state.current_index = (rr_state.current_index + 1) % token_count
                rr_state.token_count = token_count
                db.commit()
                logger.info(f"🔄 Round-Robin advanced: {provider_name} -> index {rr_state.current_index}")
            else:
                # Create new state starting at index 1 (since we just used index 0)
                rr_state = RoundRobinState(
                    provider_name=provider_name,
                    current_index=1 % token_count,
                    token_count=token_count
                )
                db.add(rr_state)
                db.commit()
                logger.info(f"🔄 Round-Robin created: {provider_name} -> index {rr_state.current_index}")
        except Exception as e:
            logger.warning(f"Failed to advance round-robin: {e}")
            db.rollback()
    
    async def make_request_with_failover(
        self,
        db: Session,
        model: Any,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        stream: bool = False
    ) -> Tuple[Optional[Any], Dict[str, Any]]:
        """
        Make LLM request with automatic failover.
        
        Returns:
            Tuple of (response, metadata)
            - response: The API response or None if all failed
            - metadata: Dict with request details (token used, attempts, etc.)
        """
        chain = self.build_failover_chain(db, model)
        
        if not chain:
            logger.error("No tokens available in failover chain")
            return None, {"error": "No tokens available", "attempts": 0}
        
        metadata = {
            "model": model.model_name,
            "model_name": model.name,
            "provider": model.provider,
            "attempts": 0,
            "tokens_tried": [],
            "success": False,
            "token_used": None,
            "duration": 0,
            "error": None,
            "token_selection_method": "round_robin",
            "round_robin_index": None
        }
        
        start_time = time.time()
        
        for token_config in chain:
            metadata["attempts"] += 1
            metadata["tokens_tried"].append(token_config["display_name"])
            
            # Log round-robin info for primary provider tokens
            if token_config.get("is_primary_provider") and token_config.get("round_robin_index") is not None:
                metadata["round_robin_index"] = token_config["round_robin_index"]
                logger.info(f"🎯 Round-robin token selection: index={token_config['round_robin_index']}/{token_config['token_count']}")
            
            try:
                logger.info(f"🔄 Attempt {metadata['attempts']}: Trying token '{token_config['display_name']}' from {token_config['provider_display_name']}")
                
                # Build request based on provider
                response = await self._make_provider_request(
                    token_config=token_config,
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=stream
                )
                
                if response:
                    metadata["success"] = True
                    metadata["token_used"] = token_config["display_name"]
                    metadata["duration"] = time.time() - start_time
                    
                    # Update token success in database and advance round-robin
                    await self._update_token_success(db, token_config["id"], token_config)
                    
                    logger.info(f"✅ Success with token '{token_config['display_name']}' after {metadata['attempts']} attempt(s)")
                    return response, metadata
                    
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"❌ Token '{token_config['display_name']}' failed: {error_msg[:100]}")
                
                # Update token failure in database
                await self._update_token_failure(db, token_config["id"], error_msg)
                
                # Log error to error_logs table
                try:
                    from .error_logger import error_logger
                    error_logger.log_llm_error(
                        db=db,
                        error_message=error_msg,
                        model_name=model.model_name,
                        provider_name=token_config.get("provider_name", "unknown"),
                        token_name=token_config.get("display_name"),
                        endpoint=token_config.get("api_url"),
                        request_details={
                            "model": model.model_name,
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                            "message_count": len(messages),
                            "attempt": metadata["attempts"]
                        }
                    )
                except Exception as log_error:
                    logger.warning(f"Failed to log error: {log_error}")
                
                metadata["error"] = error_msg
                continue
        
        metadata["duration"] = time.time() - start_time
        logger.error(f"🚫 All {metadata['attempts']} tokens failed for model {model.name}")
        
        return None, metadata
    
    async def _make_provider_request(
        self,
        token_config: Dict[str, Any],
        model: Any,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        stream: bool
    ) -> Optional[Any]:
        """Make request to specific provider with token"""
        provider_name = token_config["provider_name"]
        api_key = token_config["api_key"]
        api_url = token_config["api_url"]
        
        # Format messages for API
        formatted_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
        ]
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Use model name as-is - HuggingFace Router auto-selects best provider
        payload = {
            "model": model.model_name,
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }
        
        # Provider-specific configurations
        if provider_name == "huggingface":
            # HuggingFace Router endpoint - auto-selects best provider
            if not api_url or "huggingface" in api_url:
                api_url = "https://router.huggingface.co/v1"
            
            endpoint = f"{api_url}/chat/completions"
            
        elif provider_name == "openai":
            api_url = api_url or "https://api.openai.com/v1"
            endpoint = f"{api_url}/chat/completions"
            
        elif provider_name == "deepseek":
            api_url = api_url or "https://api.deepseek.com/v1"
            endpoint = f"{api_url}/chat/completions"
            
        elif provider_name == "anthropic":
            api_url = api_url or "https://api.anthropic.com/v1"
            endpoint = f"{api_url}/messages"
            # Anthropic has different format
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"
            del headers["Authorization"]
            payload = {
                "model": model.model_name,
                "messages": formatted_messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        else:
            # Generic OpenAI-compatible endpoint
            endpoint = f"{api_url}/chat/completions" if api_url else None
            if not endpoint:
                raise ValueError(f"No API URL configured for provider {provider_name}")
        
        logger.info(f"🌐 Making request to: {endpoint}")
        logger.debug(f"📤 Payload: model={model.model_name}, messages={len(formatted_messages)}")
        
        # Force non-streaming for now to avoid SSE parsing issues
        # TODO: Implement proper SSE streaming support
        payload["stream"] = False
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    endpoint,
                    headers=headers,
                    json=payload
                )
            except httpx.ConnectError as e:
                raise Exception(f"Connection failed to {endpoint}: {str(e)}")
            except httpx.TimeoutException as e:
                raise Exception(f"Request timeout to {endpoint}: {str(e)}")
            
            logger.info(f"📥 Response status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    response_text = response.text
                    if not response_text or response_text.strip() == "":
                        raise Exception("Empty response from API")
                    
                    # Check if response is SSE format (streaming)
                    if response_text.startswith("data:"):
                        # Parse SSE streaming response
                        logger.info("📡 Parsing SSE streaming response...")
                        return self._parse_sse_response(response_text)
                    
                    return response.json()
                except json.JSONDecodeError as e:
                    # Try to parse as SSE if JSON fails
                    if "data:" in response_text:
                        logger.info("📡 Fallback: Parsing as SSE response...")
                        return self._parse_sse_response(response_text)
                    logger.error(f"JSON decode error: {e}, Response text: {response_text[:500]}")
                    raise Exception(f"Invalid JSON response: {response_text[:200]}")
            elif response.status_code == 429:
                raise Exception(f"Rate limit exceeded: {response.text[:200]}")
            elif response.status_code == 401:
                raise Exception(f"Authentication failed: Invalid API key")
            elif response.status_code == 402:
                raise Exception(f"Payment required: Quota exceeded")
            elif response.status_code == 403:
                raise Exception(f"Access forbidden: {response.text[:200]}")
            elif response.status_code == 404:
                raise Exception(f"Model or endpoint not found: {response.text[:200]}")
            elif response.status_code >= 500:
                raise Exception(f"Server error {response.status_code}: {response.text[:200]}")
            else:
                raise Exception(f"API error {response.status_code}: {response.text[:200]}")
    
    def _parse_sse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Server-Sent Events (SSE) streaming response into a single response object"""
        content_parts = []
        last_chunk = None
        
        for line in response_text.split('\n'):
            line = line.strip()
            if line.startswith('data:'):
                data_str = line[5:].strip()
                if data_str == '[DONE]':
                    break
                try:
                    chunk = json.loads(data_str)
                    last_chunk = chunk
                    
                    # Extract content from delta
                    choices = chunk.get('choices', [])
                    if choices:
                        delta = choices[0].get('delta', {})
                        content = delta.get('content', '')
                        if content:
                            content_parts.append(content)
                except json.JSONDecodeError:
                    continue
        
        # Build final response in OpenAI format
        full_content = ''.join(content_parts)
        
        if last_chunk:
            return {
                "id": last_chunk.get("id", "unknown"),
                "object": "chat.completion",
                "created": last_chunk.get("created", 0),
                "model": last_chunk.get("model", "unknown"),
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": full_content
                    },
                    "finish_reason": "stop"
                }]
            }
        
        # Fallback if no chunks parsed
        return {
            "id": "unknown",
            "object": "chat.completion",
            "created": 0,
            "model": "unknown",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": full_content or "No response content"
                },
                "finish_reason": "stop"
            }]
        }
    
    async def _update_token_success(self, db: Session, token_id: int, token_config: Dict[str, Any] = None):
        """Update token stats on successful request and advance round-robin"""
        from ..database.models import AIToken
        
        try:
            token = db.query(AIToken).filter(AIToken.id == token_id).first()
            if token:
                token.total_requests = (token.total_requests or 0) + 1
                token.last_used_at = datetime.utcnow()
                token.is_available = True
                token.last_error = None
                # Don't commit here - let the parent transaction handle it
                db.flush()
                
                # Advance round-robin for primary provider tokens
                if token_config and token_config.get("is_primary_provider") and token_config.get("token_count"):
                    self._advance_round_robin(
                        db, 
                        token_config["provider_name"], 
                        token_config["token_count"]
                    )
        except Exception as e:
            logger.warning(f"Failed to update token success stats: {e}")
            # Do NOT rollback - it would destroy the parent transaction (conversation, messages, etc.)
    
    async def _update_token_failure(self, db: Session, token_id: int, error: str):
        """Update token stats on failed request"""
        from ..database.models import AIToken
        
        try:
            token = db.query(AIToken).filter(AIToken.id == token_id).first()
            if token:
                token.total_requests = (token.total_requests or 0) + 1
                token.failed_requests = (token.failed_requests or 0) + 1
                token.last_error = error[:500]
                token.last_error_at = datetime.utcnow()
                
                # Mark as unavailable if too many failures
                total = token.total_requests or 1
                failed = token.failed_requests or 0
                failure_rate = failed / max(total, 1)
                if failure_rate > 0.8 and total > 5:
                    token.is_available = False
                    logger.warning(f"Token {token.display_name} marked unavailable due to high failure rate")
                
                db.flush()
        except Exception as e:
            logger.warning(f"Failed to update token failure stats: {e}")
            # Do NOT rollback - it would destroy the parent transaction
    
    def record_statistics(
        self, 
        db: Session, 
        metadata: Dict[str, Any],
        mode: str = "chat"
    ):
        """Record request statistics to database"""
        from ..database.statistics_model import Statistics
        
        try:
            stat = Statistics(
                category="request",
                key=metadata.get("model", "unknown"),
                value=str(metadata.get("duration", 0)),
                data=json.dumps({
                    "model": metadata.get("model"),
                    "model_name": metadata.get("model_name"),
                    "provider": metadata.get("provider"),
                    "token_used": metadata.get("token_used"),
                    "attempts": metadata.get("attempts"),
                    "success": metadata.get("success"),
                    "mode": mode,
                    "error": metadata.get("error") if not metadata.get("success") else None
                }, ensure_ascii=False),
                timestamp=datetime.utcnow()
            )
            db.add(stat)
            db.commit()
            logger.debug(f"Recorded statistics for request: {metadata.get('model')}")
        except Exception as e:
            logger.warning(f"Failed to record statistics: {e}")
            db.rollback()


# Global router instance
llm_router = LLMRouter()
