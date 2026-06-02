# backend/api/appointments.py
"""
Appointment management API for Ragleaf platform.
Handles appointment CRUD, status updates, and calendar integration.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from backend.database.connection import get_db
from backend.database.models_platform import (
    Organization, Agent, Appointment, CalendarIntegration
)
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org

logger = logging.getLogger(__name__)

appointments_router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class AppointmentCreateRequest(BaseModel):
    """Used by AI agent or manual creation."""
    agent_id: Optional[int] = None
    conversation_id: Optional[str] = None
    customer_name: str = Field(..., min_length=2, max_length=200)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_notes: Optional[str] = None
    service_type: Optional[str] = None
    service_details: Optional[Dict[str, Any]] = None
    appointment_date: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)


class AppointmentUpdateRequest(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_notes: Optional[str] = None
    service_type: Optional[str] = None
    service_details: Optional[Dict[str, Any]] = None
    appointment_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: int
    public_id: str
    organization_id: int
    agent_id: Optional[int] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_notes: Optional[str] = None
    service_type: Optional[str] = None
    service_details: Optional[Dict[str, Any]] = None
    appointment_date: datetime
    appointment_end: Optional[datetime] = None
    duration_minutes: int = 60
    status: str = "pending"
    cancelled_reason: Optional[str] = None
    sync_status: str = "not_synced"
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(confirmed|completed|cancelled|no_show)$")
    cancelled_reason: Optional[str] = None


# ============================================================================
# Internal API — Called by AI agent during chat
# ============================================================================

class AIAppointmentRequest(BaseModel):
    """Schema for AI agent to create appointments during chat."""
    agent_public_id: str
    conversation_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    service_type: str
    appointment_date: str  # ISO format string from AI
    duration_minutes: int = 60
    customer_notes: Optional[str] = None


@appointments_router.post(
    "/appointments/ai-create",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI agent creates appointment from chat"
)
async def ai_create_appointment(
    request: AIAppointmentRequest,
    db: Session = Depends(get_db)
):
    """
    Called by the AI agent during chat to create a real appointment.
    This endpoint validates the data, checks for conflicts, and saves to DB.
    """
    # Find agent and org
    agent = db.query(Agent).filter(Agent.public_id == request.agent_public_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent bulunamadı")
    
    # Parse date
    try:
        apt_date = datetime.fromisoformat(request.appointment_date.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=422, detail="Geçersiz tarih formatı")
    
    # Check if appointment is in the future
    if apt_date < datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Geçmiş bir tarihe randevu oluşturulamaz")
    
    apt_end = apt_date + timedelta(minutes=request.duration_minutes)
    
    # Check for conflicts (overlapping appointments)
    conflicts = db.query(Appointment).filter(
        Appointment.organization_id == agent.organization_id,
        Appointment.status.in_(["pending", "confirmed"]),
        Appointment.appointment_date < apt_end,
        Appointment.appointment_end > apt_date
    ).count()
    
    if conflicts > 0:
        raise HTTPException(
            status_code=409,
            detail="Bu zaman diliminde başka bir randevu mevcut"
        )
    
    # Create appointment
    appointment = Appointment(
        organization_id=agent.organization_id,
        agent_id=agent.id,
        customer_name=request.customer_name,
        customer_phone=request.customer_phone,
        customer_notes=request.customer_notes,
        service_type=request.service_type,
        service_details={"services": [request.service_type]},
        appointment_date=apt_date,
        appointment_end=apt_end,
        duration_minutes=request.duration_minutes,
        status="pending"
    )
    
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    
    logger.info(f"📅 AI created appointment: {appointment.public_id} for {request.customer_name} at {apt_date}")
    
    # TODO: Trigger calendar sync if integration exists
    # TODO: Send notification to business owner
    
    return appointment


# ============================================================================
# Tenant API — Dashboard appointment management
# ============================================================================

@appointments_router.get(
    "/appointments",
    response_model=List[AppointmentResponse],
    summary="List appointments for organization"
)
async def list_appointments(
    status_filter: Optional[str] = Query(None, alias="status"),
    agent_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """List appointments with filters."""
    query = db.query(Appointment).filter(Appointment.organization_id == org.id)
    
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    
    if agent_id:
        query = query.filter(Appointment.agent_id == agent_id)
    
    if date_from:
        try:
            from_dt = datetime.fromisoformat(date_from)
            query = query.filter(Appointment.appointment_date >= from_dt)
        except ValueError:
            pass
    
    if date_to:
        try:
            to_dt = datetime.fromisoformat(date_to)
            query = query.filter(Appointment.appointment_date <= to_dt)
        except ValueError:
            pass
    
    appointments = query.order_by(
        Appointment.appointment_date.asc()
    ).offset(offset).limit(limit).all()
    
    return appointments


@appointments_router.get(
    "/appointments/{public_id}",
    response_model=AppointmentResponse,
    summary="Get appointment details"
)
async def get_appointment(
    public_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Get single appointment by public_id."""
    appointment = db.query(Appointment).filter(
        Appointment.public_id == public_id,
        Appointment.organization_id == org.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    return appointment


@appointments_router.patch(
    "/appointments/{public_id}/status",
    response_model=AppointmentResponse,
    summary="Update appointment status"
)
async def update_appointment_status(
    public_id: str,
    request: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Update appointment status (confirm, complete, cancel, no-show)."""
    appointment = db.query(Appointment).filter(
        Appointment.public_id == public_id,
        Appointment.organization_id == org.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    # Validate status transitions
    valid_transitions = {
        "pending": ["confirmed", "cancelled"],
        "confirmed": ["completed", "cancelled", "no_show"],
    }
    
    allowed = valid_transitions.get(appointment.status, [])
    if request.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"'{appointment.status}' durumundan '{request.status}' durumuna geçiş yapılamaz. İzin verilen: {allowed}"
        )
    
    appointment.status = request.status
    
    if request.status == "confirmed":
        appointment.confirmed_at = datetime.now(timezone.utc)
    elif request.status == "completed":
        appointment.completed_at = datetime.now(timezone.utc)
    elif request.status == "cancelled":
        appointment.cancelled_reason = request.cancelled_reason
        appointment.cancelled_by = "business"
    
    db.commit()
    db.refresh(appointment)
    
    logger.info(f"📅 Appointment {public_id} status → {request.status}")
    
    # TODO: Sync status change to external calendar
    
    return appointment


@appointments_router.put(
    "/appointments/{public_id}",
    response_model=AppointmentResponse,
    summary="Update appointment details"
)
async def update_appointment(
    public_id: str,
    request: AppointmentUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Update appointment details (reschedule, change service, etc.)."""
    appointment = db.query(Appointment).filter(
        Appointment.public_id == public_id,
        Appointment.organization_id == org.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    if appointment.status in ["completed", "cancelled", "no_show"]:
        raise HTTPException(status_code=422, detail="Tamamlanmış/iptal edilmiş randevu düzenlenemez")
    
    update_data = request.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "status":
            continue  # Status changes go through /status endpoint
        setattr(appointment, field, value)
    
    # Recalculate end time if date or duration changed
    if request.appointment_date or request.duration_minutes:
        apt_date = appointment.appointment_date
        duration = appointment.duration_minutes
        appointment.appointment_end = apt_date + timedelta(minutes=duration)
    
    db.commit()
    db.refresh(appointment)
    
    return appointment


@appointments_router.delete(
    "/appointments/{public_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete appointment"
)
async def delete_appointment(
    public_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Permanently delete an appointment."""
    appointment = db.query(Appointment).filter(
        Appointment.public_id == public_id,
        Appointment.organization_id == org.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    db.delete(appointment)
    db.commit()
    
    logger.info(f"🗑️ Appointment {public_id} deleted")


# ============================================================================
# Stats endpoint
# ============================================================================

@appointments_router.get(
    "/appointments/stats/summary",
    summary="Appointment statistics"
)
async def appointment_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Get appointment statistics for the organization."""
    from sqlalchemy import func
    
    base_query = db.query(Appointment).filter(Appointment.organization_id == org.id)
    
    total = base_query.count()
    pending = base_query.filter(Appointment.status == "pending").count()
    confirmed = base_query.filter(Appointment.status == "confirmed").count()
    completed = base_query.filter(Appointment.status == "completed").count()
    cancelled = base_query.filter(Appointment.status == "cancelled").count()
    
    # Today's appointments
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    today = base_query.filter(
        Appointment.appointment_date >= today_start,
        Appointment.appointment_date < today_end,
        Appointment.status.in_(["pending", "confirmed"])
    ).count()
    
    # This week
    week_start = today_start - timedelta(days=today_start.weekday())
    week_end = week_start + timedelta(days=7)
    this_week = base_query.filter(
        Appointment.appointment_date >= week_start,
        Appointment.appointment_date < week_end,
        Appointment.status.in_(["pending", "confirmed"])
    ).count()
    
    return {
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "completed": completed,
        "cancelled": cancelled,
        "today": today,
        "this_week": this_week
    }
