# backend/api/vectorstore_settings.py
"""
Vector Store Settings Management API
Manages embedding models, chunk sizes, and hybrid vector store configuration.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from ..database.connection import get_db
from ..database.models import Settings
from ..auth.dependencies import get_current_admin_user
from ..services.embeddings import EmbeddingService
import json
import os

vectorstore_settings_router = APIRouter()

# ========================================
# Pydantic Models
# ========================================

class VectorStoreSettingsSchema(BaseModel):
    """Vector store configuration settings"""
    embedding_model: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    chunk_size: int = Field(default=512, ge=100, le=2000)
    chunk_overlap: int = Field(default=100, ge=0, le=500)
    collection_name: str = Field(default="documents")
    chroma_dir: str = Field(default="./documents/database/chroma_db")
    reranker_model: Optional[str] = Field(default="BAAI/bge-reranker-large")
    reranker_enabled: bool = Field(default=False)

    class Config:
        json_schema_extra = {
            "example": {
                "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
                "chunk_size": 512,
                "chunk_overlap": 100,
                "collection_name": "documents",
                "chroma_dir": "./documents/database/chroma_db",
                "reranker_model": "BAAI/bge-reranker-large",
                "reranker_enabled": False
            }
        }

class EmbeddingModelInfo(BaseModel):
    """Information about an embedding model"""
    model_config = {"protected_namespaces": ()}
    
    model_id: str
    display_name: str
    dimensions: int
    description: str
    recommended: bool = False

class SettingsUpdateResponse(BaseModel):
    """Response after updating settings"""
    success: bool
    message: str
    settings: VectorStoreSettingsSchema
    requires_rebuild: bool = False

# ========================================
# Helper Functions
# ========================================

def get_default_settings() -> VectorStoreSettingsSchema:
    """Get default vector store settings from environment variables"""
    return VectorStoreSettingsSchema(
        embedding_model=os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
        chunk_size=int(os.getenv("CHUNK_SIZE", "512")),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "100")),
        collection_name=os.getenv("COLLECTION_NAME", "documents"),
        chroma_dir=os.getenv("CHROMA_DIR", "./documents/database/chroma_db"),
        reranker_model=os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-large"),
        reranker_enabled=os.getenv("RERANKER_ENABLED", "false").lower() == "true"
    )

def load_settings_from_db(db: Session) -> VectorStoreSettingsSchema:
    """Load vector store settings from database, fallback to defaults"""
    setting = db.query(Settings).filter(Settings.key == "vectorstore_config").first()

    if setting and setting.value:
        try:
            return VectorStoreSettingsSchema(**setting.value)
        except Exception as e:
            print(f"Error loading settings from DB: {e}")
            return get_default_settings()

    return get_default_settings()

def save_settings_to_db(db: Session, settings: VectorStoreSettingsSchema) -> None:
    """Save vector store settings to database"""
    setting = db.query(Settings).filter(Settings.key == "vectorstore_config").first()

    settings_dict = settings.model_dump()

    if setting:
        setting.value = settings_dict
        setting.description = "Hibrit Vector Store yapılandırma ayarları"
    else:
        setting = Settings(
            key="vectorstore_config",
            value=settings_dict,
            description="Hibrit Vector Store yapılandırma ayarları"
        )
        db.add(setting)

    db.commit()
    db.refresh(setting)

# ========================================
# API Endpoints
# ========================================

@vectorstore_settings_router.get("/settings/vectorstore", response_model=VectorStoreSettingsSchema)
async def get_vectorstore_settings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Get current vector store settings.
    Returns settings from database or defaults from .env
    """
    try:
        settings = load_settings_from_db(db)
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ayarlar yüklenemedi: {str(e)}")

@vectorstore_settings_router.put("/settings/vectorstore", response_model=SettingsUpdateResponse)
async def update_vectorstore_settings(
    new_settings: VectorStoreSettingsSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Update vector store settings.
    Returns whether a rebuild is required based on changes.
    """
    try:
        # Load current settings
        current_settings = load_settings_from_db(db)

        # Check if critical parameters changed (requires rebuild)
        requires_rebuild = (
            current_settings.embedding_model != new_settings.embedding_model or
            current_settings.chunk_size != new_settings.chunk_size or
            current_settings.chunk_overlap != new_settings.chunk_overlap
        )

        # Save new settings
        save_settings_to_db(db, new_settings)

        # Update environment variables for current session
        os.environ["EMBEDDING_MODEL"] = new_settings.embedding_model
        os.environ["CHUNK_SIZE"] = str(new_settings.chunk_size)
        os.environ["CHUNK_OVERLAP"] = str(new_settings.chunk_overlap)
        os.environ["COLLECTION_NAME"] = new_settings.collection_name
        os.environ["VECTORSTORE_ROOT"] = new_settings.vectorstore_root
        os.environ["CHROMA_DIR"] = new_settings.chroma_dir
        os.environ["FAISS_DIR"] = new_settings.faiss_dir
        if new_settings.reranker_model:
            os.environ["RERANKER_MODEL"] = new_settings.reranker_model
        os.environ["RERANKER_ENABLED"] = str(new_settings.reranker_enabled).lower()
        os.environ["FAISS_INDEX_TYPE"] = new_settings.faiss_index_type

        message = "Ayarlar başarıyla güncellendi"
        if requires_rebuild:
            message += ". ⚠️ Embedding modeli veya chunk parametreleri değişti - FAISS rebuild gerekli!"

        return SettingsUpdateResponse(
            success=True,
            message=message,
            settings=new_settings,
            requires_rebuild=requires_rebuild
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ayarlar güncellenemedi: {str(e)}")

@vectorstore_settings_router.post("/settings/vectorstore/reset", response_model=SettingsUpdateResponse)
async def reset_vectorstore_settings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Reset vector store settings to defaults from .env
    """
    try:
        default_settings = get_default_settings()
        save_settings_to_db(db, default_settings)

        return SettingsUpdateResponse(
            success=True,
            message="Ayarlar varsayılan değerlere sıfırlandı",
            settings=default_settings,
            requires_rebuild=True
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ayarlar sıfırlanamadı: {str(e)}")

@vectorstore_settings_router.get("/settings/embedding-models", response_model=List[EmbeddingModelInfo])
async def get_available_embedding_models(
    current_user = Depends(get_current_admin_user)
):
    """
    Get list of available/recommended embedding models.
    These are commonly used models with known dimensions.
    """
    models = [
        EmbeddingModelInfo(
            model_id="intfloat/multilingual-e5-base",
            display_name="Multilingual E5 Base (Recommended)",
            dimensions=768,
            description="Türkçe ve İngilizce için optimize edilmiş, dengeli performans",
            recommended=True
        ),
        EmbeddingModelInfo(
            model_id="sentence-transformers/all-MiniLM-L6-v2",
            display_name="All-MiniLM-L6-v2",
            dimensions=384,
            description="Hızlı ve hafif, İngilizce odaklı",
            recommended=False
        ),
        EmbeddingModelInfo(
            model_id="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            display_name="Paraphrase Multilingual MiniLM",
            dimensions=384,
            description="Çok dilli destek, orta boyut",
            recommended=False
        ),
        EmbeddingModelInfo(
            model_id="intfloat/multilingual-e5-large",
            display_name="Multilingual E5 Large",
            dimensions=1024,
            description="En iyi kalite, daha yüksek kaynak kullanımı",
            recommended=False
        ),
        EmbeddingModelInfo(
            model_id="BAAI/bge-base-en-v1.5",
            display_name="BGE Base EN v1.5",
            dimensions=768,
            description="İngilizce için yüksek performans",
            recommended=False
        ),
        EmbeddingModelInfo(
            model_id="BAAI/bge-m3",
            display_name="BGE M3",
            dimensions=1024,
            description="Çok dilli, yeni nesil model",
            recommended=False
        ),
    ]

    return models

class RerankerModelInfo(BaseModel):
    """Information about a reranker model"""
    model_config = {"protected_namespaces": ()}
    
    model_id: str
    display_name: str
    description: str
    recommended: bool = False
    max_length: int = 512

@vectorstore_settings_router.get("/settings/reranker-models", response_model=List[RerankerModelInfo])
async def get_available_reranker_models(
    current_user = Depends(get_current_admin_user)
):
    """
    Get list of available/recommended reranker models.
    These are models specifically designed for reranking search results.
    """
    models = [
        RerankerModelInfo(
            model_id="BAAI/bge-reranker-large",
            display_name="BGE Reranker Large (Recommended)",
            description="En yüksek kalite, çok dilli destek, daha yavaş",
            recommended=True,
            max_length=512
        ),
        RerankerModelInfo(
            model_id="BAAI/bge-reranker-base",
            display_name="BGE Reranker Base",
            description="İyi kalite/hız dengesi, çok dilli",
            recommended=False,
            max_length=512
        ),
        RerankerModelInfo(
            model_id="cross-encoder/ms-marco-MiniLM-L-6-v2",
            display_name="MS MARCO MiniLM L6",
            description="Hızlı ve hafif, İngilizce odaklı",
            recommended=False,
            max_length=512
        ),
        RerankerModelInfo(
            model_id="cross-encoder/ms-marco-MiniLM-L-12-v2",
            display_name="MS MARCO MiniLM L12",
            description="Dengeli performans, İngilizce",
            recommended=False,
            max_length=512
        ),
        RerankerModelInfo(
            model_id="BAAI/bge-reranker-v2-m3",
            display_name="BGE Reranker v2 M3",
            description="En yeni versiyon, gelişmiş çok dilli destek",
            recommended=False,
            max_length=8192
        ),
    ]

    return models

@vectorstore_settings_router.post("/settings/embedding-models/test")
async def test_embedding_model(
    model_id: str,
    current_user = Depends(get_current_admin_user)
):
    """
    Test an embedding model by loading it and encoding a sample text.
    Returns model info and performance metrics.
    """
    try:
        import time

        # Create embedding service with specified model
        service = EmbeddingService(model_name=model_id)

        # Test encoding
        test_text = "Bu bir test cümlesidir. This is a test sentence."
        start_time = time.time()
        embeddings = service.encode([test_text])
        elapsed_time = time.time() - start_time

        return {
            "success": True,
            "model_id": model_id,
            "model_loaded": True,
            "vector_dimensions": embeddings.shape[1] if len(embeddings.shape) > 1 else len(embeddings[0]),
            "encoding_time_ms": round(elapsed_time * 1000, 2),
            "device": service.device,
            "message": f"Model başarıyla test edildi ({service.device} cihazında)"
        }
    except Exception as e:
        return {
            "success": False,
            "model_id": model_id,
            "model_loaded": False,
            "error": str(e),
            "message": f"Model yüklenemedi: {str(e)}"
        }
