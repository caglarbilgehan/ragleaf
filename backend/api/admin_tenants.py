# backend/api/admin_tenants.py
"""
Admin Tenant Management API.
Super admin can list, view, and manage tenants (organizations).
Includes KVKK-compliant document access control.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Query, status, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.connection import get_db
from backend.database.models_platform import (
    Organization, OrganizationMember, Agent, AgentAPIKey, Appointment
)
from backend.database.models_v2 import Document
from backend.auth.dependencies import get_current_active_user

logger = logging.getLogger(__name__)

admin_tenants_router = APIRouter()


# ============================================================================
# Auth guard — only superadmin
# ============================================================================

async def require_superadmin(current_user=Depends(get_current_active_user)):
    if not (current_user.is_superadmin or current_user.is_admin):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    return current_user


# ============================================================================
# Schemas
# ============================================================================

class TenantListItem(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: Optional[str] = None
    plan: str
    is_active: bool
    is_system: bool = False
    allow_admin_doc_access: bool
    max_agents: int
    max_documents: int
    has_ai_assistant: bool = True
    has_ai_writer: bool = False
    has_ai_social: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    ragleaf_leaves: int = 0
    # Computed
    user_count: int = 0
    agent_count: int = 0
    document_count: int = 0
    appointment_count: int = 0


class TenantDetail(TenantListItem):
    max_queries_per_month: int
    max_storage_mb: int
    settings: Optional[Dict[str, Any]] = None


class TenantUpdateRequest(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None
    max_agents: Optional[int] = None
    max_documents: Optional[int] = None
    max_queries_per_month: Optional[int] = None
    max_storage_mb: Optional[int] = None
    has_ai_assistant: Optional[bool] = None
    has_ai_writer: Optional[bool] = None
    has_ai_social: Optional[bool] = None


class KVKKToggleRequest(BaseModel):
    allow_admin_doc_access: bool


class PlanResponse(BaseModel):
    id: int
    key: str
    name: str
    price: float
    billing_cycle: str
    max_agents: int
    max_documents: int
    max_queries_per_month: int
    max_storage_mb: int
    is_active: bool
    has_ai_assistant: bool = True
    has_ai_writer: bool = False
    has_ai_social: bool = False
    ai_writer_price_addon: float = 0.0
    ai_social_price_addon: float = 0.0

    class Config:
        from_attributes = True


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    billing_cycle: Optional[str] = None
    max_agents: Optional[int] = None
    max_documents: Optional[int] = None
    max_queries_per_month: Optional[int] = None
    max_storage_mb: Optional[int] = None
    is_active: Optional[bool] = None
    has_ai_assistant: Optional[bool] = None
    has_ai_writer: Optional[bool] = None
    has_ai_social: Optional[bool] = None
    ai_writer_price_addon: Optional[float] = None
    ai_social_price_addon: Optional[float] = None


# ============================================================================
# Endpoints
# ============================================================================

@admin_tenants_router.get(
    "/admin/tenants",
    response_model=List[TenantListItem],
    summary="Tüm tenantları listele"
)
async def list_tenants(
    search: Optional[str] = None,
    plan: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """List all tenants with computed stats."""
    query = db.query(Organization)

    if search:
        query = query.filter(
            Organization.name.ilike(f"%{search}%") |
            Organization.slug.ilike(f"%{search}%")
        )
    if plan:
        query = query.filter(Organization.plan == plan)
    if is_active is not None:
        query = query.filter(Organization.is_active == is_active)

    orgs = query.order_by(Organization.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for org in orgs:
        user_count = db.query(func.count(OrganizationMember.id)).filter(
            OrganizationMember.organization_id == org.id
        ).scalar() or 0

        agent_count = db.query(func.count(Agent.id)).filter(
            Agent.organization_id == org.id
        ).scalar() or 0

        document_count = db.query(func.count(Document.id)).filter(
            Document.organization_id == org.id
        ).scalar() or 0

        appointment_count = db.query(func.count(Appointment.id)).filter(
            Appointment.organization_id == org.id
        ).scalar() or 0

        result.append(TenantListItem(
            id=org.id,
            name=org.name,
            slug=org.slug,
            logo_url=org.logo_url,
            plan=org.plan,
            is_active=org.is_active,
            is_system=org.is_system or False,
            allow_admin_doc_access=org.allow_admin_doc_access or False,
            max_agents=org.max_agents,
            max_documents=org.max_documents,
            created_at=org.created_at,
            updated_at=org.updated_at,
            ragleaf_leaves=org.ragleaf_leaves,
            user_count=user_count,
            agent_count=agent_count,
            document_count=document_count,
            appointment_count=appointment_count,
        ))

    return result


@admin_tenants_router.get(
    "/admin/tenants/stats",
    summary="Tenant genel istatistikleri"
)
async def tenant_stats(
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """Overall tenant statistics for admin dashboard."""
    total = db.query(func.count(Organization.id)).scalar() or 0
    active = db.query(func.count(Organization.id)).filter(
        Organization.is_active == True
    ).scalar() or 0

    # Plan distribution
    plan_counts = db.query(
        Organization.plan, func.count(Organization.id)
    ).group_by(Organization.plan).all()

    total_agents = db.query(func.count(Agent.id)).scalar() or 0
    total_appointments = db.query(func.count(Appointment.id)).scalar() or 0

    return {
        "total_tenants": total,
        "active_tenants": active,
        "inactive_tenants": total - active,
        "total_agents": total_agents,
        "total_appointments": total_appointments,
        "plan_distribution": {plan: count for plan, count in plan_counts},
    }


@admin_tenants_router.get(
    "/admin/tenants/{tenant_id}",
    response_model=TenantDetail,
    summary="Tenant detayı"
)
async def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """Get detailed tenant information."""
    org = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tenant bulunamadı")

    user_count = db.query(func.count(OrganizationMember.id)).filter(
        OrganizationMember.organization_id == org.id
    ).scalar() or 0

    agent_count = db.query(func.count(Agent.id)).filter(
        Agent.organization_id == org.id
    ).scalar() or 0

    document_count = db.query(func.count(Document.id)).filter(
        Document.organization_id == org.id
    ).scalar() or 0

    appointment_count = db.query(func.count(Appointment.id)).filter(
        Appointment.organization_id == org.id
    ).scalar() or 0

    return TenantDetail(
        id=org.id,
        name=org.name,
        slug=org.slug,
        logo_url=org.logo_url,
        plan=org.plan,
        is_active=org.is_active,
        is_system=org.is_system or False,
        allow_admin_doc_access=org.allow_admin_doc_access or False,
        max_agents=org.max_agents,
        max_documents=org.max_documents,
        max_queries_per_month=org.max_queries_per_month,
        max_storage_mb=org.max_storage_mb,
        settings=org.settings,
        created_at=org.created_at,
        updated_at=org.updated_at,
        ragleaf_leaves=org.ragleaf_leaves,
        user_count=user_count,
        agent_count=agent_count,
        document_count=document_count,
        appointment_count=appointment_count,
    )


@admin_tenants_router.patch(
    "/admin/tenants/{tenant_id}",
    summary="Tenant bilgilerini güncelle"
)
async def update_tenant(
    tenant_id: int,
    request: TenantUpdateRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """Update tenant plan, limits, or status."""
    org = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tenant bulunamadı")

    # System tenant protection
    if org.is_system:
        # Only allow limited updates on system tenant
        update_data = request.model_dump(exclude_unset=True)
        forbidden = {'is_active'}
        blocked = forbidden & set(update_data.keys())
        if blocked:
            raise HTTPException(
                status_code=403,
                detail=f"Sistem tenant'ında bu alanlar değiştirilemez: {', '.join(blocked)}"
            )
    else:
        update_data = request.model_dump(exclude_unset=True)

    # Auto-apply plan limits on plan change if limits are not explicitly passed
    if "plan" in update_data:
        new_plan = update_data["plan"]
        from sqlalchemy import text
        plan_db = db.execute(text("SELECT max_agents, max_documents, max_queries_per_month, max_storage_mb FROM plans WHERE key = :key AND is_active = true"), {"key": new_plan}).fetchone()
        if plan_db:
            if "max_agents" not in update_data:
                org.max_agents = plan_db.max_agents
            if "max_documents" not in update_data:
                org.max_documents = plan_db.max_documents
            if "max_queries_per_month" not in update_data:
                org.max_queries_per_month = plan_db.max_queries_per_month
            if "max_storage_mb" not in update_data:
                org.max_storage_mb = plan_db.max_storage_mb

    for field, value in update_data.items():
        setattr(org, field, value)

    db.commit()
    db.refresh(org)

    logger.info(f"Admin updated tenant {org.slug}: {update_data}")
    return {"detail": "Tenant güncellendi", "id": org.id}


@admin_tenants_router.get(
    "/admin/tenants/{tenant_id}/users",
    summary="Tenant kullanıcıları"
)
async def get_tenant_users(
    tenant_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """Get all users of a specific tenant."""
    org = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tenant bulunamadı")

    from backend.database.models_v2 import User

    members = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id
    ).all()

    users = []
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        if user:
            users.append({
                "id": user.id,
                "email": user.email,
                "first_name": user.name,
                "last_name": user.surname,
                "role": member.role,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            })

    return {"tenant_id": tenant_id, "users": users, "total": len(users)}


@admin_tenants_router.get(
    "/admin/tenants/{tenant_id}/agents",
    summary="Tenant agentları"
)
async def get_tenant_agents(
    tenant_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """Get all agents of a specific tenant."""
    agents = db.query(Agent).filter(Agent.organization_id == tenant_id).all()

    return {
        "tenant_id": tenant_id,
        "agents": [
            {
                "id": a.id,
                "public_id": a.public_id,
                "name": a.name,
                "slug": a.slug,
                "is_active": a.is_active,
                "is_system": a.is_system or False,
                "total_conversations": a.total_conversations or 0,
                "total_messages": a.total_messages or 0,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in agents
        ],
        "total": len(agents),
    }


@admin_tenants_router.get(
    "/admin/tenants/{tenant_id}/documents",
    summary="Tenant dokümanları (KVKK kontrollü)"
)
async def get_tenant_documents(
    tenant_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """
    Get tenant documents — only if KVKK access is granted.
    Returns document metadata only (not content).
    """
    org = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tenant bulunamadı")

    if not org.allow_admin_doc_access:
        return {
            "tenant_id": tenant_id,
            "kvkk_access": False,
            "message": "Bu tenant KVKK kapsamında doküman erişim izni vermemiş. "
                       "Tenant ayarlarından 'Teknik Destek Erişimi' etkinleştirilmelidir.",
            "documents": [],
            "total": 0,
        }

    docs = db.query(Document).filter(Document.organization_id == tenant_id).all()

    return {
        "tenant_id": tenant_id,
        "kvkk_access": True,
        "documents": [
            {
                "id": d.id,
                "name": d.name,
                "file_type": d.file_type,
                "file_size": d.file_size,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ],
        "total": len(docs),
    }


@admin_tenants_router.get(
    "/admin/tenants/{tenant_id}/appointments",
    summary="Tenant randevuları"
)
async def get_tenant_appointments(
    tenant_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """Get recent appointments for a tenant (read-only)."""
    appointments = db.query(Appointment).filter(
        Appointment.organization_id == tenant_id
    ).order_by(Appointment.appointment_date.desc()).limit(limit).all()

    return {
        "tenant_id": tenant_id,
        "appointments": [
            {
                "id": a.id,
                "public_id": a.public_id,
                "customer_name": a.customer_name,
                "service_type": a.service_type,
                "appointment_date": a.appointment_date.isoformat() if a.appointment_date else None,
                "status": a.status,
            }
            for a in appointments
        ],
        "total": len(appointments),
    }


@admin_tenants_router.post(
    "/admin/tenants/{tenant_id}/agents/{agent_id}/documents/upload",
    summary="Admin: Tenant agent'ına döküman yükle"
)
async def admin_upload_tenant_document(
    tenant_id: int,
    agent_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """
    Admin uploads a document to a tenant's agent.
    Requires KVKK doc access permission from the tenant.
    Auto-processes the document after upload.
    """
    from pathlib import Path as FilePath
    from backend.database.models_platform import AgentKnowledgeBase, UsageLog

    # Verify tenant exists
    org = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tenant bulunamadı")

    # KVKK check
    if not org.allow_admin_doc_access:
        raise HTTPException(
            status_code=403,
            detail="Bu tenant KVKK kapsamında doküman erişim izni vermemiş. "
                   "Tenant ayarlarından 'Teknik Destek Erişimi' etkinleştirilmelidir."
        )

    # Verify agent belongs to tenant
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.organization_id == tenant_id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent bulunamadı veya bu tenant'a ait değil")

    # Validate file type
    allowed_types = ['.pdf', '.docx', '.txt', '.md']
    file_ext = FilePath(file.filename).suffix.lower()
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya tipi: {file_ext}. İzin verilenler: {allowed_types}"
        )

    # Read content
    content = await file.read()
    max_size_mb = 50
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Dosya boyutu {max_size_mb}MB limitini aşıyor")

    # Create document record
    doc = Document(
        name=FilePath(file.filename).stem,
        original_filename=file.filename,
        folder_name=f"admin_upload_{tenant_id}_{file.filename}",
        file_size=len(content),
        file_type=file_ext[1:],
        status="uploaded",
        organization_id=tenant_id
    )
    db.add(doc)
    db.flush()

    # Update folder_name with ID for uniqueness
    doc.folder_name = f"org_{tenant_id}_doc_{doc.id}"

    # Save file to disk
    import os
    from backend.services.storage_service import get_storage
    _storage = get_storage()
    upload_dir = str(_storage.get_upload_dir(org.slug, doc.folder_name))

    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Link to agent's knowledge base
    kb_link = AgentKnowledgeBase(agent_id=agent.id, document_id=doc.id)
    db.add(kb_link)

    # Log usage
    usage = UsageLog(
        organization_id=tenant_id,
        agent_id=agent.id,
        event_type="doc_upload",
        details={
            "filename": file.filename,
            "size": len(content),
            "document_id": doc.id,
            "uploaded_by": "admin"
        }
    )
    db.add(usage)

    db.commit()
    db.refresh(doc)

    # Auto-process in background
    from backend.api.agents import _auto_process_document
    background_tasks.add_task(_auto_process_document, doc.id)

    logger.info(f"✅ Admin uploaded document: {file.filename} → agent {agent.name} (tenant={org.slug})")

    return {
        "success": True,
        "document_id": doc.id,
        "filename": file.filename,
        "agent_id": agent.id,
        "tenant_id": tenant_id,
        "auto_processing": True,
        "note": "Doküman yüklendi ve otomatik işleme başlatıldı."
    }


@admin_tenants_router.delete(
    "/admin/tenants/{tenant_id}",
    summary="Tenant'ı kalıcı olarak sil"
)
async def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_superadmin)
):
    """
    Permanently delete a tenant (Organization).
    Cascades database records and deletes physical storage files.
    """
    org = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tenant bulunamadı")
        
    if org.is_system:
        raise HTTPException(status_code=403, detail="Sistem tenant'ı silinemez")
        
    org_slug = org.slug
    
    # 1. Clean up users belonging solely to this tenant
    members = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == tenant_id
    ).all()
    
    from backend.database.models_v2 import User
    for member in members:
        # Check if they belong to any other orgs
        other_org_count = db.query(OrganizationMember).filter(
            OrganizationMember.user_id == member.user_id,
            OrganizationMember.organization_id != tenant_id
        ).count()
        
        if other_org_count == 0:
            user = db.query(User).filter(User.id == member.user_id).first()
            if user:
                db.delete(user)
                
    # 2. Delete organization record from DB (triggers CASCADE delete on agents, links, members, docs)
    db.delete(org)
    db.commit()
    
    # 3. Clean up physical storage files
    try:
        from backend.services.storage_service import get_storage
        get_storage().delete_tenant_storage(org_slug)
    except Exception as e:
        logger.error(f"Failed to delete storage for tenant {org_slug}: {e}")
        
    logger.info(f"🗑️ Admin permanently deleted tenant {org_slug} (id={tenant_id})")
    
    return {"success": True, "detail": f"Tenant '{org_slug}' ve ilişkili tüm verileri silindi."}


@admin_tenants_router.get(
    "/admin/plans",
    response_model=List[PlanResponse],
    summary="Tüm planları listele"
)
async def list_plans(
    db: Session = Depends(get_db),
    current_user = Depends(require_superadmin)
):
    """Sistemdeki tüm planları (aktif/pasif) listeler."""
    from backend.database.models_platform import Plan
    plans = db.query(Plan).order_by(Plan.price.asc()).all()
    return plans


@admin_tenants_router.put(
    "/admin/plans/{plan_id}",
    response_model=PlanResponse,
    summary="Plan güncelle"
)
async def update_plan(
    plan_id: int,
    request: PlanUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_superadmin)
):
    """Belirli bir planın fiyat ve limitlerini günceller."""
    from backend.database.models_platform import Plan
    plan_obj = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan_obj:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan_obj, field, value)

    db.commit()
    db.refresh(plan_obj)
    
    logger.info(f"Admin updated plan {plan_obj.key}: {update_data}")
    return plan_obj

