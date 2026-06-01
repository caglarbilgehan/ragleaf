# backend/database/__init__.py
"""
Database Module
Exports correct models based on active database type (PostgreSQL vs SQLite)
"""

from .connection import get_db, is_postgresql, SessionLocal, engine, Base

# Export correct models based on database type
if is_postgresql():
    from .models_v2 import (
        User,
        Document,
        DocumentChunk,
        LLMModel,
        AIProvider,
        AIToken,
        EmbeddingModel,
        ChatConversation,
        ChatMessage,
        Settings,
        Statistics
    )
    # Alias for backward compatibility
    ModelConfig = LLMModel
else:
    from .models import (
        User,
        Document,
        ModelConfig,
        AIProvider,
        AIToken,
        EmbeddingModel,
        Settings
    )
    # PostgreSQL-only models not available in SQLite
    DocumentChunk = None
    LLMModel = ModelConfig
    ChatConversation = None
    ChatMessage = None
    Statistics = None
