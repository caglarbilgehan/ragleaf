"""
Document Metadata Update API endpoint
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from ..database.connection import get_db
from ..database.models import Document
from ..auth.dependencies import get_current_admin_user
from ..database.models import User

logger = logging.getLogger(__name__)

metadata_router = APIRouter(prefix="/admin", tags=["document-metadata"])


class DocumentMetadataUpdate(BaseModel):
    language: Optional[str] = None
    doc_metadata: Optional[Dict[str, Any]] = None
    display_name: Optional[str] = None  # Allow updating display name (maps to 'name' field)


@metadata_router.put("/documents/{document_id}/metadata")
async def update_document_metadata(
    document_id: int,
    update: DocumentMetadataUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update document metadata and language"""
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        if update.language:
            doc.language = update.language
            logger.info(f"Updated document {document_id} language to {update.language}")
        
        if update.display_name:
            doc.name = update.display_name.strip()
            logger.info(f"✅ Updated document {document_id} name to '{doc.name}'")
        
        if update.doc_metadata:
            # Merge with existing metadata
            # IMPORTANT: We must create a NEW dictionary to ensure SQLAlchemy detects the change to the JSON column
            # Modifying the existing dictionary in-place often fails to trigger an update
            existing_meta = dict(doc.doc_metadata) if doc.doc_metadata else {}
            existing_meta.update(update.doc_metadata)
            
            # Re-assigning the whole dictionary triggers the SQLAlchemy flag_modified behavior
            doc.doc_metadata = existing_meta
            logger.info(f"Updated document {document_id} metadata: {existing_meta}")
        
        db.commit()
        db.refresh(doc)
        
        return {
            "success": True,
            "document_id": document_id,
            "language": doc.language,
            "doc_metadata": doc.doc_metadata,
            "display_name": doc.name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating document metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))
