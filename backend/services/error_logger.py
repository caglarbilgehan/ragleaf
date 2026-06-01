"""
Error Logger Service
Logs errors to unified Statistics table for tracking and analytics
"""
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

logger = logging.getLogger(__name__)


class ErrorLogger:
    """
    Service for logging errors to unified Statistics table.
    Uses category='error' and key=error_type for organization.
    """
    
    @staticmethod
    def log_error(
        db: Session,
        error_type: str,
        error_message: str,
        model_name: Optional[str] = None,
        provider_name: Optional[str] = None,
        token_name: Optional[str] = None,
        endpoint: Optional[str] = None,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        extra_info: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Log an error to the Statistics table.
        
        Args:
            db: Database session
            error_type: Type of error (llm_request, rag_query, auth, system)
            error_message: Human-readable error message
            model_name: Model name if LLM-related
            provider_name: Provider name if LLM-related
            token_name: Token name if LLM-related
            endpoint: API endpoint URL
            user_id: User ID if available
            conversation_id: Conversation ID if available
            extra_info: Additional context
            
        Returns:
            ID of the created entry
        """
        from ..database.statistics_model import Statistics, StatCategory
        
        try:
            # Build data JSON
            data = {
                "model": model_name,
                "provider": provider_name,
                "token": token_name,
                "endpoint": endpoint,
                "user_id": user_id,
                "conversation_id": conversation_id
            }
            
            # Add extra info if provided
            if extra_info:
                # Remove sensitive data
                safe_extra = {
                    k: v for k, v in extra_info.items()
                    if k not in ['api_key', 'token', 'password', 'Authorization']
                }
                data.update(safe_extra)
            
            # Remove None values
            data = {k: v for k, v in data.items() if v is not None}
            
            stat = Statistics(
                category=StatCategory.ERROR,
                key=error_type,
                value=error_message[:2000] if error_message else "",
                data=json.dumps(data, ensure_ascii=False) if data else None,
                is_resolved=False,
                timestamp=datetime.utcnow()
            )
            
            db.add(stat)
            db.commit()
            db.refresh(stat)
            
            logger.info(f"Error logged: {error_type} - {error_message[:100]}")
            return stat.id
            
        except Exception as e:
            logger.error(f"Failed to log error: {e}")
            db.rollback()
            return -1
    
    @staticmethod
    def log_llm_error(
        db: Session,
        error_message: str,
        model_name: str,
        provider_name: str,
        token_name: Optional[str] = None,
        endpoint: Optional[str] = None,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        request_details: Optional[Dict[str, Any]] = None
    ) -> int:
        """Convenience method for logging LLM request errors"""
        from ..database.statistics_model import ErrorType
        return ErrorLogger.log_error(
            db=db,
            error_type=ErrorType.LLM_REQUEST,
            error_message=error_message,
            model_name=model_name,
            provider_name=provider_name,
            token_name=token_name,
            endpoint=endpoint,
            user_id=user_id,
            conversation_id=conversation_id,
            extra_info=request_details
        )
    
    @staticmethod
    def log_rag_error(
        db: Session,
        error_message: str,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        extra_info: Optional[Dict[str, Any]] = None
    ) -> int:
        """Convenience method for logging RAG query errors"""
        from ..database.statistics_model import ErrorType
        return ErrorLogger.log_error(
            db=db,
            error_type=ErrorType.RAG_QUERY,
            error_message=error_message,
            user_id=user_id,
            conversation_id=conversation_id,
            extra_info=extra_info
        )
    
    @staticmethod
    def get_recent_errors(
        db: Session,
        limit: int = 50,
        error_type: Optional[str] = None,
        include_resolved: bool = False
    ) -> list:
        """Get recent errors from Statistics table"""
        from ..database.statistics_model import Statistics, StatCategory
        
        query = db.query(Statistics).filter(Statistics.category == StatCategory.ERROR)
        
        if error_type:
            query = query.filter(Statistics.key == error_type)
        
        if not include_resolved:
            query = query.filter(Statistics.is_resolved == False)
        
        errors = query.order_by(Statistics.timestamp.desc()).limit(limit).all()
        
        # Format for API response
        result = []
        for e in errors:
            data = e.get_data()
            result.append({
                "id": e.id,
                "error_type": e.key,
                "error_message": e.value,
                "model_name": data.get("model"),
                "provider_name": data.get("provider"),
                "token_name": data.get("token"),
                "endpoint": data.get("endpoint"),
                "user_id": data.get("user_id"),
                "is_resolved": e.is_resolved,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None
            })
        
        return result
    
    @staticmethod
    def get_error_stats(db: Session, days: int = 7) -> Dict[str, Any]:
        """Get error statistics for the last N days"""
        from ..database.statistics_model import Statistics, StatCategory
        
        since = datetime.utcnow() - timedelta(days=days)
        
        # Get all errors in period
        errors = db.query(Statistics).filter(
            Statistics.category == StatCategory.ERROR,
            Statistics.timestamp >= since
        ).all()
        
        total_errors = len(errors)
        unresolved_count = sum(1 for e in errors if not e.is_resolved)
        
        # Group by type
        errors_by_type = {}
        errors_by_provider = {}
        errors_by_model = {}
        
        for e in errors:
            # By type
            error_type = e.key or "unknown"
            errors_by_type[error_type] = errors_by_type.get(error_type, 0) + 1
            
            # Parse data for provider/model
            data = e.get_data()
            
            provider = data.get("provider")
            if provider:
                errors_by_provider[provider] = errors_by_provider.get(provider, 0) + 1
            
            model = data.get("model")
            if model:
                errors_by_model[model] = errors_by_model.get(model, 0) + 1
        
        return {
            "total_errors": total_errors,
            "unresolved_count": unresolved_count,
            "errors_by_type": errors_by_type,
            "errors_by_provider": errors_by_provider,
            "errors_by_model": errors_by_model,
            "period_days": days
        }
    
    @staticmethod
    def resolve_error(db: Session, error_id: int) -> bool:
        """Mark an error as resolved"""
        from ..database.statistics_model import Statistics, StatCategory
        
        try:
            error = db.query(Statistics).filter(
                Statistics.id == error_id,
                Statistics.category == StatCategory.ERROR
            ).first()
            
            if error:
                error.is_resolved = True
                db.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to resolve error: {e}")
            db.rollback()
            return False


# Singleton instance
error_logger = ErrorLogger()
