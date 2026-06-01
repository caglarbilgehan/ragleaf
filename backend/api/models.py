from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database.connection import get_db
from ..database.models import ModelConfig
from ..auth.dependencies import get_current_active_user

models_router = APIRouter()

@models_router.get("/active", response_model=List[dict])
async def get_active_models(
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all active models for users"""
    models = db.query(ModelConfig).filter(ModelConfig.is_active == True).all()
    
    return [
        {
            "id": model.id,
            "name": model.name,
            "provider": model.provider,
            "model_name": model.model_name,
            "is_default": model.is_default,
            "display_name": f"{model.name} ({model.provider})"
        }
        for model in models
    ]
