"""
API Key Authentication for app-to-app communication
"""

from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.models.api_key import APIKey
from backend.models.user import User
from typing import Optional, List
import time
from datetime import datetime, timedelta
import redis
import json
import logging

logger = logging.getLogger(__name__)

# Redis for rate limiting (optional, fallback to in-memory)
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
    redis_client.ping()
    REDIS_AVAILABLE = True
except:
    REDIS_AVAILABLE = False
    # In-memory fallback
    rate_limit_cache = {}

class APIKeyBearer(HTTPBearer):
    """Custom HTTPBearer for API Key authentication"""
    
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        # Try Authorization header first
        credentials = await super().__call__(request)
        if credentials:
            return credentials
            
        # Try X-API-Key header
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return HTTPAuthorizationCredentials(scheme="Bearer", credentials=api_key)
            
        # Try query parameter (less secure, for testing only)
        api_key = request.query_params.get("api_key")
        if api_key:
            return HTTPAuthorizationCredentials(scheme="Bearer", credentials=api_key)
            
        if self.auto_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key required. Use Authorization: Bearer <key> or X-API-Key: <key>",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None

api_key_bearer = APIKeyBearer()

class APIKeyAuth:
    """API Key authentication and authorization"""
    
    def __init__(self, required_permissions: List[str] = None):
        self.required_permissions = required_permissions or ["chat:read"]

    def __call__(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(api_key_bearer),
        db: Session = Depends(get_db),
        request: Request = None
    ) -> tuple[APIKey, User]:
        """
        Authenticate and authorize API key
        Returns: (api_key, user)
        """
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key required"
            )

        api_key_value = credentials.credentials
        
        # Validate key format
        if not self._is_valid_key_format(api_key_value):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key format"
            )

        # Find API key in database
        api_key = db.query(APIKey).filter(
            APIKey.key_hash == APIKey.hash_key(api_key_value)
        ).first()

        if not api_key:
            logger.warning(f"Invalid API key attempted: {api_key_value[:20]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )

        # Check if key is valid
        if not api_key.is_valid():
            logger.warning(f"Expired/inactive API key used: {api_key.name}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key is expired or inactive"
            )

        # Check permissions
        for permission in self.required_permissions:
            if not api_key.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"API key lacks required permission: {permission}"
                )

        # Rate limiting
        self._check_rate_limit(api_key, request)

        # Get associated user
        user = db.query(User).filter(User.id == api_key.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Associated user not found"
            )

        # Update last used timestamp
        api_key.update_last_used()
        db.commit()

        logger.info(f"API key authenticated: {api_key.name} (User: {user.email})")
        return api_key, user

    def _is_valid_key_format(self, key: str) -> bool:
        """Validate API key format: mk_live_xxxxxxxx_... or mk_test_xxxxxxxx_..."""
        parts = key.split('_')
        return (
            len(parts) >= 4 and
            parts[0] == 'mk' and
            parts[1] in ['live', 'test'] and
            len(parts[2]) >= 8
        )

    def _check_rate_limit(self, api_key: APIKey, request: Request):
        """Check rate limiting for API key"""
        current_time = int(time.time())
        key_id = str(api_key.id)
        
        # Rate limit keys
        minute_key = f"rate_limit:minute:{key_id}:{current_time // 60}"
        day_key = f"rate_limit:day:{key_id}:{current_time // 86400}"
        
        if REDIS_AVAILABLE:
            # Redis-based rate limiting
            pipe = redis_client.pipeline()
            pipe.incr(minute_key)
            pipe.expire(minute_key, 60)
            pipe.incr(day_key)
            pipe.expire(day_key, 86400)
            results = pipe.execute()
            
            minute_count = results[0]
            day_count = results[2]
        else:
            # In-memory fallback
            minute_count = rate_limit_cache.get(minute_key, 0) + 1
            day_count = rate_limit_cache.get(day_key, 0) + 1
            
            rate_limit_cache[minute_key] = minute_count
            rate_limit_cache[day_key] = day_count
            
            # Clean old entries (simple cleanup)
            if len(rate_limit_cache) > 10000:
                old_keys = [k for k in rate_limit_cache.keys() 
                           if int(k.split(':')[-1]) < current_time - 86400]
                for k in old_keys:
                    rate_limit_cache.pop(k, None)

        # Check limits
        if minute_count > api_key.rate_limit_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {api_key.rate_limit_per_minute} requests per minute",
                headers={
                    "X-RateLimit-Limit": str(api_key.rate_limit_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str((current_time // 60 + 1) * 60)
                }
            )

        if day_count > api_key.rate_limit_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily rate limit exceeded: {api_key.rate_limit_per_day} requests per day",
                headers={
                    "X-RateLimit-Limit": str(api_key.rate_limit_per_day),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str((current_time // 86400 + 1) * 86400)
                }
            )

        # Add rate limit headers to response (will be added by middleware)
        if hasattr(request.state, 'rate_limit_headers'):
            request.state.rate_limit_headers.update({
                "X-RateLimit-Limit-Minute": str(api_key.rate_limit_per_minute),
                "X-RateLimit-Remaining-Minute": str(max(0, api_key.rate_limit_per_minute - minute_count)),
                "X-RateLimit-Limit-Day": str(api_key.rate_limit_per_day),
                "X-RateLimit-Remaining-Day": str(max(0, api_key.rate_limit_per_day - day_count))
            })
        else:
            request.state.rate_limit_headers = {
                "X-RateLimit-Limit-Minute": str(api_key.rate_limit_per_minute),
                "X-RateLimit-Remaining-Minute": str(max(0, api_key.rate_limit_per_minute - minute_count)),
                "X-RateLimit-Limit-Day": str(api_key.rate_limit_per_day),
                "X-RateLimit-Remaining-Day": str(max(0, api_key.rate_limit_per_day - day_count))
            }

# Convenience functions for different permission levels
def require_chat_read():
    """Require chat:read permission"""
    return APIKeyAuth(["chat:read"])

def require_chat_write():
    """Require chat:write permission"""
    return APIKeyAuth(["chat:write"])

def require_documents_read():
    """Require documents:read permission"""
    return APIKeyAuth(["documents:read"])

def require_admin():
    """Require admin permissions"""
    return APIKeyAuth(["admin:read", "admin:write"])

# Optional: Middleware to add rate limit headers to all responses
from fastapi import Response

async def add_rate_limit_headers(request: Request, call_next):
    """Middleware to add rate limit headers to responses"""
    response = await call_next(request)
    
    if hasattr(request.state, 'rate_limit_headers'):
        for header, value in request.state.rate_limit_headers.items():
            response.headers[header] = value
    
    return response