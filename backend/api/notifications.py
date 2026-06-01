"""
System Notifications API
Manages admin notifications for system events
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from ..database.connection import get_db
from ..database.models import Settings
from ..auth.dependencies import get_current_admin_user

logger = logging.getLogger(__name__)

notifications_router = APIRouter()

NOTIFICATIONS_KEY = "system_notifications"


class NotificationResponse(BaseModel):
    id: int
    type: str  # error, warning, info, success
    title: str
    message: str
    created_at: str
    read: bool


class MarkReadRequest(BaseModel):
    notification_ids: List[int]


def get_notifications(db: Session) -> List[dict]:
    """Get all notifications from settings"""
    setting = db.query(Settings).filter(Settings.key == NOTIFICATIONS_KEY).first()
    if setting and isinstance(setting.value, list):
        return setting.value
    return []


def save_notifications(db: Session, notifications: List[dict]):
    """Save notifications to settings"""
    setting = db.query(Settings).filter(Settings.key == NOTIFICATIONS_KEY).first()
    
    if setting:
        setting.value = notifications
        flag_modified(setting, 'value')
    else:
        setting = Settings(
            key=NOTIFICATIONS_KEY,
            value=notifications,
            description="System notifications for admins"
        )
        db.add(setting)
    
    db.commit()


@notifications_router.get("/")
async def get_all_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Get all notifications"""
    try:
        notifications = get_notifications(db)
        
        if unread_only:
            notifications = [n for n in notifications if not n.get("read", False)]
        
        # Sort by created_at descending
        notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "success": True,
            "notifications": notifications[:limit],
            "total": len(notifications),
            "unread_count": len([n for n in notifications if not n.get("read", False)])
        }
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.get("/unread-count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Get count of unread notifications"""
    try:
        notifications = get_notifications(db)
        unread_count = len([n for n in notifications if not n.get("read", False)])
        
        return {
            "success": True,
            "unread_count": unread_count
        }
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.post("/mark-read")
async def mark_notifications_read(
    request: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Mark notifications as read"""
    try:
        notifications = get_notifications(db)
        
        for notification in notifications:
            if notification.get("id") in request.notification_ids:
                notification["read"] = True
                notification["read_at"] = datetime.utcnow().isoformat()
        
        save_notifications(db, notifications)
        
        return {
            "success": True,
            "message": f"Marked {len(request.notification_ids)} notifications as read"
        }
    except Exception as e:
        logger.error(f"Error marking notifications read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.post("/mark-all-read")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Mark all notifications as read"""
    try:
        notifications = get_notifications(db)
        
        count = 0
        for notification in notifications:
            if not notification.get("read", False):
                notification["read"] = True
                notification["read_at"] = datetime.utcnow().isoformat()
                count += 1
        
        save_notifications(db, notifications)
        
        return {
            "success": True,
            "message": f"Marked {count} notifications as read"
        }
    except Exception as e:
        logger.error(f"Error marking all notifications read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete a notification"""
    try:
        notifications = get_notifications(db)
        
        original_count = len(notifications)
        notifications = [n for n in notifications if n.get("id") != notification_id]
        
        if len(notifications) == original_count:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        save_notifications(db, notifications)
        
        return {
            "success": True,
            "message": "Notification deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.delete("/")
async def clear_all_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Clear all notifications"""
    try:
        save_notifications(db, [])
        
        return {
            "success": True,
            "message": "All notifications cleared"
        }
    except Exception as e:
        logger.error(f"Error clearing notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.post("/test")
async def create_test_notification(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin_user)
):
    """Create a test notification (for development)"""
    try:
        notifications = get_notifications(db)
        
        max_id = max([n.get("id", 0) for n in notifications], default=0)
        
        test_notification = {
            "id": max_id + 1,
            "type": "info",
            "title": "Test Bildirimi",
            "message": "Bu bir test bildirimidir. Sistem düzgün çalışıyor.",
            "created_at": datetime.utcnow().isoformat(),
            "read": False
        }
        
        notifications.insert(0, test_notification)
        save_notifications(db, notifications)
        
        return {
            "success": True,
            "notification": test_notification
        }
    except Exception as e:
        logger.error(f"Error creating test notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))
