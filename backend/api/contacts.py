# backend/api/contacts.py
"""
Contact Requests API.
Public submission and Admin management endpoints.
"""

import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import ContactRequest
from backend.auth.dependencies import get_current_active_user

logger = logging.getLogger(__name__)

# Two separate routers for clean prefix registration in main.py
contacts_public_router = APIRouter()
contacts_router = APIRouter()


# ============================================================================
# Auth guard — only superadmin / admin
# ============================================================================

async def require_superadmin(current_user=Depends(get_current_active_user)):
    if not (current_user.is_superadmin or current_user.is_admin):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    return current_user


# ============================================================================
# Schemas
# ============================================================================

class ContactSubmitRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Gönderen kişinin adı")
    email: EmailStr = Field(..., description="Gönderen kişinin e-posta adresi")
    subject: Optional[str] = Field(None, max_length=200, description="Konu")
    message: str = Field(..., min_length=1, description="Mesaj içeriği")


class ContactRequestResponse(BaseModel):
    id: int
    name: str
    email: str
    subject: Optional[str] = None
    message: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., description="Yeni durum: 'pending' veya 'resolved'")

    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in ["pending", "resolved"]:
            raise ValueError("Durum sadece 'pending' veya 'resolved' olabilir")
        return value


# ============================================================================
# Public Endpoints
# ============================================================================

@contacts_public_router.post(
    "/contact/submit",
    status_code=status.HTTP_201_CREATED,
    summary="İletişim formu gönder"
)
async def submit_contact(
    request: ContactSubmitRequest,
    db: Session = Depends(get_db)
):
    """
    Public contact form submission.
    Saves the user query/message into the database.
    """
    try:
        new_request = ContactRequest(
            name=request.name.strip(),
            email=request.email.strip().lower(),
            subject=request.subject.strip() if request.subject else None,
            message=request.message.strip(),
            status="pending"
        )
        db.add(new_request)
        db.commit()
        db.refresh(new_request)
        
        logger.info(f"📬 New contact request submitted by {new_request.name} ({new_request.email})")
        
        return {
            "success": True,
            "message": "İletişim talebiniz başarıyla alındı.",
            "id": new_request.id
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving contact request: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="İletişim talebi kaydedilirken bir hata oluştu."
        )


# ============================================================================
# Admin Endpoints
# ============================================================================

@contacts_router.get(
    "/admin/contacts",
    response_model=List[ContactRequestResponse],
    summary="Tüm iletişim taleplerini listele"
)
async def list_contacts(
    status: Optional[str] = Query(None, description="Durum filtresi: 'pending' veya 'resolved'"),
    search: Optional[str] = Query(None, description="İsim, e-posta, konu veya mesaj içinde arama"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """
    List all contact requests with filters, search, and pagination.
    Available to admins only.
    """
    query = db.query(ContactRequest)

    if status:
        query = query.filter(ContactRequest.status == status)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            ContactRequest.name.ilike(search_filter) |
            ContactRequest.email.ilike(search_filter) |
            ContactRequest.subject.ilike(search_filter) |
            ContactRequest.message.ilike(search_filter)
        )

    return query.order_by(ContactRequest.created_at.desc()).offset(offset).limit(limit).all()


@contacts_router.patch(
    "/admin/contacts/{contact_id}/status",
    summary="İletişim talebi durumunu güncelle"
)
async def update_contact_status(
    contact_id: int,
    request: UpdateStatusRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """
    Update the status of a contact request ('pending' -> 'resolved' or vice versa).
    Available to admins only.
    """
    # Simple validation
    if request.status not in ["pending", "resolved"]:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz durum. Sadece 'pending' veya 'resolved' kabul edilir."
        )

    contact = db.query(ContactRequest).filter(ContactRequest.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="İletişim talebi bulunamadı")

    contact.status = request.status
    try:
        db.commit()
        db.refresh(contact)
        logger.info(f"📝 Admin updated contact request #{contact_id} status to '{request.status}'")
        return {
            "success": True,
            "detail": f"Talep durumu '{request.status}' olarak güncellendi.",
            "id": contact.id,
            "status": contact.status
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating contact request status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Durum güncellenirken bir hata oluştu."
        )
