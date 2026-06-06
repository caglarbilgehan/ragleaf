# backend/services/notification_service.py
"""
Notification Service for Ragleaf Platform.
Handles SMTP Email and Twilio/NetGSM SMS reminder dispatches.
Includes a dummy fallback mode for development and local testing.
"""

import os
import smtplib
import logging
import asyncio
from email.mime.text import MIMEText
from email.header import Header
from typing import Dict, Any, Optional
from decouple import config

logger = logging.getLogger(__name__)

# SMTP Settings
SMTP_HOST = config("SMTP_HOST", default="")
SMTP_PORT = config("SMTP_PORT", cast=int, default=587)
SMTP_USERNAME = config("SMTP_USERNAME", default="")
SMTP_PASSWORD = config("SMTP_PASSWORD", default="")
SMTP_FROM_EMAIL = config("SMTP_FROM_EMAIL", default="")
SMTP_FROM_NAME = config("SMTP_FROM_NAME", default="Ragleaf")

# SMS Settings (Twilio)
TWILIO_ACCOUNT_SID = config("TWILIO_ACCOUNT_SID", default="")
TWILIO_AUTH_TOKEN = config("TWILIO_AUTH_TOKEN", default="")
TWILIO_FROM_NUMBER = config("TWILIO_FROM_NUMBER", default="")

# SMS Settings (NetGSM)
NETGSM_USER = config("NETGSM_USER", default="")
NETGSM_PASSWORD = config("NETGSM_PASSWORD", default="")
NETGSM_HEADER = config("NETGSM_HEADER", default="")

# Default Templates
DEFAULT_EMAIL_TEMPLATE = (
    "Merhaba {customer_name},\n\n"
    "{appointment_date} tarihindeki {service_type} randevunuzu hatırlatmak isteriz.\n"
    "Durum: {status_label}\n\n"
    "İyi günler dileriz."
)

DEFAULT_SMS_TEMPLATE = (
    "Hatırlatma: {organization_name} - {appointment_date} saat {appointment_time}'deki "
    "{service_type} randevunuzu hatırlatırız."
)

def safe_format(template: str, **kwargs) -> str:
    """Safe formatting that handles missing template placeholders gracefully."""
    class SafeDict(dict):
        def __missing__(self, key):
            return "{" + key + "}"
    return template.format_map(SafeDict(**kwargs))

def _send_smtp_email_sync(to_email: str, subject: str, body: str) -> bool:
    """Synchronous SMTP email delivery."""
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.info(f"📝 [MOCK EMAIL] To: {to_email} | Subject: {subject} | Body: {body}")
        return True

    try:
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = Header(f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>")
        msg['To'] = to_email

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())
        logger.info(f"📧 Email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send SMTP email to {to_email}: {e}")
        return False

def _send_twilio_sms_sync(to_number: str, message: str) -> bool:
    """Synchronous Twilio SMS delivery."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_FROM_NUMBER:
        logger.info(f"📝 [MOCK TWILIO SMS] To: {to_number} | Message: {message}")
        return True

    try:
        import requests
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        data = {
            "From": TWILIO_FROM_NUMBER,
            "To": to_number,
            "Body": message
        }
        res = requests.post(url, auth=auth, data=data, timeout=10)
        if res.status_code in (200, 201):
            logger.info(f"💬 Twilio SMS successfully sent to {to_number}")
            return True
        else:
            logger.error(f"❌ Twilio SMS failed (code {res.status_code}): {res.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Failed to send Twilio SMS to {to_number}: {e}")
        return False

def _send_netgsm_sms_sync(to_number: str, message: str) -> bool:
    """Synchronous NetGSM SMS delivery."""
    if not NETGSM_USER or not NETGSM_PASSWORD or not NETGSM_HEADER:
        logger.info(f"📝 [MOCK NETGSM SMS] To: {to_number} | Message: {message}")
        return True

    try:
        import requests
        url = "https://api.netgsm.com.tr/sms/send/get"
        params = {
            "usercode": NETGSM_USER,
            "password": NETGSM_PASSWORD,
            "gsmno": to_number.replace("+", "").replace(" ", ""),
            "message": message,
            "msgheader": NETGSM_HEADER,
            "dil": "TR"
        }
        res = requests.get(url, params=params, timeout=10)
        if res.status_code == 200 and res.text.startswith("00"):
            logger.info(f"💬 NetGSM SMS successfully sent to {to_number}, id: {res.text}")
            return True
        else:
            logger.error(f"❌ NetGSM SMS failed (code {res.status_code}): {res.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Failed to send NetGSM SMS to {to_number}: {e}")
        return False

class NotificationService:
    """Service to handle notification formatting and delivery for appointments."""

    @staticmethod
    async def send_email_reminder(appointment: Any, org: Any) -> bool:
        """Send email reminder for an appointment using localized templates."""
        if not appointment.customer_email:
            return False

        # Get notification config from org settings
        notif_settings = org.settings.get("notifications", {}) if org.settings else {}
        email_enabled = notif_settings.get("email_enabled", True)
        if not email_enabled:
            logger.debug(f"Email reminder is disabled for org {org.name}")
            return False

        # Formulate template fields
        dt = appointment.appointment_date
        status_labels = {
            "pending": "Onay Bekliyor",
            "confirmed": "Onaylandı",
            "completed": "Tamamlandı",
            "cancelled": "İptal Edildi",
            "no_show": "Katılmadı"
        }
        
        fields = {
            "customer_name": appointment.customer_name,
            "appointment_date": dt.strftime("%d.%m.%Y %H:%M"),
            "appointment_time": dt.strftime("%H:%M"),
            "service_type": appointment.service_type or "Genel Randevu",
            "status_label": status_labels.get(appointment.status, appointment.status),
            "organization_name": org.name
        }

        template = notif_settings.get("email_template") or DEFAULT_EMAIL_TEMPLATE
        body = safe_format(template, **fields)
        subject = f"Randevu Hatırlatma: {org.name}"

        return await asyncio.to_thread(_send_smtp_email_sync, appointment.customer_email, subject, body)

    @staticmethod
    async def send_sms_reminder(appointment: Any, org: Any) -> bool:
        """Send SMS reminder for an appointment using localized templates."""
        if not appointment.customer_phone:
            return False

        # Get notification config from org settings
        notif_settings = org.settings.get("notifications", {}) if org.settings else {}
        sms_enabled = notif_settings.get("sms_enabled", True)
        if not sms_enabled:
            logger.debug(f"SMS reminder is disabled for org {org.name}")
            return False

        dt = appointment.appointment_date
        fields = {
            "customer_name": appointment.customer_name,
            "appointment_date": dt.strftime("%d.%m.%Y"),
            "appointment_time": dt.strftime("%H:%M"),
            "service_type": appointment.service_type or "Genel Randevu",
            "organization_name": org.name
        }

        template = notif_settings.get("sms_template") or DEFAULT_SMS_TEMPLATE
        message = safe_format(template, **fields)

        # Dispatch using configured channel
        if NETGSM_USER and NETGSM_PASSWORD and NETGSM_HEADER:
            return await asyncio.to_thread(_send_netgsm_sms_sync, appointment.customer_phone, message)
        elif TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER:
            return await asyncio.to_thread(_send_twilio_sms_sync, appointment.customer_phone, message)
        else:
            # Fallback mock mode
            return await asyncio.to_thread(_send_twilio_sms_sync, appointment.customer_phone, message)
