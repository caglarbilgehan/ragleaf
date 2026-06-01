# backend/services/backup_service.py
"""
Backup Service - Manual backup system for configuration and user data
Stores backups locally in /backups/ directory as compressed JSON files
"""

import os
import gzip
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


@dataclass
class BackupInfo:
    """Backup file information"""
    filename: str
    size_bytes: int
    size_formatted: str
    created_at: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BackupResult:
    """Backup operation result"""
    success: bool
    filename: Optional[str] = None
    size_bytes: Optional[int] = None
    duration_ms: int = 0
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BackupLog:
    """Backup operation log entry"""
    id: str
    operation: str  # create, delete, download
    status: str  # started, success, error
    filename: Optional[str] = None
    details: Optional[str] = None
    timestamp: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class BackupService:
    """
    Handles all backup operations for configuration and user data.
    Backups are stored as compressed JSON files (.json.gz) in /backups/ directory.
    """
    
    BACKUP_DIR = Path("./backups")
    LOG_FILE = Path("./backups/backup_logs.json")
    MAX_LOGS = 100
    
    def __init__(self):
        """Initialize backup service and ensure directories exist"""
        self._ensure_backup_dir()
    
    def _ensure_backup_dir(self) -> None:
        """Create backup directory if it doesn't exist"""
        self.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Backup directory: {self.BACKUP_DIR.absolute()}")
    
    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
    
    def _generate_filename(self) -> str:
        """Generate backup filename with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"backup_{timestamp}.json.gz"
    
    def _add_log(self, operation: str, status: str, filename: Optional[str] = None, details: Optional[str] = None) -> None:
        """Add a log entry, maintaining max 100 entries"""
        log_entry = BackupLog(
            id=str(uuid.uuid4())[:8],
            operation=operation,
            status=status,
            filename=filename,
            details=details,
            timestamp=datetime.now().isoformat()
        )
        
        # Load existing logs
        logs = self._load_logs()
        
        # Add new entry at the beginning
        logs.insert(0, log_entry.to_dict())
        
        # Trim to max entries
        if len(logs) > self.MAX_LOGS:
            logs = logs[:self.MAX_LOGS]
        
        # Save logs
        self._save_logs(logs)
        
        logger.info(f"📝 Backup log: {operation} - {status} - {filename or 'N/A'}")
    
    def _load_logs(self) -> List[Dict[str, Any]]:
        """Load backup logs from file"""
        if not self.LOG_FILE.exists():
            return []
        
        try:
            with open(self.LOG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"❌ Failed to load backup logs: {e}")
            return []
    
    def _save_logs(self, logs: List[Dict[str, Any]]) -> None:
        """Save backup logs to file"""
        try:
            with open(self.LOG_FILE, 'w', encoding='utf-8') as f:
                json.dump(logs, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ Failed to save backup logs: {e}")
    
    async def create_backup(self, db: Session) -> BackupResult:
        """
        Create a new backup containing configuration and user data.
        Excludes documents, embeddings, and chat history.
        """
        import time
        start_time = time.time()
        filename = self._generate_filename()
        filepath = self.BACKUP_DIR / filename
        
        self._add_log("create", "started", filename)
        
        try:
            # Import models
            from backend.database.models import User, Settings, AIProvider, AIToken, EmbeddingModel, ModelConfig
            
            # Collect data from database
            backup_data = {
                "version": "1.0",
                "created_at": datetime.now().isoformat(),
                "system_info": {
                    "app_version": os.getenv("APP_VERSION", "4.0.0"),
                    "database": "postgresql"
                },
                "data": {
                    "users": [],
                    "settings": [],
                    "ai_providers": [],
                    "ai_tokens": [],
                    "embedding_models": [],
                    "llm_models": []
                },
                "metadata": {}
            }
            
            # Export users (exclude password_hash for security)
            users = db.query(User).all()
            for user in users:
                backup_data["data"]["users"].append({
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "surname": user.surname,
                    "full_name": user.full_name,
                    "is_active": user.is_active,
                    "is_admin": user.is_admin,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "last_login": user.last_login.isoformat() if user.last_login else None
                })
            
            # Export settings
            settings = db.query(Settings).all()
            for setting in settings:
                backup_data["data"]["settings"].append({
                    "id": setting.id,
                    "key": setting.key,
                    "value": setting.value,
                    "description": setting.description
                })
            
            # Export AI providers
            providers = db.query(AIProvider).all()
            for provider in providers:
                backup_data["data"]["ai_providers"].append({
                    "id": provider.id,
                    "name": provider.name,
                    "display_name": provider.display_name,
                    "service_type": provider.service_type,
                    "api_url": provider.api_url,
                    "config": provider.config,
                    "priority": provider.priority,
                    "is_enabled": provider.is_enabled,
                    "is_active": provider.is_active,
                    "default_model": provider.default_model,
                    "default_model_display_name": provider.default_model_display_name
                })
            
            # Export AI tokens (mask API keys for security)
            tokens = db.query(AIToken).all()
            for token in tokens:
                plain_key = token.api_key_plain
                masked_key = plain_key[:8] + "..." + plain_key[-4:] if len(plain_key) > 12 else "***"
                backup_data["data"]["ai_tokens"].append({
                    "id": token.id,
                    "provider_id": token.provider_id,
                    "display_name": token.display_name,
                    "api_key_masked": masked_key,
                    "api_url": token.api_url,
                    "priority": token.priority,
                    "is_active": token.is_active,
                    "requests_per_minute": token.requests_per_minute,
                    "requests_per_day": token.requests_per_day
                })
            
            # Export embedding models
            embedding_models = db.query(EmbeddingModel).all()
            for model in embedding_models:
                backup_data["data"]["embedding_models"].append({
                    "id": model.id,
                    "model_id": model.model_id,
                    "display_name": model.display_name,
                    "description": model.description,
                    "dimension": model.dimension,
                    "max_sequence_length": model.max_sequence_length,
                    "deployment_type": model.deployment_type,
                    "multilingual": model.multilingual,
                    "performance_tier": model.performance_tier,
                    "is_active": model.is_active,
                    "is_default": model.is_default,
                    "provider": model.provider,
                    "model_family": model.model_family
                })
            
            # Export LLM models
            llm_models = db.query(ModelConfig).all()
            for model in llm_models:
                backup_data["data"]["llm_models"].append({
                    "id": model.id,
                    "name": model.name,
                    "provider": model.provider,
                    "model_name": model.model_name,
                    "description": model.description,
                    "num_ctx": model.num_ctx,
                    "num_predict": model.num_predict,
                    "temperature": model.temperature,
                    "top_p": model.top_p,
                    "top_k": model.top_k,
                    "repeat_penalty": model.repeat_penalty,
                    "max_context_chars": model.max_context_chars,
                    "rag_top_k": model.rag_top_k,
                    "chunk_size": model.chunk_size,
                    "chunk_overlap": model.chunk_overlap,
                    "timeout_seconds": model.timeout_seconds,
                    "stream_enabled": model.stream_enabled,
                    "is_active": model.is_active,
                    "is_default": model.is_default
                })
            
            # Add metadata summary
            backup_data["metadata"] = {
                "user_count": len(backup_data["data"]["users"]),
                "settings_count": len(backup_data["data"]["settings"]),
                "provider_count": len(backup_data["data"]["ai_providers"]),
                "token_count": len(backup_data["data"]["ai_tokens"]),
                "embedding_model_count": len(backup_data["data"]["embedding_models"]),
                "llm_model_count": len(backup_data["data"]["llm_models"])
            }
            
            # Write compressed JSON
            json_str = json.dumps(backup_data, ensure_ascii=False, indent=2)
            with gzip.open(filepath, 'wt', encoding='utf-8') as f:
                f.write(json_str)
            
            # Get file size
            size_bytes = filepath.stat().st_size
            duration_ms = int((time.time() - start_time) * 1000)
            
            self._add_log("create", "success", filename, f"Size: {self._format_size(size_bytes)}, Duration: {duration_ms}ms")
            
            logger.info(f"✅ Backup created: {filename} ({self._format_size(size_bytes)})")
            
            return BackupResult(
                success=True,
                filename=filename,
                size_bytes=size_bytes,
                duration_ms=duration_ms
            )
            
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            self._add_log("create", "error", filename, error_msg)
            logger.error(f"❌ Backup failed: {error_msg}")
            
            return BackupResult(
                success=False,
                duration_ms=duration_ms,
                error=error_msg
            )
    
    async def list_backups(self) -> List[BackupInfo]:
        """List all available backups, sorted by date (newest first)"""
        backups = []
        
        try:
            for file in self.BACKUP_DIR.glob("backup_*.json.gz"):
                stat = file.stat()
                backups.append(BackupInfo(
                    filename=file.name,
                    size_bytes=stat.st_size,
                    size_formatted=self._format_size(stat.st_size),
                    created_at=datetime.fromtimestamp(stat.st_mtime).isoformat()
                ))
            
            # Sort by created_at descending (newest first)
            backups.sort(key=lambda x: x.created_at, reverse=True)
            
        except Exception as e:
            logger.error(f"❌ Failed to list backups: {e}")
        
        return backups
    
    async def get_backup_file(self, filename: str) -> Optional[Path]:
        """Get backup file path for download"""
        # Validate filename format
        if not filename.startswith("backup_") or not filename.endswith(".json.gz"):
            logger.warning(f"⚠️ Invalid backup filename: {filename}")
            return None
        
        filepath = self.BACKUP_DIR / filename
        
        if not filepath.exists():
            logger.warning(f"⚠️ Backup file not found: {filename}")
            return None
        
        self._add_log("download", "success", filename)
        return filepath
    
    async def delete_backup(self, filename: str) -> bool:
        """Delete a backup file"""
        # Validate filename format
        if not filename.startswith("backup_") or not filename.endswith(".json.gz"):
            self._add_log("delete", "error", filename, "Invalid filename format")
            return False
        
        filepath = self.BACKUP_DIR / filename
        
        if not filepath.exists():
            self._add_log("delete", "error", filename, "File not found")
            return False
        
        try:
            filepath.unlink()
            self._add_log("delete", "success", filename)
            logger.info(f"🗑️ Backup deleted: {filename}")
            return True
        except Exception as e:
            self._add_log("delete", "error", filename, str(e))
            logger.error(f"❌ Failed to delete backup: {e}")
            return False
    
    async def get_logs(self, limit: int = 50) -> List[BackupLog]:
        """Get recent backup operation logs"""
        logs = self._load_logs()
        return [BackupLog(**log) for log in logs[:limit]]


# Singleton instance
_backup_service: Optional[BackupService] = None


def get_backup_service() -> BackupService:
    """Get or create backup service singleton"""
    global _backup_service
    if _backup_service is None:
        _backup_service = BackupService()
    return _backup_service
