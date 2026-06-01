"""
AI Provider Configuration API
Manages provider priorities, default models, and failover settings
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ..database.connection import get_db
from ..database.models import Settings
from ..auth.dependencies import get_current_admin_user

logger = logging.getLogger(__name__)

ai_provider_config_router = APIRouter()

# ===== Pydantic Models =====

class SubProvider(BaseModel):
    name: str
    display_name: str
    priority: int = 1
    is_enabled: bool = True
    config: Optional[Dict[str, Any]] = None

class ProviderConfig(BaseModel):
    name: str  # huggingface, deepseek, openai, anthropic
    display_name: str
    priority: int = 1
    is_enabled: bool = True
    default_model: Optional[str] = None
    default_model_display_name: Optional[str] = None
    has_sub_providers: bool = False
    sub_providers: Optional[List[SubProvider]] = None
    config: Optional[Dict[str, Any]] = None

class AIProviderConfigSchema(BaseModel):
    providers: List[ProviderConfig]
    active_provider: str  # Currently active provider name
    fallback_enabled: bool = True
    max_retry_per_provider: int = 3
    notify_on_all_fail: bool = True

class ProviderCreateRequest(BaseModel):
    name: str
    display_name: str
    priority: Optional[int] = None
    is_enabled: bool = True
    default_model: Optional[str] = None
    default_model_display_name: Optional[str] = None
    has_sub_providers: bool = False
    sub_providers: Optional[List[SubProvider]] = None

class ProviderUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    priority: Optional[int] = None
    is_enabled: Optional[bool] = None
    default_model: Optional[str] = None
    default_model_display_name: Optional[str] = None
    has_sub_providers: Optional[bool] = None
    sub_providers: Optional[List[SubProvider]] = None

class SetActiveProviderRequest(BaseModel):
    provider_name: str

class ReorderProvidersRequest(BaseModel):
    provider_order: List[str]  # List of provider names in order

# ===== Default Configuration =====

DEFAULT_PROVIDER_CONFIG = {
    "providers": [
        {
            "name": "huggingface",
            "display_name": "HuggingFace",
            "priority": 1,
            "is_enabled": True,
            "default_model": "meta-llama/Llama-2-7b-chat-hf",
            "default_model_display_name": "Llama 2 7B Chat",
            "has_sub_providers": True,
            "sub_providers": [
                {
                    "name": "inference_api",
                    "display_name": "Inference API (Serverless)",
                    "priority": 1,
                    "is_enabled": True,
                    "config": {"type": "serverless"}
                },
                {
                    "name": "inference_endpoints",
                    "display_name": "Inference Endpoints (Dedicated)",
                    "priority": 2,
                    "is_enabled": False,
                    "config": {"type": "dedicated"}
                }
            ],
            "config": {}
        },
        {
            "name": "deepseek",
            "display_name": "DeepSeek",
            "priority": 2,
            "is_enabled": False,
            "default_model": "deepseek-chat",
            "default_model_display_name": "DeepSeek Chat",
            "has_sub_providers": False,
            "sub_providers": None,
            "config": {"api_base": "https://api.deepseek.com/v1"}
        },
        {
            "name": "openai",
            "display_name": "OpenAI",
            "priority": 3,
            "is_enabled": False,
            "default_model": "gpt-4o-mini",
            "default_model_display_name": "GPT-4o Mini",
            "has_sub_providers": False,
            "sub_providers": None,
            "config": {"api_base": "https://api.openai.com/v1"}
        },
        {
            "name": "anthropic",
            "display_name": "Anthropic",
            "priority": 4,
            "is_enabled": False,
            "default_model": "claude-3-haiku-20240307",
            "default_model_display_name": "Claude 3 Haiku",
            "has_sub_providers": False,
            "sub_providers": None,
            "config": {"api_base": "https://api.anthropic.com/v1"}
        }
    ],
    "active_provider": "huggingface",
    "fallback_enabled": True,
    "max_retry_per_provider": 3,
    "notify_on_all_fail": True,
    "created_at": None,
    "updated_at": None
}

SETTINGS_KEY = "ai_provider_config"

# ===== Helper Functions =====

def get_provider_config(db: Session) -> Dict[str, Any]:
    """Get provider config from settings, create default if not exists"""
    setting = db.query(Settings).filter(Settings.key == SETTINGS_KEY).first()
    
    if not setting:
        # Create default config
        config = DEFAULT_PROVIDER_CONFIG.copy()
        config["created_at"] = datetime.utcnow().isoformat()
        
        setting = Settings(
            key=SETTINGS_KEY,
            value=config,
            description="AI Provider configuration - priorities, models, failover settings"
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting.value
    
    return setting.value

def save_provider_config(db: Session, config: Dict[str, Any]) -> Dict[str, Any]:
    """Save provider config to settings"""
    setting = db.query(Settings).filter(Settings.key == SETTINGS_KEY).first()
    
    config["updated_at"] = datetime.utcnow().isoformat()
    
    if setting:
        setting.value = config
        flag_modified(setting, 'value')
    else:
        setting = Settings(
            key=SETTINGS_KEY,
            value=config,
            description="AI Provider configuration - priorities, models, failover settings"
        )
        db.add(setting)
    
    db.commit()
    return config

# ===== API Endpoints =====

@ai_provider_config_router.get("/")
async def get_ai_provider_config(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Get full AI provider configuration"""
    try:
        config = get_provider_config(db)
        return {
            "success": True,
            "config": config
        }
    except Exception as e:
        logger.error(f"Error getting provider config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.get("/providers")
async def get_providers(
    enabled_only: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Get list of providers"""
    try:
        config = get_provider_config(db)
        providers = config.get("providers", [])
        
        if enabled_only:
            providers = [p for p in providers if p.get("is_enabled", True)]
        
        # Sort by priority
        providers.sort(key=lambda x: x.get("priority", 999))
        
        return {
            "success": True,
            "providers": providers,
            "active_provider": config.get("active_provider")
        }
    except Exception as e:
        logger.error(f"Error getting providers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.get("/providers/{provider_name}")
async def get_provider(
    provider_name: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Get specific provider details"""
    try:
        config = get_provider_config(db)
        providers = config.get("providers", [])
        
        provider = next((p for p in providers if p.get("name") == provider_name), None)
        
        if not provider:
            raise HTTPException(status_code=404, detail=f"Provider '{provider_name}' not found")
        
        return {
            "success": True,
            "provider": provider
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.post("/providers")
async def create_provider(
    request: ProviderCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Create a new provider"""
    try:
        config = get_provider_config(db)
        providers = config.get("providers", [])
        
        # Check if provider already exists
        if any(p.get("name") == request.name for p in providers):
            raise HTTPException(status_code=400, detail=f"Provider '{request.name}' already exists")
        
        # Set priority if not provided
        if request.priority is None:
            max_priority = max([p.get("priority", 0) for p in providers], default=0)
            request.priority = max_priority + 1
        
        new_provider = {
            "name": request.name,
            "display_name": request.display_name,
            "priority": request.priority,
            "is_enabled": request.is_enabled,
            "default_model": request.default_model,
            "default_model_display_name": request.default_model_display_name,
            "has_sub_providers": request.has_sub_providers,
            "sub_providers": [sp.dict() for sp in request.sub_providers] if request.sub_providers else None,
            "config": {}
        }
        
        providers.append(new_provider)
        config["providers"] = providers
        
        save_provider_config(db, config)
        
        logger.info(f"Created provider: {request.name}")
        
        return {
            "success": True,
            "provider": new_provider
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.put("/providers/{provider_name}")
async def update_provider(
    provider_name: str,
    request: ProviderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Update a provider"""
    try:
        config = get_provider_config(db)
        providers = config.get("providers", [])
        
        provider_index = next((i for i, p in enumerate(providers) if p.get("name") == provider_name), None)
        
        if provider_index is None:
            raise HTTPException(status_code=404, detail=f"Provider '{provider_name}' not found")
        
        provider = providers[provider_index]
        
        # Update fields
        update_data = request.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field == "sub_providers" and value is not None:
                provider[field] = [sp.dict() if hasattr(sp, 'dict') else sp for sp in value]
            else:
                provider[field] = value
        
        config["providers"] = providers
        save_provider_config(db, config)
        
        logger.info(f"Updated provider: {provider_name}")
        
        return {
            "success": True,
            "provider": provider
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.delete("/providers/{provider_name}")
async def delete_provider(
    provider_name: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete a provider"""
    try:
        config = get_provider_config(db)
        providers = config.get("providers", [])
        
        provider_index = next((i for i, p in enumerate(providers) if p.get("name") == provider_name), None)
        
        if provider_index is None:
            raise HTTPException(status_code=404, detail=f"Provider '{provider_name}' not found")
        
        # Don't allow deleting active provider
        if config.get("active_provider") == provider_name:
            raise HTTPException(status_code=400, detail="Cannot delete active provider. Set another provider as active first.")
        
        providers.pop(provider_index)
        config["providers"] = providers
        
        save_provider_config(db, config)
        
        logger.info(f"Deleted provider: {provider_name}")
        
        return {
            "success": True,
            "message": f"Provider '{provider_name}' deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.post("/providers/reorder")
async def reorder_providers(
    request: ReorderProvidersRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Reorder providers by setting priorities"""
    try:
        config = get_provider_config(db)
        providers = config.get("providers", [])
        
        # Update priorities based on order
        for priority, provider_name in enumerate(request.provider_order, start=1):
            provider = next((p for p in providers if p.get("name") == provider_name), None)
            if provider:
                provider["priority"] = priority
        
        config["providers"] = providers
        save_provider_config(db, config)
        
        logger.info(f"Reordered providers: {request.provider_order}")
        
        return {
            "success": True,
            "message": "Providers reordered successfully"
        }
    except Exception as e:
        logger.error(f"Error reordering providers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.post("/active-provider")
async def set_active_provider(
    request: SetActiveProviderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Set the active provider"""
    try:
        config = get_provider_config(db)
        providers = config.get("providers", [])
        
        # Check if provider exists and is enabled
        provider = next((p for p in providers if p.get("name") == request.provider_name), None)
        
        if not provider:
            raise HTTPException(status_code=404, detail=f"Provider '{request.provider_name}' not found")
        
        if not provider.get("is_enabled", True):
            raise HTTPException(status_code=400, detail=f"Provider '{request.provider_name}' is disabled")
        
        config["active_provider"] = request.provider_name
        save_provider_config(db, config)
        
        logger.info(f"Set active provider: {request.provider_name}")
        
        return {
            "success": True,
            "active_provider": request.provider_name
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting active provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.get("/active")
async def get_active_provider_config(
    db: Session = Depends(get_db)
):
    """Get active provider configuration (public endpoint for ChatUI)"""
    try:
        config = get_provider_config(db)
        active_provider_name = config.get("active_provider")
        providers = config.get("providers", [])
        
        # Find active provider
        active_provider = next((p for p in providers if p.get("name") == active_provider_name), None)
        
        if not active_provider:
            # Fallback to first enabled provider
            enabled_providers = [p for p in providers if p.get("is_enabled", True)]
            enabled_providers.sort(key=lambda x: x.get("priority", 999))
            active_provider = enabled_providers[0] if enabled_providers else None
        
        if not active_provider:
            return {
                "success": False,
                "error": "No active provider configured"
            }
        
        return {
            "success": True,
            "provider": {
                "name": active_provider.get("name"),
                "display_name": active_provider.get("display_name"),
                "default_model": active_provider.get("default_model"),
                "default_model_display_name": active_provider.get("default_model_display_name"),
                "has_sub_providers": active_provider.get("has_sub_providers", False),
                "sub_providers": active_provider.get("sub_providers")
            },
            "fallback_enabled": config.get("fallback_enabled", True)
        }
    except Exception as e:
        logger.error(f"Error getting active provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.put("/settings")
async def update_provider_settings(
    fallback_enabled: Optional[bool] = None,
    max_retry_per_provider: Optional[int] = None,
    notify_on_all_fail: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Update general provider settings"""
    try:
        config = get_provider_config(db)
        
        if fallback_enabled is not None:
            config["fallback_enabled"] = fallback_enabled
        if max_retry_per_provider is not None:
            config["max_retry_per_provider"] = max_retry_per_provider
        if notify_on_all_fail is not None:
            config["notify_on_all_fail"] = notify_on_all_fail
        
        save_provider_config(db, config)
        
        return {
            "success": True,
            "settings": {
                "fallback_enabled": config.get("fallback_enabled"),
                "max_retry_per_provider": config.get("max_retry_per_provider"),
                "notify_on_all_fail": config.get("notify_on_all_fail")
            }
        }
    except Exception as e:
        logger.error(f"Error updating provider settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@ai_provider_config_router.post("/reset")
async def reset_provider_config(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Reset provider config to defaults"""
    try:
        config = DEFAULT_PROVIDER_CONFIG.copy()
        config["created_at"] = datetime.utcnow().isoformat()
        
        save_provider_config(db, config)
        
        logger.info("Reset provider config to defaults")
        
        return {
            "success": True,
            "message": "Provider configuration reset to defaults",
            "config": config
        }
    except Exception as e:
        logger.error(f"Error resetting provider config: {e}")
        raise HTTPException(status_code=500, detail=str(e))
