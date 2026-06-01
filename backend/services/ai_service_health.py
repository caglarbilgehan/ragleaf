"""
AI Service Health Check System
Monitors AI service availability and updates database status
"""

import asyncio
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from ..database.connection import get_db
from ..database.models import AIProvider, Settings
from .huggingface_service import huggingface_service

logger = logging.getLogger(__name__)

class AIServiceHealthChecker:
    """Health checker for AI services"""
    
    def __init__(self):
        self.check_interval = 300  # 5 minutes
        self.timeout = 30  # 30 seconds timeout
        self.running = False
        
    async def check_provider_health(self, provider: AIProvider) -> Dict[str, Any]:
        """Check health of a specific AI provider (metadata only)"""
        try:
            # Basic health check - just verify provider exists and is configured
            is_healthy = bool(provider.name and provider.service_type)
            
            return {
                "provider_id": provider.id,
                "provider_name": provider.name,
                "is_healthy": is_healthy,
                "checked_at": datetime.now(),
                "error": None if is_healthy else "Provider not properly configured"
            }
                
        except Exception as e:
            logger.error(f"Health check failed for {provider.name}: {e}")
            return {
                "provider_id": provider.id,
                "provider_name": provider.name,
                "is_healthy": False,
                "checked_at": datetime.now(),
                "error": str(e)
            }
    
    async def check_all_providers(self) -> List[Dict[str, Any]]:
        """Check health of all AI providers (metadata only)"""
        db = next(get_db())
        
        try:
            # Get all AI providers
            providers = db.query(AIProvider).all()
            
            if not providers:
                logger.warning("No AI providers found in table")
                return []
            
            # Check each provider
            health_results = []
            for provider in providers:
                result = await self.check_provider_health(provider)
                health_results.append(result)
            
            # Log summary
            healthy_count = sum(1 for r in health_results if r["is_healthy"])
            total_count = len(health_results)
            logger.info(f"Health check completed: {healthy_count}/{total_count} providers healthy (metadata only)")
            
            return health_results
            
        except Exception as e:
            logger.error(f"Error during health check: {e}")
            return []
        finally:
            db.close()
    
    async def get_provider_metadata(self, provider_name: str) -> Dict[str, Any]:
        """Get provider metadata (status managed in settings)"""
        db = next(get_db())
        
        try:
            provider = db.query(AIProvider).filter(
                AIProvider.name == provider_name
            ).first()
            
            if provider:
                return {
                    "provider": provider,
                    "available": True,  # Actual availability checked in settings
                    "display_name": provider.display_name,
                    "service_type": provider.service_type,
                    "api_url": provider.api_url,
                    "config": provider.config
                }
            else:
                return {
                    "provider": None,
                    "available": False,
                    "error": f"No {provider_name} provider metadata found"
                }
                
        except Exception as e:
            logger.error(f"Error getting provider metadata for {provider_name}: {e}")
            return {
                "provider": None,
                "available": False,
                "error": str(e)
            }
        finally:
            db.close()
    
    async def start_monitoring(self):
        """Start continuous health monitoring"""
        self.running = True
        logger.info("AI Service health monitoring started")
        
        while self.running:
            try:
                await self.check_all_services()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in health monitoring loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retry
    
    def stop_monitoring(self):
        """Stop health monitoring"""
        self.running = False
        logger.info("AI Service health monitoring stopped")

# Global health checker instance
ai_service_health_checker = AIServiceHealthChecker()

async def get_provider_metadata_list() -> List[Dict[str, Any]]:
    """Get list of AI providers metadata (status checked in settings)"""
    db = next(get_db())
    
    try:
        providers = db.query(AIProvider).all()
        
        return [
            {
                "id": provider.id,
                "name": provider.name,
                "display_name": provider.display_name,
                "service_type": provider.service_type,
                "api_url": provider.api_url,
                "config": provider.config
            }
            for provider in providers
        ]
        
    except Exception as e:
        logger.error(f"Error getting providers metadata: {e}")
        return []
    finally:
        db.close()

async def ensure_service_availability():
    """Ensure at least one AI service is available - check settings table only"""
    try:
        db = next(get_db())
        
        # Check settings table (primary and only source for API keys)
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        
        if setting and isinstance(setting.value, list):
            services_data = setting.value
            
            # Filter active services with API keys
            active_services = [
                s for s in services_data 
                if (s.get('is_active', True) and 
                    s.get('is_available', True) and
                    s.get('api_key'))
            ]
            
            if active_services:
                logger.info(f"Available AI services from settings: {[s.get('display_name') for s in active_services]}")
                return True
        
        logger.error("No active AI services with API keys found in settings table")
        return False
        
    except Exception as e:
        logger.error(f"Error checking service availability: {e}")
        return False
    finally:
        db.close()
