# backend/api/agent_templates.py
"""
Agent Template API — Sektörel hazır AI asistan şablonları.
Şablon listesi, detay ve şablondan agent oluşturma.
"""

import re
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from pathlib import Path as FilePath
import os
import json

from backend.database.connection import get_db
from backend.database.models_v2 import Document
from backend.database.models_platform import (
    Organization, Agent, AgentAPIKey, AgentTemplate, AgentTemplateDocument
)
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org
from backend.api.agents import _auto_process_document

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
    agent_name: str = None,
    welcome_message: str = None,
    agent_description: str = None
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
    # Use user-provided welcome message or fall back to template
    if not welcome_message:
        welcome_message = render_template(
            template.default_welcome_message or "Merhaba! Size nasıl yardımcı olabilirim?",
            config_data
        )
    
    # Use user-provided description or fall back to template
    description = agent_description or template.description
    
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
        description=description,
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


@templates_router.get(
    "/public/plans",
    summary="Aktif planları ve fiyatlarını listele"
)
async def list_public_plans(db: Session = Depends(get_db)):
    """Aktif paketleri ve fiyatlarını döndürür."""
    from backend.database.models_platform import Plan
    plans = db.query(Plan).filter(Plan.is_active == True).order_by(Plan.price.asc()).all()
    return [
        {
            "id": p.id,
            "key": p.key,
            "name": p.name,
            "price": float(p.price),
            "billing_cycle": p.billing_cycle,
            "max_agents": p.max_agents,
            "max_documents": p.max_documents,
            "max_queries_per_month": p.max_queries_per_month,
            "max_storage_mb": p.max_storage_mb
        }
        for p in plans
    ]


# ============================================================================
# Admin CRUD & Document Management Endpoints (Hazır Asistan Düzenleme & Geliştirme)
# ============================================================================

class TemplateCreate(BaseModel):
    slug: str
    category: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    default_system_prompt: str
    default_welcome_message: Optional[str] = None
    default_personality: Optional[Dict[str, Any]] = None
    default_appearance: Optional[Dict[str, Any]] = None
    config_schema: List[Dict[str, Any]] = []
    preview_questions: Optional[List[str]] = None
    is_active: Optional[bool] = True
    is_featured: Optional[bool] = False
    sort_order: Optional[int] = 0

class TemplateUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    default_system_prompt: Optional[str] = None
    default_welcome_message: Optional[str] = None
    default_personality: Optional[Dict[str, Any]] = None
    default_appearance: Optional[Dict[str, Any]] = None
    config_schema: Optional[List[Dict[str, Any]]] = None
    preview_questions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None

def verify_admin(current_user = Depends(get_current_active_user)):
    if not (current_user.is_admin or current_user.is_superadmin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için yönetici yetkisi gerekiyor"
        )
    return current_user

@templates_router.post("/admin/templates", response_model=TemplateDetail, summary="Yeni şablon oluştur")
async def admin_create_template(
    request: TemplateCreate,
    db: Session = Depends(get_db),
    admin = Depends(verify_admin)
):
    existing = db.query(AgentTemplate).filter(AgentTemplate.slug == request.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"'{request.slug}' slug'ına sahip şablon zaten mevcut")
        
    template = AgentTemplate(**request.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@templates_router.put("/admin/templates/{template_id}", response_model=TemplateDetail, summary="Şablon güncelle")
async def admin_update_template(
    template_id: int,
    request: TemplateUpdate,
    db: Session = Depends(get_db),
    admin = Depends(verify_admin)
):
    template = db.query(AgentTemplate).filter(AgentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
        
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
        
    db.commit()
    db.refresh(template)
    return template

@templates_router.delete("/admin/templates/{template_id}", summary="Şablon sil")
async def admin_delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    admin = Depends(verify_admin)
):
    template = db.query(AgentTemplate).filter(AgentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
        
    db.delete(template)
    db.commit()
    return {"success": True, "message": "Şablon başarıyla silindi"}

@templates_router.post("/admin/templates/{template_id}/documents/upload", summary="Şablona döküman yükle")
async def admin_upload_template_document(
    template_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin = Depends(verify_admin)
):
    template = db.query(AgentTemplate).filter(AgentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
        
    system_org = db.query(Organization).filter(Organization.is_system == True).first()
    system_org_id = system_org.id if system_org else None
    system_org_slug = system_org.slug if system_org else "system"
    
    allowed_types = ['.pdf', '.docx', '.txt', '.md']
    file_ext = FilePath(file.filename).suffix.lower()
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen dosya tipi: {file_ext}. İzin verilenler: {allowed_types}"
        )
        
    content = await file.read()
    max_size_mb = 50
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Dosya boyutu {max_size_mb}MB limitini aşıyor"
        )
        
    doc = Document(
        name=FilePath(file.filename).stem,
        original_filename=file.filename,
        folder_name=f"template_{template.id}_{file.filename}",
        file_size=len(content),
        file_type=file_ext[1:],
        status="uploaded",
        organization_id=system_org_id
    )
    db.add(doc)
    db.flush()
    
    doc.folder_name = f"org_system_doc_{doc.id}"
    
    import os
    from backend.services.storage_service import get_storage
    _storage = get_storage()
    upload_dir = str(_storage.get_upload_dir(system_org_slug, doc.folder_name))
    
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(content)
        
    link = AgentTemplateDocument(template_id=template.id, document_id=doc.id)
    db.add(link)
    db.commit()
    db.refresh(doc)
    
    background_tasks.add_task(_auto_process_document, doc.id)
    return {
        "success": True,
        "document_id": doc.id,
        "filename": file.filename,
        "template_id": template.id,
        "status": "uploaded",
        "auto_processing": True
    }

@templates_router.get("/admin/templates/{template_id}/documents", summary="Şablon dökümanlarını listele")
async def admin_list_template_documents(
    template_id: int,
    db: Session = Depends(get_db),
    admin = Depends(verify_admin)
):
    template = db.query(AgentTemplate).filter(AgentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
        
    links = db.query(AgentTemplateDocument).filter(AgentTemplateDocument.template_id == template.id).all()
    documents = []
    for link in links:
        doc = db.query(Document).filter(Document.id == link.document_id).first()
        if doc:
            documents.append({
                "id": doc.id,
                "name": doc.name,
                "original_filename": doc.original_filename,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "status": doc.status,
                "processing_stage": doc.processing_stage,
                "processing_progress": doc.processing_progress or 0,
                "total_chunks": doc.total_chunks,
                "vector_indexed": doc.vector_indexed,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            })
    return {"template_id": template.id, "documents": documents, "total": len(documents)}

@templates_router.delete("/admin/templates/{template_id}/documents/{document_id}", summary="Şablondan döküman ilişkisini kaldır")
async def admin_delete_template_document(
    template_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    admin = Depends(verify_admin)
):
    link = db.query(AgentTemplateDocument).filter(
        AgentTemplateDocument.template_id == template_id,
        AgentTemplateDocument.document_id == document_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Döküman bu şablona bağlı bulunamadı")
        
    db.delete(link)
    
    other_links = db.query(AgentTemplateDocument).filter(
        AgentTemplateDocument.document_id == document_id
    ).count()
    
    if other_links == 0:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            db.delete(doc)
            
    db.commit()
    return {"success": True, "message": "Döküman ilişkisi başarıyla kaldırıldı"}


