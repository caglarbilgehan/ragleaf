from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database.connection import get_db
from ..database.models import Document
from ..auth.dependencies import get_current_active_user

documents_router = APIRouter()

@documents_router.get("/", response_model=List[str])
async def get_documents(
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of processed documents for users"""
    # Support new pipeline statuses: indexed, enriched, processed
    documents = db.query(Document).filter(
        Document.status.in_(["indexed", "enriched", "processed"])
    ).all()
    
    return [doc.name for doc in documents]
