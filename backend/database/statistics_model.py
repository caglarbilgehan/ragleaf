"""
Unified Statistics Model
Single flexible table for all statistics tracking including errors, performance, usage
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Index
from sqlalchemy.sql import func
from .connection import Base
import json


class Statistics(Base):
    """
    Unified statistics table with key-value design.
    
    Categories:
    - error: Error logs (LLM failures, RAG errors, system errors)
    - request: API request logs
    - performance: Performance metrics
    - usage: Usage statistics (tokens, models, etc.)
    - system: System-level statistics
    
    For errors, the structure is:
    - category: "error"
    - key: error type (llm_request, rag_query, auth, system)
    - value: error message
    - data: JSON with details (model, provider, token, endpoint, etc.)
    - is_resolved: whether error is resolved
    """
    __tablename__ = "statistics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(50), nullable=False, index=True)  # error, request, performance, usage, system
    key = Column(String(100), nullable=False, index=True)      # Specific type/metric name
    value = Column(Text)                                        # Primary value (message, duration, count, etc.)
    data = Column(Text)                                         # JSON with additional context
    is_resolved = Column(Boolean, default=False)                # For errors: resolution status
    timestamp = Column(DateTime, default=func.now(), index=True)
    
    # Indexes for fast queries
    __table_args__ = (
        Index('idx_category_timestamp', 'category', 'timestamp'),
        Index('idx_category_key', 'category', 'key'),
        Index('idx_category_resolved', 'category', 'is_resolved'),
    )
    
    def get_data(self) -> dict:
        """Parse data JSON field"""
        if self.data:
            try:
                return json.loads(self.data)
            except:
                return {}
        return {}
    
    def set_data(self, data: dict):
        """Set data JSON field"""
        self.data = json.dumps(data, ensure_ascii=False)
    
    def __repr__(self):
        return f"<Statistics(id={self.id}, category={self.category}, key={self.key})>"


# Category constants
class StatCategory:
    ERROR = "error"
    REQUEST = "request"
    PERFORMANCE = "performance"
    USAGE = "usage"
    SYSTEM = "system"


# Error type constants
class ErrorType:
    LLM_REQUEST = "llm_request"
    RAG_QUERY = "rag_query"
    AUTH = "auth"
    SYSTEM = "system"
    VALIDATION = "validation"
