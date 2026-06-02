# backend/database/models_platform.py
"""
Ragleaf Platform Models
Multi-tenant AI Agent Platform — Organization, Agent, Public Chat tables
"""

import uuid
import secrets
import hashlib
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, 
    ForeignKey, Float, Index, text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .connection_v2 import Base


# ============================================================================
# Agent Templates (Sektörel Şablonlar)
# ============================================================================

class AgentTemplate(Base):
    """
    Sektörel hazır AI asistan şablonları.
    Kullanıcılar bir şablon seçip firma bilgilerini girerek hızlıca agent oluşturabilir.
    """
    __tablename__ = "agent_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)  # "kuafor"
    category = Column(String(100), nullable=False)                        # "beauty", "health", "ecommerce"
    name = Column(String(200), nullable=False)                            # "Kuaför Asistanı"
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)                              # "✂️"
    
    # Template defaults
    default_system_prompt = Column(Text, nullable=False)                  # {{firma_adi}} placeholders
    default_welcome_message = Column(Text, nullable=True)
    default_personality = Column(JSONB, default={}, nullable=True)
    default_appearance = Column(JSONB, default={}, nullable=True)
    
    # Wizard config — defines which fields to ask the user
    # Array of: {"key": "firma_adi", "label": "Salon Adı", "type": "text", "required": true, "placeholder": "..."}
    config_schema = Column(JSONB, nullable=False, default=[])
    
    # Preview/marketing
    preview_questions = Column(JSONB, default=[], nullable=True)  # Example questions shown in preview
    
    # Status & ordering
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_template_category', 'category'),
        Index('idx_template_active', 'is_active'),
    )
    
    def __repr__(self):
        return f"<AgentTemplate {self.slug} name={self.name}>"


# ============================================================================
# Organization & Team Tables
# ============================================================================

class Organization(Base):
    """
    Organization (Firma/Takım).
    Top-level tenant — all data is scoped to an organization.
    """
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    logo_url = Column(String(500), nullable=True)
    
    # Plan & Limits
    plan = Column(String(50), default="free")  # free, starter, pro, enterprise
    max_agents = Column(Integer, default=3)
    max_documents = Column(Integer, default=50)
    max_queries_per_month = Column(Integer, default=1000)
    max_storage_mb = Column(Integer, default=500)
    
    # Organization-level settings
    settings = Column(JSONB, default={}, nullable=True)
    # settings = {
    #   "default_language": "tr",
    #   "default_model": "...",
    #   "branding": { "primary_color": "#4F46E5" },
    #   "notifications": { "email": true }
    # }
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # KVKK — Admin doküman erişim izni (tenant tarafından verilir)
    allow_admin_doc_access = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="organization", cascade="all, delete-orphan")
    api_keys = relationship("AgentAPIKey", back_populates="organization", cascade="all, delete-orphan")
    usage_logs = relationship("UsageLog", back_populates="organization", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Organization {self.id} slug={self.slug}>"


class OrganizationMember(Base):
    """
    Organization membership — links users to organizations with roles.
    """
    __tablename__ = "organization_members"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Role within organization
    role = Column(String(20), nullable=False, default="member")  # owner, admin, member
    
    # Invitation tracking
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    invited_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], backref="org_memberships")
    inviter = relationship("User", foreign_keys=[invited_by])
    
    # Unique constraint: one user per org
    __table_args__ = (
        UniqueConstraint('organization_id', 'user_id', name='uq_org_member'),
        Index('idx_org_member_org', 'organization_id'),
        Index('idx_org_member_user', 'user_id'),
    )
    
    def __repr__(self):
        return f"<OrgMember org={self.organization_id} user={self.user_id} role={self.role}>"


# ============================================================================
# Agent Tables
# ============================================================================

class Agent(Base):
    """
    AI Agent (Temsilci).
    Each agent has its own knowledge base, personality, and deployment settings.
    """
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(36), unique=True, nullable=False, index=True, 
                       default=lambda: f"ag_{uuid.uuid4().hex[:16]}")
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Identity
    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # AI Behavior
    system_prompt = Column(Text, nullable=True)
    welcome_message = Column(Text, default="Merhaba! Size nasıl yardımcı olabilirim?")
    
    # Personality config
    personality = Column(JSONB, default={}, nullable=True)
    # personality = {
    #   "tone": "professional",  # professional, friendly, casual
    #   "language": "tr",
    #   "response_style": "concise",  # concise, detailed, balanced
    #   "fallback_message": "Bu konuda bilgim yok, müşteri hizmetlerimizle iletişime geçebilirsiniz."
    # }
    
    # Model Configuration
    model_config_data = Column(JSONB, default={}, nullable=True)
    # model_config_data = {
    #   "provider": "huggingface",
    #   "model": "meta-llama/Llama-3.1-70B-Instruct",
    #   "temperature": 0.3,
    #   "max_tokens": 1024,
    #   "top_p": 0.9
    # }
    
    # RAG Configuration
    rag_config = Column(JSONB, default={}, nullable=True)
    # rag_config = {
    #   "top_k": 5,
    #   "similarity_threshold": 0.3,
    #   "search_method": "hybrid",  # semantic, fulltext, hybrid
    #   "include_sources": true,
    #   "max_context_chars": 4000
    # }
    
    # Widget Appearance
    appearance = Column(JSONB, default={}, nullable=True)
    # appearance = {
    #   "primary_color": "#4F46E5",
    #   "text_color": "#FFFFFF",
    #   "position": "bottom-right",  # bottom-right, bottom-left
    #   "width": 400,
    #   "height": 600,
    #   "show_branding": true,
    #   "bubble_icon": "chat",  # chat, help, custom
    #   "border_radius": 16
    # }
    
    # Security & Rate Limiting
    allowed_domains = Column(JSONB, default=[], nullable=True)  # ["example.com", "*.example.com"]
    rate_limit_per_minute = Column(Integer, default=20)
    rate_limit_per_day = Column(Integer, default=500)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=True)  # Can be accessed via widget/API
    
    # Stats (denormalized for quick access)
    total_conversations = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="agents")
    knowledge_base = relationship("AgentKnowledgeBase", back_populates="agent", cascade="all, delete-orphan")
    api_keys = relationship("AgentAPIKey", back_populates="agent", cascade="all, delete-orphan")
    conversations = relationship("PublicConversation", back_populates="agent", cascade="all, delete-orphan")
    
    # Unique constraint: slug unique within org
    __table_args__ = (
        UniqueConstraint('organization_id', 'slug', name='uq_agent_slug_per_org'),
        Index('idx_agent_org', 'organization_id'),
        Index('idx_agent_public_id', 'public_id'),
    )
    
    def __repr__(self):
        return f"<Agent {self.id} name={self.name} org={self.organization_id}>"


class AgentKnowledgeBase(Base):
    """
    Links agents to documents (knowledge base).
    An agent can have multiple documents, and a document can be shared across agents.
    """
    __tablename__ = "agent_knowledge_base"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    agent = relationship("Agent", back_populates="knowledge_base")
    document = relationship("Document", backref="agent_associations")
    
    # Unique constraint: document only once per agent
    __table_args__ = (
        UniqueConstraint('agent_id', 'document_id', name='uq_agent_document'),
        Index('idx_akb_agent', 'agent_id'),
        Index('idx_akb_document', 'document_id'),
    )
    
    def __repr__(self):
        return f"<AgentKnowledgeBase agent={self.agent_id} doc={self.document_id}>"


class AgentAPIKey(Base):
    """
    API keys for agent access (widget embed keys and REST API keys).
    """
    __tablename__ = "agent_api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Key info
    name = Column(String(200), nullable=False)
    key_prefix = Column(String(10), nullable=False, index=True)  # "ak_xxxx" for display
    key_hash = Column(String(64), nullable=False, unique=True, index=True)  # SHA-256 hash
    raw_key = Column(String(200), nullable=True)  # Stored for public keys (used in widget embed)
    
    # Key type
    key_type = Column(String(20), default="public")  # public (widget), secret (API)
    
    # Permissions
    permissions = Column(JSONB, default={"chat": True}, nullable=True)
    # permissions = {
    #   "chat": true,
    #   "read_conversations": false,
    #   "manage_knowledge": false
    # }
    
    # Usage tracking
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    total_requests = Column(Integer, default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    agent = relationship("Agent", back_populates="api_keys")
    organization = relationship("Organization", back_populates="api_keys")
    
    __table_args__ = (
        Index('idx_api_key_agent', 'agent_id'),
        Index('idx_api_key_org', 'organization_id'),
        Index('idx_api_key_hash', 'key_hash'),
    )
    
    @staticmethod
    def generate_key(key_type: str = "public") -> tuple:
        """
        Generate a new API key.
        Returns (raw_key, key_prefix, key_hash)
        """
        prefix = "ak" if key_type == "public" else "sk"
        raw = f"{prefix}_{secrets.token_hex(24)}"
        key_prefix = raw[:10]
        key_hash = hashlib.sha256(raw.encode()).hexdigest()
        return raw, key_prefix, key_hash
    
    @staticmethod
    def hash_key(raw_key: str) -> str:
        """Hash a raw API key for lookup."""
        return hashlib.sha256(raw_key.encode()).hexdigest()
    
    def __repr__(self):
        return f"<AgentAPIKey {self.key_prefix}... agent={self.agent_id}>"


# ============================================================================
# Public Conversation Tables (Widget & API chats)
# ============================================================================

class PublicConversation(Base):
    """
    Conversations from widget/API end-users.
    Separate from internal admin chat conversations.
    """
    __tablename__ = "public_conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Visitor identification
    session_id = Column(String(100), nullable=False, index=True)  # Browser session
    visitor_id = Column(String(100), nullable=True, index=True)   # Persistent visitor ID (cookie-based)
    
    # Visitor metadata
    visitor_metadata = Column(JSONB, default={}, nullable=True)
    # visitor_metadata = {
    #   "ip": "...",
    #   "user_agent": "...",
    #   "referrer": "...",
    #   "page_url": "https://example.com/pricing",
    #   "country": "TR",
    #   "city": "Istanbul"
    # }
    
    # Conversation state
    status = Column(String(20), default="active")  # active, resolved, archived
    
    # Stats
    message_count = Column(Integer, default=0)
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="conversations")
    messages = relationship("PublicMessage", back_populates="conversation", 
                          cascade="all, delete-orphan", order_by="PublicMessage.created_at")
    
    __table_args__ = (
        Index('idx_pub_conv_agent', 'agent_id'),
        Index('idx_pub_conv_session', 'session_id'),
        Index('idx_pub_conv_visitor', 'visitor_id'),
        Index('idx_pub_conv_started', 'started_at'),
    )
    
    def __repr__(self):
        return f"<PublicConversation {self.id} agent={self.agent_id}>"


class PublicMessage(Base):
    """
    Messages within a public conversation.
    """
    __tablename__ = "public_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("public_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Message content
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    
    # RAG metadata (for assistant messages)
    rag_sources = Column(JSONB, nullable=True)
    # rag_sources = [
    #   { "document_name": "...", "chunk_id": 123, "score": 0.85, "preview": "..." }
    # ]
    
    # Token tracking
    tokens_used = Column(Integer, nullable=True)
    model_used = Column(String(200), nullable=True)
    provider_used = Column(String(100), nullable=True)
    
    # Performance
    response_time_ms = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("PublicConversation", back_populates="messages")
    
    __table_args__ = (
        Index('idx_pub_msg_conversation', 'conversation_id'),
        Index('idx_pub_msg_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<PublicMessage {self.id} role={self.role}>"


# ============================================================================
# Usage Tracking
# ============================================================================

class UsageLog(Base):
    """
    Usage tracking per organization/agent for billing and analytics.
    """
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Event details
    event_type = Column(String(50), nullable=False)  # chat_query, doc_upload, doc_index, doc_process
    
    # Token/resource usage
    tokens_used = Column(Integer, default=0)
    cost_estimate_usd = Column(Float, default=0.0)
    
    # Context
    details = Column(JSONB, nullable=True)
    # details = {
    #   "model": "...",
    #   "provider": "...",
    #   "input_tokens": 500,
    #   "output_tokens": 200,
    #   "document_id": 123
    # }
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="usage_logs")
    
    __table_args__ = (
        Index('idx_usage_org', 'organization_id'),
        Index('idx_usage_agent', 'agent_id'),
        Index('idx_usage_type', 'event_type'),
        Index('idx_usage_created', 'created_at'),
        Index('idx_usage_org_created', 'organization_id', 'created_at'),
    )
    
    def __repr__(self):
        return f"<UsageLog {self.id} type={self.event_type} org={self.organization_id}>"


# ============================================================================
# Appointment System (Randevu Yönetimi)
# ============================================================================

class Appointment(Base):
    """
    Randevu kaydı.
    AI asistan chat üzerinden bilgileri toplar ve bu tabloya yazar.
    Google Calendar vb. entegrasyonlarla senkronize edilebilir.
    """
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(36), unique=True, nullable=False, index=True,
                       default=lambda: f"apt_{uuid.uuid4().hex[:12]}")
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Conversation link (which chat created this appointment)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("public_conversations.id", ondelete="SET NULL"), nullable=True)
    
    # Customer info (collected by AI)
    customer_name = Column(String(200), nullable=False)
    customer_phone = Column(String(50), nullable=True)
    customer_email = Column(String(200), nullable=True)
    customer_notes = Column(Text, nullable=True)  # "Saçımı kısa kestirmek istiyorum"
    
    # Appointment details
    service_type = Column(String(200), nullable=True)     # "Saç Kesimi + Fön"
    service_details = Column(JSONB, default={}, nullable=True)  # {"services": ["Saç Kesimi", "Fön"], "duration_min": 60}
    
    # Scheduling
    appointment_date = Column(DateTime(timezone=True), nullable=False, index=True)
    appointment_end = Column(DateTime(timezone=True), nullable=True)       # Calculated from duration
    duration_minutes = Column(Integer, default=60)
    
    # Status workflow: pending → confirmed → completed / cancelled / no_show
    status = Column(String(30), default="pending", nullable=False, index=True)
    # pending    — AI tarafından oluşturuldu, onay bekliyor
    # confirmed  — İşletme onayladı
    # completed  — Randevu gerçekleşti
    # cancelled  — İptal edildi
    # no_show    — Müşteri gelmedi
    
    cancelled_reason = Column(Text, nullable=True)
    cancelled_by = Column(String(20), nullable=True)  # "customer", "business", "system"
    
    # External calendar sync
    external_calendar_id = Column(String(200), nullable=True)   # Google Calendar event ID etc.
    external_calendar_type = Column(String(50), nullable=True)  # "google", "outlook", "ical"
    sync_status = Column(String(20), default="not_synced")      # not_synced, synced, sync_error
    
    # Reminders
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    
    # Extra data
    extra_data = Column(JSONB, default={}, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization")
    agent = relationship("Agent")
    conversation = relationship("PublicConversation")
    
    __table_args__ = (
        Index('idx_apt_org', 'organization_id'),
        Index('idx_apt_agent', 'agent_id'),
        Index('idx_apt_date', 'appointment_date'),
        Index('idx_apt_status', 'status'),
        Index('idx_apt_org_date', 'organization_id', 'appointment_date'),
        Index('idx_apt_org_status', 'organization_id', 'status'),
    )
    
    def __repr__(self):
        return f"<Appointment {self.public_id} customer={self.customer_name} date={self.appointment_date}>"


class CalendarIntegration(Base):
    """
    External calendar integration settings per organization.
    Supports Google Calendar, Outlook Calendar, iCal.
    """
    __tablename__ = "calendar_integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Integration type
    provider = Column(String(50), nullable=False)  # "google", "outlook", "ical", "caldav"
    name = Column(String(200), nullable=False)      # "Google Takvim — Ana Hesap"
    
    # Auth credentials (encrypted in production)
    credentials = Column(JSONB, default={}, nullable=True)
    # For Google: {"access_token": "...", "refresh_token": "...", "token_uri": "..."}
    # For iCal:   {"calendar_url": "https://..."}
    
    # Calendar settings
    calendar_id = Column(String(300), nullable=True)  # Google: "primary" or specific calendar ID
    
    # Sync settings
    sync_enabled = Column(Boolean, default=True)
    sync_direction = Column(String(20), default="push")  # "push" (write only), "pull" (read only), "both"
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_error = Column(Text, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    
    __table_args__ = (
        Index('idx_cal_org', 'organization_id'),
        Index('idx_cal_provider', 'provider'),
        UniqueConstraint('organization_id', 'provider', 'calendar_id', name='uq_cal_integration'),
    )
    
    def __repr__(self):
        return f"<CalendarIntegration {self.provider} org={self.organization_id}>"
