# backend/services/statistics_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from datetime import datetime, timedelta
from typing import Dict, List, Any
from ..database.models import ModelConfig

class StatisticsService:
    """Statistics service - now returns mock data since conversations are in MongoDB"""
    
    @staticmethod
    async def get_real_conversation_count(db: Session, start_date: datetime, end_date: datetime, mode: str) -> int:
        """Get conversation count - returns mock data since conversations are in MongoDB"""
        return 0
    
    @staticmethod
    async def get_real_message_count(db: Session, start_date: datetime, end_date: datetime, mode: str) -> int:
        """Get message count - returns mock data since messages are in MongoDB"""
        return 0
    
    @staticmethod
    async def get_real_avg_tokens_sent(db: Session, start_date: datetime, end_date: datetime, mode: str) -> float:
        """Get average tokens sent - returns mock data since messages are in MongoDB"""
        return 0.0
    
    @staticmethod
    async def get_real_avg_tokens_received(db: Session, start_date: datetime, end_date: datetime, mode: str) -> float:
        """Get average tokens received - returns mock data since messages are in MongoDB"""
        return 0.0
    
    @staticmethod
    async def get_real_avg_response_time(db: Session, start_date: datetime, end_date: datetime, mode: str) -> float:
        """Get average response time - returns mock data since messages are in MongoDB"""
        return 0.0
    
    @staticmethod
    async def get_real_avg_processing_time(db: Session, start_date: datetime, end_date: datetime, mode: str) -> float:
        """Get average processing time - returns mock data since messages are in MongoDB"""
        return 0.0
    
    @staticmethod
    async def generate_real_hourly_stats(db: Session, start_date: datetime, end_date: datetime, mode: str) -> List[Dict[str, Any]]:
        """Generate hourly statistics - returns mock data since conversations are in MongoDB"""
        stats = []
        
        # Generate hourly buckets with mock data
        current = start_date.replace(minute=0, second=0, microsecond=0)
        while current <= end_date:
            stats.append({
                "hour": current.strftime("%Y-%m-%d %H:00"),
                "conversations": 0,
                "messages": 0,
                "avg_messages_per_conversation": 0
            })
            
            current = current + timedelta(hours=1)
        
        return stats
    
    @staticmethod
    async def generate_real_daily_stats(db: Session, start_date: datetime, end_date: datetime, mode: str) -> List[Dict[str, Any]]:
        """Generate daily statistics - returns mock data since conversations are in MongoDB"""
        stats = []
        
        current = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        while current <= end_date:
            stats.append({
                "timestamp": current.isoformat(),
                "conversations": 0,
                "messages": 0,
                "avg_response_time": 0.0
            })
            
            current = current + timedelta(days=1)
        
        return stats
