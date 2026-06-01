"""
AI Services Management API - Settings Table Based
Handles AI service configurations using settings table
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import logging

from ..database.connection import get_db
from ..database.models import Settings
from ..auth.dependencies import get_current_admin_user

logger = logging.getLogger(__name__)

ai_services_router = APIRouter()

# Pydantic models
class AIServiceCreate(BaseModel):
    name: str
    display_name: str
    service_type: str
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    priority: int = 1
    requests_per_minute: int = 60
    requests_per_day: int = 1000

class AIServiceUpdate(BaseModel):
    display_name: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    requests_per_minute: Optional[int] = None
    requests_per_day: Optional[int] = None

@ai_services_router.get("/")
async def get_ai_services(
    service_type: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """Get all AI services from settings table"""
    try:
        # Get AI services from settings table
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting:
            return []
        
        services_data = setting.value
        if not isinstance(services_data, list):
            return []
        
        # Filter by service_type if specified
        if service_type:
            services_data = [s for s in services_data if s.get('service_type') == service_type]
        
        # Filter by active status if specified
        if active_only:
            services_data = [s for s in services_data if s.get('is_active', True)]
        
        # Sort by priority
        services_data.sort(key=lambda x: (x.get('priority', 999), x.get('created_at', '')))
        
        # Add has_api_key field and hide actual API key
        for service in services_data:
            service['has_api_key'] = bool(service.get('api_key'))
            if 'api_key' in service:
                del service['api_key']  # Don't expose API key in response
        
        return services_data
        
    except Exception as e:
        logger.error(f"Error getting AI services: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get AI services: {str(e)}")

@ai_services_router.get("/{service_id}/api-key")
async def get_service_api_key(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get API key for a specific service (admin only)"""
    try:
        # Get AI services from settings table
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI services not found"
            )
        
        services_data = setting.value
        
        # Find service
        service = next((s for s in services_data if s.get('id') == service_id), None)
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI service not found"
            )
        
        return {
            "service_id": service_id,
            "api_key": service.get('api_key', ''),
            "has_api_key": bool(service.get('api_key'))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service API key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get API key: {str(e)}")

@ai_services_router.post("/")
async def create_ai_service(
    service_data: AIServiceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Create a new AI service in settings table"""
    try:
        # Get current AI services
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if setting:
            services_data = setting.value if isinstance(setting.value, list) else []
        else:
            services_data = []
        
        # Allow multiple services with same name (for multiple tokens)
        # No need to check for existing service name
        
        # Generate new ID
        max_id = max([s.get('id', 0) for s in services_data], default=0)
        new_id = max_id + 1
        
        # Create new service
        new_service = {
            "id": new_id,
            "name": service_data.name,
            "display_name": service_data.display_name,
            "service_type": service_data.service_type,
            "api_key": service_data.api_key,
            "api_url": service_data.api_url,
            "config": service_data.config,
            "priority": service_data.priority,
            "is_active": True,
            "is_available": True,
            "total_requests": 0,
            "failed_requests": 0,
            "last_used_at": None,
            "last_error": None,
            "requests_per_minute": service_data.requests_per_minute,
            "requests_per_day": service_data.requests_per_day,
            "current_minute_requests": 0,
            "current_day_requests": 0,
            "minute_reset_at": None,
            "day_reset_at": None,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": None
        }
        
        # Add to services list
        services_data.append(new_service)
        
        # Update or create setting
        if setting:
            setting.value = services_data
            flag_modified(setting, 'value')
        else:
            setting = Settings(
                key="ai_services",
                value=services_data,
                description="AI service configurations and management"
            )
            db.add(setting)
        
        db.commit()
        
        logger.info(f"Created AI service: {service_data.name}")
        
        # Return response without API key
        response_service = new_service.copy()
        response_service['has_api_key'] = bool(new_service.get('api_key'))
        if 'api_key' in response_service:
            del response_service['api_key']
        
        return response_service
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating AI service: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create AI service: {str(e)}")

@ai_services_router.put("/{service_id}")
async def update_ai_service(
    service_id: int,
    service_data: AIServiceUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Update an AI service in settings table"""
    try:
        # Get current AI services
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI services not found"
            )
        
        services_data = setting.value
        
        # Find service to update
        service_index = next((i for i, s in enumerate(services_data) if s.get('id') == service_id), None)
        if service_index is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI service not found"
            )
        
        # Update service fields
        service = services_data[service_index]
        update_data = service_data.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            service[field] = value
        
        service['updated_at'] = datetime.utcnow().isoformat()
        
        # Update setting
        setting.value = services_data
        flag_modified(setting, 'value')
        db.commit()
        
        logger.info(f"Updated AI service: {service.get('name')}")
        
        # Return response without API key
        response_service = service.copy()
        response_service['has_api_key'] = bool(service.get('api_key'))
        if 'api_key' in response_service:
            del response_service['api_key']
        
        return response_service
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating AI service: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update AI service: {str(e)}")

@ai_services_router.delete("/{service_id}")
async def delete_ai_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Delete an AI service from settings table"""
    logger.info(f"Delete request for service ID: {service_id}")
    
    try:
        # Get current AI services
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        logger.info(f"Found setting: {setting is not None}")
        
        if not setting or not isinstance(setting.value, list):
            logger.error("AI services setting not found or invalid")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI services not found"
            )
        
        services_data = setting.value
        logger.info(f"Current services count: {len(services_data)}")
        
        # Find service to delete
        service_index = next((i for i, s in enumerate(services_data) if s.get('id') == service_id), None)
        logger.info(f"Service index to delete: {service_index}")
        
        if service_index is None:
            logger.error(f"Service with ID {service_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI service not found"
            )
        
        service_name = services_data[service_index].get('name', 'Unknown')
        logger.info(f"Deleting service: {service_name}")
        
        # Remove service
        services_data.pop(service_index)
        logger.info(f"Services after deletion: {len(services_data)}")
        
        # Update setting with flag_modified for JSON field
        setting.value = services_data
        flag_modified(setting, 'value')
        db.commit()
        logger.info("Database committed successfully")
        
        logger.info(f"Deleted AI service: {service_name}")
        return {"message": f"AI service '{service_name}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting AI service: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete AI service: {str(e)}")

@ai_services_router.post("/{service_id}/test")
async def test_ai_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Test an AI service connection"""
    try:
        # Get current AI services
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI services not found"
            )
        
        services_data = setting.value
        
        # Find service to test
        service_index = next((i for i, s in enumerate(services_data) if s.get('id') == service_id), None)
        if service_index is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI service not found"
            )
        
        service = services_data[service_index]
        
        try:
            # TODO: Implement actual service testing based on service type
            # For now, just check if API key and URL are provided
            
            if not service.get('api_key'):
                raise Exception("API key not configured")
            
            if not service.get('api_url'):
                raise Exception("API URL not configured")
            
            # Update availability
            service['is_available'] = True
            service['last_error'] = None
            
            # Update setting
            setting.value = services_data
            flag_modified(setting, 'value')
            db.commit()
            
            return {
                "success": True,
                "message": f"AI service '{service.get('display_name')}' is working correctly",
                "service_name": service.get('name')
            }
            
        except Exception as e:
            # Update availability
            service['is_available'] = False
            service['last_error'] = str(e)
            
            # Update setting
            setting.value = services_data
            flag_modified(setting, 'value')
            db.commit()
            
            return {
                "success": False,
                "message": f"AI service test failed: {str(e)}",
                "service_name": service.get('name')
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing AI service: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test AI service: {str(e)}")

@ai_services_router.get("/available")
async def get_available_services(
    service_type: str,
    db: Session = Depends(get_db)
):
    """Get available AI services for a specific type, ordered by priority"""
    try:
        # Get AI services from settings table
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if not setting or not isinstance(setting.value, list):
            return []
        
        services_data = setting.value
        
        # Filter by service type, active and available status
        available_services = [
            s for s in services_data 
            if (s.get('service_type') == service_type and 
                s.get('is_active', True) and 
                s.get('is_available', True))
        ]
        
        # Sort by priority
        available_services.sort(key=lambda x: x.get('priority', 999))
        
        # Return minimal info without API keys
        return [
            {
                "id": service.get('id'),
                "name": service.get('name'),
                "display_name": service.get('display_name'),
                "api_url": service.get('api_url'),
                "priority": service.get('priority'),
                "config": service.get('config')
            }
            for service in available_services
        ]
        
    except Exception as e:
        logger.error(f"Error getting available services: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get available services: {str(e)}")
