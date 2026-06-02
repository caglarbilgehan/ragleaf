# backend/api/agent_templates.py
"""
Agent Template API — Sektörel hazır AI asistan şablonları.
Şablon listesi, detay ve şablondan agent oluşturma.
"""

import re
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import (
    Organization, Agent, AgentAPIKey, AgentTemplate
)
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org

logger = logging.getLogger(__name__)

templates_router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class TemplateListItem(BaseModel):
    id: int
    slug: str
    category: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_featured: bool = False
    preview_questions: Optional[List[str]] = None
    config_schema: List[Dict[str, Any]] = []
    
    class Config:
        from_attributes = True


class TemplateDetail(TemplateListItem):
    default_system_prompt: str
    default_welcome_message: Optional[str] = None
    default_personality: Optional[Dict[str, Any]] = None
    default_appearance: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class CreateFromTemplateRequest(BaseModel):
    template_slug: str = Field(..., description="Şablon slug'ı, ör: 'kuafor'")
    config_data: Dict[str, Any] = Field(..., description="Kullanıcının girdiği firma bilgileri")
    agent_name: Optional[str] = Field(None, description="Agent adı (opsiyonel, yoksa şablondan üretilir)")


class CreateFromTemplateResponse(BaseModel):
    id: int
    public_id: str
    name: str
    slug: str
    template_slug: Optional[str] = None
    message: Optional[str] = None
    system_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    api_key: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# Template Helpers
# ============================================================================

def render_template(template_text: str, config_data: Dict[str, Any]) -> str:
    """
    Replace {{placeholder}} values in template text with config_data values.
    Supports special formatting for lists and schedules.
    """
    result = template_text
    
    for key, value in config_data.items():
        placeholder = "{{" + key + "}}"
        
        if isinstance(value, list):
            # Format list as bullet points
            formatted = "\n".join(f"- {item}" for item in value)
            # Also create a formatted version with key suffix
            result = result.replace("{{" + key + "_listesi}}", formatted)
            result = result.replace(placeholder, ", ".join(str(v) for v in value))
        elif isinstance(value, dict):
            # Format dict as key-value pairs (for schedules etc.)
            formatted = "\n".join(f"- {k}: {v}" for k, v in value.items())
            result = result.replace("{{" + key + "_formatted}}", formatted)
            result = result.replace(placeholder, str(value))
        else:
            result = result.replace(placeholder, str(value))
    
    # Clean up any remaining unreplaced placeholders
    result = re.sub(r'\{\{[^}]+\}\}', '[Belirtilmedi]', result)
    
    return result


def slugify(text: str) -> str:
    """Generate URL-safe slug from Turkish text."""
    # Turkish char mapping
    tr_map = str.maketrans({
        'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g',
        'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o',
        'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u',
    })
    slug = text.lower().translate(tr_map)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug).strip('-')
    return slug[:80]


# ============================================================================
# Endpoints — Public (no auth needed for template listing)
# ============================================================================

@templates_router.get(
    "/templates",
    response_model=List[TemplateListItem],
    summary="Tüm aktif şablonları listele"
)
async def list_templates(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Aktif sektörel şablonları döndür. Opsiyonel kategori filtresi."""
    query = db.query(AgentTemplate).filter(AgentTemplate.is_active == True)
    
    if category:
        query = query.filter(AgentTemplate.category == category)
    
    templates = query.order_by(
        AgentTemplate.is_featured.desc(),
        AgentTemplate.sort_order.asc(),
        AgentTemplate.name.asc()
    ).all()
    
    return templates


@templates_router.get(
    "/templates/{slug}",
    response_model=TemplateDetail,
    summary="Şablon detayı"
)
async def get_template(
    slug: str,
    db: Session = Depends(get_db)
):
    """Tek bir şablonun tüm detaylarını döndür."""
    template = db.query(AgentTemplate).filter(
        AgentTemplate.slug == slug,
        AgentTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Şablon bulunamadı: {slug}"
        )
    
    return template


# ============================================================================
# ============================================================================
# Helper — reusable agent creation from template
# ============================================================================

def _create_agent_from_template(
    db: Session,
    template_slug: str,
    config_data: dict,
    org_id: int,
    user_id: int,
    agent_name: str = None
) -> Agent:
    """
    Create an agent from a template. Reusable by both API endpoint
    and the registration auto-onboarding flow.
    """
    template = db.query(AgentTemplate).filter(
        AgentTemplate.slug == template_slug,
        AgentTemplate.is_active == True
    ).first()
    
    if not template:
        raise ValueError(f"Şablon bulunamadı: {template_slug}")
    
    # Render system prompt
    system_prompt = render_template(template.default_system_prompt, config_data)
    welcome_message = render_template(
        template.default_welcome_message or "Merhaba! Size nasıl yardımcı olabilirim?",
        config_data
    )
    
    # Determine agent name
    if not agent_name:
        firma_adi = config_data.get("firma_adi", template.name)
        agent_name = f"{firma_adi} Asistanı"
    
    # Generate unique slug
    base_slug = slugify(agent_name)
    slug = base_slug
    counter = 1
    while db.query(Agent).filter(
        Agent.organization_id == org_id,
        Agent.slug == slug
    ).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Create agent
    personality = dict(template.default_personality or {})
    personality["template_slug"] = template.slug
    personality["template_config"] = config_data
    
    agent = Agent(
        organization_id=org_id,
        name=agent_name,
        slug=slug,
        description=template.description,
        system_prompt=system_prompt,
        welcome_message=welcome_message,
        personality=personality,
        model_config_data={
            "provider": "huggingface",
            "temperature": 0.4,
            "max_tokens": 1024,
            "top_p": 0.9
        },
        rag_config={
            "top_k": 5,
            "similarity_threshold": 0.3,
            "search_method": "hybrid",
            "include_sources": False,
            "max_context_chars": 4000
        },
        appearance=dict(template.default_appearance or {
            "primary_color": "#22c55e",
            "text_color": "#FFFFFF",
            "position": "bottom-right",
            "width": 400,
            "height": 600,
            "show_branding": True,
            "bubble_icon": "chat",
            "border_radius": 16
        }),
        is_active=True,
        is_public=True
    )
    
    db.add(agent)
    db.flush()
    
    # Auto-generate public API key
    raw_key, key_prefix, key_hash = AgentAPIKey.generate_key("public")
    api_key = AgentAPIKey(
        agent_id=agent.id,
        organization_id=org_id,
        name=f"{agent_name} — Widget Key",
        key_prefix=key_prefix,
        key_hash=key_hash,
        raw_key=raw_key,
        key_type="public",
        permissions={"chat": True}
    )
    db.add(api_key)
    
    db.commit()
    db.refresh(agent)
    
    logger.info(f"✅ Agent created from template '{template.slug}': {agent.name} (org_id={org_id})")
    
    return agent


# ============================================================================
# Endpoints — Authenticated (agent creation)
# ============================================================================

@templates_router.post(
    "/agents/from-template",
    response_model=CreateFromTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Şablondan agent oluştur"
)
async def create_agent_from_template(
    request: CreateFromTemplateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(get_current_org)
):
    """
    Sektörel şablondan yeni agent oluştur.
    config_data içindeki bilgiler system_prompt'a yerleştirilir.
    """
    
    # Validate required fields
    template = db.query(AgentTemplate).filter(
        AgentTemplate.slug == request.template_slug,
        AgentTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Şablon bulunamadı: {request.template_slug}"
        )
    
    for field in template.config_schema or []:
        if field.get("required") and field["key"] not in request.config_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Zorunlu alan eksik: {field.get('label', field['key'])}"
            )
    
    # Check agent limit
    agent_count = db.query(Agent).filter(Agent.organization_id == org.id).count()
    if agent_count >= org.max_agents:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Agent limiti doldu ({org.max_agents}). Planınızı yükseltin."
        )
    
    agent = _create_agent_from_template(
        db=db,
        template_slug=request.template_slug,
        config_data=request.config_data,
        org_id=org.id,
        user_id=current_user.id,
        agent_name=request.agent_name
    )
    
    # Get the raw API key for response
    latest_key = db.query(AgentAPIKey).filter(
        AgentAPIKey.agent_id == agent.id
    ).order_by(AgentAPIKey.created_at.desc()).first()
    
    return CreateFromTemplateResponse(
        id=agent.id,
        public_id=agent.public_id,
        name=agent.name,
        slug=agent.slug,
        template_slug=request.template_slug,
        message=f"✅ '{agent.name}' başarıyla oluşturuldu!"
    )

