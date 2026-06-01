# backend/api/organizations.py
"""
Organization management API for Ragleaf platform.
Handles org creation, membership, and settings.
"""

import re
import logging
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.connection import get_db
from backend.database.models_platform import (
    Organization, OrganizationMember, Agent, UsageLog
)
from backend.database.models_v2 import User, Document
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org, require_org_role

logger = logging.getLogger(__name__)

organizations_router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class OrgCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        if v and not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', v):
            raise ValueError('Slug sadece küçük harf, rakam ve tire içerebilir')
        return v


class OrgUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    logo_url: Optional[str] = None
    settings: Optional[dict] = None


class OrgResponse(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: Optional[str] = None
    plan: str
    max_agents: int
    max_documents: int
    max_queries_per_month: int
    is_active: bool
    created_at: datetime
    
    # Computed stats
    agent_count: Optional[int] = 0
    document_count: Optional[int] = 0
    member_count: Optional[int] = 0
    
    class Config:
        from_attributes = True


class MemberInviteRequest(BaseModel):
    email: str
    role: str = Field(default="member", pattern="^(admin|member)$")


class MemberResponse(BaseModel):
    id: int
    user_id: int
    role: str
    is_active: bool
    created_at: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# Endpoints
# ============================================================================

@organizations_router.post("", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    request: OrgCreateRequest,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new organization and set the creator as owner."""
    # Generate slug from name if not provided
    slug = request.slug
    if not slug:
        slug = re.sub(r'[^a-z0-9]+', '-', request.name.lower()).strip('-')
        if len(slug) < 2:
            slug = f"org-{slug}"
    
    # Check slug uniqueness
    existing = db.query(Organization).filter(Organization.slug == slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{slug}' slug'ı zaten kullanılıyor"
        )
    
    # Check if user already owns an org (free plan limit)
    owned_orgs = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.role == "owner",
        OrganizationMember.is_active == True
    ).count()
    
    if owned_orgs >= 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maksimum 3 organizasyon oluşturabilirsiniz"
        )
    
    # Create organization
    org = Organization(
        name=request.name,
        slug=slug,
        plan="free",
        settings={"default_language": "tr"}
    )
    db.add(org)
    db.flush()  # Get the ID
    
    # Add creator as owner
    membership = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role="owner",
        accepted_at=datetime.now(timezone.utc)
    )
    db.add(membership)
    
    # Set as user's default org if they don't have one
    if not current_user.default_org_id:
        db.execute(
            User.__table__.update()
            .where(User.__table__.c.id == current_user.id)
            .values(default_org_id=org.id)
        )
    
    db.commit()
    db.refresh(org)
    
    logger.info(f"✅ Organization created: {org.name} (slug={org.slug}) by user {current_user.id}")
    
    return OrgResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        logo_url=org.logo_url,
        plan=org.plan,
        max_agents=org.max_agents,
        max_documents=org.max_documents,
        max_queries_per_month=org.max_queries_per_month,
        is_active=org.is_active,
        created_at=org.created_at,
        agent_count=0,
        document_count=0,
        member_count=1
    )


@organizations_router.get("", response_model=List[OrgResponse])
async def list_my_organizations(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all organizations the current user belongs to."""
    memberships = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).all()
    
    results = []
    for membership in memberships:
        org = db.query(Organization).filter(
            Organization.id == membership.organization_id,
            Organization.is_active == True
        ).first()
        
        if not org:
            continue
        
        # Get counts
        agent_count = db.query(Agent).filter(Agent.organization_id == org.id).count()
        doc_count = db.query(Document).filter(Document.organization_id == org.id).count()
        member_count = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.is_active == True
        ).count()
        
        results.append(OrgResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            logo_url=org.logo_url,
            plan=org.plan,
            max_agents=org.max_agents,
            max_documents=org.max_documents,
            max_queries_per_month=org.max_queries_per_month,
            is_active=org.is_active,
            created_at=org.created_at,
            agent_count=agent_count,
            document_count=doc_count,
            member_count=member_count
        ))
    
    return results


@organizations_router.get("/current", response_model=OrgResponse)
async def get_current_organization(
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Get the current user's active organization with stats."""
    agent_count = db.query(Agent).filter(Agent.organization_id == org.id).count()
    doc_count = db.query(Document).filter(Document.organization_id == org.id).count()
    member_count = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.is_active == True
    ).count()
    
    return OrgResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        logo_url=org.logo_url,
        plan=org.plan,
        max_agents=org.max_agents,
        max_documents=org.max_documents,
        max_queries_per_month=org.max_queries_per_month,
        is_active=org.is_active,
        created_at=org.created_at,
        agent_count=agent_count,
        document_count=doc_count,
        member_count=member_count
    )


@organizations_router.put("/current", response_model=OrgResponse)
async def update_current_organization(
    request: OrgUpdateRequest,
    org: Organization = Depends(get_current_org),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update the current organization. Requires admin or owner role."""
    # Check role
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).first()
    
    if not membership or membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin veya owner yetkisi gerekli"
        )
    
    if request.name is not None:
        org.name = request.name
    if request.logo_url is not None:
        org.logo_url = request.logo_url
    if request.settings is not None:
        org.settings = {**(org.settings or {}), **request.settings}
    
    db.commit()
    db.refresh(org)
    
    return OrgResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        logo_url=org.logo_url,
        plan=org.plan,
        max_agents=org.max_agents,
        max_documents=org.max_documents,
        max_queries_per_month=org.max_queries_per_month,
        is_active=org.is_active,
        created_at=org.created_at
    )


@organizations_router.get("/current/members", response_model=List[MemberResponse])
async def list_organization_members(
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """List all members of the current organization."""
    memberships = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.is_active == True
    ).all()
    
    results = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        results.append(MemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            is_active=m.is_active,
            created_at=m.created_at,
            user_email=user.email if user else None,
            user_name=f"{user.name or ''} {user.surname or ''}".strip() if user else None
        ))
    
    return results


@organizations_router.post("/current/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    request: MemberInviteRequest,
    org: Organization = Depends(get_current_org),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Invite a user to the organization by email. Requires admin or owner role."""
    # Check role
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).first()
    
    if not membership or membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Üye davet etmek için admin veya owner yetkisi gerekli"
        )
    
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{request.email}' e-postasıyla kayıtlı kullanıcı bulunamadı"
        )
    
    # Check if already a member
    existing = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user.id
    ).first()
    
    if existing:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bu kullanıcı zaten organizasyon üyesi"
            )
        else:
            # Reactivate
            existing.is_active = True
            existing.role = request.role
            db.commit()
            db.refresh(existing)
            return MemberResponse(
                id=existing.id,
                user_id=existing.user_id,
                role=existing.role,
                is_active=existing.is_active,
                created_at=existing.created_at,
                user_email=user.email,
                user_name=f"{user.name or ''} {user.surname or ''}".strip()
            )
    
    # Create membership
    new_member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role=request.role,
        invited_by=current_user.id,
        invited_at=datetime.now(timezone.utc),
        accepted_at=datetime.now(timezone.utc)  # Auto-accept for now
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    
    logger.info(f"✅ User {user.email} invited to org {org.slug} as {request.role}")
    
    return MemberResponse(
        id=new_member.id,
        user_id=new_member.user_id,
        role=new_member.role,
        is_active=new_member.is_active,
        created_at=new_member.created_at,
        user_email=user.email,
        user_name=f"{user.name or ''} {user.surname or ''}".strip()
    )


@organizations_router.delete("/current/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: int,
    org: Organization = Depends(get_current_org),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a member from the organization. Requires owner role."""
    # Check caller is owner
    caller_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).first()
    
    if not caller_membership or caller_membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Üye çıkarmak için owner yetkisi gerekli"
        )
    
    # Find target membership
    target = db.query(OrganizationMember).filter(
        OrganizationMember.id == member_id,
        OrganizationMember.organization_id == org.id
    ).first()
    
    if not target:
        raise HTTPException(status_code=404, detail="Üye bulunamadı")
    
    # Can't remove yourself if you're the only owner
    if target.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendinizi organizasyondan çıkaramazsınız"
        )
    
    target.is_active = False
    db.commit()
    
    logger.info(f"✅ Member {member_id} removed from org {org.slug}")
