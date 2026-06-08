# backend/api/org_users.py
"""
Tenant User Management API.
Allows org admins/owners to manage users within their organization.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone

from ..database.connection import get_db
from ..database.models import User
from ..database.models_platform import Organization, OrganizationMember
from ..auth.org_dependencies import get_current_org, require_org_role
from ..auth.dependencies import get_current_active_user
from ..auth.security import get_password_hash

import logging
logger = logging.getLogger(__name__)

def generate_unique_user_id(db: Session) -> int:
    import random
    from sqlalchemy import text
    while True:
        user_id = random.randint(10000000, 99999999)
        exists = db.execute(text("SELECT 1 FROM users WHERE id = :id"), {"id": user_id}).fetchone()
        if not exists:
            return user_id

org_users_router = APIRouter(prefix="/api/org/users", tags=["Org Users"])


# ============ Schemas ============

class OrgUserCreate(BaseModel):
    email: str
    name: Optional[str] = None
    surname: Optional[str] = None
    password: str
    role: str = "member"  # member, admin, owner

class OrgUserUpdate(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    is_active: Optional[bool] = None

class OrgUserRoleUpdate(BaseModel):
    role: str  # member, admin, owner

class OrgUserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    surname: Optional[str]
    full_name: Optional[str]
    is_active: bool
    role: str
    joined_at: Optional[str]

    class Config:
        from_attributes = True


# ============ Endpoints ============

@org_users_router.get("", response_model=List[OrgUserResponse])
async def list_org_users(
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """List all users in the current organization."""
    memberships = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.is_active == True
    ).all()
    
    users = []
    for membership in memberships:
        user = db.query(User).filter(User.id == membership.user_id).first()
        if user:
            users.append(OrgUserResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                surname=user.surname,
                full_name=user.full_name,
                is_active=user.is_active,
                role=membership.role,
                joined_at=str(membership.created_at) if membership.created_at else None
            ))
    
    return users


@org_users_router.post("", response_model=OrgUserResponse, status_code=status.HTTP_201_CREATED)
async def create_org_user(
    user_data: OrgUserCreate,
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """
    Create a new user and add them to the current organization.
    Only org admins/owners can create users.
    """
    # Check permission: must be admin or owner in the org
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).first()
    
    # Superadmins can always create users
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    
    if not is_superadmin and (not membership or membership.role not in ('admin', 'owner')):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı oluşturmak için admin veya owner yetkisi gerekli"
        )
    
    # Validate role
    valid_roles = ['member', 'admin', 'owner']
    if user_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geçersiz rol. İzin verilen roller: {', '.join(valid_roles)}"
        )
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    
    if existing_user:
        # Check if already a member of this org
        existing_membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == existing_user.id
        ).first()
        
        if existing_membership:
            if existing_membership.is_active:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Bu kullanıcı zaten organizasyona üye"
                )
            else:
                # Reactivate membership
                existing_membership.is_active = True
                existing_membership.role = user_data.role
                db.commit()
                
                return OrgUserResponse(
                    id=existing_user.id,
                    email=existing_user.email,
                    name=existing_user.name,
                    surname=existing_user.surname,
                    full_name=existing_user.full_name,
                    is_active=existing_user.is_active,
                    role=user_data.role,
                    joined_at=str(existing_membership.created_at) if existing_membership.created_at else None
                )
        
        # Add existing user to this org
        new_membership = OrganizationMember(
            organization_id=org.id,
            user_id=existing_user.id,
            role=user_data.role,
            is_active=True
        )
        db.add(new_membership)
        db.commit()
        
        logger.info(f"✅ Existing user {existing_user.email} added to org {org.slug}")
        
        return OrgUserResponse(
            id=existing_user.id,
            email=existing_user.email,
            name=existing_user.name,
            surname=existing_user.surname,
            full_name=existing_user.full_name,
            is_active=existing_user.is_active,
            role=user_data.role,
            joined_at=None
        )
    
    # Create new user
    full_name = f"{user_data.name or ''} {user_data.surname or ''}".strip() or user_data.email.split('@')[0]
    user_id = generate_unique_user_id(db)
    
    new_user = User(
        id=user_id,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        name=user_data.name,
        surname=user_data.surname,
        full_name=full_name,
        is_active=True,
        is_admin=False,
        default_org_id=org.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    db.flush()  # Set the user ID
    
    # Create membership
    new_membership = OrganizationMember(
        organization_id=org.id,
        user_id=new_user.id,
        role=user_data.role,
        is_active=True
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_user)
    
    logger.info(f"✅ New user created: {new_user.email} in org {org.slug} with role {user_data.role}")
    
    return OrgUserResponse(
        id=new_user.id,
        email=new_user.email,
        name=new_user.name,
        surname=new_user.surname,
        full_name=new_user.full_name,
        is_active=new_user.is_active,
        role=user_data.role,
        joined_at=None
    )


@org_users_router.put("/{user_id}", response_model=OrgUserResponse)
async def update_org_user(
    user_id: int,
    user_data: OrgUserUpdate,
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Update a user's details within the organization."""
    # Verify target user is in the org
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Kullanıcı bu organizasyonda bulunamadı")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    if user_data.name is not None:
        user.name = user_data.name
    if user_data.surname is not None:
        user.surname = user_data.surname
    if user_data.name is not None or user_data.surname is not None:
        user.full_name = f"{user.name or ''} {user.surname or ''}".strip()
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    
    return OrgUserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        surname=user.surname,
        full_name=user.full_name,
        is_active=user.is_active,
        role=membership.role,
        joined_at=str(membership.created_at) if membership.created_at else None
    )


@org_users_router.put("/{user_id}/role", response_model=OrgUserResponse)
async def update_org_user_role(
    user_id: int,
    role_data: OrgUserRoleUpdate,
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Change a user's role within the organization. Requires owner role."""
    # Verify requester is owner
    requester_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).first()
    
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    
    if not is_superadmin and (not requester_membership or requester_membership.role != 'owner'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rol değiştirmek için owner yetkisi gerekli"
        )
    
    # Find target membership
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Kullanıcı bu organizasyonda bulunamadı")
    
    valid_roles = ['member', 'admin', 'owner']
    if role_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geçersiz rol: {', '.join(valid_roles)}"
        )
    
    membership.role = role_data.role
    db.commit()
    
    user = db.query(User).filter(User.id == user_id).first()
    
    return OrgUserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        surname=user.surname,
        full_name=user.full_name,
        is_active=user.is_active,
        role=membership.role,
        joined_at=str(membership.created_at) if membership.created_at else None
    )


@org_users_router.delete("/{user_id}")
async def remove_org_user(
    user_id: int,
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Remove a user from the organization (deactivate membership)."""
    # Can't remove yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendinizi organizasyondan çıkaramazsınız"
        )
    
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Kullanıcı bu organizasyonda bulunamadı")
    
    membership.is_active = False
    db.commit()
    
    logger.info(f"✅ User {user_id} removed from org {org.slug}")
    
    return {"message": "Kullanıcı organizasyondan çıkarıldı", "user_id": user_id}
