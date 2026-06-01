"""
Action History Service
Tracks and retrieves document action history for audit logging
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database.models_v2 import DocumentAction, Document, User

logger = logging.getLogger(__name__)


class ActionHistoryService:
    """Service for managing document action history"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def log_action(
        self,
        document_id: int,
        action: str,
        user_id: int,
        result: str,
        duration_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> DocumentAction:
        """
        Log a document action to history
        
        Args:
            document_id: Document ID
            action: Action type (process, index, reset, reprocess, reindex, retry)
            user_id: User ID who performed the action
            result: Action result (success, failure)
            duration_ms: Duration in milliseconds (for successful actions)
            error_message: Error message (for failed actions)
        
        Returns:
            Created DocumentAction record
        """
        try:
            # Create action record
            action_record = DocumentAction(
                document_id=document_id,
                action=action,
                user_id=user_id,
                result=result,
                duration_ms=duration_ms,
                error_message=error_message
            )
            
            self.db.add(action_record)
            self.db.commit()
            self.db.refresh(action_record)
            
            logger.info(
                f"📝 Action logged: doc={document_id}, action={action}, "
                f"result={result}, user={user_id}"
            )
            
            return action_record
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Failed to log action: {str(e)}")
            raise
    
    async def get_action_history(
        self,
        document_id: int,
        limit: int = 50,
        action_type: Optional[str] = None
    ) -> List[dict]:
        """
        Get action history for a document
        
        Args:
            document_id: Document ID
            limit: Maximum number of records to return
            action_type: Filter by action type (optional)
        
        Returns:
            List of action history records with user info
        """
        try:
            # Build query
            query = self.db.query(
                DocumentAction,
                User.email,
                User.full_name
            ).join(
                User, DocumentAction.user_id == User.id
            ).filter(
                DocumentAction.document_id == document_id
            )
            
            # Apply action type filter
            if action_type:
                query = query.filter(DocumentAction.action == action_type)
            
            # Order by created_at desc and limit
            query = query.order_by(desc(DocumentAction.created_at)).limit(limit)
            
            # Execute query
            results = query.all()
            
            # Format results
            history = []
            for action, user_email, user_name in results:
                history.append({
                    "id": action.id,
                    "action": action.action,
                    "result": action.result,
                    "duration_ms": action.duration_ms,
                    "error_message": action.error_message,
                    "created_at": action.created_at.isoformat() if action.created_at else None,
                    "user": {
                        "email": user_email,
                        "name": user_name or user_email
                    }
                })
            
            logger.info(f"📊 Retrieved {len(history)} action history records for doc={document_id}")
            
            return history
            
        except Exception as e:
            logger.error(f"❌ Failed to get action history: {str(e)}")
            raise
    
    async def get_recent_actions(
        self,
        user_id: int,
        limit: int = 20
    ) -> List[dict]:
        """
        Get recent actions for a user
        
        Args:
            user_id: User ID
            limit: Maximum number of records to return
        
        Returns:
            List of recent action records with document info
        """
        try:
            # Build query
            query = self.db.query(
                DocumentAction,
                Document.name,
                Document.folder_name
            ).join(
                Document, DocumentAction.document_id == Document.id
            ).filter(
                DocumentAction.user_id == user_id
            ).order_by(
                desc(DocumentAction.created_at)
            ).limit(limit)
            
            # Execute query
            results = query.all()
            
            # Format results
            actions = []
            for action, doc_name, folder_name in results:
                actions.append({
                    "id": action.id,
                    "action": action.action,
                    "result": action.result,
                    "duration_ms": action.duration_ms,
                    "error_message": action.error_message,
                    "created_at": action.created_at.isoformat() if action.created_at else None,
                    "document": {
                        "id": action.document_id,
                        "name": doc_name,
                        "folder_name": folder_name
                    }
                })
            
            logger.info(f"📊 Retrieved {len(actions)} recent actions for user={user_id}")
            
            return actions
            
        except Exception as e:
            logger.error(f"❌ Failed to get recent actions: {str(e)}")
            raise
    
    async def cleanup_old_actions(self, days: int = 90) -> int:
        """
        Delete action history older than specified days
        
        Args:
            days: Number of days to keep (default: 90)
        
        Returns:
            Number of deleted records
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Delete old records
            deleted_count = self.db.query(DocumentAction).filter(
                DocumentAction.created_at < cutoff_date
            ).delete()
            
            self.db.commit()
            
            logger.info(f"🗑️ Cleaned up {deleted_count} action history records older than {days} days")
            
            return deleted_count
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Failed to cleanup old actions: {str(e)}")
            raise
    
    async def get_action_stats(self, document_id: int) -> dict:
        """
        Get action statistics for a document
        
        Args:
            document_id: Document ID
        
        Returns:
            Dictionary with action statistics
        """
        try:
            # Get all actions for document
            actions = self.db.query(DocumentAction).filter(
                DocumentAction.document_id == document_id
            ).all()
            
            # Calculate stats
            total_actions = len(actions)
            successful_actions = len([a for a in actions if a.result == "success"])
            failed_actions = len([a for a in actions if a.result == "failure"])
            
            # Calculate average duration for successful actions
            successful_durations = [a.duration_ms for a in actions if a.result == "success" and a.duration_ms]
            avg_duration_ms = sum(successful_durations) / len(successful_durations) if successful_durations else None
            
            # Count by action type
            action_counts = {}
            for action in actions:
                action_counts[action.action] = action_counts.get(action.action, 0) + 1
            
            stats = {
                "total_actions": total_actions,
                "successful_actions": successful_actions,
                "failed_actions": failed_actions,
                "success_rate": successful_actions / total_actions if total_actions > 0 else 0,
                "avg_duration_ms": avg_duration_ms,
                "action_counts": action_counts
            }
            
            logger.info(f"📊 Retrieved action stats for doc={document_id}")
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Failed to get action stats: {str(e)}")
            raise
