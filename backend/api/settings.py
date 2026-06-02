# backend/api/settings.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import os
import json
from decouple import config
import logging

from ..database.connection import get_db
from ..database.models import User, Settings
from ..auth.dependencies import get_current_admin_user

logger = logging.getLogger(__name__)

settings_router = APIRouter()

class DocumentProcessorConfig(BaseModel):
    max_memory_mb: int = 512
    batch_size: int = 9
    chunk_size: int = 500
    overlap: int = 100

class EmbeddingServiceConfig(BaseModel):
    max_memory_mb: int = 1024
    batch_size: int = 32
    default_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    loaded_models: List[str] = []

class SystemMonitorConfig(BaseModel):
    warning_memory_percent: int = 75
    critical_memory_percent: int = 90
    monitoring_active: bool = True

class IndexingConfig(BaseModel):
    document_processor: DocumentProcessorConfig
    embedding_service: EmbeddingServiceConfig
    system_monitor: SystemMonitorConfig

class EnvironmentConfig(BaseModel):
    # AI Services
    HUGGINGFACE_API_TOKEN: Optional[str] = None
    
    # Database
    DATABASE_URL: Optional[str] = None
    
    # CORS
    CORS_ORIGINS: Optional[str] = None
    
    # App Settings
    APP_NAME: Optional[str] = None
    APP_VERSION: Optional[str] = None
    
    # File Upload
    MAX_FILE_SIZE_MB: Optional[int] = None
    DOCUMENTS_DIR: Optional[str] = None
    
    # MongoDB Integration
    CHATUI_API_BASE: Optional[str] = None
    
    # ChatUI Configuration
    PUBLIC_APP_NAME: Optional[str] = None
    PUBLIC_APP_DESCRIPTION: Optional[str] = None
    USE_USER_TOKEN: Optional[bool] = None
    AUTOMATIC_LOGIN: Optional[bool] = None

@settings_router.get("/environment", response_model=EnvironmentConfig)
async def get_environment_config(
    current_user: User = Depends(get_current_admin_user)
):
    """Get current environment configuration"""
    try:
        # Read current values from environment/config
        return EnvironmentConfig(
            HUGGINGFACE_API_TOKEN=config("HUGGINGFACE_API_TOKEN", default=""),
            DATABASE_URL=config("DATABASE_URL", default="sqlite:///./backend/rag_webui.db"),
            CORS_ORIGINS=config("CORS_ORIGINS", default=""),
            APP_NAME=config("APP_NAME", default="Ragleaf AI"),
            APP_VERSION=config("APP_VERSION", default="4.0.0"),
            MAX_FILE_SIZE_MB=config("MAX_FILE_SIZE_MB", default=100, cast=int),
            DOCUMENTS_DIR=config("DOCUMENTS_DIR", default=os.getenv("STORAGE_ROOT", "./storage")),
            CHATUI_API_BASE=config("CHATUI_API_BASE", default="http://localhost:3001/api/v2"),
            PUBLIC_APP_NAME=config("PUBLIC_APP_NAME", default="Ragleaf AI"),
            PUBLIC_APP_DESCRIPTION=config("PUBLIC_APP_DESCRIPTION", default="Belge zekasına sahip gelişmiş RAG ve Sohbet sistemi"),
            USE_USER_TOKEN=config("USE_USER_TOKEN", default=False, cast=bool),
            AUTOMATIC_LOGIN=config("AUTOMATIC_LOGIN", default=False, cast=bool)
        )
    except Exception as e:
        logger.error(f"Error getting environment config: {e}")
        raise HTTPException(status_code=500, detail="Environment config could not be retrieved")

@settings_router.post("/environment")
async def update_environment_config(
    env_config: EnvironmentConfig,
    current_user: User = Depends(get_current_admin_user)
):
    """Update environment configuration"""
    try:
        # .env dosyasının yolu
        env_file_path = os.path.join(os.getcwd(), ".env")
        
        # Mevcut .env dosyasını oku
        env_lines = []
        if os.path.exists(env_file_path):
            with open(env_file_path, 'r', encoding='utf-8') as f:
                env_lines = f.readlines()
        
        # Güncellenecek değerler
        updates = {}
        for field, value in env_config.dict(exclude_none=True).items():
            if value is not None:
                if isinstance(value, bool):
                    updates[field] = str(value).lower()
                else:
                    updates[field] = str(value)
        
        # .env dosyasını güncelle
        updated_lines = []
        updated_keys = set()
        
        for line in env_lines:
            line = line.strip()
            if not line or line.startswith('#'):
                updated_lines.append(line)
                continue
            
            if '=' in line:
                key = line.split('=')[0].strip()
                if key in updates:
                    updated_lines.append(f"{key}={updates[key]}")
                    updated_keys.add(key)
                else:
                    updated_lines.append(line)
            else:
                updated_lines.append(line)
        
        # Yeni anahtarları ekle
        for key, value in updates.items():
            if key not in updated_keys:
                updated_lines.append(f"{key}={value}")
        
        # .env dosyasını yaz
        with open(env_file_path, 'w', encoding='utf-8') as f:
            for line in updated_lines:
                f.write(line + '\n')
        
        logger.info(f"Environment config updated by user {current_user.username}")
        
        return {"message": "Environment configuration updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating environment config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update environment config: {str(e)}")

@settings_router.get("/environment/validate")
async def validate_environment_config(
    current_user: User = Depends(get_current_admin_user)
):
    """Validate current environment configuration"""
    try:
        validation_results = {}
        
        # HuggingFace Token validation
        hf_token = config("HUGGINGFACE_API_TOKEN", default="")
        if hf_token:
            if hf_token.startswith("hf_") and len(hf_token) > 20:
                validation_results["huggingface_token"] = {"valid": True, "message": "Token format is valid"}
            else:
                validation_results["huggingface_token"] = {"valid": False, "message": "Invalid token format"}
        else:
            validation_results["huggingface_token"] = {"valid": False, "message": "Token not configured"}
        
        # Database validation
        db_url = config("DATABASE_URL", default="")
        if db_url:
            validation_results["database"] = {"valid": True, "message": "Database URL configured"}
        else:
            validation_results["database"] = {"valid": False, "message": "Database URL not configured"}
        
        # CORS validation
        cors_origins = config("CORS_ORIGINS", default="")
        if cors_origins:
            origins = [origin.strip() for origin in cors_origins.split(',')]
            validation_results["cors"] = {
                "valid": len(origins) > 0, 
                "message": f"{len(origins)} CORS origins configured"
            }
        else:
            validation_results["cors"] = {"valid": False, "message": "No CORS origins configured"}
        
        # File upload validation
        max_file_size = config("MAX_FILE_SIZE_MB", default=0, cast=int)
        docs_dir = config("DOCUMENTS_DIR", default="")
        validation_results["file_upload"] = {
            "valid": max_file_size > 0 and docs_dir,
            "message": f"Max file size: {max_file_size}MB, Documents dir: {docs_dir}"
        }
        
        return validation_results
        
    except Exception as e:
        logger.error(f"Error validating environment config: {e}")
        raise HTTPException(status_code=500, detail="Environment validation failed")

@settings_router.post("/environment/test-huggingface")
async def test_huggingface_connection(
    current_user: User = Depends(get_current_admin_user)
):
    """Test HuggingFace API connection"""
    try:
        import requests
        
        hf_token = config("HUGGINGFACE_API_TOKEN", default="")
        if not hf_token:
            return {"success": False, "message": "HuggingFace token not configured"}
        
        # Test with a simple API call
        headers = {"Authorization": f"Bearer {hf_token}"}
        response = requests.get(
            "https://huggingface.co/api/whoami-v2",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            user_info = response.json()
            return {
                "success": True, 
                "message": f"Connection successful. User: {user_info.get('name', 'Unknown')}",
                "user_info": user_info
            }
        else:
            return {
                "success": False, 
                "message": f"API returned status {response.status_code}"
            }
            
    except Exception as e:
        logger.error(f"Error testing HuggingFace connection: {e}")
        return {"success": False, "message": f"Connection test failed: {str(e)}"}

@settings_router.post("/environment/restart-required")
async def check_restart_required(
    current_user: User = Depends(get_current_admin_user)
):
    """Check if application restart is required after config changes"""
    # Bu endpoint gelecekte kullanılabilir
    # Şu an için her zaman restart gerekli diyebiliriz
    return {
        "restart_required": True,
        "message": "Application restart recommended for configuration changes to take effect"
    }

@settings_router.get("/indexing", response_model=IndexingConfig)
async def get_indexing_config(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get indexing configuration for document processing"""
    try:
        import json
        
        # Get from settings table
        from sqlalchemy import text
        result = db.execute(
            text("SELECT value FROM settings WHERE key = :key"),
            {"key": "indexing_config"}
        ).fetchone()
        
        if result:
            config_data = json.loads(result[0])
            return IndexingConfig(**config_data)
        else:
            # Return default config
            return IndexingConfig(
                document_processor=DocumentProcessorConfig(),
                embedding_service=EmbeddingServiceConfig(),
                system_monitor=SystemMonitorConfig()
            )
            
    except Exception as e:
        logger.error(f"Error getting indexing config: {e}")
        raise HTTPException(status_code=500, detail="Failed to get indexing configuration")

@settings_router.post("/indexing")
async def update_indexing_config(
    indexing_config: IndexingConfig,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update indexing configuration"""
    try:
        import json
        
        # Convert to dict and then JSON
        config_dict = indexing_config.dict()
        config_json = json.dumps(config_dict)
        
        # Update or insert in settings table (PostgreSQL UPSERT)
        from sqlalchemy import text
        db.execute(
            text("""
            INSERT INTO settings (key, value, description, updated_at)
            VALUES (:key, :value, :description, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
            """),
            {
                "key": "indexing_config",
                "value": config_json,
                "description": "Indexing configuration for document processing and embedding"
            }
        )
        
        db.commit()
        
        logger.info(f"Indexing config updated by user {current_user.username}")
        
        return {"message": "Indexing configuration updated successfully"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating indexing config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update indexing config: {str(e)}")

@settings_router.get("/file_processing")
async def get_file_processing_config(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get file processing configuration from settings table"""
    try:
        setting = db.query(Settings).filter(Settings.key == "file_processing").first()
        
        if setting:
            return setting.value
        else:
            # Return default config if not found
            default_config = {
                "document_processor": {
                    "max_memory_mb": 512,
                    "batch_size": 9,
                    "chunk_size": 500,
                    "overlap": 100
                },
                "embedding_service": {
                    "max_memory_mb": 1024,
                    "batch_size": 32,
                    "default_model": "sentence-transformers/all-MiniLM-L6-v2",
                    "loaded_models": []
                },
                "system_monitor": {
                    "warning_memory_percent": 75,
                    "critical_memory_percent": 90,
                    "monitoring_active": True
                }
            }
            return default_config
            
    except Exception as e:
        logger.error(f"Error getting file processing config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get file processing config: {str(e)}")

@settings_router.post("/file_processing")
async def update_file_processing_config(
    config_data: Dict[str, Any],
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update file processing configuration in settings table"""
    try:
        # Check if setting exists
        setting = db.query(Settings).filter(Settings.key == "file_processing").first()
        
        if setting:
            # Update existing setting
            setting.value = config_data
            setting.description = "Document processing and embedding configuration"
        else:
            # Create new setting
            setting = Settings(
                key="file_processing",
                value=config_data,
                description="Document processing and embedding configuration"
            )
            db.add(setting)
        
        db.commit()
        
        logger.info(f"File processing config updated by user {current_user.username}")
        
        return {"message": "File processing configuration updated successfully"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating file processing config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update file processing config: {str(e)}")

# ===== CHUNKING SETTINGS (NEW) =====

@settings_router.get("/chunking_settings")
async def get_chunking_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get chunking settings from settings table"""
    try:
        setting = db.query(Settings).filter(Settings.key == "chunking_settings").first()
        
        if setting:
            return setting.value
        else:
            # Return default chunking config
            default_config = {
                "chunk_size": 750,
                "overlap": 100,
                "batch_size": 9,
                "max_memory_mb": 512
            }
            return default_config
            
    except Exception as e:
        logger.error(f"Error getting chunking settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chunking settings: {str(e)}")

@settings_router.post("/chunking_settings")
async def update_chunking_settings(
    config_data: Dict[str, Any],
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update chunking settings in settings table"""
    try:
        # Validate required fields
        required_fields = ["chunk_size", "overlap", "batch_size", "max_memory_mb"]
        for field in required_fields:
            if field not in config_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Check if setting exists
        setting = db.query(Settings).filter(Settings.key == "chunking_settings").first()
        
        if setting:
            # Update existing setting
            setting.value = config_data
            setting.description = "Text chunking configuration for document processing"
        else:
            # Create new setting
            setting = Settings(
                key="chunking_settings",
                value=config_data,
                description="Text chunking configuration for document processing"
            )
            db.add(setting)
        
        db.commit()
        
        logger.info(f"Chunking settings updated by user {current_user.email}: {config_data}")
        
        return {"message": "Chunking settings updated successfully", "data": config_data}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating chunking settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update chunking settings: {str(e)}")

# ===== SYSTEM MONITOR SETTINGS =====

@settings_router.get("/system_monitor_settings")
async def get_system_monitor_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system monitor settings from settings table"""
    try:
        setting = db.query(Settings).filter(Settings.key == "system_monitor_settings").first()
        
        if setting:
            return setting.value
        else:
            # Return default system monitor config
            default_config = {
                "warning_memory_percent": 75,
                "critical_memory_percent": 90,
                "monitoring_active": True
            }
            return default_config
            
    except Exception as e:
        logger.error(f"Error getting system monitor settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get system monitor settings: {str(e)}")

@settings_router.post("/system_monitor_settings")
async def update_system_monitor_settings(
    config_data: Dict[str, Any],
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update system monitor settings in settings table"""
    try:
        # Validate required fields
        required_fields = ["warning_memory_percent", "critical_memory_percent", "monitoring_active"]
        for field in required_fields:
            if field not in config_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Validate percentages
        if not (0 <= config_data["warning_memory_percent"] <= 100):
            raise HTTPException(status_code=400, detail="warning_memory_percent must be between 0 and 100")
        if not (0 <= config_data["critical_memory_percent"] <= 100):
            raise HTTPException(status_code=400, detail="critical_memory_percent must be between 0 and 100")
        
        # Check if setting exists
        setting = db.query(Settings).filter(Settings.key == "system_monitor_settings").first()
        
        if setting:
            # Update existing setting
            setting.value = config_data
            setting.description = "System resource monitoring configuration"
        else:
            # Create new setting
            setting = Settings(
                key="system_monitor_settings",
                value=config_data,
                description="System resource monitoring configuration"
            )
            db.add(setting)
        
        db.commit()
        
        logger.info(f"System monitor settings updated by user {current_user.email}: {config_data}")
        
        return {"message": "System monitor settings updated successfully", "data": config_data}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating system monitor settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update system monitor settings: {str(e)}")

# ===== RAG SETTINGS =====

@settings_router.get("/rag_settings")
async def get_rag_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get RAG settings from settings table"""
    try:
        setting = db.query(Settings).filter(Settings.key == "rag_settings").first()
        
        if setting:
            return setting.value
        else:
            # Return default RAG config
            default_config = {
                "similarity_threshold": 0.3,
                "max_chunks": 5,
                "diversity_threshold": 0.8,
                "enable_reranking": True,
                "enable_query_expansion": True
            }
            return default_config
            
    except Exception as e:
        logger.error(f"Error getting RAG settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get RAG settings: {str(e)}")

@settings_router.post("/rag_settings")
async def update_rag_settings(
    config_data: Dict[str, Any],
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update RAG settings in settings table"""
    try:
        # Validate required fields
        required_fields = ["similarity_threshold", "max_chunks"]
        for field in required_fields:
            if field not in config_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Validate similarity_threshold (0.0 - 1.0)
        if not (0.0 <= config_data["similarity_threshold"] <= 1.0):
            raise HTTPException(status_code=400, detail="similarity_threshold must be between 0.0 and 1.0")
        
        # Validate max_chunks (1-20)
        if not (1 <= config_data["max_chunks"] <= 20):
            raise HTTPException(status_code=400, detail="max_chunks must be between 1 and 20")
        
        # Validate diversity_threshold if provided
        if "diversity_threshold" in config_data:
            if not (0.0 <= config_data["diversity_threshold"] <= 1.0):
                raise HTTPException(status_code=400, detail="diversity_threshold must be between 0.0 and 1.0")
        
        # Check if setting exists
        setting = db.query(Settings).filter(Settings.key == "rag_settings").first()
        
        if setting:
            # Update existing setting
            setting.value = config_data
            setting.description = "RAG search and retrieval configuration"
        else:
            # Create new setting
            setting = Settings(
                key="rag_settings",
                value=config_data,
                description="RAG search and retrieval configuration"
            )
            db.add(setting)
        
        db.commit()
        
        logger.info(f"RAG settings updated by user {current_user.email}: {config_data}")
        
        return {"message": "RAG settings updated successfully", "data": config_data}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating RAG settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update RAG settings: {str(e)}")

# ===== MULTILINGUAL SETTINGS (NEW) =====

class MultilingualConfig(BaseModel):
    active_languages: List[str] = ["tr"]  # ["tr", "en"]
    default_source_language: str = "tr"
    auto_translate: bool = False
    translation_provider: str = "openai"  # "openai", "local", "azure"
    
@settings_router.get("/multilingual_settings", response_model=MultilingualConfig)
async def get_multilingual_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get multilingual settings from settings table"""
    try:
        setting = db.query(Settings).filter(Settings.key == "multilingual_settings").first()
        
        if setting:
            return MultilingualConfig(**setting.value)
        else:
            # Return default config
            return MultilingualConfig()
            
    except Exception as e:
        logger.error(f"Error getting multilingual settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get multilingual settings: {str(e)}")

@settings_router.post("/multilingual_settings")
async def update_multilingual_settings(
    config_data: MultilingualConfig,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update multilingual settings"""
    try:
        # Check if setting exists
        setting = db.query(Settings).filter(Settings.key == "multilingual_settings").first()
        
        config_dict = config_data.dict()
        
        if setting:
            setting.value = config_dict
            setting.description = "Multilingual RAG configuration"
        else:
            setting = Settings(
                key="multilingual_settings",
                value=config_dict,
                description="Multilingual RAG configuration"
            )
            db.add(setting)
        
        db.commit()
        logger.info(f"Multilingual settings updated by {current_user.email}")
        return {"message": "Settings updated", "data": config_dict}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating multilingual settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))
