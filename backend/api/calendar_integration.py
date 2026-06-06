# backend/api/calendar_integration.py
"""
Calendar Integration API.
Handles Google Calendar OAuth2 flow and iCal feed endpoints.
"""

import os
import logging
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import (
    Organization, CalendarIntegration, Appointment
)
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org
from backend.services.calendar_service import calendar_service

logger = logging.getLogger(__name__)

calendar_router = APIRouter()

# Google OAuth2 settings from environment
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_CALENDAR_REDIRECT_URI",
    "https://platform.ragleaf.com/api/calendar/google/callback"
)


# ============================================================================
# Schemas
# ============================================================================

class CalendarIntegrationResponse(BaseModel):
    id: int
    provider: str
    name: str
    calendar_id: Optional[str] = None
    sync_enabled: bool
    sync_direction: str
    last_sync_at: Optional[datetime] = None
    sync_error: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GoogleAuthInitResponse(BaseModel):
    auth_url: str


# ============================================================================
# List / Status Endpoints
# ============================================================================

@calendar_router.get(
    "/calendar/integrations",
    response_model=List[CalendarIntegrationResponse],
    summary="Takvim entegrasyonlarını listele"
)
async def list_calendar_integrations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Get all calendar integrations for the current organization."""
    integrations = db.query(CalendarIntegration).filter(
        CalendarIntegration.organization_id == org.id
    ).all()
    return integrations


@calendar_router.delete(
    "/calendar/integrations/{integration_id}",
    summary="Takvim entegrasyonunu kaldır"
)
async def remove_calendar_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Remove a calendar integration."""
    integration = db.query(CalendarIntegration).filter(
        CalendarIntegration.id == integration_id,
        CalendarIntegration.organization_id == org.id
    ).first()

    if not integration:
        raise HTTPException(status_code=404, detail="Entegrasyon bulunamadı")

    db.delete(integration)
    db.commit()
    return {"detail": "Entegrasyon kaldırıldı"}


# ============================================================================
# Google Calendar OAuth2 Flow
# ============================================================================

@calendar_router.get(
    "/calendar/google/auth",
    response_model=GoogleAuthInitResponse,
    summary="Google Calendar OAuth2 başlat"
)
async def start_google_auth(
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """
    Generate Google OAuth2 authorization URL.
    Frontend should redirect the user to this URL.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar entegrasyonu yapılandırılmamış. GOOGLE_CALENDAR_CLIENT_ID ayarlanmalı."
        )

    # Use org ID as state for CSRF and org matching
    state = f"org_{org.id}"

    auth_url = calendar_service.get_google_auth_url(
        client_id=GOOGLE_CLIENT_ID,
        redirect_uri=GOOGLE_REDIRECT_URI,
        state=state
    )

    return GoogleAuthInitResponse(auth_url=auth_url)


@calendar_router.get(
    "/calendar/google/callback",
    summary="Google Calendar OAuth2 callback"
)
async def google_auth_callback(
    code: str = Query(...),
    state: str = Query(""),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Google OAuth2 callback endpoint.
    Exchanges authorization code for tokens and saves the integration.
    """
    if error:
        logger.warning(f"Google OAuth error: {error}")
        return RedirectResponse(
            url=f"/tenant/settings?calendar_error={error}",
            status_code=302
        )

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google Calendar yapılandırılmamış")

    # Extract org_id from state
    org_id = None
    if state.startswith("org_"):
        try:
            org_id = int(state.split("_")[1])
        except (ValueError, IndexError):
            pass

    if not org_id:
        raise HTTPException(status_code=400, detail="Geçersiz state parametresi")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizasyon bulunamadı")

    # Exchange code for tokens
    try:
        token_data = await calendar_service.exchange_google_code(
            code=code,
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            redirect_uri=GOOGLE_REDIRECT_URI
        )
    except Exception as e:
        logger.error(f"Google token exchange failed: {e}")
        return RedirectResponse(
            url=f"/tenant/settings?calendar_error=token_exchange_failed",
            status_code=302
        )

    # Save credentials
    credentials = {
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "token_uri": GOOGLE_TOKEN_URL,
        "expires_at": datetime.now(timezone.utc).timestamp() + token_data.get("expires_in", 3600),
        "scope": token_data.get("scope", GOOGLE_SCOPES),
    }

    # Check if integration already exists
    existing = db.query(CalendarIntegration).filter(
        CalendarIntegration.organization_id == org.id,
        CalendarIntegration.provider == "google"
    ).first()

    if existing:
        existing.credentials = credentials
        existing.is_active = True
        existing.sync_error = None
        existing.last_sync_at = datetime.now(timezone.utc)
    else:
        integration = CalendarIntegration(
            organization_id=org.id,
            provider="google",
            name="Google Takvim",
            credentials=credentials,
            calendar_id="primary",
            sync_enabled=True,
            sync_direction="push",
            is_active=True
        )
        db.add(integration)

    db.commit()
    logger.info(f"✅ Google Calendar connected for org {org.slug}")

    return RedirectResponse(
        url="/tenant/settings?calendar_connected=true",
        status_code=302
    )


# ============================================================================
# iCal Feed (Universal Calendar Subscription)
# ============================================================================

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


@calendar_router.get(
    "/calendar/feed/{org_slug}.ics",
    summary="iCal randevu feed'i (abonelik)"
)
async def ical_feed(
    org_slug: str,
    token: str = Query(..., description="Feed access token"),
    db: Session = Depends(get_db)
):
    """
    Public iCal feed for calendar subscription.
    Any calendar app (Apple Calendar, Outlook, etc.) can subscribe to this URL.
    Requires a feed access token for security.
    """
    org = db.query(Organization).filter(Organization.slug == org_slug).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizasyon bulunamadı")

    # Simple token validation (org_id based hash)
    import hashlib
    expected_token = hashlib.sha256(
        f"ical_feed_{org.id}_{org.slug}".encode()
    ).hexdigest()[:24]

    if token != expected_token:
        raise HTTPException(status_code=403, detail="Geçersiz feed token")

    # Get upcoming appointments
    appointments = db.query(Appointment).filter(
        Appointment.organization_id == org.id,
        Appointment.status.in_(["pending", "confirmed"]),
        Appointment.appointment_date >= datetime.now(timezone.utc)
    ).order_by(Appointment.appointment_date.asc()).limit(200).all()

    ical_content = calendar_service.generate_ical_feed(
        appointments=appointments,
        org_name=org.name
    )

    return PlainTextResponse(
        content=ical_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{org.slug}-randevular.ics"'
        }
    )


@calendar_router.get(
    "/calendar/feed-url",
    summary="iCal feed URL'i oluştur"
)
async def get_ical_feed_url(
    request: Request,
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """Generate the iCal feed subscription URL for the current organization."""
    import hashlib
    token = hashlib.sha256(
        f"ical_feed_{org.id}_{org.slug}".encode()
    ).hexdigest()[:24]

    base_url = str(request.base_url).rstrip("/")
    feed_url = f"{base_url}/api/calendar/feed/{org.slug}.ics?token={token}"

    return {
        "feed_url": feed_url,
        "instructions": {
            "google_calendar": f"Google Takvim → Diğer takvimler → URL ile abone ol → {feed_url}",
            "apple_calendar": f"Apple Takvim → Dosya → Yeni Takvim Aboneliği → {feed_url}",
            "outlook": f"Outlook → Takvim Ekle → İnternetten → {feed_url}",
        }
    }
