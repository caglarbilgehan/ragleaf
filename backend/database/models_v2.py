# backend/database/models_v2.py
"""
PostgreSQL + pgvector Models
New unified schema for all data storage
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import uuid

from .connection_v2 import Base


# ============================================================================
# Core Tables
# ============================================================================

class User(Base):
    """User accounts for both Admin Panel and ChatUI"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(50), nullable=True)
    surname = Column(String(50), nullable=True)
    full_name = Column(String(100), nullable=True)
    
    # Permissions
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_superadmin = Column(Boolean, default=False)  # Platform-level super admin
    
    # Department assignment for RAG filtering
    # Array of department names: ["Teknik Servis", "Proje", "Uygulama", "Arge", "Satış", "Muhasebe", "Müşteri Hizmetleri"]
    departments = Column(JSONB, default=[], nullable=True)
    
    # Organization (multi-tenancy)
    default_org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    conversations = relationship("ChatConversation", back_populates="user", cascade="all, delete-orphan")


# ============================================================================
# Document & Vector Tables
# ============================================================================

class Document(Base):
    """Document metadata and processing status"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    doc_number = Column(Integer, unique=True, nullable=True, index=True)  # Auto-incrementing document number (0001, 0002, ...)
    folder_name = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    
    # Organization (multi-tenancy)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Processing status
    status = Column(String(20), default="uploaded", index=True)
    processing_stage = Column(String(50), nullable=True)
    processing_progress = Column(Integer, default=0)
    processing_details = Column(Text, nullable=True)
    processing_logs = Column(JSONB, nullable=True)
    
    # Metadata
    total_pages = Column(Integer, nullable=True)
    total_chunks = Column(Integer, nullable=True)
    ocr_completed = Column(Boolean, default=False)
    vector_indexed = Column(Boolean, default=False)
    
    # Advanced RAG Metadata (Category, Department, Product Info)
    doc_metadata = Column(JSONB, default={}, nullable=True)
    
    # Language Support
    language = Column(String(10), default="tr", nullable=False)  # tr, en, etc.
    
    # Document Summary (AI generated)
    summary = Column(Text, nullable=True)
    summary_generated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Embedding model used
    embedding_model_id = Column(Integer, ForeignKey("embedding_models.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    embedding_model = relationship("EmbeddingModel", backref="documents")


class DocumentChunk(Base):
    """Document chunks with vector embeddings (pgvector)"""
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Chunk content
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    
    # Language Support
    language = Column(String(10), default="tr", nullable=False, index=True)
    original_chunk_id = Column(Integer, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True)
    
    # Vector embedding (pgvector) - dimension is managed by PostgreSQL column definition
    # Use Vector() without dimension to let PostgreSQL handle it dynamically
    embedding = Column(Vector(768), nullable=True)  # Dimension set in DB column, not here
    
    # Visual RAG & Enrichment
    image_relations = Column(JSONB, default=[], nullable=True)
    enrichment_data = Column(JSONB, default={}, nullable=True)  # For visual scenarios, suggested questions
    
    # Document Enrichment Reference (for enrichment-generated chunks)
    enrichment_type = Column(String(10), nullable=True)  # 'json' or 'qa' - indicates this chunk is from an enrichment
    enrichment_id = Column(Integer, nullable=True)  # FK to document_enrichments (set manually to avoid circular ref)
    
    # Metadata
    word_count = Column(Integer, nullable=True)
    char_count = Column(Integer, nullable=True)
    paragraph_index = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    # Self-referential relationship for translations (original chunk -> translated chunks)
    original_chunk = relationship("DocumentChunk", 
        remote_side=[id],
        backref="translations",
        foreign_keys=[original_chunk_id]
    )
    
    # Indexes for vector search
    __table_args__ = (
        Index('idx_chunk_document', 'document_id'),
        Index('idx_chunk_language', 'language'),
        Index('idx_chunk_embedding_ivfflat', 'embedding', postgresql_using='ivfflat', postgresql_ops={'embedding': 'vector_cosine_ops'}),
        Index('idx_chunk_enrichment', 'enrichment_id', postgresql_where=text('enrichment_id IS NOT NULL')),
    )


class DocumentAsset(Base):
    """Extracted assets (images, charts, tables) from documents"""
    __tablename__ = "document_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    asset_type = Column(String(50), nullable=False)  # image, table, chart
    file_path = Column(String(255), nullable=False)
    caption = Column(Text, nullable=True)  # AI generated or user edited description
    ocr_text = Column(Text, nullable=True)  # OCR extracted text from image
    asset_metadata = Column(JSONB, default={}, nullable=True)  # tags, page_number, bbox
    
    # CLIP Embedding for semantic image search (pgvector)
    clip_embedding = Column(Vector(512), nullable=True)  # CLIP ViT-B/32 produces 512-dim embeddings
    clip_embedding_generated_at = Column(DateTime(timezone=True), nullable=True)
    clip_model_version = Column(String(50), nullable=True)  # e.g., "ViT-B/32"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    document = relationship("Document", backref="assets")
    
    # Indexes for CLIP embedding search
    __table_args__ = (
        Index('idx_asset_document', 'document_id'),
        Index('idx_asset_clip_embedding_ivfflat', 'clip_embedding', 
              postgresql_using='ivfflat', 
              postgresql_ops={'clip_embedding': 'vector_cosine_ops'},
              postgresql_with={'lists': 100}),
    )


# ============================================================================
# AI Configuration Tables
# ============================================================================

class LLMModel(Base):
    """LLM Model configurations (renamed from ModelConfig)"""
    __tablename__ = "llm_models"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    provider = Column(String(50), nullable=False)
    model_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # LLM Parameters
    num_ctx = Column(Integer, default=32768, nullable=True)
    num_predict = Column(Integer, default=4096, nullable=True)
    temperature = Column(Float, default=0.3, nullable=True)
    top_p = Column(Float, default=0.9, nullable=True)
    top_k = Column(Integer, default=40, nullable=True)
    repeat_penalty = Column(Float, default=1.1, nullable=True)
    
    # RAG Parameters
    max_context_chars = Column(Integer, default=8000, nullable=True)
    rag_top_k = Column(Integer, default=5, nullable=True)
    chunk_size = Column(Integer, default=1000, nullable=True)
    chunk_overlap = Column(Integer, default=200, nullable=True)
    
    # System Parameters
    timeout_seconds = Column(Integer, default=120, nullable=True)
    stream_enabled = Column(Boolean, default=True, nullable=True)
    config = Column(JSONB, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AIProvider(Base):
    """AI Provider configurations"""
    __tablename__ = "ai_providers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    service_type = Column(String(50), nullable=False, default="inference")
    
    # Configuration
    api_url = Column(String(500), nullable=True)
    config = Column(JSONB, nullable=True)
    
    # Priority and Status
    priority = Column(Integer, default=1)
    is_enabled = Column(Boolean, default=True)
    is_active = Column(Boolean, default=False)
    
    # Default Model
    default_model = Column(String(200), nullable=True)
    default_model_display_name = Column(String(200), nullable=True)
    
    # Relationships
    tokens = relationship("AIToken", back_populates="provider", cascade="all, delete-orphan")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AIToken(Base):
    """AI Provider API tokens — stored encrypted at rest"""
    __tablename__ = "ai_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("ai_providers.id", ondelete="CASCADE"), nullable=False)
    
    # Token Info
    display_name = Column(String(200), nullable=False)
    api_key = Column(String(500), nullable=False)  # Stored encrypted via Fernet
    api_url = Column(String(500), nullable=True)
    
    # Priority and Status
    priority = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    is_available = Column(Boolean, default=True)
    
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
        from backend.auth.crypto import decrypt_token
        return decrypt_token(self.api_key)

    def set_api_key(self, plaintext_key: str):
        """Encrypt and store the API key."""
        from backend.auth.crypto import encrypt_token
        self.api_key = encrypt_token(plaintext_key)


class EmbeddingModel(Base):
    """Embedding model configurations"""
    __tablename__ = "embedding_models"
    
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(200), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Model Specifications
    dimension = Column(Integer, nullable=False)
    max_sequence_length = Column(Integer, default=512)
    size_mb = Column(Float, nullable=True)
    
    # Deployment Type
    deployment_type = Column(String(20), default="local")
    api_endpoint = Column(String(500), nullable=True)
    requires_api_key = Column(Boolean, default=False)
    api_key_env_var = Column(String(100), nullable=True)
    
    # Capabilities
    multilingual = Column(Boolean, default=False)
    performance_tier = Column(String(20), default="balanced")
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    is_downloaded = Column(Boolean, default=False)
    
    # Metadata
    provider = Column(String(50), default="huggingface")
    model_family = Column(String(50), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used = Column(DateTime(timezone=True), nullable=True)


# ============================================================================
# Chat Tables (replaces MongoDB)
# ============================================================================

class ChatConversation(Base):
    """Chat conversations (replaces MongoDB conversations)"""
    __tablename__ = "chat_conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Conversation metadata
    title = Column(String(255), nullable=True)
    model = Column(String(100), nullable=True)
    
    # Settings
    system_prompt = Column(Text, nullable=True)
    temperature = Column(Float, default=0.7)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    """Chat messages (replaces MongoDB messages)"""
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Message content
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    
    # Metadata
    tokens_used = Column(Integer, nullable=True)
    model = Column(String(100), nullable=True)
    
    # RAG context (if used)
    rag_sources = Column(JSONB, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("ChatConversation", back_populates="messages")


# ============================================================================
# System Tables
# ============================================================================

class Settings(Base):
    """Application settings (key-value store)"""
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSONB, nullable=False)
    description = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Statistics(Base):
    """Unified statistics table"""
    __tablename__ = "statistics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(50), nullable=False, index=True)
    key = Column(String(100), nullable=False, index=True)
    value = Column(Text, nullable=True)
    data = Column(JSONB, nullable=True)
    is_resolved = Column(Boolean, default=False)
    
    # Timestamps
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_statistics_category_timestamp', 'category', 'timestamp'),
        Index('idx_statistics_category_key', 'category', 'key'),
    )


# ============================================================================
# Multi-Modal RAG Tables
# ============================================================================

class MultiModalSettings(Base):
    """Multi-Modal RAG settings"""
    __tablename__ = "multimodal_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Enable/Disable
    enabled = Column(Boolean, default=False)
    
    # Provider Configuration
    provider = Column(String(50), default="openai")  # openai, anthropic, google
    model = Column(String(100), default="gpt-4-vision-preview")
    
    # Image Settings
    max_images_per_query = Column(Integer, default=3)
    max_image_size = Column(Integer, default=1024)  # pixels
    include_ocr = Column(Boolean, default=True)
    include_caption = Column(Boolean, default=True)
    
    # Budget Settings
    daily_budget_usd = Column(Float, default=10.0)
    monthly_budget_usd = Column(Float, default=100.0)
    
    # Cache Settings
    cache_enabled = Column(Boolean, default=True)
    cache_ttl_hours = Column(Integer, default=24)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class MultiModalUsage(Base):
    """Multi-Modal API usage tracking"""
    __tablename__ = "multimodal_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Provider Info
    provider = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    
    # Usage Metrics
    tokens_used = Column(Integer, nullable=False)
    cost_usd = Column(Float, nullable=False)
    image_count = Column(Integer, nullable=False)
    
    # Request Info
    query_id = Column(String(100), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_multimodal_usage_provider', 'provider'),
        Index('idx_multimodal_usage_created', 'created_at'),
    )


class ImageAnalysisCache(Base):
    """Cache for image analysis results"""
    __tablename__ = "image_analysis_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Image Identification
    image_hash = Column(String(64), nullable=False, index=True)
    analysis_type = Column(String(50), nullable=False)  # general, technical, table, chart
    
    # Analysis Result
    analysis_result = Column(JSONB, nullable=False)
    
    # Provider Info
    provider = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_image_cache_hash_type', 'image_hash', 'analysis_type'),
    )


# ============================================================================
# RAG Analytics Tables
# ============================================================================

class RAGQueryLog(Base):
    """Log of all RAG queries for analytics"""
    __tablename__ = "rag_query_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Query Info
    query_text = Column(Text, nullable=False)
    language = Column(String(10), default="tr")
    
    # Results
    chunks_retrieved = Column(Integer, default=0)
    best_score = Column(Float, nullable=True)
    confidence_level = Column(String(20), nullable=True)  # high, medium, low, none
    documents_used = Column(JSONB, default=[])  # [{doc_id, doc_name, score}]
    
    # Performance
    rag_duration_ms = Column(Integer, nullable=True)
    llm_duration_ms = Column(Integer, nullable=True)
    total_duration_ms = Column(Integer, nullable=True)
    
    # Status
    success = Column(Boolean, default=True)
    fallback_reason = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", backref="rag_queries")
    feedback = relationship("RAGFeedback", back_populates="query", uselist=False)
    
    # Indexes
    __table_args__ = (
        Index('idx_rag_query_logs_created', 'created_at'),
        Index('idx_rag_query_logs_user', 'user_id'),
        Index('idx_rag_query_logs_success', 'success'),
    )


class RAGFeedback(Base):
    """User feedback on RAG responses"""
    __tablename__ = "rag_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(String(50), ForeignKey("rag_query_logs.query_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Feedback
    rating = Column(Integer, nullable=False)  # -1: dislike, 1: like
    comment = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    query = relationship("RAGQueryLog", back_populates="feedback")
    user = relationship("User", backref="rag_feedback")
    
    # Indexes
    __table_args__ = (
        Index('idx_rag_feedback_query', 'query_id'),
        Index('idx_rag_feedback_rating', 'rating'),
    )


class RAGDailyMetrics(Base):
    """Aggregated daily metrics for RAG analytics"""
    __tablename__ = "rag_daily_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), unique=True, nullable=False, index=True)
    
    # Query Stats
    total_queries = Column(Integer, default=0)
    successful_queries = Column(Integer, default=0)
    failed_queries = Column(Integer, default=0)
    
    # Performance Stats
    avg_duration_ms = Column(Float, nullable=True)
    avg_chunks_retrieved = Column(Float, nullable=True)
    avg_best_score = Column(Float, nullable=True)
    
    # User Stats
    unique_users = Column(Integer, default=0)
    unique_documents = Column(Integer, default=0)
    
    # Feedback Stats
    likes = Column(Integer, default=0)
    dislikes = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ============================================================================
# RAG Evaluation Tables (Ragas)
# ============================================================================

class EvaluationTestSet(Base):
    """Test sets for RAG evaluation"""
    __tablename__ = "evaluation_test_sets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    questions = relationship("EvaluationQuestion", back_populates="test_set", cascade="all, delete-orphan")
    runs = relationship("EvaluationRun", back_populates="test_set", cascade="all, delete-orphan")


class EvaluationQuestion(Base):
    """Questions in a test set"""
    __tablename__ = "evaluation_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    test_set_id = Column(Integer, ForeignKey("evaluation_test_sets.id"), nullable=False)
    
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=True)  # Ground truth (optional)
    reference_doc_ids = Column(JSONB, default=[])  # Expected document IDs
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    test_set = relationship("EvaluationTestSet", back_populates="questions")
    results = relationship("EvaluationResult", back_populates="question", cascade="all, delete-orphan")


class EvaluationRun(Base):
    """Evaluation run instance"""
    __tablename__ = "evaluation_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    test_set_id = Column(Integer, ForeignKey("evaluation_test_sets.id"), nullable=False)
    
    # Status
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Aggregate Scores (0-1)
    avg_faithfulness = Column(Float, nullable=True)
    avg_relevancy = Column(Float, nullable=True)
    avg_precision = Column(Float, nullable=True)
    avg_recall = Column(Float, nullable=True)
    overall_score = Column(Float, nullable=True)
    
    # Metadata
    model_name = Column(String(100), nullable=True)
    embedding_model = Column(String(100), nullable=True)
    total_questions = Column(Integer, default=0)
    completed_questions = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    test_set = relationship("EvaluationTestSet", back_populates="runs")
    results = relationship("EvaluationResult", back_populates="run", cascade="all, delete-orphan")


class EvaluationResult(Base):
    """Individual question evaluation result"""
    __tablename__ = "evaluation_results"
    
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("evaluation_runs.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("evaluation_questions.id"), nullable=False)
    
    # RAG Response
    rag_answer = Column(Text, nullable=True)
    retrieved_contexts = Column(JSONB, default=[])  # [{chunk_id, text, score}]
    retrieved_doc_ids = Column(JSONB, default=[])
    
    # Ragas Metrics (0-1)
    faithfulness = Column(Float, nullable=True)
    answer_relevancy = Column(Float, nullable=True)
    context_precision = Column(Float, nullable=True)
    context_recall = Column(Float, nullable=True)
    
    # Performance
    duration_ms = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    run = relationship("EvaluationRun", back_populates="results")
    question = relationship("EvaluationQuestion", back_populates="results")


# ============================================================================
# Document Enrichment Tables
# ============================================================================

class DocumentEnrichment(Base):
    """
    Document enrichments for enhanced RAG context.
    Stores JSON data or Q&A pairs that are embedded and searchable.
    """
    __tablename__ = "document_enrichments"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Enrichment type: 'json' for structured data, 'qa' for question-answer pairs
    type = Column(String(10), nullable=False)  # 'json' or 'qa'
    
    # Content fields
    # For JSON: title = başlık, content = JSON string
    # For Q&A: title = soru, content = cevap
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    
    # Reference to the embedding chunk created for this enrichment
    embedding_chunk_id = Column(Integer, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    document = relationship("Document", backref="enrichments")
    embedding_chunk = relationship("DocumentChunk", foreign_keys=[embedding_chunk_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_enrichments_document', 'document_id'),
        Index('idx_enrichments_type', 'type'),
    )
    
    def __repr__(self):
        return f"<DocumentEnrichment {self.id} type={self.type} doc={self.document_id}>"


# ============================================================================
# Operations & Background Tasks
# ============================================================================

class Operation(Base):
    """
    Background operations tracking (reset, process, index, etc.)
    Used for progress tracking and operation history
    """
    __tablename__ = "operations"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(String(50), unique=True, nullable=False, index=True)
    operation_type = Column(String(50), nullable=False, index=True)  # 'reset', 'process', 'index', 'reset_and_reprocess', 'bulk_reset'
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Status tracking
    status = Column(String(20), nullable=False, index=True)  # 'pending', 'running', 'completed', 'error', 'cancelled'
    progress = Column(Integer, default=0)  # 0-100
    stage = Column(String(50), nullable=True)  # 'resetting', 'processing', 'indexing', 'completed', 'error'
    details = Column(Text, nullable=True)  # Current operation details
    
    # Configuration and results
    options = Column(JSONB, nullable=True)  # Operation options (reset_level, reset_options, reprocess_options, etc.)
    result = Column(JSONB, nullable=True)  # Operation result summary
    error = Column(Text, nullable=True)  # Error message if failed
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", backref="operations")
    
    # Indexes
    __table_args__ = (
        Index('idx_operations_operation_id', 'operation_id'),
        Index('idx_operations_document_id', 'document_id'),
        Index('idx_operations_status', 'status'),
        Index('idx_operations_type', 'operation_type'),
        Index('idx_operations_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Operation {self.operation_id} type={self.operation_type} status={self.status}>"


# ============================================================================
# Document Action History & Queue Tables
# ============================================================================

class DocumentAction(Base):
    """
    Document action history for audit logging.
    Tracks all actions performed on documents (process, index, reset, etc.)
    """
    __tablename__ = "document_actions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)  # 'process', 'index', 'reset', 'reprocess', 'reindex', 'retry'
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Result tracking
    result = Column(String(20), nullable=False, index=True)  # 'success', 'failure'
    duration_ms = Column(Integer, nullable=True)  # Duration in milliseconds (for successful actions)
    error_message = Column(Text, nullable=True)  # Error message (for failed actions)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    document = relationship("Document", backref="action_history")
    user = relationship("User", backref="document_actions")
    
    # Indexes
    __table_args__ = (
        Index('idx_document_actions_document_id', 'document_id'),
        Index('idx_document_actions_created_at', 'created_at'),
        Index('idx_document_actions_user_id', 'user_id'),
        Index('idx_document_actions_action', 'action'),
        Index('idx_document_actions_result', 'result'),
    )
    
    def __repr__(self):
        return f"<DocumentAction {self.id} action={self.action} result={self.result}>"


class ActionQueue(Base):
    """
    Action queue for managing queued document actions.
    Allows users to queue multiple actions and execute them in order.
    """
    __tablename__ = "action_queue"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # 'process', 'index', 'reset', 'reprocess', 'reindex'
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Queue management
    position = Column(Integer, nullable=False, index=True)  # Position in queue (lower = higher priority)
    status = Column(String(20), default="queued", index=True)  # 'queued', 'running', 'completed', 'cancelled', 'failed'
    options = Column(JSONB, nullable=True)  # JSON options for the action (e.g., chunking strategy, OCR languages)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    document = relationship("Document", backref="queued_actions")
    user = relationship("User", backref="action_queue")
    
    # Indexes
    __table_args__ = (
        Index('idx_action_queue_user_id', 'user_id'),
        Index('idx_action_queue_status', 'status'),
        Index('idx_action_queue_position', 'position'),
        Index('idx_action_queue_document_id', 'document_id'),
    )
    
    def __repr__(self):
        return f"<ActionQueue {self.id} action={self.action} status={self.status} position={self.position}>"
