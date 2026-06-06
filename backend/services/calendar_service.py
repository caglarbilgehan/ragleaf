# backend/services/calendar_service.py
"""
Calendar Integration Service.
Handles Google Calendar, Outlook, and iCal sync for appointments.

Google Calendar flow:
1. Admin initiates OAuth → gets authorization code
2. Backend exchanges code → gets access_token + refresh_token
3. On appointment create/update → push event to Google Calendar
4. Periodic sync pulls external changes back

This service is designed to work without google API client libraries
by using direct HTTP calls to the Google Calendar REST API.
"""

import logging
import json
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta, timezone
import urllib.parse

import httpx

from backend.database.models_platform import (
    Appointment, CalendarIntegration, Organization
)

logger = logging.getLogger(__name__)


# ============================================================================
# Google Calendar API (Direct REST — no google-api-python-client needed)
# ============================================================================

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events"


class CalendarService:
    """
    Manages calendar integrations for organizations.
    Supports Google Calendar (OAuth2), with extensibility for Outlook/iCal.
    """

    def __init__(self):
        self._http = httpx.AsyncClient(timeout=15.0)

    # ========================================================================
    # Google OAuth2 Flow
    # ========================================================================

    def get_google_auth_url(
        self,
        client_id: str,
        redirect_uri: str,
        state: str = ""
    ) -> str:
        """
        Generate Google OAuth2 authorization URL.
        User visits this URL to grant calendar access.
        """
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_SCOPES,
            "access_type": "offline",   # Get refresh_token
            "prompt": "consent",        # Always show consent screen
            "state": state,             # CSRF protection / org_id
        }
        return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    async def exchange_google_code(
        self,
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access + refresh tokens.
        Returns: {"access_token": "...", "refresh_token": "...", "expires_in": 3600, ...}
        """
        resp = await self._http.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })

        if resp.status_code != 200:
            logger.error(f"Google token exchange failed: {resp.text}")
            raise Exception(f"Google token exchange failed: {resp.status_code}")

        token_data = resp.json()
        logger.info("Google OAuth2 token exchange successful")
        return token_data

    async def refresh_google_token(
        self,
        refresh_token: str,
        client_id: str,
        client_secret: str
    ) -> Dict[str, Any]:
        """Refresh an expired Google access token."""
        resp = await self._http.post(GOOGLE_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
        })

        if resp.status_code != 200:
            logger.error(f"Google token refresh failed: {resp.text}")
            raise Exception(f"Google token refresh failed: {resp.status_code}")

        return resp.json()

    # ========================================================================
    # Google Calendar Event Operations
    # ========================================================================

    async def _get_valid_token(
        self,
        integration: CalendarIntegration,
        client_id: str,
        client_secret: str,
        db=None
    ) -> str:
        """Get a valid access token, refreshing if needed."""
        creds = integration.credentials or {}
        access_token = creds.get("access_token")
        refresh_token = creds.get("refresh_token")
        expires_at = creds.get("expires_at", 0)

        # Check if token is expired (with 5 min buffer)
        now = datetime.now(timezone.utc).timestamp()
        if now >= (expires_at - 300) and refresh_token:
            try:
                new_tokens = await self.refresh_google_token(
                    refresh_token, client_id, client_secret
                )
                access_token = new_tokens["access_token"]
                new_expires_at = now + new_tokens.get("expires_in", 3600)

                # Update stored credentials
                creds["access_token"] = access_token
                creds["expires_at"] = new_expires_at
                if "refresh_token" in new_tokens:
                    creds["refresh_token"] = new_tokens["refresh_token"]

                integration.credentials = creds
                if db:
                    db.commit()

                logger.info(f"Refreshed Google token for integration {integration.id}")
            except Exception as e:
                logger.error(f"Token refresh failed: {e}")
                raise

        return access_token

    async def push_appointment_to_google(
        self,
        appointment: Appointment,
        integration: CalendarIntegration,
        client_id: str,
        client_secret: str,
        db=None
    ) -> Optional[str]:
        """
        Create a Google Calendar event from an appointment.
        Returns the Google event ID, or None on failure.
        """
        access_token = await self._get_valid_token(
            integration, client_id, client_secret, db
        )

        calendar_id = integration.calendar_id or "primary"

        # Build event body
        event = self._build_google_event(appointment)

        resp = await self._http.post(
            f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events",
            json=event,
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if resp.status_code in (200, 201):
            event_data = resp.json()
            event_id = event_data.get("id")
            logger.info(
                f"📅 Google Calendar event created: {event_id} "
                f"for appointment {appointment.public_id}"
            )

            # Update sync status
            appointment.sync_status = "synced"
            appointment.extra_data = {
                **(appointment.extra_data or {}),
                "google_event_id": event_id
            }
            integration.last_sync_at = datetime.now(timezone.utc)
            integration.sync_error = None
            if db:
                db.commit()

            return event_id
        else:
            error_msg = resp.text[:500]
            logger.error(f"Google Calendar event creation failed: {error_msg}")
            integration.sync_error = error_msg
            appointment.sync_status = "error"
            if db:
                db.commit()
            return None

    async def update_google_event(
        self,
        appointment: Appointment,
        integration: CalendarIntegration,
        client_id: str,
        client_secret: str,
        db=None
    ) -> bool:
        """Update an existing Google Calendar event when appointment changes."""
        extra = appointment.extra_data or {}
        event_id = extra.get("google_event_id")
        if not event_id:
            return False

        access_token = await self._get_valid_token(
            integration, client_id, client_secret, db
        )
        calendar_id = integration.calendar_id or "primary"

        # Handle cancellation
        if appointment.status in ("cancelled", "no_show"):
            resp = await self._http.delete(
                f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code in (200, 204):
                logger.info(f"Google event {event_id} deleted (appointment {appointment.status})")
                appointment.sync_status = "synced"
                if db:
                    db.commit()
                return True
            return False

        # Update event
        event = self._build_google_event(appointment)
        resp = await self._http.put(
            f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events/{event_id}",
            json=event,
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if resp.status_code == 200:
            logger.info(f"Google event {event_id} updated")
            appointment.sync_status = "synced"
            if db:
                db.commit()
            return True

        logger.error(f"Google event update failed: {resp.text[:300]}")
        return False

    def _build_google_event(self, appointment: Appointment) -> Dict[str, Any]:
        """Convert an Appointment to a Google Calendar event payload."""
        start_dt = appointment.appointment_date
        end_dt = appointment.appointment_end or (
            start_dt + timedelta(minutes=appointment.duration_minutes or 60)
        )

        summary_parts = [appointment.customer_name]
        if appointment.service_type:
            summary_parts.append(f"— {appointment.service_type}")

        description_parts = []
        if appointment.customer_phone:
            description_parts.append(f"📞 Telefon: {appointment.customer_phone}")
        if appointment.customer_email:
            description_parts.append(f"📧 E-posta: {appointment.customer_email}")
        if appointment.service_type:
            description_parts.append(f"✂️ Hizmet: {appointment.service_type}")
        if appointment.customer_notes:
            description_parts.append(f"📝 Not: {appointment.customer_notes}")
        description_parts.append(f"🆔 Referans: {appointment.public_id}")
        description_parts.append(f"📊 Durum: {appointment.status}")

        event = {
            "summary": " ".join(summary_parts),
            "description": "\n".join(description_parts),
            "start": {
                "dateTime": start_dt.isoformat(),
                "timeZone": "Europe/Istanbul",
            },
            "end": {
                "dateTime": end_dt.isoformat(),
                "timeZone": "Europe/Istanbul",
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 30},
                ],
            },
            "colorId": self._status_color(appointment.status),
        }

        return event

    @staticmethod
    def _status_color(status: str) -> str:
        """Map appointment status to Google Calendar color ID."""
        return {
            "pending": "5",     # Banana (yellow)
            "confirmed": "9",   # Blueberry (blue)
            "completed": "10",  # Basil (green)
            "cancelled": "11",  # Tomato (red)
            "no_show": "8",     # Graphite (gray)
        }.get(status, "0")

    # ========================================================================
    # iCal Feed Generation
    # ========================================================================

    def generate_ical_feed(
        self,
        appointments: list,
        org_name: str = "Ragleaf"
    ) -> str:
        """
        Generate an iCal (.ics) feed from appointments.
        Can be subscribed to by any calendar app (Apple Calendar, Outlook, etc.)
        """
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            f"PRODID:-//{org_name}//Ragleaf//TR",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            f"X-WR-CALNAME:{org_name} Randevuları",
        ]

        for apt in appointments:
            start_dt = apt.appointment_date
            end_dt = apt.appointment_end or (
                start_dt + timedelta(minutes=apt.duration_minutes or 60)
            )

            lines.extend([
                "BEGIN:VEVENT",
                f"UID:{apt.public_id}@ragleaf.com",
                f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%S')}",
                f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%S')}",
                f"SUMMARY:{apt.customer_name} — {apt.service_type or 'Randevu'}",
                f"DESCRIPTION:Tel: {apt.customer_phone or '-'}\\nRef: {apt.public_id}",
                f"STATUS:{'CONFIRMED' if apt.status == 'confirmed' else 'TENTATIVE'}",
                "END:VEVENT",
            ])

        lines.append("END:VCALENDAR")
        return "\r\n".join(lines)


# Singleton
calendar_service = CalendarService()
