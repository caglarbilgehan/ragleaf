# backend/database/models.py
import os
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .connection import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(50), nullable=True)
    surname = Column(String(50), nullable=True)
    full_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # Department assignment for RAG filtering
    # Array of department names: ["Teknik Servis", "Proje", "Uygulama", "Arge", "Satış", "Muhasebe", "Müşteri Hizmetleri"]
    departments = Column(JSON, default=[], nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    folder_name = Column(String(255), unique=True, nullable=False)  # doc_001_manual_dc3500
    name = Column(String(255), nullable=False)  # Display name
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, etc.
    file_size = Column(Integer, nullable=False)
    status = Column(String(20), default="uploaded")  # uploaded, processing, processed, error
    
    # Processing progress (for real-time tracking)
    processing_stage = Column(String(50), nullable=True)  # text_extraction, ocr, chunking, embedding, indexing
    processing_progress = Column(Integer, default=0)  # 0-100
    processing_details = Column(Text, nullable=True)  # Current operation details / error message
    processing_logs = Column(JSON, nullable=True)  # Array of log entries [{timestamp, level, message}]
    
    # Quick access metadata (duplicated from file system for performance)
    total_pages = Column(Integer, nullable=True)
    total_chunks = Column(Integer, nullable=True)
    ocr_completed = Column(Boolean, default=False)
    vector_indexed = Column(Boolean, default=False)
    
    # Advanced RAG Metadata (Added for compatibility with V2)
    doc_metadata = Column(JSON, default={}, nullable=True)
    language = Column(String(10), default="tr", nullable=False)
    
    # Embedding model tracking - which model was used to process this document
    embedding_model_id = Column(Integer, ForeignKey("embedding_models.id"), nullable=True)
    
    # Relationship to EmbeddingModel
    embedding_model = relationship("EmbeddingModel", backref="documents")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    @property
    def file_path(self):
        """Get original file path from folder structure (multi-tenant aware)"""
        if self.folder_name:
            from backend.services.storage_service import get_storage
            org_slug = getattr(self, '_org_slug', None) or os.getenv("DEFAULT_TENANT_SLUG", "default")
            return str(get_storage().get_original_file_path(org_slug, self.folder_name, self.original_filename))
        return None
    
    @property
    def metadata_path(self):
        """Get metadata file path (multi-tenant aware)"""
        if self.folder_name:
            from backend.services.storage_service import get_storage
            org_slug = getattr(self, '_org_slug', None) or os.getenv("DEFAULT_TENANT_SLUG", "default")
            return str(get_storage().get_metadata_path(org_slug, self.folder_name))
        return None

class ModelConfig(Base):
    __tablename__ = "models"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    provider = Column(String(50), nullable=False)  # huggingface (remote only)
    model_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)  # Model description
    
    # LLM Parameters (RAG-Optimized Defaults)
    num_ctx = Column(Integer, default=32768, nullable=True)  # Context window size (modern LLMs support 32K-128K)
    num_predict = Column(Integer, default=4096, nullable=True)  # Max tokens to predict (increased for comprehensive RAG responses)
    temperature = Column(Float, default=0.3, nullable=True)  # Randomness (0.3 = more consistent technical answers)
    top_p = Column(Float, default=0.9, nullable=True)  # Nucleus sampling
    top_k = Column(Integer, default=40, nullable=True)  # Top-k sampling
    repeat_penalty = Column(Float, default=1.1, nullable=True)  # Repetition penalty
    
    # RAG Parameters (Optimized for Technical Documentation)
    max_context_chars = Column(Integer, default=8000, nullable=True)  # Max chars from RAG context (5 chunks * 1600 chars)
    rag_top_k = Column(Integer, default=5, nullable=True)  # Number of RAG chunks to retrieve (increased for better coverage)
    chunk_size = Column(Integer, default=1000, nullable=True)  # Chunk size for RAG (larger chunks = more context per chunk)
    chunk_overlap = Column(Integer, default=200, nullable=True)  # Overlap between chunks (prevents information loss)
    
    # System Parameters
    timeout_seconds = Column(Integer, default=120, nullable=True)  # Request timeout
    stream_enabled = Column(Boolean, default=True, nullable=True)  # Enable streaming responses
    providers = Column(Text, nullable=True)  # Provider configurations for model compatibility (JSON string)
    
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())



class AIProvider(Base):
    """
    AI Provider Configuration
    Stores provider metadata and default settings
    """
    __tablename__ = "ai_provider"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)  # huggingface, openai, anthropic, deepseek
    display_name = Column(String(200), nullable=False)  # "Hugging Face", "OpenAI", etc.
    service_type = Column(String(50), nullable=False, default="inference")  # "inference", "embedding", "chat"
    
    # Configuration
    api_url = Column(String(500), nullable=True)  # Default Base API URL
    config = Column(JSON, nullable=True)  # Additional configuration
    
    # Priority and Status
    priority = Column(Integer, default=1)  # Lower = higher priority for failover
    is_enabled = Column(Boolean, default=True)  # Provider enabled?
    is_active = Column(Boolean, default=False)  # Currently active provider?
    
    # Default Model
    default_model = Column(String(200), nullable=True)  # Default model ID for this provider
    default_model_display_name = Column(String(200), nullable=True)  # Display name
    
    # Relationships
    tokens = relationship("AIToken", back_populates="provider", cascade="all, delete-orphan")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    @property
    def has_tokens(self):
        """Check if provider has any active tokens"""
        return any(t.is_active for t in self.tokens) if self.tokens else False
    
    @property
    def active_token_count(self):
        """Count of active tokens"""
        return len([t for t in self.tokens if t.is_active]) if self.tokens else 0


class AIToken(Base):
    """
    AI Provider Tokens/API Keys
    Each provider can have multiple tokens for failover
    """
    __tablename__ = "ai_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("ai_provider.id", ondelete="CASCADE"), nullable=False)
    
    # Token Info
    display_name = Column(String(200), nullable=False)  # "HuggingFace Token 1"
    api_key = Column(String(500), nullable=False)  # Encrypted API key
    api_url = Column(String(500), nullable=True)  # Override provider's default URL
    
    # Priority and Status
    priority = Column(Integer, default=1)  # Lower = tried first
    is_active = Column(Boolean, default=True)  # Token enabled?
    is_available = Column(Boolean, default=True)  # Token working? (auto-updated on errors)
    
    # Usage Stats
    total_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    last_error_at = Column(DateTime(timezone=True), nullable=True)
    
    # Rate Limiting
    requests_per_minute = Column(Integer, default=60)
    requests_per_day = Column(Integer, default=1000)
    
    # Relationships
    provider = relationship("AIProvider", back_populates="tokens")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def api_key_plain(self) -> str:
        """Decrypt the API key for use in API calls."""
        try:
            from backend.auth.crypto import decrypt_token
            return decrypt_token(self.api_key)
        except Exception:
            # Fallback: key might be stored in plain text (e.g. from backup restore)
            return self.api_key

    def set_api_key(self, plaintext_key: str):
        """Encrypt and store the API key."""
        try:
            from backend.auth.crypto import encrypt_token
            self.api_key = encrypt_token(plaintext_key)
        except Exception:
            self.api_key = plaintext_key


class RoundRobinState(Base):
    """
    Round-Robin State for Token Selection
    Tracks the current position in round-robin sequence for each provider
    """
    __tablename__ = "round_robin_state"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String(100), unique=True, nullable=False, index=True)  # Provider name (e.g., "huggingface")
    current_index = Column(Integer, default=0, nullable=False)  # Current position in round-robin sequence
    token_count = Column(Integer, default=0, nullable=False)  # Number of active tokens (for validation)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<RoundRobinState {self.provider_name} index={self.current_index}/{self.token_count}>"


class EmbeddingModel(Base):
    """
    Embedding Model Configuration
    Separate from LLM models - Only for embedding models
    Supports both LOCAL and REMOTE deployment (hybrid architecture)
    """
    __tablename__ = "embedding_models"
    
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(200), unique=True, nullable=False, index=True)  # intfloat/multilingual-e5-base
    display_name = Column(String(200), nullable=False)  # "Multilingual E5 Base"
    description = Column(Text, nullable=True)
    
    # Model Specifications
    dimension = Column(Integer, nullable=False)  # 384, 768, 1024
    max_sequence_length = Column(Integer, default=512)
    size_mb = Column(Float, nullable=True)  # Model size (for local only)
    
    # Deployment Type (LOCAL vs REMOTE) - Hybrid Architecture
    deployment_type = Column(String(20), default="local")  # local, remote
    api_endpoint = Column(String(500), nullable=True)  # Remote API endpoint
    requires_api_key = Column(Boolean, default=False)  # API key required?
    api_key_env_var = Column(String(100), nullable=True)  # OPENAI_API_KEY, COHERE_API_KEY
    
    # Capabilities
    multilingual = Column(Boolean, default=False)  # Multilingual support?
    performance_tier = Column(String(20), default="balanced")  # fast, balanced, best
    
    # Status
    is_active = Column(Boolean, default=True)  # Available for use?
    is_default = Column(Boolean, default=False)  # Default model?
    is_downloaded = Column(Boolean, default=False)  # Downloaded? (local only)
    
    # Metadata
    provider = Column(String(50), default="huggingface")  # huggingface, openai, cohere
    model_family = Column(String(50), nullable=True)  # e5, bge, minilm, mpnet, ada
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<EmbeddingModel {self.model_id} (dim={self.dimension}, type={self.deployment_type})>"

class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
