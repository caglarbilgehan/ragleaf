"""
HuggingFace Model Search API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import httpx
import asyncio
import logging
from decouple import config

logger = logging.getLogger(__name__)

from ..database.connection import get_db
from ..auth.dependencies import get_current_admin_user

huggingface_models_router = APIRouter()

class HFModelInfo(BaseModel):
    id: str
    author: str
    modelId: str
    pipeline_tag: Optional[str]
    tags: List[str]
    downloads: int
    likes: int
    library_name: Optional[str]
    created_at: str
    updated_at: str

class HFModelSearchResponse(BaseModel):
    models: List[HFModelInfo]
    total: int
    has_more: bool

@huggingface_models_router.get("/popular", response_model=List[HFModelInfo])
async def get_popular_models(
    limit: int = Query(20, description="Number of models to return"),
    current_user = Depends(get_current_admin_user)
):
    """Get popular HuggingFace models"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # HuggingFace Hub API - popular text-generation models
            response = await client.get(
                "https://huggingface.co/api/models",
                params={
                    "pipeline_tag": "text-generation",
                    "sort": "downloads",
                    "direction": -1,
                    "limit": limit,
                    "filter": "text-generation"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="HuggingFace API error")
            
            models_data = response.json()
            
            # Format models for frontend
            formatted_models = []
            for model in models_data:
                try:
                    formatted_model = HFModelInfo(
                        id=model.get("id", ""),
                        author=model.get("id", "").split("/")[0] if "/" in model.get("id", "") else "unknown",
                        modelId=model.get("id", ""),
                        pipeline_tag=model.get("pipeline_tag"),
                        tags=model.get("tags", []),
                        downloads=model.get("downloads", 0),
                        likes=model.get("likes", 0),
                        library_name=model.get("library_name"),
                        created_at=model.get("createdAt", ""),
                        updated_at=model.get("lastModified", "")
                    )
                    formatted_models.append(formatted_model)
                except Exception as e:
                    logger.warning(f"Error formatting model {model.get('id', 'unknown')}: {e}")
                    continue
            
            return formatted_models
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="HuggingFace API timeout")
    except Exception as e:
        logger.error(f"Error fetching popular models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@huggingface_models_router.get("/search", response_model=HFModelSearchResponse)
async def search_models(
    query: str = Query(..., description="Search query"),
    limit: int = Query(20, description="Number of models to return"),
    current_user = Depends(get_current_admin_user)
):
    """Search HuggingFace models"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://huggingface.co/api/models",
                params={
                    "search": query,
                    "pipeline_tag": "text-generation",
                    "sort": "downloads",
                    "direction": -1,
                    "limit": limit,
                    "filter": "text-generation"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="HuggingFace API error")
            
            models_data = response.json()
            
            # Format models
            formatted_models = []
            for model in models_data:
                try:
                    formatted_model = HFModelInfo(
                        id=model.get("id", ""),
                        author=model.get("id", "").split("/")[0] if "/" in model.get("id", "") else "unknown",
                        modelId=model.get("id", ""),
                        pipeline_tag=model.get("pipeline_tag"),
                        tags=model.get("tags", []),
                        downloads=model.get("downloads", 0),
                        likes=model.get("likes", 0),
                        library_name=model.get("library_name"),
                        created_at=model.get("createdAt", ""),
                        updated_at=model.get("lastModified", "")
                    )
                    formatted_models.append(formatted_model)
                except Exception as e:
                    logger.warning(f"Error formatting model {model.get('id', 'unknown')}: {e}")
                    continue
            
            return HFModelSearchResponse(
                models=formatted_models,
                total=len(formatted_models),
                has_more=len(formatted_models) == limit
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="HuggingFace API timeout")
    except Exception as e:
        logger.error(f"Error searching models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@huggingface_models_router.get("/model/{model_id:path}", response_model=HFModelInfo)
async def get_model_info(
    model_id: str,
    current_user = Depends(get_current_admin_user)
):
    """Get detailed info about a specific model"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"https://huggingface.co/api/models/{model_id}")
            
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Model not found")
            elif response.status_code != 200:
                raise HTTPException(status_code=500, detail="HuggingFace API error")
            
            model_data = response.json()
            
            return HFModelInfo(
                id=model_data.get("id", ""),
                author=model_data.get("id", "").split("/")[0] if "/" in model_data.get("id", "") else "unknown",
                modelId=model_data.get("id", ""),
                pipeline_tag=model_data.get("pipeline_tag"),
                tags=model_data.get("tags", []),
                downloads=model_data.get("downloads", 0),
                likes=model_data.get("likes", 0),
                library_name=model_data.get("library_name"),
                created_at=model_data.get("createdAt", ""),
                updated_at=model_data.get("lastModified", "")
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="HuggingFace API timeout")
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))
