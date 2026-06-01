"""
AI Service Statistics Service
Uses unified Statistics table for all tracking
"""

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
import logging

from ..database.statistics_model import Statistics, StatCategory

logger = logging.getLogger(__name__)


class AIServiceStatisticsService:
    """AI Service istatistik yönetimi - unified Statistics tablosu kullanır"""
    
    @staticmethod
    def record_api_request(
        db: Session,
        provider_name: str,
        model_name: str,
        success: bool = True,
        tokens_used: int = 0,
        response_time: float = 0.0,
        user_id: Optional[str] = None
    ):
        """API isteği kaydı - Statistics tablosuna yazar"""
        try:
            stat = Statistics(
                category=StatCategory.REQUEST,
                key="api_request",
                value=str(response_time),
                data=json.dumps({
                    "provider": provider_name,
                    "model": model_name,
                    "success": success,
                    "tokens": tokens_used,
                    "duration": response_time,
                    "user_id": user_id,
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False),
                timestamp=datetime.utcnow()
            )
            db.add(stat)
            db.commit()
        except Exception as e:
            logger.error(f"Error recording API request: {e}")
            db.rollback()
    
    @staticmethod
    def get_service_statistics(
        db: Session,
        days: int = 7,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Statistics tablosundan AI servis istatistiklerini al"""
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            stats = db.query(Statistics).filter(
                Statistics.category == StatCategory.REQUEST,
                Statistics.timestamp >= start_date
            ).order_by(Statistics.timestamp.desc()).limit(limit).all()
            
            result = []
            for stat in stats:
                data = stat.get_data()
                result.append({
                    "id": stat.id,
                    "provider": data.get("provider"),
                    "model": data.get("model"),
                    "success": data.get("success", True),
                    "tokens": data.get("tokens", 0),
                    "duration": data.get("duration", 0),
                    "timestamp": stat.timestamp.isoformat() if stat.timestamp else None
                })
            
            return result
        except Exception as e:
            logger.error(f"Error getting service statistics: {e}")
            return []
    
    @staticmethod
    def get_service_summary(db: Session, days: int = 7) -> Dict[str, Any]:
        """AI Service özet istatistikleri - Statistics tablosundan"""
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            stats = db.query(Statistics).filter(
                Statistics.category == StatCategory.REQUEST,
                Statistics.timestamp >= start_date
            ).all()
            
            total_requests = len(stats)
            successful = 0
            total_tokens = 0
            total_duration = 0.0
            by_provider = {}
            by_model = {}
            
            for stat in stats:
                data = stat.get_data()
                
                if data.get("success", True):
                    successful += 1
                
                total_tokens += data.get("tokens", 0)
                total_duration += data.get("duration", 0)
                
                provider = data.get("provider", "unknown")
                by_provider[provider] = by_provider.get(provider, 0) + 1
                
                model = data.get("model", "unknown")
                by_model[model] = by_model.get(model, 0) + 1
            
            return {
                "period_days": days,
                "summary": {
                    "total_requests": total_requests,
                    "successful_requests": successful,
                    "failed_requests": total_requests - successful,
                    "success_rate": round((successful / total_requests * 100) if total_requests > 0 else 0, 2),
                    "total_tokens": total_tokens,
                    "avg_response_time": round(total_duration / total_requests, 3) if total_requests > 0 else 0
                },
                "by_provider": by_provider,
                "by_model": by_model,
                "top_models": sorted(by_model.items(), key=lambda x: x[1], reverse=True)[:5]
            }
        except Exception as e:
            logger.error(f"Error getting service summary: {e}")
            return {
                "period_days": days,
                "summary": {},
                "by_provider": {},
                "by_model": {},
                "top_models": []
            }
    
    @staticmethod
    def record_huggingface_usage(
        db: Session,
        model_name: str,
        tokens_used: int = 0,
        request_duration: float = 0.0,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """HuggingFace kullanım kaydı - Statistics tablosuna"""
        try:
            stat = Statistics(
                category=StatCategory.USAGE,
                key="huggingface",
                value=str(request_duration),
                data=json.dumps({
                    "model": model_name,
                    "tokens": tokens_used,
                    "duration": request_duration,
                    "success": success,
                    "error": error_message,
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False),
                timestamp=datetime.utcnow()
            )
            db.add(stat)
            db.commit()
        except Exception as e:
            logger.error(f"Error recording HuggingFace usage: {e}")
            db.rollback()
    
    @staticmethod
    def get_huggingface_usage_summary(db: Session, days: int = 7) -> Dict[str, Any]:
        """HuggingFace kullanım özeti - Statistics tablosundan"""
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            stats = db.query(Statistics).filter(
                Statistics.category == StatCategory.USAGE,
                Statistics.key == "huggingface",
                Statistics.timestamp >= start_date
            ).all()
            
            total_requests = len(stats)
            successful = 0
            total_tokens = 0
            total_duration = 0.0
            by_model = {}
            
            for stat in stats:
                data = stat.get_data()
                
                if data.get("success", True):
                    successful += 1
                
                total_tokens += data.get("tokens", 0)
                total_duration += data.get("duration", 0)
                
                model = data.get("model", "unknown")
                if model not in by_model:
                    by_model[model] = {"requests": 0, "tokens": 0, "successful": 0}
                by_model[model]["requests"] += 1
                by_model[model]["tokens"] += data.get("tokens", 0)
                if data.get("success", True):
                    by_model[model]["successful"] += 1
            
            return {
                "period_days": days,
                "summary": {
                    "total_requests": total_requests,
                    "successful_requests": successful,
                    "success_rate": round((successful / total_requests * 100) if total_requests > 0 else 0, 2),
                    "total_tokens": total_tokens,
                    "avg_request_duration": round(total_duration / total_requests, 3) if total_requests > 0 else 0
                },
                "model_usage": [
                    {
                        "model_name": model,
                        "requests": data["requests"],
                        "tokens": data["tokens"],
                        "success_rate": round((data["successful"] / data["requests"] * 100) if data["requests"] > 0 else 0, 2)
                    }
                    for model, data in sorted(by_model.items(), key=lambda x: x[1]["requests"], reverse=True)[:10]
                ]
            }
        except Exception as e:
            logger.error(f"Error getting HuggingFace usage summary: {e}")
            return {
                "period_days": days,
                "summary": {},
                "model_usage": []
            }
