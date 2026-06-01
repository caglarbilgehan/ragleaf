"""
ChatUI AI Services Integration
Provides AI service configurations for ChatUI
Includes active provider/model info and RAG mode support
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging

from ..database.connection import get_db
from ..database.models import Settings, User
from ..auth.dependencies import get_current_user_optional

logger = logging.getLogger(__name__)

chatui_ai_router = APIRouter()

# Settings keys
PROVIDER_CONFIG_KEY = "ai_provider_config"
AI_SERVICES_KEY = "ai_services"


class ChatConfigResponse(BaseModel):
    """Response for ChatUI configuration"""
    model_config = {"protected_namespaces": ()}
    
    provider_name: str
    provider_display_name: str
    model_id: str
    model_display_name: str
    is_rag_mode: bool
    can_switch_mode: bool  # True for admins
    fallback_enabled: bool


@chatui_ai_router.get("/config")
async def get_chat_config(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get chat configuration for ChatUI
    - Returns active provider and model
    - Normal users: RAG mode only
    - Admins: Can switch between RAG and normal mode
    """
    try:
        # Get provider config
        provider_setting = db.query(Settings).filter(Settings.key == PROVIDER_CONFIG_KEY).first()
        
        if not provider_setting:
            return {
                "success": False,
                "error": "AI provider not configured",
                "message": "Lütfen admin panelden AI provider yapılandırın."
            }
        
        config = provider_setting.value
        active_provider_name = config.get("active_provider", "huggingface")
        providers = config.get("providers", [])
        
        # Find active provider
        active_provider = next(
            (p for p in providers if p.get("name") == active_provider_name and p.get("is_enabled")),
            None
        )
        
        if not active_provider:
            # Fallback to first enabled provider
            enabled_providers = [p for p in providers if p.get("is_enabled")]
            enabled_providers.sort(key=lambda x: x.get("priority", 999))
            active_provider = enabled_providers[0] if enabled_providers else None
        
        if not active_provider:
            return {
                "success": False,
                "error": "No active provider",
                "message": "Aktif AI provider bulunamadı."
            }
        
        # Check if user is admin
        is_admin = current_user and getattr(current_user, 'is_admin', False)
        
        return {
            "success": True,
            "config": {
                "provider_name": active_provider.get("name"),
                "provider_display_name": active_provider.get("display_name"),
                "model_id": active_provider.get("default_model"),
                "model_display_name": active_provider.get("default_model_display_name"),
                "is_rag_mode": not is_admin,  # Normal users always in RAG mode
                "can_switch_mode": is_admin,  # Only admins can switch
                "fallback_enabled": config.get("fallback_enabled", True)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting chat config: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@chatui_ai_router.get("/active-model")
async def get_active_model(db: Session = Depends(get_db)):
    """
    Get active model info for ChatUI (simplified endpoint)
    """
    try:
        provider_setting = db.query(Settings).filter(Settings.key == PROVIDER_CONFIG_KEY).first()
        
        if not provider_setting:
            return {
                "model_id": None,
                "model_name": None,
                "provider": None,
                "error": "Not configured"
            }
        
        config = provider_setting.value
        active_provider_name = config.get("active_provider")
        providers = config.get("providers", [])
        
        active_provider = next(
            (p for p in providers if p.get("name") == active_provider_name),
            None
        )
        
        if not active_provider:
            return {
                "model_id": None,
                "model_name": None,
                "provider": None,
                "error": "No active provider"
            }
        
        return {
            "model_id": active_provider.get("default_model"),
            "model_name": active_provider.get("default_model_display_name"),
            "provider": active_provider.get("name"),
            "provider_display_name": active_provider.get("display_name")
        }
        
    except Exception as e:
        logger.error(f"Error getting active model: {e}")
        return {
            "model_id": None,
            "error": str(e)
        }

@chatui_ai_router.get("/available-services")
async def get_available_ai_services(db: Session = Depends(get_db)):
    """Get available AI services for ChatUI"""
    try:
        # Get AI services from settings table
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            return []
        
        services_data = setting.value
        
        # Filter active and available services
        available_services = [
            s for s in services_data 
            if (s.get('is_active', True) and 
                s.get('is_available', True) and
                s.get('api_key'))
        ]
        
        # Sort by priority
        available_services.sort(key=lambda x: x.get('priority', 999))
        
        # Return ChatUI compatible format
        chatui_services = []
        for service in available_services:
            chatui_services.append({
                "id": service.get('id'),
                "name": service.get('name'),
                "display_name": service.get('display_name'),
                "api_key": service.get('api_key'),
                "api_url": service.get('api_url'),
                "priority": service.get('priority', 1),
                "service_type": service.get('service_type', 'inference')
            })
        
        return {
            "success": True,
            "services": chatui_services,
            "primary_service": chatui_services[0] if chatui_services else None
        }
        
    except Exception as e:
        logger.error(f"Error getting available AI services: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get AI services: {str(e)}")

@chatui_ai_router.get("/primary-token")
async def get_primary_huggingface_token(db: Session = Depends(get_db)):
    """Get primary HuggingFace token for ChatUI"""
    try:
        # Get AI services from settings table
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            return {"token": None, "error": "No AI services configured"}
        
        services_data = setting.value
        
        # Filter active HuggingFace services with API keys
        hf_services = [
            s for s in services_data 
            if (s.get('name') == 'huggingface' and
                s.get('is_active', True) and 
                s.get('is_available', True) and
                s.get('api_key'))
        ]
        
        if not hf_services:
            return {"token": None, "error": "No active HuggingFace services found"}
        
        # Sort by priority and get the first one
        hf_services.sort(key=lambda x: x.get('priority', 999))
        primary_service = hf_services[0]
        
        return {
            "token": primary_service.get('api_key'),
            "service_id": primary_service.get('id'),
            "display_name": primary_service.get('display_name'),
            "api_url": primary_service.get('api_url'),
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Error getting primary HuggingFace token: {e}")
        return {"token": None, "error": str(e)}

@chatui_ai_router.post("/report-error/{service_id}")
async def report_service_error(
    service_id: int,
    error_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Report an error for a specific AI service"""
    try:
        # Get AI services from settings table
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            raise HTTPException(status_code=404, detail="AI services not found")
        
        services_data = setting.value
        
        # Find service to update
        service_index = next((i for i, s in enumerate(services_data) if s.get('id') == service_id), None)
        if service_index is None:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Update service error status
        service = services_data[service_index]
        service['is_available'] = False
        service['last_error'] = error_data.get('error', 'Unknown error')
        service['failed_requests'] = service.get('failed_requests', 0) + 1
        
        # Update setting
        setting.value = services_data
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(setting, 'value')
        db.commit()
        
        logger.warning(f"Service {service_id} reported error: {error_data.get('error')}")
        
        return {"success": True, "message": "Error reported successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reporting service error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to report error: {str(e)}")

@chatui_ai_router.get("/failover-token/{failed_service_id}")
async def get_failover_token(
    failed_service_id: int,
    db: Session = Depends(get_db)
):
    """Get next available token for failover"""
    try:
        # Get AI services from settings table
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            return {"token": None, "error": "No AI services configured"}
        
        services_data = setting.value
        
        # Filter active HuggingFace services with API keys, excluding the failed one
        hf_services = [
            s for s in services_data 
            if (s.get('name') == 'huggingface' and
                s.get('id') != failed_service_id and
                s.get('is_active', True) and 
                s.get('is_available', True) and
                s.get('api_key'))
        ]
        
        if not hf_services:
            return {"token": None, "error": "No failover services available"}
        
        # Sort by priority and get the first available one
        hf_services.sort(key=lambda x: x.get('priority', 999))
        failover_service = hf_services[0]
        
        return {
            "token": failover_service.get('api_key'),
            "service_id": failover_service.get('id'),
            "display_name": failover_service.get('display_name'),
            "api_url": failover_service.get('api_url'),
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Error getting failover token: {e}")
        return {"token": None, "error": str(e)}
