# backend/middleware/rate_limiter.py
"""
Redis-based rate limiting middleware for Ragleaf platform.
Applies per-agent rate limits for public API endpoints.
"""

import time
import logging
from typing import Optional
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)

# Redis client (lazy init)
_redis = None


def _get_redis():
    """Get Redis client with lazy initialization."""
    global _redis
    if _redis is None:
        try:
            import redis
            from decouple import config
            redis_url = config("REDIS_URL", default="redis://localhost:6379/0")
            _redis = redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=3)
            _redis.ping()
        except Exception as e:
            logger.warning(f"Redis not available for rate limiting: {e}")
            _redis = False  # Mark as unavailable
    return _redis if _redis is not False else None


async def check_rate_limit(
    agent_id: int,
    limit_per_minute: int = 20,
    limit_per_day: int = 500,
    identifier: Optional[str] = None
) -> dict:
    """
    Check rate limit for an agent.
    
    Args:
        agent_id: Agent ID
        limit_per_minute: Max requests per minute
        limit_per_day: Max requests per day
        identifier: Optional additional identifier (IP, session, etc.)
    
    Returns:
        Dict with rate limit info
    
    Raises:
        HTTPException 429 if rate limited
    """
    redis_client = _get_redis()
    
    if not redis_client:
        # No Redis = no rate limiting (graceful degradation)
        return {"limited": False, "reason": "redis_unavailable"}
    
    now = int(time.time())
    suffix = f":{identifier}" if identifier else ""
    
    # Minute window
    minute_key = f"rl:agent:{agent_id}:min:{now // 60}{suffix}"
    # Day window
    day_key = f"rl:agent:{agent_id}:day:{now // 86400}{suffix}"
    
    try:
        pipe = redis_client.pipeline()
        pipe.incr(minute_key)
        pipe.expire(minute_key, 120)  # 2 min TTL
        pipe.incr(day_key)
        pipe.expire(day_key, 172800)  # 2 day TTL
        results = pipe.execute()
        
        minute_count = results[0]
        day_count = results[2]
        
        # Check minute limit
        if minute_count > limit_per_minute:
            retry_after = 60 - (now % 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": f"Dakika limiti aşıldı ({limit_per_minute}/dk)",
                    "retry_after": retry_after,
                    "limit": limit_per_minute,
                    "window": "minute"
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        # Check daily limit
        if day_count > limit_per_day:
            retry_after = 86400 - (now % 86400)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": f"Günlük limit aşıldı ({limit_per_day}/gün)",
                    "retry_after": retry_after,
                    "limit": limit_per_day,
                    "window": "day"
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        return {
            "limited": False,
            "minute_remaining": limit_per_minute - minute_count,
            "day_remaining": limit_per_day - day_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Rate limit check error: {e}")
        return {"limited": False, "reason": "error"}
