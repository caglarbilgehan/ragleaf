"""
Simple Statistics Service
Unified logging for all metrics
"""
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from ..database.statistics_model import Statistics

logger = logging.getLogger(__name__)

class SimpleStatisticsService:
    """Simple unified statistics service"""
    
    @staticmethod
    def log(
        db: Session,
        category: str,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log any statistic with flexible key-value design
        
        Categories:
        - request: API request metrics
        - token: Token usage
        - performance: Timing and performance
        - error: Error tracking
        - model: Model usage
        - rag: RAG-specific metrics
        """
        try:
            # Convert value to string if needed
            if isinstance(value, (dict, list)):
                value_str = json.dumps(value)
            else:
                value_str = str(value)
            
            logger.info(f"📊 Creating statistic: category={category}, key={key}, value={value_str[:50]}")
            
            stat = Statistics(
                category=category,
                key=key,
                value=value_str,
                data=json.dumps(metadata, ensure_ascii=False) if metadata else None
            )
            
            db.add(stat)
            db.commit()
            logger.info(f"✅ Statistic saved with id={stat.id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to log statistic: {e}")
            import traceback
            logger.error(traceback.format_exc())
            db.rollback()
    
    @staticmethod
    def log_request(
        db: Session,
        model_name: str,
        mode: str,
        duration: float,
        tokens_used: Optional[int] = None,
        success: bool = True,
        error: Optional[str] = None,
        query: Optional[str] = None
    ):
        """Log a chat request with all metrics"""
        metadata = {
            "model": model_name,
            "mode": mode,
            "duration": duration,
            "success": success,
            "timestamp": datetime.now().isoformat()
        }
        
        if tokens_used:
            metadata["tokens"] = tokens_used
        
        if error:
            metadata["error"] = error
        
        if query:
            # Store first 500 chars of query for analysis
            metadata["query"] = query[:500] if len(query) > 500 else query
        
        SimpleStatisticsService.log(
            db=db,
            category="request",
            key=f"{mode}_request",
            value=duration,
            metadata=metadata
        )
    
    @staticmethod
    def log_performance(
        db: Session,
        operation: str,
        duration: float,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log performance metrics"""
        metadata = {
            "operation": operation,
            "duration": duration,
            "timestamp": datetime.now().isoformat()
        }
        
        if details:
            metadata.update(details)
        
        SimpleStatisticsService.log(
            db=db,
            category="performance",
            key=operation,
            value=duration,
            metadata=metadata
        )
    
    @staticmethod
    def log_token_usage(
        db: Session,
        model_name: str,
        provider: str,
        tokens: int,
        cost: Optional[float] = None
    ):
        """Log token usage"""
        metadata = {
            "model": model_name,
            "provider": provider,
            "tokens": tokens,
            "timestamp": datetime.now().isoformat()
        }
        
        if cost:
            metadata["cost"] = cost
        
        SimpleStatisticsService.log(
            db=db,
            category="token",
            key=f"{provider}_tokens",
            value=tokens,
            metadata=metadata
        )
    
    @staticmethod
    def log_error(
        db: Session,
        error_type: str,
        error_message: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """Log errors"""
        metadata = {
            "error_type": error_type,
            "message": error_message,
            "timestamp": datetime.now().isoformat()
        }
        
        if context:
            metadata.update(context)
        
        SimpleStatisticsService.log(
            db=db,
            category="error",
            key=error_type,
            value=error_message,
            metadata=metadata
        )

# Global instance
simple_stats = SimpleStatisticsService()
