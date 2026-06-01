from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from ..database.connection import get_db
from ..database.models import ModelConfig, User
from ..auth.dependencies import get_current_admin_user
from ..services.ai_service import ai_service

ai_admin_router = APIRouter()

class AIModelCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    name: str
    provider: str  # huggingface-based providers (groq, novita, nebius, etc.)
    model_name: str
    description: Optional[str] = None
    is_default: bool = False

class AIModelTest(BaseModel):
    test_prompt: Optional[str] = "Merhaba! Bu bir test mesajıdır. Kısaca kendini tanıt."

@ai_admin_router.get("/providers/health")
async def check_all_providers_health(
    current_user: User = Depends(get_current_admin_user)
):
    """Check health of all AI providers"""
    try:
        health_status = await ai_service.check_all_providers_health()
        return {
            "success": True,
            **health_status
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking provider health: {str(e)}"
        )

@ai_admin_router.get("/providers/{provider}/health")
async def check_provider_health(
    provider: str,
    current_user: User = Depends(get_current_admin_user)
):
    """Check health of a specific provider"""
    try:
        health_status = await ai_service.check_provider_health(provider)
        return {
            "success": True,
            **health_status
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking {provider} health: {str(e)}"
        )

@ai_admin_router.get("/models/available")
async def get_all_available_models(
    current_user: User = Depends(get_current_admin_user)
):
    """Get available models from all providers"""
    try:
        models_data = await ai_service.list_all_models()
        
        # Get existing configured models
        db: Session = next(get_db())
        existing_models = db.query(ModelConfig).all()
        existing_model_names = {f"{model.provider}:{model.model_name}" for model in existing_models}
        
        # Mark which models are already configured
        for model in models_data["models"]:
            model_key = f"{model.get('provider', '')}:{model.get('name', model.get('id', ''))}"
            model["is_configured"] = model_key in existing_model_names
        
        return {
            "success": True,
            **models_data
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get available models: {str(e)}"
        )

@ai_admin_router.get("/providers/huggingface/models")
async def get_huggingface_models(
    current_user: User = Depends(get_current_admin_user)
):
    """Get popular HuggingFace models"""
    try:
        from ..services.huggingface_service import huggingface_service
        models_data = await huggingface_service.get_popular_models()
        
        return {
            "success": True,
            "provider": "huggingface",
            **models_data
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get HuggingFace models: {str(e)}"
        )

@ai_admin_router.post("/models/configure")
async def configure_ai_model(
    model_data: AIModelCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Configure an AI model from any provider"""
    try:
        # Validate provider - now supporting HuggingFace-based providers
        supported_providers = ["huggingface", "groq", "novita", "nebius", "nscale", "hyperbolic", "together", "fireworks-ai", "cerebras", "sambanova", "scaleway"]
        
        if model_data.provider not in supported_providers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Provider {model_data.provider} is not supported. Use: {supported_providers}"
            )
        
        # Check if model already configured
        existing_model = db.query(ModelConfig).filter(
            ModelConfig.model_name == model_data.model_name,
            ModelConfig.provider == model_data.provider
        ).first()
        
        if existing_model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Model {model_data.model_name} from {model_data.provider} is already configured"
            )
        
        # If this is set as default, unset other defaults
        if model_data.is_default:
            db.query(ModelConfig).filter(
                ModelConfig.is_default == True
            ).update({"is_default": False})
        
        # Set default API URLs based on provider
        default_urls = {
            "huggingface": "https://api-inference.huggingface.co",
            "groq": "https://api.groq.com",
            "novita": "https://api.novita.ai",
            "nebius": "https://api.nebius.ai",
            "nscale": "https://api.nscale.com",
            "hyperbolic": "https://api.hyperbolic.xyz",
            "together": "https://api.together.xyz",
            "fireworks-ai": "https://api.fireworks.ai",
            "cerebras": "https://api.cerebras.ai",
            "sambanova": "https://api.sambanova.ai",
            "scaleway": "https://api.scaleway.com"
        }
        
        # Create new model configuration
        new_model = ModelConfig(
            name=model_data.name,
            provider=model_data.provider,
            model_name=model_data.model_name,
            api_key="",  # Will be set later if needed
            api_url=default_urls.get(model_data.provider, ""),
            is_active=True,
            is_default=model_data.is_default,
            # LLM Parameters
            temperature=0.7,
            top_p=0.9,
            top_k=40,
            num_ctx=2048,
            num_predict=512,
            repeat_penalty=1.1,
            # RAG Parameters
            max_context_chars=1500,
            rag_top_k=3,
            chunk_size=500,
            chunk_overlap=100,
            # System Parameters
            timeout_seconds=120
        )
        
        db.add(new_model)
        db.commit()
        db.refresh(new_model)
        
        return {
            "success": True,
            "message": f"Model {model_data.name} configured successfully",
            "model_id": new_model.id,
            "provider": model_data.provider
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error configuring model: {str(e)}"
        )

@ai_admin_router.post("/models/{model_id}/test")
async def test_ai_model(
    model_id: int,
    test_data: AIModelTest = AIModelTest(),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Test a configured AI model"""
    try:
        model = db.query(ModelConfig).filter(ModelConfig.id == model_id).first()
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model not found"
            )
        
        # Test the model
        response = await ai_service.generate_response(
            model=model.model_name,
            prompt=test_data.test_prompt,
            system_prompt="Sen yardımcı bir AI asistanısın. Kısa ve net yanıt ver.",
            provider=model.provider
        )
        
        if "error" in response:
            return {
                "success": False,
                "error": response["error"],
                "model_name": model.model_name,
                "provider": model.provider
            }
        
        return {
            "success": True,
            "model_name": model.model_name,
            "provider": model.provider,
            "test_prompt": test_data.test_prompt,
            "response": response["response"],
            "metrics": response.get("usage", {}),
            "response_time": response.get("response_time", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error testing model: {str(e)}"
        )

@ai_admin_router.get("/providers/status")
async def get_providers_status(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive status of all providers and configured models"""
    try:
        # Get provider health
        health_status = await ai_service.check_all_providers_health()
        
        # Get configured models by provider
        configured_models = db.query(ModelConfig).all()
        models_by_provider = {}
        
        for model in configured_models:
            provider = model.provider
            if provider not in models_by_provider:
                models_by_provider[provider] = []
            
            models_by_provider[provider].append({
                "id": model.id,
                "name": model.name,
                "model_name": model.model_name,
                "is_active": model.is_active,
                "is_default": model.is_default
            })
        
        return {
            "success": True,
            "health": health_status,
            "configured_models": models_by_provider,
            "summary": {
                "total_providers": len(health_status["providers"]),
                "healthy_providers": health_status["healthy_count"],
                "total_configured_models": len(configured_models),
                "active_models": len([m for m in configured_models if m.is_active])
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting provider status: {str(e)}"
        )
