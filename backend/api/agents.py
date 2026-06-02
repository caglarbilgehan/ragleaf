# backend/api/agents.py
"""
Agent management API for Ragleaf platform.
Handles agent CRUD, knowledge base management, and API key generation.
"""

import re
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import (
    Organization, Agent, AgentKnowledgeBase, AgentAPIKey, UsageLog
)
from backend.database.models_v2 import Document
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org

logger = logging.getLogger(__name__)

agents_router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    system_prompt: Optional[str] = Field(
        None,
        description="System prompt for the agent's personality and behavior"
    )
    welcome_message: Optional[str] = "Merhaba! Size nasıl yardımcı olabilirim?"
    personality: Optional[Dict[str, Any]] = None
    model_config_data: Optional[Dict[str, Any]] = None
    rag_config: Optional[Dict[str, Any]] = None
    appearance: Optional[Dict[str, Any]] = None
    allowed_domains: Optional[List[str]] = None


class AgentUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    personality: Optional[Dict[str, Any]] = None
    model_config_data: Optional[Dict[str, Any]] = None
    rag_config: Optional[Dict[str, Any]] = None
    appearance: Optional[Dict[str, Any]] = None
    allowed_domains: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    rate_limit_per_minute: Optional[int] = None
    rate_limit_per_day: Optional[int] = None


class AgentResponse(BaseModel):
    id: int
    public_id: str
    name: str
    slug: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    system_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    personality: Optional[Dict[str, Any]] = None
    model_config_data: Optional[Dict[str, Any]] = None
    rag_config: Optional[Dict[str, Any]] = None
    appearance: Optional[Dict[str, Any]] = None
    allowed_domains: Optional[List[str]] = None
    rate_limit_per_minute: int = 20
    rate_limit_per_day: int = 500
    is_active: bool = True
    is_public: bool = True
    total_conversations: int = 0
    total_messages: int = 0
    document_count: Optional[int] = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    auto_api_key: Optional[str] = None  # Only set on agent creation
    
    class Config:
        from_attributes = True


class KnowledgeBaseAddRequest(BaseModel):
    document_ids: List[int] = Field(..., min_length=1)


class APIKeyCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    key_type: str = Field(default="public", pattern="^(public|secret)$")


class APIKeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    key_type: str
    is_active: bool
    total_requests: int
    last_used_at: Optional[datetime] = None
    created_at: datetime
    # raw_key only returned on creation
    raw_key: Optional[str] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# Agent CRUD
# ============================================================================

@agents_router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    request: AgentCreateRequest,
    org: Organization = Depends(get_current_org),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new AI agent for the organization."""
    # Check org limit
    current_count = db.query(Agent).filter(Agent.organization_id == org.id).count()
    if current_count >= org.max_agents:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organizasyon limiti aşıldı. Mevcut plan en fazla {org.max_agents} agent destekliyor."
        )
    
    # Generate slug
    slug = re.sub(r'[^a-z0-9]+', '-', request.name.lower()).strip('-')
    
    # Ensure slug uniqueness within org
    existing = db.query(Agent).filter(
        Agent.organization_id == org.id,
        Agent.slug == slug
    ).first()
    if existing:
        slug = f"{slug}-{current_count + 1}"
    
    # Default configs
    default_personality = {
        "tone": "professional",
        "language": "tr",
        "response_style": "balanced",
        "fallback_message": "Bu konuda yeterli bilgim yok. Daha fazla bilgi için müşteri hizmetlerimizle iletişime geçebilirsiniz."
    }
    
    default_model_config = {
        "provider": "huggingface",
        "model": "meta-llama/Llama-3.1-70B-Instruct",
        "temperature": 0.3,
        "max_tokens": 1024,
        "top_p": 0.9
    }
    
    default_rag_config = {
        "top_k": 5,
        "similarity_threshold": 0.3,
        "search_method": "hybrid",
        "include_sources": False,
        "max_context_chars": 4000
    }
    
    default_appearance = {
        "primary_color": "#4F46E5",
        "text_color": "#FFFFFF",
        "position": "bottom-right",
        "width": 400,
        "height": 600,
        "show_branding": True,
        "bubble_icon": "chat",
        "border_radius": 16
    }
    
    agent = Agent(
        organization_id=org.id,
        name=request.name,
        slug=slug,
        description=request.description,
        system_prompt=request.system_prompt or f"Sen {request.name} adlı bir AI asistansın. Kullanıcılara nazik ve profesyonel bir şekilde yardımcı ol.",
        welcome_message=request.welcome_message,
        personality={**default_personality, **(request.personality or {})},
        model_config_data={**default_model_config, **(request.model_config_data or {})},
        rag_config={**default_rag_config, **(request.rag_config or {})},
        appearance={**default_appearance, **(request.appearance or {})},
        allowed_domains=request.allowed_domains or [],
    )
    
    db.add(agent)
    db.flush()  # Get agent ID before creating API key
    
    # Auto-generate public API key for the agent
    raw_key, key_prefix, key_hash = AgentAPIKey.generate_key("public")
    auto_api_key = AgentAPIKey(
        agent_id=agent.id,
        organization_id=org.id,
        name=f"{request.name} - Widget Key",
        key_prefix=key_prefix,
        key_hash=key_hash,
        key_type="public",
        raw_key=raw_key  # Store raw key for public keys
    )
    db.add(auto_api_key)
    
    db.commit()
    db.refresh(agent)
    
    logger.info(f"✅ Agent created: {agent.name} (id={agent.id}) for org {org.slug} with auto API key {key_prefix}...")
    
    response = _agent_to_response(agent, db)
    # Include the raw API key in the response (only shown once at creation)
    response.auto_api_key = raw_key
    return response


@agents_router.get("", response_model=List[AgentResponse])
async def list_agents(
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """List all agents for the current organization."""
    agents = db.query(Agent).filter(
        Agent.organization_id == org.id
    ).order_by(Agent.created_at.desc()).all()
    
    return [_agent_to_response(agent, db) for agent in agents]


@agents_router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Get agent details."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    return _agent_to_response(agent, db)


@agents_router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: int,
    request: AgentUpdateRequest,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Update agent configuration."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    update_fields = request.model_dump(exclude_unset=True)
    
    for field, value in update_fields.items():
        if value is not None:
            # Merge JSONB fields instead of replacing
            if field in ("personality", "model_config_data", "rag_config", "appearance"):
                existing = getattr(agent, field) or {}
                setattr(agent, field, {**existing, **value})
            else:
                setattr(agent, field, value)
    
    db.commit()
    db.refresh(agent)
    
    logger.info(f"✅ Agent updated: {agent.name} (id={agent.id})")
    
    return _agent_to_response(agent, db)


@agents_router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: int,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Delete an agent and all associated data."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    db.delete(agent)
    db.commit()
    
    logger.info(f"✅ Agent deleted: {agent.name} (id={agent_id})")


# ============================================================================
# Knowledge Base Management
# ============================================================================

@agents_router.post("/{agent_id}/knowledge", status_code=status.HTTP_201_CREATED)
async def add_documents_to_knowledge_base(
    agent_id: int,
    request: KnowledgeBaseAddRequest,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Add documents to an agent's knowledge base."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    added = 0
    skipped = 0
    
    for doc_id in request.document_ids:
        # Verify document belongs to org
        doc = db.query(Document).filter(
            Document.id == doc_id,
            Document.organization_id == org.id
        ).first()
        
        if not doc:
            skipped += 1
            continue
        
        # Check if already linked
        existing = db.query(AgentKnowledgeBase).filter(
            AgentKnowledgeBase.agent_id == agent.id,
            AgentKnowledgeBase.document_id == doc_id
        ).first()
        
        if existing:
            skipped += 1
            continue
        
        link = AgentKnowledgeBase(agent_id=agent.id, document_id=doc_id)
        db.add(link)
        added += 1
    
    db.commit()
    
    return {"added": added, "skipped": skipped, "total": added + skipped}


@agents_router.get("/{agent_id}/knowledge")
async def list_knowledge_base(
    agent_id: int,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """List all documents in an agent's knowledge base."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    links = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.agent_id == agent.id
    ).all()
    
    documents = []
    for link in links:
        doc = db.query(Document).filter(Document.id == link.document_id).first()
        if doc:
            documents.append({
                "id": doc.id,
                "name": doc.name,
                "file_type": doc.file_type,
                "status": doc.status,
                "total_chunks": doc.total_chunks,
                "vector_indexed": doc.vector_indexed,
                "created_at": doc.created_at.isoformat() if doc.created_at else None
            })
    
    return {"agent_id": agent.id, "documents": documents, "total": len(documents)}


@agents_router.delete("/{agent_id}/knowledge/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document_from_knowledge_base(
    agent_id: int,
    document_id: int,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Remove a document from an agent's knowledge base."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    link = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.agent_id == agent.id,
        AgentKnowledgeBase.document_id == document_id
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Doküman bu agent'ın bilgi tabanında bulunamadı")
    
    db.delete(link)
    db.commit()


# ============================================================================
# API Key Management
# ============================================================================

@agents_router.post("/{agent_id}/api-keys", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    agent_id: int,
    request: APIKeyCreateRequest,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """
    Create a new API key for an agent.
    The raw key is ONLY returned in this response — store it securely.
    """
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    # Generate key
    raw_key, key_prefix, key_hash = AgentAPIKey.generate_key(request.key_type)
    
    api_key = AgentAPIKey(
        agent_id=agent.id,
        organization_id=org.id,
        name=request.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        key_type=request.key_type,
        raw_key=raw_key if request.key_type == "public" else None  # Only store raw for public keys
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    logger.info(f"✅ API key created: {key_prefix}... for agent {agent.name}")
    
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        key_type=api_key.key_type,
        is_active=api_key.is_active,
        total_requests=0,
        created_at=api_key.created_at,
        raw_key=raw_key  # Only returned once!
    )


@agents_router.get("/{agent_id}/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    agent_id: int,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """List all API keys for an agent (keys are masked)."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    keys = db.query(AgentAPIKey).filter(
        AgentAPIKey.agent_id == agent.id,
        AgentAPIKey.is_active == True
    ).all()
    
    return [APIKeyResponse(
        id=k.id,
        name=k.name,
        key_prefix=k.key_prefix,
        key_type=k.key_type,
        is_active=k.is_active,
        total_requests=k.total_requests,
        last_used_at=k.last_used_at,
        created_at=k.created_at
    ) for k in keys]


@agents_router.delete("/{agent_id}/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    agent_id: int,
    key_id: int,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Revoke (deactivate) an API key."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    api_key = db.query(AgentAPIKey).filter(
        AgentAPIKey.id == key_id,
        AgentAPIKey.agent_id == agent.id
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key bulunamadı")
    
    api_key.is_active = False
    db.commit()
    
    logger.info(f"✅ API key revoked: {api_key.key_prefix}...")


# ============================================================================
# Agent Test
# ============================================================================

@agents_router.post("/{agent_id}/test")
async def test_agent(
    agent_id: int,
    message: str = "Merhaba, bana yardımcı olabilir misin?",
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Test an agent with a sample message. Returns a preview of how the agent would respond."""
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    # Get knowledge base document count
    kb_count = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.agent_id == agent.id
    ).count()
    
    return {
        "agent": {
            "name": agent.name,
            "system_prompt": agent.system_prompt,
            "model": agent.model_config_data,
            "rag_config": agent.rag_config,
        },
        "knowledge_base_documents": kb_count,
        "test_message": message,
        "status": "ready" if kb_count > 0 else "no_knowledge_base",
        "note": "Full chat test will be available via the public chat API"
    }


# ============================================================================
# Widget Embed Code
# ============================================================================

@agents_router.get("/{agent_id}/embed-code")
async def get_embed_code(
    agent_id: int,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """
    Get the widget embed code for an agent.
    Returns HTML snippet ready to paste into any website.
    Auto-uses the first active public API key.
    """
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    # Get first active public API key — get the raw prefix for display
    api_key = db.query(AgentAPIKey).filter(
        AgentAPIKey.agent_id == agent.id,
        AgentAPIKey.is_active == True,
        AgentAPIKey.key_type == "public"
    ).first()
    
    # For the embed code, we need to use the key_prefix as the identifiable part
    # Since we hash keys, we'll generate a new one if needed and store it
    api_key_for_embed = "NO_API_KEY"
    if not api_key:
        # Auto-create a public key
        raw_key, key_prefix, key_hash = AgentAPIKey.generate_key("public")
        api_key = AgentAPIKey(
            agent_id=agent.id,
            organization_id=org.id,
            name=f"{agent.name} - Widget Key (Auto)",
            key_prefix=key_prefix,
            key_hash=key_hash,
            key_type="public",
            raw_key=raw_key
        )
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
        api_key_for_embed = raw_key
        logger.info(f"✅ Auto-created API key for embed: {key_prefix}... for agent {agent.name}")
    else:
        # Use stored raw_key if available, otherwise prefix
        api_key_for_embed = api_key.raw_key or (api_key.key_prefix + "...")
    
    # Determine API URL from environment
    import os
    api_base_url = os.getenv("API_BASE_URL", "https://api.ragleaf.com")
    widget_url = f"{api_base_url}/widget.js"
    
    appearance = agent.appearance or {}
    primary_color = appearance.get("primary_color", "#4F46E5")
    position = appearance.get("position", "bottom-right")
    
    # Build embed snippet with real API key
    embed_html = f'''<script
  src="{widget_url}"
  data-agent-id="{agent.public_id}"
  data-api-key="{api_key_for_embed}"
  data-api-url="{api_base_url}"
  data-primary-color="{primary_color}"
  data-position="{position}"
  data-title="{agent.name}"
  async
></script>'''
    
    # Build iframe alternative
    iframe_html = f'''<iframe
  src="{api_base_url}/chat/{agent.public_id}"
  width="400" height="600"
  style="border: none; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
  allow="clipboard-write"
></iframe>'''
    
    return {
        "agent_id": agent.id,
        "agent_name": agent.name,
        "public_id": agent.public_id,
        "has_api_key": True,
        "api_key_prefix": api_key.key_prefix + "...",
        "allowed_domains": agent.allowed_domains or [],
        "embed_code": {
            "widget": embed_html,
            "iframe": iframe_html,
        },
        "instructions": {
            "widget": "Script tag'ını sitenizin </body> tag'ından önce yapıştırın. Widget otomatik olarak yüklenecektir.",
            "iframe": "iframe kodunu sayfanıza ekleyin. Boyut ve stili ihtiyacınıza göre ayarlayın."
        },
        "security": {
            "domain_restriction": bool(agent.allowed_domains),
            "rate_limiting": True,
            "api_key_auth": True,
            "cors_protection": bool(agent.allowed_domains),
        },
        "note": "API key güvenliği için sadece 'public' tipinde key kullanın. Domain kısıtlaması ayarlamayı unutmayın."
    }


# ============================================================================
# Agent Document Upload (Tenant self-service)
# ============================================================================

@agents_router.post("/{agent_id}/documents/upload")
async def upload_agent_document(
    agent_id: int,
    file: UploadFile = File(...),
    org: Organization = Depends(get_current_org),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload a document directly to an agent's knowledge base.
    Tenant self-service: uploads the file, creates Document record, and links to agent.
    """
    from pathlib import Path as FilePath
    
    agent = _get_agent_or_404(agent_id, org.id, db)
    
    # Check org document limit
    current_doc_count = db.query(Document).filter(
        Document.organization_id == org.id
    ).count()
    
    if current_doc_count >= org.max_documents:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Doküman limiti aşıldı. Planınız en fazla {org.max_documents} doküman destekliyor."
        )
    
    # Validate file type
    allowed_types = ['.pdf', '.docx', '.txt', '.md']
    file_ext = FilePath(file.filename).suffix.lower()
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen dosya tipi: {file_ext}. İzin verilenler: {allowed_types}"
        )
    
    # Read content
    content = await file.read()
    max_size_mb = 50
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Dosya boyutu {max_size_mb}MB limitini aşıyor"
        )
    
    # Create document record
    doc = Document(
        name=FilePath(file.filename).stem,
        original_filename=file.filename,
        folder_name=f"agent_{agent.id}_{file.filename}",
        file_size=len(content),
        file_type=file_ext[1:],
        status="uploaded",
        organization_id=org.id
    )
    db.add(doc)
    db.flush()
    
    # Update folder_name with ID for uniqueness
    doc.folder_name = f"org_{org.id}_doc_{doc.id}"
    
    # Save file to disk (multi-tenant storage)
    import os
    from backend.services.storage_service import get_storage
    _storage = get_storage()
    upload_dir = str(_storage.get_upload_dir(org.slug, doc.folder_name))
    
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Link document to agent's knowledge base
    kb_link = AgentKnowledgeBase(agent_id=agent.id, document_id=doc.id)
    db.add(kb_link)
    
    # Log usage
    from backend.database.models_platform import UsageLog
    usage = UsageLog(
        organization_id=org.id,
        agent_id=agent.id,
        event_type="doc_upload",
        details={"filename": file.filename, "size": len(content), "document_id": doc.id}
    )
    db.add(usage)
    
    db.commit()
    db.refresh(doc)
    
    logger.info(f"✅ Document uploaded: {file.filename} → agent {agent.name} (org={org.slug})")
    
    return {
        "success": True,
        "document_id": doc.id,
        "filename": file.filename,
        "agent_id": agent.id,
        "status": "uploaded",
        "note": "Doküman yüklendi. İşlenmesi için /process endpoint'ini kullanın."
    }


# ============================================================================
# Helpers
# ============================================================================

def _get_agent_or_404(agent_id: int, org_id: int, db: Session) -> Agent:
    """Get agent by ID, scoped to organization."""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.organization_id == org_id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent bulunamadı"
        )
    
    return agent


def _agent_to_response(agent: Agent, db: Session) -> AgentResponse:
    """Convert Agent model to response with computed fields."""
    doc_count = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.agent_id == agent.id
    ).count()
    
    return AgentResponse(
        id=agent.id,
        public_id=agent.public_id,
        name=agent.name,
        slug=agent.slug,
        description=agent.description,
        avatar_url=agent.avatar_url,
        system_prompt=agent.system_prompt,
        welcome_message=agent.welcome_message,
        personality=agent.personality,
        model_config_data=agent.model_config_data,
        rag_config=agent.rag_config,
        appearance=agent.appearance,
        allowed_domains=agent.allowed_domains,
        rate_limit_per_minute=agent.rate_limit_per_minute,
        rate_limit_per_day=agent.rate_limit_per_day,
        is_active=agent.is_active,
        is_public=agent.is_public,
        total_conversations=agent.total_conversations,
        total_messages=agent.total_messages,
        document_count=doc_count,
        created_at=agent.created_at,
        updated_at=agent.updated_at
    )
