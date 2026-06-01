# backend/services/chat_service.py
"""
Chat Service for PostgreSQL
Replaces MongoDB for chat conversations and messages
"""

import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ChatService:
    """
    PostgreSQL-based chat service
    
    Replaces MongoDB for:
    - Chat conversations
    - Chat messages
    """
    
    def create_conversation(
        self,
        db: Session,
        user_id: Optional[int] = None,
        title: Optional[str] = None,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new conversation"""
        try:
            result = db.execute(
                text("""
                    INSERT INTO chat_conversations (user_id, title, model, system_prompt)
                    VALUES (:user_id, :title, :model, :system_prompt)
                    RETURNING id, created_at
                """),
                {
                    "user_id": user_id,
                    "title": title or "New Conversation",
                    "model": model,
                    "system_prompt": system_prompt
                }
            )
            row = result.fetchone()
            db.commit()
            
            return {
                "id": str(row.id),
                "user_id": user_id,
                "title": title or "New Conversation",
                "model": model,
                "created_at": row.created_at.isoformat()
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create conversation: {e}")
            raise
    
    def get_conversation(self, db: Session, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get a conversation by ID"""
        try:
            result = db.execute(
                text("""
                    SELECT id, user_id, title, model, system_prompt, temperature, created_at, updated_at
                    FROM chat_conversations
                    WHERE id = :conv_id
                """),
                {"conv_id": conversation_id}
            )
            row = result.fetchone()
            
            if not row:
                return None
            
            return {
                "id": str(row.id),
                "user_id": row.user_id,
                "title": row.title,
                "model": row.model,
                "system_prompt": row.system_prompt,
                "temperature": row.temperature,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
        except Exception as e:
            logger.error(f"Failed to get conversation: {e}")
            return None
    
    def list_conversations(
        self,
        db: Session,
        user_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List conversations for a user"""
        try:
            filter_clause = "WHERE user_id = :user_id" if user_id else ""
            params = {"limit": limit, "offset": offset}
            if user_id:
                params["user_id"] = user_id
            
            result = db.execute(
                text(f"""
                    SELECT id, user_id, title, model, created_at, updated_at
                    FROM chat_conversations
                    {filter_clause}
                    ORDER BY updated_at DESC NULLS LAST
                    LIMIT :limit OFFSET :offset
                """),
                params
            )
            
            return [
                {
                    "id": str(row.id),
                    "user_id": row.user_id,
                    "title": row.title,
                    "model": row.model,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None
                }
                for row in result
            ]
        except Exception as e:
            logger.error(f"Failed to list conversations: {e}")
            return []
    
    def update_conversation(
        self,
        db: Session,
        conversation_id: str,
        title: Optional[str] = None,
        model: Optional[str] = None
    ) -> bool:
        """Update a conversation"""
        try:
            updates = []
            params = {"conv_id": conversation_id}
            
            if title:
                updates.append("title = :title")
                params["title"] = title
            if model:
                updates.append("model = :model")
                params["model"] = model
            
            updates.append("updated_at = NOW()")
            
            db.execute(
                text(f"""
                    UPDATE chat_conversations
                    SET {', '.join(updates)}
                    WHERE id = :conv_id
                """),
                params
            )
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update conversation: {e}")
            return False
    
    def delete_conversation(self, db: Session, conversation_id: str) -> bool:
        """Delete a conversation and its messages"""
        try:
            db.execute(
                text("DELETE FROM chat_conversations WHERE id = :conv_id"),
                {"conv_id": conversation_id}
            )
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete conversation: {e}")
            return False
    
    def add_message(
        self,
        db: Session,
        conversation_id: str,
        role: str,
        content: str,
        model: Optional[str] = None,
        tokens_used: Optional[int] = None,
        rag_sources: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Add a message to a conversation"""
        try:
            import json
            rag_json = json.dumps(rag_sources) if rag_sources else None
            
            result = db.execute(
                text("""
                    INSERT INTO chat_messages (conversation_id, role, content, model, tokens_used, rag_sources)
                    VALUES (:conv_id, :role, :content, :model, :tokens, :rag_sources::jsonb)
                    RETURNING id, created_at
                """),
                {
                    "conv_id": conversation_id,
                    "role": role,
                    "content": content,
                    "model": model,
                    "tokens": tokens_used,
                    "rag_sources": rag_json
                }
            )
            row = result.fetchone()
            
            # Update conversation updated_at
            db.execute(
                text("UPDATE chat_conversations SET updated_at = NOW() WHERE id = :conv_id"),
                {"conv_id": conversation_id}
            )
            
            db.commit()
            
            return {
                "id": str(row.id),
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "model": model,
                "tokens_used": tokens_used,
                "created_at": row.created_at.isoformat()
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to add message: {e}")
            raise
    
    def get_messages(
        self,
        db: Session,
        conversation_id: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get messages for a conversation"""
        try:
            result = db.execute(
                text("""
                    SELECT id, role, content, model, tokens_used, rag_sources, created_at
                    FROM chat_messages
                    WHERE conversation_id = :conv_id
                    ORDER BY created_at ASC
                    LIMIT :limit
                """),
                {"conv_id": conversation_id, "limit": limit}
            )
            
            return [
                {
                    "id": str(row.id),
                    "role": row.role,
                    "content": row.content,
                    "model": row.model,
                    "tokens_used": row.tokens_used,
                    "rag_sources": row.rag_sources,
                    "created_at": row.created_at.isoformat() if row.created_at else None
                }
                for row in result
            ]
        except Exception as e:
            logger.error(f"Failed to get messages: {e}")
            return []


# Global instance
chat_service = ChatService()
