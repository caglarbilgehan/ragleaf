from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import httpx
import asyncio

from ..database.connection import get_db
from ..database.models import ModelConfig, User
from ..auth.dependencies import get_current_admin_user
from ..services.huggingface_service import huggingface_service
import logging

logger = logging.getLogger(__name__)

huggingface_router = APIRouter()

class HuggingFaceModelCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    name: str
    model_name: str
    description: Optional[str] = None
    is_default: bool = False

@huggingface_router.get("/models/search")
async def search_huggingface_models(
    query: str = Query(..., description="Search query for models"),
    limit: int = Query(20, ge=1, le=100, description="Number of results to return"),
    task: str = Query("text-generation", description="Task type filter"),
    current_user: User = Depends(get_current_admin_user)
):
    """Search HuggingFace models from the internet"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # HuggingFace Hub API endpoint
            url = "https://huggingface.co/api/models"
            params = {
                "search": query,
                "filter": task,
                "limit": limit,
                "sort": "downloads",
                "direction": -1
            }
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            models_data = response.json()
            
            # Format the response for our frontend
            formatted_models = []
            for model in models_data:
                formatted_model = {
                    "id": model.get("id", ""),
                    "name": model.get("id", "").split("/")[-1] if "/" in model.get("id", "") else model.get("id", ""),
                    "full_name": model.get("id", ""),
                    "description": model.get("description", "No description available"),
                    "downloads": model.get("downloads", 0),
                    "likes": model.get("likes", 0),
                    "tags": model.get("tags", []),
                    "task": task,
                    "author": model.get("id", "").split("/")[0] if "/" in model.get("id", "") else "unknown",
                    "updated_at": model.get("lastModified", ""),
                    "model_size": model.get("safetensors", {}).get("total", 0) if model.get("safetensors") else 0
                }
                formatted_models.append(formatted_model)
            
            return {
                "success": True,
                "query": query,
                "task": task,
                "total_found": len(formatted_models),
                "models": formatted_models
            }
            
    except httpx.TimeoutException:
        logger.error("Timeout while searching HuggingFace models")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request timeout while searching models"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error while searching HuggingFace models: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error from HuggingFace API: {e.response.status_code}"
        )
    except Exception as e:
        logger.error(f"Error searching HuggingFace models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching models: {str(e)}"
        )

@huggingface_router.get("/models/popular")
async def get_popular_models(
    current_user: User = Depends(get_current_admin_user)
):
    """Get popular HuggingFace models for text generation from the internet"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get most popular text generation models from HuggingFace Hub
            url = "https://huggingface.co/api/models"
            params = {
                "filter": "text-generation",
                "sort": "downloads",
                "direction": -1,
                "limit": 20
            }
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            models_data = response.json()
            
            # Format the response for our frontend
            formatted_models = []
            for model in models_data:
                formatted_model = {
                    "id": model.get("id", ""),
                    "name": model.get("id", "").split("/")[-1] if "/" in model.get("id", "") else model.get("id", ""),
                    "full_name": model.get("id", ""),
                    "description": model.get("description", "No description available"),
                    "downloads": model.get("downloads", 0),
                    "likes": model.get("likes", 0),
                    "tags": model.get("tags", []),
                    "task": "text-generation",
                    "author": model.get("id", "").split("/")[0] if "/" in model.get("id", "") else "unknown",
                    "updated_at": model.get("lastModified", ""),
                    "model_size": model.get("safetensors", {}).get("total", 0) if model.get("safetensors") else 0
                }
                formatted_models.append(formatted_model)
            
            return {
                "success": True,
                "models": formatted_models
            }
            
    except httpx.TimeoutException:
        logger.error("Timeout while fetching popular HuggingFace models")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request timeout while fetching popular models"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error while fetching popular HuggingFace models: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error from HuggingFace API: {e.response.status_code}"
        )
    except Exception as e:
        logger.error(f"Error fetching popular HuggingFace models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching models: {str(e)}"
        )

@huggingface_router.post("/models/configure")
async def configure_huggingface_model(
    model_data: HuggingFaceModelCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Configure a HuggingFace model in the system"""
    try:
        # Check if model already configured
        existing_model = db.query(ModelConfig).filter(
            ModelConfig.model_name == model_data.model_name,
            ModelConfig.provider == "huggingface"
        ).first()
        
        if existing_model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Model {model_data.model_name} is already configured"
            )
        
        # If this is set as default, unset other defaults
        if model_data.is_default:
            db.query(ModelConfig).filter(
                ModelConfig.is_default == True
            ).update({"is_default": False})
        
        # Create new model configuration
        new_model = ModelConfig(
            name=model_data.name,
            provider="huggingface",
            model_name=model_data.model_name,
            api_key="",  # Will be set from environment
            api_url="https://api-inference.huggingface.co/models",
            is_active=True,
            is_default=model_data.is_default,
            # LLM Parameters
            temperature=0.7,
            top_p=0.9,
            top_k=50,
            num_ctx=1024,  # HuggingFace has smaller context windows
            num_predict=256,
            repeat_penalty=1.1,
            # RAG Parameters  
            max_context_chars=1000,  # Smaller for remote models
            rag_top_k=3,
            chunk_size=400,
            chunk_overlap=80,
            # System Parameters
            timeout_seconds=30  # Shorter timeout for remote API
        )
        
        db.add(new_model)
        db.commit()
        db.refresh(new_model)
        
        return {
            "success": True,
            "message": f"HuggingFace model {model_data.name} configured successfully",
            "model_id": new_model.id,
            "model": {
                "id": new_model.id,
                "name": new_model.name,
                "provider": new_model.provider,
                "model_name": new_model.model_name,
                "is_active": new_model.is_active,
                "is_default": new_model.is_default
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error configuring HuggingFace model: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error configuring model: {str(e)}"
        )

@huggingface_router.get("/models/test/{model_name}")
async def test_huggingface_model(
    model_name: str,
    current_user: User = Depends(get_current_admin_user)
):
    """Test a HuggingFace model"""
    try:
        # Test the model with a simple prompt
        test_prompt = "Hello, how are you?"
        
        response = await huggingface_service.generate_text(
            model_name=model_name,
            prompt=test_prompt,
            max_tokens=50,
            temperature=0.7
        )
        
        return {
            "success": True,
            "message": f"Model {model_name} is working correctly",
            "test_prompt": test_prompt,
            "response": response
        }
        
    except Exception as e:
        logger.error(f"Error testing HuggingFace model {model_name}: {str(e)}")
        return {
            "success": False,
            "message": f"Model {model_name} test failed: {str(e)}",
            "error": str(e)
        }

@huggingface_router.get("/health")
async def check_huggingface_health(
    current_user: User = Depends(get_current_admin_user)
):
    """Check HuggingFace API health"""
    try:
        # Test with a simple model
        test_response = await huggingface_service.generate_text(
            model_name="gpt2",
            prompt="Test",
            max_tokens=5,
            temperature=0.7
        )
        
        return {
            "success": True,
            "message": "HuggingFace API is healthy",
            "api_accessible": True,
            "token_configured": huggingface_service.has_token()
        }
        
    except Exception as e:
        logger.error(f"HuggingFace health check failed: {str(e)}")
        return {
            "success": False,
            "message": f"HuggingFace API health check failed: {str(e)}",
            "api_accessible": False,
            "token_configured": huggingface_service.has_token(),
            "error": str(e)
        }
