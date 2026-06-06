# backend/services/reminder_scheduler.py
"""
Background Scheduler for Appointment Reminders.
Runs a periodic task loop in the background to scan for upcoming appointments and send email/SMS reminders.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from backend.database.connection import SessionLocal
from backend.database.models_platform import Appointment, Organization
from backend.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

# Control flag for scheduler loop
_scheduler_running = False

async def dispatch_reminders(appointment: Appointment, db: Session) -> bool:
    """Helper to fetch Organization and dispatch email/SMS reminders."""
    org = db.query(Organization).filter(Organization.id == appointment.organization_id).first()
    if not org:
        logger.error(f"Organization not found for appointment {appointment.public_id}")
        return False

    email_sent = False
    sms_sent = False

    # Send email reminder if email is present
    if appointment.customer_email:
        try:
            email_sent = await NotificationService.send_email_reminder(appointment, org)
        except Exception as e:
            logger.error(f"Error sending email reminder: {e}")

    # Send SMS reminder if phone is present
    if appointment.customer_phone:
        try:
            sms_sent = await NotificationService.send_sms_reminder(appointment, org)
        except Exception as e:
            logger.error(f"Error sending SMS reminder: {e}")

    return email_sent or sms_sent

async def check_and_send_reminders(db: Session) -> int:
    """Query upcoming appointments, classify by reminder region, and dispatch notifications."""
    now = datetime.now(timezone.utc)
    
    # Query pending or confirmed appointments in the next 25 hours
    appointments = db.query(Appointment).filter(
        Appointment.status.in_(["pending", "confirmed"]),
        Appointment.appointment_date > now,
        Appointment.appointment_date <= now + timedelta(hours=25)
    ).all()

    sent_count = 0

    for appointment in appointments:
        time_diff = appointment.appointment_date - now
        extra_data = appointment.extra_data or {}
        
        # Ensure dict structure for extra_data
        if not isinstance(extra_data, dict):
            extra_data = {}

        sent_reminders = extra_data.get("sent_reminders", [])
        if not isinstance(sent_reminders, list):
            sent_reminders = []

        should_update = False
        sent_any = False

        # Region A (1-day reminder): between 2 hours and 24 hours
        if timedelta(hours=2) < time_diff <= timedelta(hours=24):
            if "1d" not in sent_reminders:
                logger.info(f"⏰ GÖREV-8: Sending 1-day reminder to {appointment.customer_name} for appointment {appointment.public_id}")
                sent_any = await dispatch_reminders(appointment, db)
                sent_reminders.append("1d")
                should_update = True

        # Region B (1-hour reminder): between 45 minutes and 2 hours
        elif timedelta(minutes=45) < time_diff <= timedelta(hours=2):
            if "1h" not in sent_reminders:
                logger.info(f"⏰ GÖREV-8: Sending 1-hour reminder to {appointment.customer_name} for appointment {appointment.public_id}")
                sent_any = await dispatch_reminders(appointment, db)
                sent_reminders.append("1h")
                should_update = True

        # Region C (30-minute reminder): between 0 and 45 minutes
        elif timedelta(minutes=0) < time_diff <= timedelta(minutes=45):
            if "30m" not in sent_reminders:
                logger.info(f"⏰ GÖREV-8: Sending 30-minute reminder to {appointment.customer_name} for appointment {appointment.public_id}")
                sent_any = await dispatch_reminders(appointment, db)
                sent_reminders.append("30m")
                should_update = True

        if should_update:
            # Force dictionary copy for SQLAlchemy JSONB dirty tracking
            extra_data["sent_reminders"] = sent_reminders
            appointment.extra_data = dict(extra_data)
            
            if sent_any:
                appointment.reminder_sent = True
                appointment.reminder_sent_at = datetime.now(timezone.utc)
                sent_count += 1
            
            db.commit()

    return sent_count

async def start_reminder_scheduler():
    """Main background scheduler loop task."""
    global _scheduler_running
    _scheduler_running = True
    logger.info("⏰ Background Reminder Scheduler task started.")

    while _scheduler_running:
        db = SessionLocal()
        try:
            sent_count = await check_and_send_reminders(db)
            if sent_count > 0:
                logger.info(f"⏰ Checked reminders. Sent {sent_count} notifications.")
        except Exception as e:
            logger.error(f"❌ Error in reminder scheduler run: {e}", exc_info=True)
        finally:
            db.close()

        # Check every 60 seconds
        await asyncio.sleep(60)

async def stop_reminder_scheduler(task: asyncio.Task):
    """Stop the scheduler loop and cancel the task gracefully."""
    global _scheduler_running
    _scheduler_running = False
    logger.info("⏰ Stopping Background Reminder Scheduler...")
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    logger.info("⏰ Background Reminder Scheduler stopped.")
