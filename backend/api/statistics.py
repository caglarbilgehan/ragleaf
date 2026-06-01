"""
New Statistics API - Using unified statistics table
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import json
import logging

logger = logging.getLogger(__name__)

from ..database.connection import get_db
from ..database.statistics_model import Statistics
from ..auth.dependencies import get_current_admin_user

statistics_router = APIRouter()

class StatsSummary(BaseModel):
    total_requests: int
    avg_duration: float
    total_tokens: int
    success_rate: float
    period_days: int

@statistics_router.get("/summary")
async def get_statistics_summary(
    days: int = Query(7, description="Number of days to look back"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get overall statistics summary"""
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Get request statistics
        request_stats = db.query(Statistics).filter(
            Statistics.category == 'request',
            Statistics.timestamp >= start_date
        ).all()
        
        if not request_stats:
            return {
                "total_requests": 0,
                "avg_duration": 0,
                "total_tokens": 0,
                "success_rate": 100,
                "period_days": days,
                "by_mode": {"chat": 0, "rag": 0},
                "by_model": {}
            }
        
        total_requests = len(request_stats)
        total_duration = 0
        total_tokens = 0
        successful = 0
        by_mode = {"chat": 0, "rag": 0}
        by_model = {}
        
        for stat in request_stats:
            # Parse data (was extra_data)
            try:
                extra = stat.get_data() if hasattr(stat, 'get_data') else (json.loads(stat.data) if stat.data else {})
                
                # Duration
                total_duration += float(stat.value)
                
                # Tokens
                if 'tokens' in extra:
                    total_tokens += extra['tokens']
                
                # Success
                if extra.get('success', True):
                    successful += 1
                
                # By mode
                mode = extra.get('mode', 'chat')
                by_mode[mode] = by_mode.get(mode, 0) + 1
                
                # By model
                model = extra.get('model', 'unknown')
                by_model[model] = by_model.get(model, 0) + 1
                
            except Exception as e:
                logger.warning(f"Error parsing stat: {e}")
                continue
        
        return {
            "total_requests": total_requests,
            "avg_duration": round(total_duration / total_requests, 2) if total_requests > 0 else 0,
            "total_tokens": total_tokens,
            "success_rate": round((successful / total_requests) * 100, 2) if total_requests > 0 else 100,
            "period_days": days,
            "by_mode": by_mode,
            "by_model": by_model
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@statistics_router.get("/performance")
async def get_performance_stats(
    days: int = Query(7, description="Number of days to look back"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get performance statistics"""
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        perf_stats = db.query(Statistics).filter(
            Statistics.category == 'performance',
            Statistics.timestamp >= start_date
        ).all()
        
        operations = {}
        
        for stat in perf_stats:
            try:
                extra = stat.get_data() if hasattr(stat, 'get_data') else {}
                operation = stat.key
                
                if operation not in operations:
                    operations[operation] = {
                        "count": 0,
                        "total_duration": 0,
                        "avg_duration": 0
                    }
                
                operations[operation]["count"] += 1
                operations[operation]["total_duration"] += float(stat.value)
                
            except Exception as e:
                logger.warning(f"Error parsing performance stat: {e}")
                continue
        
        # Calculate averages
        for op in operations:
            count = operations[op]["count"]
            if count > 0:
                operations[op]["avg_duration"] = round(
                    operations[op]["total_duration"] / count, 3
                )
        
        return {
            "period_days": days,
            "operations": operations
        }
        
    except Exception as e:
        logger.error(f"Error getting performance stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@statistics_router.get("/timeline")
async def get_timeline_stats(
    days: int = Query(7, description="Number of days to look back"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get timeline statistics (hourly breakdown)"""
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Get all request stats
        stats = db.query(Statistics).filter(
            Statistics.category == 'request',
            Statistics.timestamp >= start_date
        ).order_by(Statistics.timestamp.asc()).all()
        
        # Group by hour
        hourly = {}
        
        for stat in stats:
            try:
                hour_key = stat.timestamp.strftime('%Y-%m-%d %H:00')
                
                if hour_key not in hourly:
                    hourly[hour_key] = {
                        "timestamp": hour_key,
                        "requests": 0,
                        "avg_duration": 0,
                        "total_duration": 0
                    }
                
                hourly[hour_key]["requests"] += 1
                # Safely convert value to float
                try:
                    duration = float(stat.value) if stat.value else 0
                    hourly[hour_key]["total_duration"] += duration
                except (ValueError, TypeError):
                    pass
            except Exception as e:
                logger.warning(f"Error processing stat: {e}")
                continue
        
        # Calculate averages
        timeline = []
        for hour_key in sorted(hourly.keys()):
            data = hourly[hour_key]
            data["avg_duration"] = round(
                data["total_duration"] / data["requests"], 2
            ) if data["requests"] > 0 else 0
            del data["total_duration"]
            timeline.append(data)
        
        return {
            "period_days": days,
            "timeline": timeline
        }
        
    except Exception as e:
        logger.error(f"Error getting timeline stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@statistics_router.get("/errors")
async def get_error_stats(
    days: int = Query(7, description="Number of days to look back"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get error statistics"""
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        error_stats = db.query(Statistics).filter(
            Statistics.category == 'error',
            Statistics.timestamp >= start_date
        ).all()
        
        errors_by_type = {}
        
        for stat in error_stats:
            try:
                error_type = stat.key or "unknown"
                
                if error_type not in errors_by_type:
                    errors_by_type[error_type] = {
                        "count": 0,
                        "recent_messages": []
                    }
                
                errors_by_type[error_type]["count"] += 1
                
                # Keep last 5 error messages
                if len(errors_by_type[error_type]["recent_messages"]) < 5:
                    errors_by_type[error_type]["recent_messages"].append({
                        "message": stat.value or "No message",
                        "timestamp": stat.timestamp.isoformat() if stat.timestamp else datetime.now().isoformat()
                    })
            except Exception as e:
                logger.warning(f"Error processing error stat: {e}")
                continue
        
        return {
            "period_days": days,
            "total_errors": len(error_stats),
            "errors_by_type": errors_by_type
        }
        
    except Exception as e:
        logger.error(f"Error getting error stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
