# backend/services/enhanced_statistics_service.py
"""
Enhanced Statistics Service - Uses unified Statistics table
"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
import logging

from ..database.statistics_model import Statistics, StatCategory

logger = logging.getLogger(__name__)


class EnhancedStatisticsService:
    """Gelişmiş istatistik servisi - unified Statistics tablosu kullanır"""
    
    @staticmethod
    async def get_user_statistics(
        db: Session, 
        user_id: str, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """Kullanıcı bazlı istatistikleri al - Statistics tablosundan"""
        try:
            stats = db.query(Statistics).filter(
                Statistics.category == StatCategory.REQUEST,
                Statistics.timestamp >= start_date,
                Statistics.timestamp <= end_date
            ).all()
            
            # Filter by user_id from data
            user_stats = []
            for stat in stats:
                data = stat.get_data()
                if data.get("user_id") == user_id:
                    user_stats.append((stat, data))
            
            if not user_stats:
                return {
                    "total_requests": 0,
                    "total_tokens": 0,
                    "avg_response_time": 0.0,
                    "by_model": {},
                    "success_rate": 100.0
                }
            
            total_requests = len(user_stats)
            total_tokens = sum(d.get("tokens", 0) for _, d in user_stats)
            total_duration = sum(d.get("duration", 0) for _, d in user_stats)
            successful = sum(1 for _, d in user_stats if d.get("success", True))
            
            by_model = {}
            for _, data in user_stats:
                model = data.get("model", "unknown")
                by_model[model] = by_model.get(model, 0) + 1
            
            return {
                "total_requests": total_requests,
                "total_tokens": total_tokens,
                "avg_response_time": round(total_duration / total_requests, 3) if total_requests > 0 else 0,
                "by_model": by_model,
                "success_rate": round((successful / total_requests * 100) if total_requests > 0 else 100, 2)
            }
            
        except Exception as e:
            logger.error(f"Error getting user statistics for {user_id}: {e}")
            return {"total_requests": 0, "total_tokens": 0, "avg_response_time": 0.0, "by_model": {}, "success_rate": 100.0}
    
    @staticmethod
    async def get_system_statistics(
        db: Session, 
        start_date: datetime, 
        end_date: datetime,
        mode: str = "all"
    ) -> Dict[str, Any]:
        """Sistem geneli istatistikleri al - Statistics tablosundan"""
        try:
            stats = db.query(Statistics).filter(
                Statistics.category == StatCategory.REQUEST,
                Statistics.timestamp >= start_date,
                Statistics.timestamp <= end_date
            ).all()
            
            total_requests = len(stats)
            total_tokens = 0
            total_duration = 0.0
            successful = 0
            rag_count = 0
            chat_count = 0
            
            for stat in stats:
                data = stat.get_data()
                total_tokens += data.get("tokens", 0)
                total_duration += data.get("duration", 0)
                if data.get("success", True):
                    successful += 1
                if data.get("mode") == "rag":
                    rag_count += 1
                else:
                    chat_count += 1
            
            # Mode filter
            if mode == "rag":
                total_requests = rag_count
            elif mode == "chat":
                total_requests = chat_count
            
            return {
                "total_requests": total_requests,
                "total_tokens": total_tokens,
                "avg_response_time": round(total_duration / len(stats), 3) if stats else 0,
                "success_rate": round((successful / len(stats) * 100) if stats else 100, 2),
                "rag_vs_chat": {"rag": rag_count, "chat": chat_count},
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "mode": mode
            }
            
        except Exception as e:
            logger.error(f"Error getting system statistics: {e}")
            return {
                "total_requests": 0,
                "total_tokens": 0,
                "avg_response_time": 0.0,
                "success_rate": 100.0,
                "rag_vs_chat": {"rag": 0, "chat": 0},
                "mode": mode
            }
    
    @staticmethod
    async def log_huggingface_usage(
        db: Session,
        model_name: str,
        tokens_used: int,
        compute_time: float,
        status_code: int,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None
    ):
        """HuggingFace API kullanımını logla - Statistics tablosuna"""
        try:
            stat = Statistics(
                category=StatCategory.USAGE,
                key="huggingface",
                value=str(compute_time),
                data=json.dumps({
                    "model": model_name,
                    "tokens": tokens_used,
                    "compute_time": compute_time,
                    "status_code": status_code,
                    "success": 200 <= status_code < 300,
                    "user_id": user_id,
                    "conversation_id": conversation_id,
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False),
                timestamp=datetime.utcnow()
            )
            db.add(stat)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error logging HuggingFace usage: {e}")
    
    @staticmethod
    async def get_top_users_by_activity(
        db: Session, 
        start_date: datetime, 
        end_date: datetime,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """En aktif kullanıcıları al - Statistics tablosundan"""
        try:
            stats = db.query(Statistics).filter(
                Statistics.category == StatCategory.REQUEST,
                Statistics.timestamp >= start_date,
                Statistics.timestamp <= end_date
            ).all()
            
            user_activity = {}
            for stat in stats:
                data = stat.get_data()
                user_id = data.get("user_id", "unknown")
                if user_id not in user_activity:
                    user_activity[user_id] = {"requests": 0, "tokens": 0}
                user_activity[user_id]["requests"] += 1
                user_activity[user_id]["tokens"] += data.get("tokens", 0)
            
            # Sort by requests
            sorted_users = sorted(user_activity.items(), key=lambda x: x[1]["requests"], reverse=True)[:limit]
            
            return [
                {
                    "user_id": user_id,
                    "total_requests": data["requests"],
                    "total_tokens": data["tokens"]
                }
                for user_id, data in sorted_users
            ]
            
        except Exception as e:
            logger.error(f"Error getting top users: {e}")
            return []
