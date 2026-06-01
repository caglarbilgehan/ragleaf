"""
API Key management endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.models.api_key import APIKey
from backend.database.models import User
from backend.database.models_v2 import LLMModel
from backend.auth.dependencies import get_current_user
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/keys", tags=["API Keys"])

# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class CreateAPIKeyRequest(BaseModel):
    """Request model for creating API key"""
    # Basic info
    name: str = Field(..., min_length=1, max_length=255, description="API key name")
    description: Optional[str] = Field(None, max_length=500, description="Description")
    
    # Mode settings
    allowed_mode: str = Field(default="rag", pattern="^(rag|chat|hybrid)$", description="Allowed mode")
    department_ids: List[int] = Field(default=[1], description="Department IDs for RAG")
    
    # AI settings - LLM Model Selection
    system_prompt: Optional[str] = Field(None, max_length=2000, description="Custom system prompt")
    llm_model_id: Optional[int] = Field(None, description="Specific LLM model ID from system (None = use system default)")
    max_tokens: int = Field(default=1000, ge=100, le=4000, description="Max tokens")
    temperature: float = Field(default=0.7, ge=0.0, le=1.0, description="Temperature")
    
    # RAG settings
    top_k: int = Field(default=5, ge=1, le=20, description="Top K chunks")
    similarity_threshold: float = Field(default=0.5, ge=0.0, le=1.0, description="Similarity threshold")
    include_sources: bool = Field(default=True, description="Include sources in response")
    include_images: bool = Field(default=True, description="Include images in response")
    
    # Language settings
    default_language: str = Field(default="tr", description="Default language")
    allowed_languages: List[str] = Field(default=["tr", "en"], description="Allowed languages")
    
    # Security settings
    permissions: List[str] = Field(default=["chat:read"], description="Permissions")
    ip_whitelist: List[str] = Field(default=[], description="IP whitelist (empty = all)")
    allowed_origins: List[str] = Field(default=[], description="Allowed origins (empty = all)")
    rate_limit_per_minute: int = Field(default=60, ge=1, le=1000, description="Rate limit/minute")
    rate_limit_per_day: int = Field(default=1000, ge=1, le=100000, description="Rate limit/day")
    
    # Other settings
    environment: str = Field(default="live", pattern="^(live|test)$", description="Environment")
    expires_days: Optional[int] = Field(None, ge=1, le=365, description="Expiration in days")
    
    # Response format
    response_format: Optional[Dict[str, Any]] = Field(None, description="Response format settings")
    custom_templates: Optional[Dict[str, str]] = Field(None, description="Custom message templates")
    extra_metadata: Dict[str, Any] = Field(default={}, description="Additional metadata")

class UpdateAPIKeyRequest(BaseModel):
    """Request model for updating API key"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    
    # Mode settings
    allowed_mode: Optional[str] = Field(None, pattern="^(rag|chat|hybrid)$")
    department_ids: Optional[List[int]] = None
    
    # AI settings - LLM Model Selection
    system_prompt: Optional[str] = Field(None, max_length=2000)
    llm_model_id: Optional[int] = Field(None, description="Specific LLM model ID (None = system default)")
    max_tokens: Optional[int] = Field(None, ge=100, le=4000)
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    
    # RAG settings
    top_k: Optional[int] = Field(None, ge=1, le=20)
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    include_sources: Optional[bool] = None
    include_images: Optional[bool] = None
    
    # Language settings
    default_language: Optional[str] = None
    allowed_languages: Optional[List[str]] = None
    
    # Security settings
    permissions: Optional[List[str]] = None
    ip_whitelist: Optional[List[str]] = None
    allowed_origins: Optional[List[str]] = None
    rate_limit_per_minute: Optional[int] = Field(None, ge=1, le=1000)
    rate_limit_per_day: Optional[int] = Field(None, ge=1, le=100000)
    
    # Status
    is_active: Optional[bool] = None
    
    # Other
    response_format: Optional[Dict[str, Any]] = None
    custom_templates: Optional[Dict[str, str]] = None
    extra_metadata: Optional[Dict[str, Any]] = None

class APIKeyResponse(BaseModel):
    """Response model for API key"""
    id: int
    name: str
    description: Optional[str]
    key_prefix: str
    key_preview: Optional[str]
    
    # Mode settings
    allowed_mode: str
    department_ids: List[int]
    
    # AI settings - LLM Model
    system_prompt: Optional[str]
    llm_model_id: Optional[int]
    llm_model_name: Optional[str] = None  # Populated from join
    max_tokens: int
    temperature: float
    
    # RAG settings
    top_k: int
    similarity_threshold: float
    include_sources: bool
    include_images: bool
    
    # Language settings
    default_language: str
    allowed_languages: List[str]
    
    # Security settings
    permissions: List[str]
    ip_whitelist: List[str]
    allowed_origins: List[str]
    rate_limit_per_minute: int
    rate_limit_per_day: int
    
    # Status
    is_active: bool
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: Optional[datetime]
    
    # Stats
    total_requests: int
    total_tokens_used: int
    
    # Other
    response_format: Optional[Dict[str, Any]]
    custom_templates: Optional[Dict[str, str]]
    extra_metadata: Dict[str, Any]

class CreateAPIKeyResponse(BaseModel):
    """Response model for newly created API key"""
    api_key: APIKeyResponse
    secret_key: str
    warning: str = "⚠️ Bu secret key'i güvenli bir yerde saklayın. Bir daha gösterilmeyecek!"

# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/", response_model=CreateAPIKeyResponse)
async def create_api_key(
    request: CreateAPIKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create new API key
    
    **Permissions:** Admin only
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create API keys"
        )

    # Validate permissions
    valid_permissions = ["chat:read", "chat:write", "documents:read", "documents:write", "admin:read", "admin:write"]
    for perm in request.permissions:
        if perm not in valid_permissions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permission: {perm}"
            )

    # Validate LLM model if specified
    llm_model_name = None
    if request.llm_model_id:
        model_config = db.query(ModelConfig).filter(
            ModelConfig.id == request.llm_model_id,
            ModelConfig.is_active == True
        ).first()
        if not model_config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"LLM model with ID {request.llm_model_id} not found or inactive"
            )
        llm_model_name = model_config.model_name

    try:
        api_key, secret_key = APIKey.create_key(
            name=request.name,
            user_id=current_user.id,
            description=request.description,
            allowed_mode=request.allowed_mode,
            department_ids=request.department_ids,
            system_prompt=request.system_prompt,
            llm_model_id=request.llm_model_id,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
            include_sources=request.include_sources,
            include_images=request.include_images,
            default_language=request.default_language,
            allowed_languages=request.allowed_languages,
            permissions=request.permissions,
            ip_whitelist=request.ip_whitelist,
            allowed_origins=request.allowed_origins,
            rate_limit_per_minute=request.rate_limit_per_minute,
            rate_limit_per_day=request.rate_limit_per_day,
            environment=request.environment,
            expires_days=request.expires_days,
            response_format=request.response_format,
            custom_templates=request.custom_templates,
            extra_metadata=request.extra_metadata
        )

        db.add(api_key)
        db.commit()
        db.refresh(api_key)

        logger.info(f"✅ API key created: {api_key.name} by {current_user.email}")

        return CreateAPIKeyResponse(
            api_key=APIKeyResponse(**api_key.to_dict(include_secret=True, llm_model_name=llm_model_name)),
            secret_key=secret_key
        )

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to create API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create API key"
        )

@router.get("/", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API keys (admin sees all, users see their own)"""
    if current_user.is_admin:
        api_keys = db.query(APIKey).all()
    else:
        api_keys = db.query(APIKey).filter(APIKey.user_id == current_user.id).all()

    # Get model names for all keys
    result = []
    for key in api_keys:
        llm_model_name = None
        if key.llm_model_id:
            model = db.query(LLMModel).filter(LLMModel.id == key.llm_model_id).first()
            if model:
                llm_model_name = model.model_name
        result.append(APIKeyResponse(**key.to_dict(include_secret=True, llm_model_name=llm_model_name)))
    
    return result

@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific API key"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if not current_user.is_admin and api_key.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return APIKeyResponse(**api_key.to_dict(include_secret=True))

@router.put("/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: int,
    request: UpdateAPIKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update API key"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if not current_user.is_admin and api_key.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(api_key, field, value)

    try:
        db.commit()
        db.refresh(api_key)
        logger.info(f"API key updated: {api_key.name} by {current_user.email}")
        return APIKeyResponse(**api_key.to_dict(include_secret=True))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update API key")

@router.delete("/{key_id}")
async def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete API key"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if not current_user.is_admin and api_key.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        db.delete(api_key)
        db.commit()
        logger.info(f"API key deleted: {api_key.name} by {current_user.email}")
        return {"message": "API key deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete API key")

@router.post("/{key_id}/regenerate", response_model=CreateAPIKeyResponse)
async def regenerate_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate API key secret (invalidates old key)"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if not current_user.is_admin and api_key.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        environment = api_key.key_prefix.rstrip('_')
        public_key, full_secret = APIKey.generate_key(environment)
        api_key.key_hash = APIKey.hash_key(full_secret)
        api_key.last_used_at = None

        db.commit()
        db.refresh(api_key)

        logger.info(f"API key regenerated: {api_key.name} by {current_user.email}")

        return CreateAPIKeyResponse(
            api_key=APIKeyResponse(**api_key.to_dict(include_secret=True)),
            secret_key=full_secret,
            warning="⚠️ Eski key artık geçersiz! Yeni key'i güvenli bir yerde saklayın."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to regenerate API key")

@router.get("/{key_id}/usage")
async def get_api_key_usage(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get API key usage statistics"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if not current_user.is_admin and api_key.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "key_id": key_id,
        "name": api_key.name,
        "mode": api_key.allowed_mode,
        "departments": api_key.department_ids,
        "last_used_at": api_key.last_used_at,
        "total_requests": api_key.total_requests or 0,
        "total_tokens_used": api_key.total_tokens_used or 0,
        "rate_limits": {
            "per_minute": api_key.rate_limit_per_minute,
            "per_day": api_key.rate_limit_per_day
        },
        "is_active": api_key.is_active,
        "expires_at": api_key.expires_at
    }

# ═══════════════════════════════════════════════════════════════════════════════
# DEPARTMENT HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/departments/list")
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List available departments for API key configuration"""
    # TODO: Get from database if you have a departments table
    departments = [
        {"id": 1, "name": "Müşteri Hizmetleri", "description": "Müşteri destek dökümanları"},
        {"id": 2, "name": "Teknik Destek", "description": "Teknik kurulum ve bakım"},
        {"id": 3, "name": "Satış", "description": "Fiyat ve teklif dökümanları"},
        {"id": 4, "name": "Üretim", "description": "Üretim ve kalite dökümanları"},
        {"id": 5, "name": "AR-GE", "description": "Araştırma geliştirme"},
        {"id": 6, "name": "İnsan Kaynakları", "description": "İK dökümanları"},
        {"id": 7, "name": "Yönetim", "description": "Yönetim dökümanları"}
    ]
    return {"departments": departments}

@router.get("/llm-models/list")
async def list_llm_models(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List available LLM models for API key configuration
    
    Returns all active LLM models that can be assigned to an API key.
    """
    models = db.query(LLMModel).filter(LLMModel.is_active == True).all()
    
    return {
        "models": [
            {
                "id": model.id,
                "name": model.model_name,
                "provider": model.provider,
                "description": model.description or f"{model.provider} - {model.model_name}",
                "is_default": model.is_default
            }
            for model in models
        ],
        "total": len(models),
        "note": "llm_model_id=null means system default will be used"
    }