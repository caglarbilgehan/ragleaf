"""
Embedding Models API
Manage embedding models (local and remote)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from ..database import get_db, EmbeddingModel, Document
from ..services.unified_embedding_service import get_unified_embedding_service
from ..services.embedding_model_manager import get_embedding_model_manager
from ..auth.dependencies import get_current_admin_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/embedding-models", tags=["Embedding Models"])

# ===== MODELS =====

class EmbeddingModelResponse(BaseModel):
    """Embedding model response"""
    model_config = {"protected_namespaces": (), "from_attributes": True}
    
    id: int
    model_id: str
    display_name: str
    description: Optional[str]
    dimension: int
    max_sequence_length: int
    size_mb: Optional[float]
    deployment_type: str
    api_endpoint: Optional[str]
    requires_api_key: Optional[bool] = False
    api_key_env_var: Optional[str] = None
    multilingual: Optional[bool] = False
    performance_tier: Optional[str] = "balanced"
    is_active: bool
    is_default: bool
    is_downloaded: Optional[bool] = False
    provider: str
    model_family: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    last_used: Optional[datetime]

class EmbeddingModelListResponse(BaseModel):
    """List of embedding models"""
    models: List[EmbeddingModelResponse]
    total: int
    active_count: int
    default_model_id: Optional[str]

class EmbeddingModelCreate(BaseModel):
    """Create new embedding model"""
    model_config = {"protected_namespaces": ()}
    
    model_id: str = Field(..., description="Model ID (e.g., intfloat/multilingual-e5-base)")
    display_name: str = Field(..., description="Display name")
    description: Optional[str] = None
    dimension: int = Field(..., ge=1, description="Embedding dimension")
    max_sequence_length: int = Field(default=512, ge=1)
    size_mb: Optional[float] = None
    deployment_type: str = Field(default="local", pattern="^(local|remote)$")
    api_endpoint: Optional[str] = None
    requires_api_key: bool = False
    api_key_env_var: Optional[str] = None
    multilingual: bool = False
    performance_tier: str = Field(default="balanced", pattern="^(fast|balanced|best)$")
    provider: str = Field(default="huggingface")
    model_family: Optional[str] = None

class EmbeddingModelUpdate(BaseModel):
    """Update embedding model"""
    display_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None

class SetDefaultModelRequest(BaseModel):
    """Set default model request"""
    model_config = {"protected_namespaces": ()}
    
    model_id: str
    auto_reset: bool = True  # Otomatik sıfırlama yapılsın mı
    force_reset: bool = False  # Uyumlu olsa bile zorla sıfırla

class ChangeModelResponse(BaseModel):
    """Change model response"""
    success: bool
    message: str
    requires_reindex: bool
    affected_documents: int
    old_model: Optional[str]
    new_model: str
    reset_performed: bool = False
    requires_confirmation: bool = False

class ModelCompatibilityCheck(BaseModel):
    """Model compatibility check response"""
    compatible: bool
    requires_reset: bool
    reason: str
    old_model: Optional[Dict[str, Any]]
    new_model: Optional[Dict[str, Any]]

class ModelInfoResponse(BaseModel):
    """Detailed model information"""
    model_config = {"protected_namespaces": ()}
    
    id: int
    model_id: str
    display_name: str
    description: Optional[str]
    dimension: int
    deployment_type: str
    is_default: bool
    is_active: bool
    is_downloaded: bool
    provider_info: Dict[str, Any]
    usage_stats: Dict[str, Any]

# ===== ENDPOINTS =====

@router.get("/", response_model=EmbeddingModelListResponse)
async def list_embedding_models(
    active_only: bool = False,
    deployment_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    List all embedding models.
    
    - **active_only**: Only return active models
    - **deployment_type**: Filter by deployment type (local/remote)
    """
    from pathlib import Path
    
    query = db.query(EmbeddingModel)
    
    if active_only:
        query = query.filter(EmbeddingModel.is_active == True)
    
    if deployment_type:
        query = query.filter(EmbeddingModel.deployment_type == deployment_type)
    
    models = query.all()
    
    # No automatic sync - trust database values
    # is_downloaded is updated only when models are manually downloaded/deleted
    
    # Get default model
    default_model = db.query(EmbeddingModel).filter(
        EmbeddingModel.is_default == True
    ).first()
    
    return {
        "models": models,
        "total": len(models),
        "active_count": sum(1 for m in models if m.is_active),
        "default_model_id": default_model.model_id if default_model else None
    }

@router.get("/{model_id}", response_model=ModelInfoResponse)
async def get_embedding_model(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get detailed information about a specific embedding model.
    """
    model = db.query(EmbeddingModel).filter(
        EmbeddingModel.model_id == model_id
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
    
    # Get unified service
    service = get_unified_embedding_service()
    
    try:
        # Get provider info
        info = service.get_model_info(model_id, db)
        
        # Get usage stats
        doc_count = db.query(Document).filter(
            Document.embedding_model_id == model.id
        ).count()
        
        usage_stats = {
            "documents_using_model": doc_count,
            "last_used": model.last_used.isoformat() if model.last_used else None
        }
        
        return {
            **info,
            "usage_stats": usage_stats
        }
    except Exception as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=EmbeddingModelResponse)
async def create_embedding_model(
    model_data: EmbeddingModelCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Create a new embedding model configuration.
    """
    # Check if model already exists
    existing = db.query(EmbeddingModel).filter(
        EmbeddingModel.model_id == model_data.model_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Model already exists: {model_data.model_id}"
        )
    
    # Validate remote model requirements
    if model_data.deployment_type == "remote":
        if not model_data.api_endpoint:
            raise HTTPException(
                status_code=400,
                detail="api_endpoint is required for remote models"
            )
        if model_data.requires_api_key and not model_data.api_key_env_var:
            raise HTTPException(
                status_code=400,
                detail="api_key_env_var is required when requires_api_key is True"
            )
    
    # Create model
    new_model = EmbeddingModel(**model_data.model_dump())
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    
    logger.info(f"Created new embedding model: {new_model.model_id}")
    
    return new_model

@router.patch("/{model_id}", response_model=EmbeddingModelResponse)
async def update_embedding_model(
    model_id: str,
    update_data: EmbeddingModelUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Update embedding model configuration.
    """
    model = db.query(EmbeddingModel).filter(
        EmbeddingModel.model_id == model_id
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # Handle is_default specially - reset documents when default model changes
    reset_result = None
    if "is_default" in update_dict and update_dict["is_default"]:
        # Get current default model before changing
        current_default = db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True
        ).first()
        
        # Only reset if changing to a different model
        if current_default and current_default.id != model.id:
            logger.info(f"🔄 Varsayılan embedding modeli değişiyor: {current_default.model_id} → {model_id}")
            
            # Import embedding model manager for reset operations
            from ..services.embedding_model_manager import get_embedding_model_manager
            manager = get_embedding_model_manager(db)
            
            # 1. Cancel any active processing
            from ..services.async_document_processor import async_document_processor
            active_docs = db.query(Document).filter(
                Document.status == "processing"
            ).all()
            
            cancelled_count = 0
            for doc in active_docs:
                try:
                    await async_document_processor.cancel_processing(doc.id)
                    doc.status = "uploaded"
                    doc.processing_stage = None
                    doc.processing_progress = 0
                    doc.processing_details = f"İşlem iptal edildi - embedding modeli değişti"
                    doc.embedding_model_id = None
                    cancelled_count += 1
                except Exception as e:
                    logger.warning(f"⚠️ Could not cancel processing for doc {doc.id}: {e}")
            
            if cancelled_count > 0:
                logger.info(f"⏹️ {cancelled_count} aktif işlem iptal edildi")
            
            # 2. Reset documents processed with old model (including errors)
            docs_to_reset = db.query(Document).filter(
                Document.embedding_model_id == current_default.id,
                Document.status.in_(["processed", "error"])
            ).all()
            
            for doc in docs_to_reset:
                doc.status = "uploaded"
                doc.processing_stage = None
                doc.processing_progress = 0
                doc.processing_details = f"Embedding modeli değişti ({current_default.display_name} → {model.display_name}) - yeniden işleme gerekli"
                doc.vector_indexed = False
                doc.embedding_model_id = None
            
            reset_count = len(docs_to_reset)
            logger.info(f"🔄 {reset_count} döküman sıfırlandı (embedding modeli değişti)")
            
            # 3. Clear ChromaDB collection
            try:
                manager.clear_chromadb()
                logger.info("🗑️ ChromaDB koleksiyonu temizlendi")
            except Exception as e:
                logger.warning(f"⚠️ ChromaDB temizleme hatası: {e}")
            
            reset_result = {
                "cancelled_processing": cancelled_count,
                "reset_documents": reset_count
            }
        
        # Unset other defaults
        db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True
        ).update({"is_default": False})
    
    for key, value in update_dict.items():
        setattr(model, key, value)
    
    db.commit()
    db.refresh(model)
    
    if reset_result:
        logger.info(f"✅ Varsayılan embedding modeli değiştirildi: {model_id} | {reset_result['reset_documents']} döküman sıfırlandı")
    else:
        logger.info(f"✅ Embedding modeli güncellendi: {model_id}")
    
    return model

# Sync and fix endpoints removed - manual download/delete only

@router.delete("/{model_id}", response_model=dict)
async def delete_embedding_model(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Delete an embedding model.
    """
    model = db.query(EmbeddingModel).filter(
        EmbeddingModel.model_id == model_id
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
    
    # Don't allow deleting the default model
    if model.is_default:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the default model. Please set another model as default first."
        )
    
    # Check if any documents are using this model
    doc_count = db.query(Document).filter(
        Document.embedding_model_id == model.id
    ).count()
    
    if doc_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete model. {doc_count} documents are using this model."
        )
    
    db.delete(model)
    db.commit()
    
    logger.info(f"Deleted embedding model: {model_id}")
    
    return {"success": True, "message": f"Model {model_id} deleted successfully"}

@router.post("/check-compatibility")
async def check_model_compatibility(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Check if changing to a new model requires vector database reset.
    Call this before set-default to warn user about potential data loss.
    """
    manager = get_embedding_model_manager(db)
    
    try:
        result = manager.check_model_compatibility(model_id)
        return result
    except Exception as e:
        logger.error(f"Compatibility check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/set-default", response_model=ChangeModelResponse)
async def set_default_model(
    request: SetDefaultModelRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Set the default embedding model.
    If model change requires vector reset (different dimension), it will:
    1. Clear ChromaDB
    2. Clear all FAISS vectors
    3. Reset document status to 'uploaded'
    
    Use auto_reset=False to get confirmation before reset.
    Use force_reset=True to reset even if models are compatible.
    """
    manager = get_embedding_model_manager(db)
    
    try:
        result = manager.change_embedding_model(
            new_model_id=request.model_id,
            auto_reset=request.auto_reset,
            force=request.force_reset
        )
        
        # Map to response model
        compatibility = result.get("compatibility", {})
        return ChangeModelResponse(
            success=result["success"],
            message=result["message"],
            requires_reindex=result.get("documents_affected", 0) > 0,
            affected_documents=result.get("documents_affected", 0),
            old_model=compatibility.get("old_model", {}).get("model_id") if compatibility.get("old_model") else None,
            new_model=request.model_id,
            reset_performed=result.get("reset_performed", False),
            requires_confirmation=result.get("requires_confirmation", False)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to change default model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/overview")
async def get_embedding_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get embedding models statistics overview.
    Only counts downloaded models for the stats.
    """
    # Only count downloaded models
    total_models = db.query(EmbeddingModel).filter(
        EmbeddingModel.is_downloaded == True
    ).count()
    active_models = db.query(EmbeddingModel).filter(
        EmbeddingModel.is_active == True,
        EmbeddingModel.is_downloaded == True
    ).count()
    local_models = db.query(EmbeddingModel).filter(
        EmbeddingModel.deployment_type == "local",
        EmbeddingModel.is_downloaded == True
    ).count()
    remote_models = db.query(EmbeddingModel).filter(
        EmbeddingModel.deployment_type == "remote",
        EmbeddingModel.is_downloaded == True
    ).count()
    
    default_model = db.query(EmbeddingModel).filter(
        EmbeddingModel.is_default == True
    ).first()
    
    # Document stats - use vector_indexed field instead of embedding_model_id
    total_docs = db.query(Document).count()
    docs_with_embedding = db.query(Document).filter(
        Document.vector_indexed == True
    ).count()
    
    return {
        "models": {
            "total": total_models,
            "active": active_models,
            "local": local_models,
            "remote": remote_models,
            "default": default_model.model_id if default_model else None
        },
        "documents": {
            "total": total_docs,
            "with_embedding": docs_with_embedding,
            "without_embedding": total_docs - docs_with_embedding
        }
    }

@router.post("/test-encode")
async def test_encode(
    model_id: str,
    text: str = "Test embedding",
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Test encoding with a specific model.
    """
    service = get_unified_embedding_service()
    
    try:
        import time
        start_time = time.time()
        
        embedding = service.encode_single(text, model_id=model_id, db=db)
        
        elapsed_time = time.time() - start_time
        
        return {
            "success": True,
            "model_id": model_id,
            "text": text,
            "embedding_shape": embedding.shape,
            "embedding_dimension": len(embedding),
            "elapsed_time_ms": round(elapsed_time * 1000, 2),
            "sample_values": embedding[:5].tolist()
        }
    except Exception as e:
        logger.error(f"Test encoding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== PUBLIC ENDPOINT (No Admin Auth Required) =====

class ActiveModelInfo(BaseModel):
    """Active embedding model basic info for frontend"""
    model_id: str
    display_name: str
    dimension: int
    multilingual: bool
    deployment_type: str


@router.get("/active/info", response_model=ActiveModelInfo)
async def get_active_model_info(
    db: Session = Depends(get_db)
):
    """
    Get basic info about the active (default) embedding model.
    This endpoint does NOT require admin authentication.
    Used by frontend to determine UI behavior based on model capabilities.
    """
    model = db.query(EmbeddingModel).filter(
        EmbeddingModel.is_default == True,
        EmbeddingModel.is_active == True
    ).first()
    
    if not model:
        raise HTTPException(
            status_code=404, 
            detail="No active embedding model configured"
        )
    
    return ActiveModelInfo(
        model_id=model.model_id,
        display_name=model.display_name,
        dimension=model.dimension,
        multilingual=model.multilingual,
        deployment_type=model.deployment_type
    )

