# backend/api/backup.py
"""
Backup API Router - Manual backup management endpoints
"""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.services.backup_service import (
    get_backup_service,
    BackupService,
    BackupInfo,
    BackupResult,
    BackupLog
)

logger = logging.getLogger(__name__)

backup_router = APIRouter(prefix="/api/backups", tags=["backup"])


# Response models
class BackupInfoResponse(BaseModel):
    filename: str
    size_bytes: int
    size_formatted: str
    created_at: str


class BackupResultResponse(BaseModel):
    success: bool
    filename: str | None = None
    size_bytes: int | None = None
    duration_ms: int = 0
    error: str | None = None


class BackupLogResponse(BaseModel):
    id: str
    operation: str
    status: str
    filename: str | None = None
    details: str | None = None
    timestamp: str


class BackupListResponse(BaseModel):
    backups: List[BackupInfoResponse]
    total: int


class BackupLogsResponse(BaseModel):
    logs: List[BackupLogResponse]
    total: int


class DeleteResponse(BaseModel):
    success: bool
    message: str


# Dependency
def get_service() -> BackupService:
    return get_backup_service()


@backup_router.post("/create", response_model=BackupResultResponse)
async def create_backup(
    db: Session = Depends(get_db),
    service: BackupService = Depends(get_service)
):
    """
    Create a new backup of configuration and user data.
    Excludes documents, embeddings, and chat history.
    """
    logger.info("🚀 Backup creation requested")
    result = await service.create_backup(db)
    return BackupResultResponse(**result.to_dict())


@backup_router.get("/list", response_model=BackupListResponse)
async def list_backups(
    service: BackupService = Depends(get_service)
):
    """
    List all available backups, sorted by date (newest first).
    """
    backups = await service.list_backups()
    return BackupListResponse(
        backups=[BackupInfoResponse(**b.to_dict()) for b in backups],
        total=len(backups)
    )


@backup_router.get("/{filename}/download")
async def download_backup(
    filename: str,
    service: BackupService = Depends(get_service)
):
    """
    Download a backup file.
    """
    filepath = await service.get_backup_file(filename)
    
    if filepath is None:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    # Properly encode filename for Content-Disposition header (RFC 5987)
    from urllib.parse import quote
    encoded_filename = quote(filename, safe='')
    ascii_filename = ''.join(c if ord(c) < 128 else '_' for c in filename)
    
    return FileResponse(
        path=filepath,
        media_type="application/gzip",
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        }
    )


@backup_router.delete("/{filename}", response_model=DeleteResponse)
async def delete_backup(
    filename: str,
    service: BackupService = Depends(get_service)
):
    """
    Delete a backup file.
    """
    success = await service.delete_backup(filename)
    
    if not success:
        raise HTTPException(status_code=404, detail="Backup not found or could not be deleted")
    
    return DeleteResponse(
        success=True,
        message=f"Backup {filename} deleted successfully"
    )


@backup_router.get("/logs", response_model=BackupLogsResponse)
async def get_backup_logs(
    limit: int = 50,
    service: BackupService = Depends(get_service)
):
    """
    Get recent backup operation logs.
    """
    logs = await service.get_logs(limit)
    return BackupLogsResponse(
        logs=[BackupLogResponse(**log.to_dict()) for log in logs],
        total=len(logs)
    )
