"""
AI Providers and Tokens API
Manages AI providers and their API tokens
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

from ..database.connection import get_db
from ..database.models import AIProvider as AIProviderModel, AIToken as AITokenModel, ModelConfig
from ..auth.dependencies import get_current_admin_user

ai_providers_router = APIRouter()


# ============== Pydantic Models ==============

class TokenResponse(BaseModel):
    id: int
    provider_id: int
    display_name: str
    api_url: Optional[str]
    priority: int
    is_active: bool
    is_available: bool
    total_requests: int
    failed_requests: int
    last_used_at: Optional[str]
    last_error: Optional[str]
    created_at: str

class ProviderResponse(BaseModel):
    id: int
    name: str
    display_name: str
    service_type: str
    api_url: Optional[str]
    priority: int
    is_enabled: bool
    is_active: bool
    default_model: Optional[str]
    default_model_display_name: Optional[str]
    token_count: int
    active_token_count: int
    has_tokens: bool
    created_at: str

class CreateProviderRequest(BaseModel):
    name: str
    display_name: str
    service_type: str = "inference"
    api_url: Optional[str] = None
    priority: int = 1

class UpdateProviderRequest(BaseModel):
    display_name: Optional[str] = None
    api_url: Optional[str] = None
    priority: Optional[int] = None
    is_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    default_model: Optional[str] = None
    default_model_display_name: Optional[str] = None

class CreateTokenRequest(BaseModel):
    display_name: str
    api_key: str
    api_url: Optional[str] = None
    priority: int = 1

class UpdateTokenRequest(BaseModel):
    display_name: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


# ============== Sub-Providers (Inference Providers) ==============

# HuggingFace Inference Providers - from https://huggingface.co/inference/models
HUGGINGFACE_SUB_PROVIDERS = [
    {"id": "hf-inference", "name": "hf-inference", "display_name": "HF Inference API", "api_url": "https://api-inference.huggingface.co/models", "description": "Official HuggingFace Inference API", "is_free": True},
    {"id": "groq", "name": "groq", "display_name": "Groq", "api_url": "https://api.groq.com/openai/v1", "description": "Ultra-fast inference with Groq LPU", "is_free": False},
    {"id": "together", "name": "together", "display_name": "Together AI", "api_url": "https://api.together.xyz/v1", "description": "Together AI inference platform", "is_free": False},
    {"id": "nebius", "name": "nebius", "display_name": "Nebius AI", "api_url": "https://api.studio.nebius.ai/v1", "description": "Nebius AI Studio", "is_free": False},
    {"id": "novita", "name": "novita", "display_name": "Novita", "api_url": "https://api.novita.ai/v3/openai", "description": "Novita AI inference", "is_free": False},
    {"id": "cerebras", "name": "cerebras", "display_name": "Cerebras", "api_url": "https://api.cerebras.ai/v1", "description": "Cerebras AI inference", "is_free": False},
    {"id": "sambanova", "name": "sambanova", "display_name": "SambaNova", "api_url": "https://api.sambanova.ai/v1", "description": "SambaNova AI inference", "is_free": False},
    {"id": "nscale", "name": "nscale", "display_name": "Nscale", "api_url": "https://inference.nscale.com/v1", "description": "Nscale inference platform", "is_free": False},
    {"id": "fal", "name": "fal", "display_name": "fal", "api_url": "https://fal.run", "description": "fal.ai inference", "is_free": False},
    {"id": "hyperbolic", "name": "hyperbolic", "display_name": "Hyperbolic", "api_url": "https://api.hyperbolic.xyz/v1", "description": "Hyperbolic inference", "is_free": False},
    {"id": "fireworks", "name": "fireworks", "display_name": "Fireworks", "api_url": "https://api.fireworks.ai/inference/v1", "description": "Fireworks AI inference", "is_free": False},
    {"id": "featherless", "name": "featherless", "display_name": "Featherless AI", "api_url": "https://api.featherless.ai/v1", "description": "Featherless AI inference", "is_free": False},
    {"id": "replicate", "name": "replicate", "display_name": "Replicate", "api_url": "https://api.replicate.com/v1", "description": "Replicate inference", "is_free": False},
    {"id": "cohere", "name": "cohere", "display_name": "Cohere", "api_url": "https://api.cohere.ai/v1", "description": "Cohere AI inference", "is_free": False},
    {"id": "scaleway", "name": "scaleway", "display_name": "Scaleway", "api_url": "https://api.scaleway.ai/v1", "description": "Scaleway AI inference", "is_free": False},
    {"id": "zai", "name": "zai", "display_name": "Zai", "api_url": "https://api.zai.chat/v1", "description": "Zai AI inference", "is_free": False},
    {"id": "public-ai", "name": "public-ai", "display_name": "Public AI", "api_url": "https://api.public.ai/v1", "description": "Public AI inference", "is_free": False},
    {"id": "ovhcloud", "name": "ovhcloud", "display_name": "OVHcloud AI Endpoints", "api_url": "https://api.ai.cloud.ovh.net/v1", "description": "OVHcloud AI inference", "is_free": False},
    {"id": "wavespeed", "name": "wavespeed", "display_name": "WaveSpeed", "api_url": "https://api.wavespeed.ai/v1", "description": "WaveSpeed AI inference", "is_free": False},
]

# OpenAI Sub-Providers (for future use)
OPENAI_SUB_PROVIDERS = [
    {"id": "openai", "name": "openai", "display_name": "OpenAI", "api_url": "https://api.openai.com/v1", "description": "Official OpenAI API", "is_free": False},
    {"id": "azure", "name": "azure", "display_name": "Azure OpenAI", "api_url": "", "description": "Azure OpenAI Service", "is_free": False},
]

# Anthropic Sub-Providers (for future use)
ANTHROPIC_SUB_PROVIDERS = [
    {"id": "anthropic", "name": "anthropic", "display_name": "Anthropic", "api_url": "https://api.anthropic.com/v1", "description": "Official Anthropic API", "is_free": False},
]

# DeepSeek Sub-Providers (for future use)
DEEPSEEK_SUB_PROVIDERS = [
    {"id": "deepseek", "name": "deepseek", "display_name": "DeepSeek", "api_url": "https://api.deepseek.com/v1", "description": "Official DeepSeek API", "is_free": False},
]

# Map provider names to their sub-providers
SUB_PROVIDERS_MAP = {
    "huggingface": HUGGINGFACE_SUB_PROVIDERS,
    "openai": OPENAI_SUB_PROVIDERS,
    "anthropic": ANTHROPIC_SUB_PROVIDERS,
    "deepseek": DEEPSEEK_SUB_PROVIDERS,
}


# ============== Helper Functions ==============

def update_models_status_for_provider(db: Session, provider_name: str, has_tokens: bool):
    """
    Update LLM models status based on provider token availability
    If provider has no tokens, deactivate all models for that provider
    If provider gets tokens, reactivate models
    """
    try:
        models = db.query(ModelConfig).filter(ModelConfig.provider == provider_name).all()
        for model in models:
            model.is_active = has_tokens
        db.commit()
        logger.info(f"Updated {len(models)} models for provider {provider_name}: is_active={has_tokens}")
    except Exception as e:
        logger.error(f"Error updating models status: {e}")
        db.rollback()


def check_and_update_provider_token_status(db: Session, provider_id: int):
    """Check provider's token status and update models accordingly"""
    provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
    if provider:
        active_tokens = db.query(AITokenModel).filter(
            AITokenModel.provider_id == provider_id,
            AITokenModel.is_active == True
        ).count()
        has_tokens = active_tokens > 0
        update_models_status_for_provider(db, provider.name, has_tokens)


# ============== Provider Endpoints ==============

@ai_providers_router.get("/")
async def get_providers(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get all AI providers with token counts and default model from models table"""
    try:
        providers = db.query(AIProviderModel).options(
            joinedload(AIProviderModel.tokens)
        ).order_by(AIProviderModel.priority).all()
        
        result = []
        for p in providers:
            active_tokens = [t for t in p.tokens if t.is_active]
            
            # Get default model from models table for this provider
            default_model = db.query(ModelConfig).filter(
                ModelConfig.provider == p.name,
                ModelConfig.is_default == True
            ).first()
            
            default_model_name = None
            default_model_display = None
            if default_model:
                default_model_name = default_model.model_name
                default_model_display = default_model.name  # Display name from models table
            
            result.append({
                "id": p.id,
                "name": p.name,
                "display_name": p.display_name,
                "service_type": p.service_type,
                "api_url": p.api_url,
                "priority": p.priority,
                "is_enabled": p.is_enabled,
                "is_active": p.is_active,
                "default_model": default_model_name,
                "default_model_display_name": default_model_display,
                "token_count": len(p.tokens),
                "active_token_count": len(active_tokens),
                "has_tokens": len(active_tokens) > 0,
                "created_at": p.created_at.isoformat() if p.created_at else None
            })
        
        return {"success": True, "providers": result}
        
    except Exception as e:
        logger.error(f"Error fetching providers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.post("/")
async def create_provider(
    request: CreateProviderRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Create a new AI provider"""
    try:
        # Check if provider already exists
        existing = db.query(AIProviderModel).filter(AIProviderModel.name == request.name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Provider '{request.name}' already exists")
        
        provider = AIProviderModel(
            name=request.name,
            display_name=request.display_name,
            service_type=request.service_type,
            api_url=request.api_url,
            priority=request.priority,
            is_enabled=True,
            is_active=False
        )
        db.add(provider)
        db.commit()
        db.refresh(provider)
        
        return {"success": True, "provider": {"id": provider.id, "name": provider.name}}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating provider: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.get("/{provider_id}")
async def get_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get a specific provider with its tokens"""
    try:
        provider = db.query(AIProviderModel).options(
            joinedload(AIProviderModel.tokens)
        ).filter(AIProviderModel.id == provider_id).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        tokens = []
        for t in sorted(provider.tokens, key=lambda x: x.priority):
            tokens.append({
                "id": t.id,
                "display_name": t.display_name,
                "api_url": t.api_url,
                "priority": t.priority,
                "is_active": t.is_active,
                "is_available": t.is_available,
                "total_requests": t.total_requests,
                "failed_requests": t.failed_requests,
                "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
                "last_error": t.last_error,
                "created_at": t.created_at.isoformat() if t.created_at else None
            })
        
        return {
            "success": True,
            "provider": {
                "id": provider.id,
                "name": provider.name,
                "display_name": provider.display_name,
                "service_type": provider.service_type,
                "api_url": provider.api_url,
                "priority": provider.priority,
                "is_enabled": provider.is_enabled,
                "is_active": provider.is_active,
                "default_model": provider.default_model,
                "default_model_display_name": provider.default_model_display_name,
                "tokens": tokens
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.put("/{provider_id}")
async def update_provider(
    provider_id: int,
    request: UpdateProviderRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Update a provider"""
    try:
        provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        # If setting as active, deactivate others
        if request.is_active:
            db.query(AIProviderModel).filter(AIProviderModel.id != provider_id).update({"is_active": False})
        
        # Update fields
        if request.display_name is not None:
            provider.display_name = request.display_name
        if request.api_url is not None:
            provider.api_url = request.api_url
        if request.priority is not None:
            provider.priority = request.priority
        if request.is_enabled is not None:
            provider.is_enabled = request.is_enabled
        if request.is_active is not None:
            provider.is_active = request.is_active
        if request.default_model is not None:
            provider.default_model = request.default_model
        if request.default_model_display_name is not None:
            provider.default_model_display_name = request.default_model_display_name
        
        db.commit()
        
        return {"success": True, "message": "Provider updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating provider: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.delete("/{provider_id}")
async def delete_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Delete a provider and all its tokens"""
    try:
        provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        provider_name = provider.name
        db.delete(provider)
        db.commit()
        
        # Deactivate models for this provider
        update_models_status_for_provider(db, provider_name, False)
        
        return {"success": True, "message": "Provider deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting provider: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.post("/{provider_id}/set-active")
async def set_active_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Set a provider as the active one"""
    try:
        provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        if not provider.is_enabled:
            raise HTTPException(status_code=400, detail="Cannot activate disabled provider")
        
        # Check if provider has tokens
        active_tokens = db.query(AITokenModel).filter(
            AITokenModel.provider_id == provider_id,
            AITokenModel.is_active == True
        ).count()
        
        if active_tokens == 0:
            raise HTTPException(status_code=400, detail="Provider has no active tokens")
        
        # Deactivate all providers
        db.query(AIProviderModel).update({"is_active": False})
        
        # Activate this one
        provider.is_active = True
        db.commit()
        
        return {"success": True, "message": f"{provider.display_name} is now active"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting active provider: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.post("/reorder")
async def reorder_providers(
    provider_ids: List[int],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Reorder providers by priority"""
    try:
        for idx, provider_id in enumerate(provider_ids):
            db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).update({"priority": idx + 1})
        db.commit()
        return {"success": True, "message": "Providers reordered"}
    except Exception as e:
        logger.error(f"Error reordering providers: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============== Token Endpoints ==============

@ai_providers_router.get("/{provider_id}/tokens")
async def get_provider_tokens(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get all tokens for a provider"""
    try:
        tokens = db.query(AITokenModel).filter(
            AITokenModel.provider_id == provider_id
        ).order_by(AITokenModel.priority).all()
        
        result = []
        for t in tokens:
            result.append({
                "id": t.id,
                "provider_id": t.provider_id,
                "display_name": t.display_name,
                "api_url": t.api_url,
                "priority": t.priority,
                "is_active": t.is_active,
                "is_available": t.is_available,
                "total_requests": t.total_requests,
                "failed_requests": t.failed_requests,
                "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
                "last_error": t.last_error,
                "created_at": t.created_at.isoformat() if t.created_at else None
            })
        
        return {"success": True, "tokens": result}
        
    except Exception as e:
        logger.error(f"Error fetching tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.post("/{provider_id}/tokens")
async def create_token(
    provider_id: int,
    request: CreateTokenRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Create a new token for a provider"""
    try:
        provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        # Get max priority for this provider
        max_priority = db.query(AITokenModel).filter(
            AITokenModel.provider_id == provider_id
        ).count()
        
        token = AITokenModel(
            provider_id=provider_id,
            display_name=request.display_name,
            api_url=request.api_url or provider.api_url,
            priority=request.priority or (max_priority + 1),
            is_active=True,
            is_available=True
        )
        token.set_api_key(request.api_key)  # Encrypt before storing
        db.add(token)
        db.commit()
        db.refresh(token)
        
        # Reset round-robin index when token list changes
        from ..services.llm_router import LLMRouter
        router = LLMRouter()
        router.reset_round_robin_index(db, provider.name)
        logger.info(f"🔄 Reset round-robin for {provider.name} after token creation")
        
        # Update models status - provider now has tokens
        update_models_status_for_provider(db, provider.name, True)
        
        return {"success": True, "token": {"id": token.id, "display_name": token.display_name}}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating token: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.put("/{provider_id}/tokens/{token_id}")
async def update_token(
    provider_id: int,
    token_id: int,
    request: UpdateTokenRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Update a token"""
    try:
        token = db.query(AITokenModel).filter(
            AITokenModel.id == token_id,
            AITokenModel.provider_id == provider_id
        ).first()
        
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")
        
        if request.display_name is not None:
            token.display_name = request.display_name
        if request.api_key is not None:
            token.set_api_key(request.api_key)  # Encrypt before storing
        if request.api_url is not None:
            token.api_url = request.api_url
        if request.priority is not None:
            token.priority = request.priority
        if request.is_active is not None:
            token.is_active = request.is_active
        
        db.commit()
        
        # Reset round-robin index when token list changes (active/inactive change)
        if request.is_active is not None:
            from ..services.llm_router import LLMRouter
            provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
            if provider:
                router = LLMRouter()
                router.reset_round_robin_index(db, provider.name)
                logger.info(f"🔄 Reset round-robin for {provider.name} after token update")
        
        # Check and update models status
        check_and_update_provider_token_status(db, provider_id)
        
        return {"success": True, "message": "Token updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating token: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.delete("/{provider_id}/tokens/{token_id}")
async def delete_token(
    provider_id: int,
    token_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Delete a token"""
    try:
        token = db.query(AITokenModel).filter(
            AITokenModel.id == token_id,
            AITokenModel.provider_id == provider_id
        ).first()
        
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")
        
        # Get provider name before deletion
        provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
        provider_name = provider.name if provider else None
        
        db.delete(token)
        db.commit()
        
        # Reset round-robin index when token list changes
        if provider_name:
            from ..services.llm_router import LLMRouter
            router = LLMRouter()
            router.reset_round_robin_index(db, provider_name)
            logger.info(f"🔄 Reset round-robin for {provider_name} after token deletion")
        
        # Check and update models status
        check_and_update_provider_token_status(db, provider_id)
        
        return {"success": True, "message": "Token deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting token: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.get("/{provider_id}/tokens/{token_id}/api-key")
async def get_token_api_key(
    provider_id: int,
    token_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get the API key for a token (admin only)"""
    try:
        token = db.query(AITokenModel).filter(
            AITokenModel.id == token_id,
            AITokenModel.provider_id == provider_id
        ).first()
        
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")
        
        return {"success": True, "api_key": token.api_key_plain}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ReorderTokensRequest(BaseModel):
    token_ids: List[int]


@ai_providers_router.post("/{provider_id}/tokens/reorder")
async def reorder_tokens(
    provider_id: int,
    request: ReorderTokensRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Reorder tokens by setting their priorities based on the order of token_ids"""
    try:
        # Verify provider exists
        provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        # Update priorities based on order
        for index, token_id in enumerate(request.token_ids):
            token = db.query(AITokenModel).filter(
                AITokenModel.id == token_id,
                AITokenModel.provider_id == provider_id
            ).first()
            
            if token:
                token.priority = index + 1
        
        db.commit()
        
        # Reset round-robin index when token order changes
        from ..services.llm_router import LLMRouter
        router = LLMRouter()
        router.reset_round_robin_index(db, provider.name)
        logger.info(f"🔄 Reset round-robin for {provider.name} after token reorder")
        
        return {"success": True, "message": "Token order updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering tokens: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.post("/{provider_id}/tokens/{token_id}/test")
async def test_token(
    provider_id: int,
    token_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Test a token by making a simple API call"""
    import httpx
    
    try:
        token = db.query(AITokenModel).filter(
            AITokenModel.id == token_id,
            AITokenModel.provider_id == provider_id
        ).first()
        
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")
        
        provider = db.query(AIProviderModel).filter(AIProviderModel.id == provider_id).first()
        
        # Test based on provider type
        api_url = token.api_url or provider.api_url
        api_key = token.api_key_plain
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                if provider.name == "huggingface":
                    # Test HuggingFace API - use whoami-v2 endpoint
                    response = await client.get(
                        "https://huggingface.co/api/whoami-v2",
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                    
                    if response.status_code == 200:
                        # Token is valid - extract user info
                        try:
                            user_data = response.json()
                            username = user_data.get("name", "Bilinmiyor")
                            is_pro = user_data.get("isPro", False)
                            can_pay = user_data.get("canPay", False)
                            
                            token.is_available = True
                            token.last_error = None
                            db.commit()
                            
                            # Build info message
                            status_parts = [f"Kullanıcı: {username}"]
                            if is_pro:
                                status_parts.append("PRO hesap")
                            else:
                                status_parts.append("Ücretsiz hesap")
                            
                            return {
                                "success": True, 
                                "message": f"Token çalışıyor! {' | '.join(status_parts)}",
                                "user_info": {
                                    "username": username,
                                    "is_pro": is_pro,
                                    "can_pay": can_pay
                                }
                            }
                        except:
                            token.is_available = True
                            token.last_error = None
                            db.commit()
                            return {"success": True, "message": "Token çalışıyor"}
                elif provider.name == "openai":
                    # Test OpenAI API
                    response = await client.get(
                        f"{api_url or 'https://api.openai.com/v1'}/models",
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                elif provider.name == "deepseek":
                    # Test DeepSeek API
                    response = await client.get(
                        f"{api_url or 'https://api.deepseek.com/v1'}/models",
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                else:
                    # Generic test
                    response = await client.get(
                        api_url,
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                
                if response.status_code == 200:
                    token.is_available = True
                    token.last_error = None
                    db.commit()
                    return {"success": True, "message": "Token çalışıyor"}
                else:
                    token.is_available = False
                    token.last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                    token.last_error_at = datetime.utcnow()
                    db.commit()
                    return {"success": False, "message": f"Token hatası: {response.status_code}"}
                    
        except Exception as e:
            token.is_available = False
            token.last_error = str(e)[:500]
            token.last_error_at = datetime.utcnow()
            db.commit()
            return {"success": False, "message": f"Bağlantı hatası: {str(e)[:100]}"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Public Endpoints (for LLM Models page) ==============

@ai_providers_router.get("/with-tokens")
async def get_providers_with_tokens(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get providers that have at least one active token (for model selection)"""
    try:
        providers = db.query(AIProviderModel).options(
            joinedload(AIProviderModel.tokens)
        ).filter(AIProviderModel.is_enabled == True).order_by(AIProviderModel.priority).all()
        
        result = []
        for p in providers:
            active_tokens = [t for t in p.tokens if t.is_active]
            if len(active_tokens) > 0:
                result.append({
                    "id": p.id,
                    "name": p.name,
                    "display_name": p.display_name,
                    "token_count": len(active_tokens)
                })
        
        return {"success": True, "providers": result}
        
    except Exception as e:
        logger.error(f"Error fetching providers with tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@ai_providers_router.get("/{provider_name}/sub-providers")
async def get_sub_providers(
    provider_name: str,
    current_user = Depends(get_current_admin_user)
):
    """Get sub-providers (inference providers) for a given provider"""
    try:
        provider_name_lower = provider_name.lower()
        
        if provider_name_lower not in SUB_PROVIDERS_MAP:
            # Return empty list for unknown providers
            return []
        
        return SUB_PROVIDERS_MAP[provider_name_lower]
        
    except Exception as e:
        logger.error(f"Error fetching sub-providers for {provider_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
