# backend/auth/org_dependencies.py
"""
Organization-aware authentication dependencies for Ragleaf platform.
Provides:
- get_current_org() — Get org from authenticated user
- get_agent_from_api_key() — Authenticate via agent API key (for widget/public API)
- require_org_role() — Role-based org access control
"""

from fastapi import Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

from ..database.connection import get_db
from .dependencies import get_current_active_user
from ..database.models_platform import (
    Organization, OrganizationMember, Agent, AgentAPIKey
)

import logging
logger = logging.getLogger(__name__)


async def get_current_org(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Organization:
    """
    Get the current user's active organization.
    Uses the user's default_org_id, or the first org they're a member of.
    Superadmins can access any org (falls back to first available org).
    """
    # First try user's default org
    if current_user.default_org_id:
        org = db.query(Organization).filter(
            Organization.id == current_user.default_org_id,
            Organization.is_active == True
        ).first()
        
        if org:
            # Superadmins don't need membership check
            if getattr(current_user, 'is_superadmin', False):
                return org
            
            # Verify user is still a member
            membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.is_active == True
            ).first()
            
            if membership:
                return org
    
    # Fallback: get first org user belongs to
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).first()
    
    if membership:
        org = db.query(Organization).filter(
            Organization.id == membership.organization_id,
            Organization.is_active == True
        ).first()
        
        if org:
            return org
    
    # Superadmin fallback: return first available org or create default
    if getattr(current_user, 'is_superadmin', False) or getattr(current_user, 'is_admin', False):
        org = db.query(Organization).filter(
            Organization.is_active == True
        ).first()
        
        if org:
            return org
        
        # Create a default organization for the platform
        org = Organization(
            name="Ragleaf Platform",
            slug="ragleaf-platform",
            is_active=True
        )
        db.add(org)
        db.flush()
        
        # Add admin as owner
        member = OrganizationMember(
            organization_id=org.id,
            user_id=current_user.id,
            role="owner",
            is_active=True
        )
        db.add(member)
        db.commit()
        db.refresh(org)
        
        logger.info(f"✅ Default organization created: {org.name} (id={org.id})")
        return org
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Kullanıcı herhangi bir organizasyona ait değil"
    )


async def get_current_org_optional(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Optional[Organization]:
    """
    Get the current user's organization, or None if not in any org.
    Used for endpoints that can work with or without org context.
    """
    try:
        return await get_current_org(current_user=current_user, db=db)
    except HTTPException:
        return None


async def require_org_role(
    role: str,
    current_user=Depends(get_current_active_user),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """
    Require a specific role within the organization.
    Role hierarchy: owner > admin > member
    """
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu organizasyonun üyesi değilsiniz"
        )
    
    role_hierarchy = {"member": 0, "admin": 1, "owner": 2}
    user_level = role_hierarchy.get(membership.role, 0)
    required_level = role_hierarchy.get(role, 0)
    
    if user_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Bu işlem için '{role}' veya üzeri yetki gerekli"
        )
    
    return membership


class AgentAuth:
    """
    Agent authentication result from API key validation.
    """
    def __init__(self, agent: Agent, org: Organization, api_key: AgentAPIKey):
        self.agent = agent
        self.organization = org
        self.api_key = api_key


async def get_agent_from_api_key(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> AgentAuth:
    """
    Authenticate a request using an Agent API key.
    Supports both:
    - Authorization: Bearer ak_xxxx
    - X-API-Key: ak_xxxx
    
    Used for widget and public API endpoints.
    """
    # Extract API key from headers
    raw_key = None
    
    if authorization and authorization.startswith("Bearer "):
        raw_key = authorization[7:].strip()
    elif x_api_key:
        raw_key = x_api_key.strip()
    
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key gerekli. Authorization: Bearer <key> veya X-API-Key: <key> header'ı ekleyin."
        )
    
    # Hash the key and look it up
    key_hash = AgentAPIKey.hash_key(raw_key)
    
    api_key = db.query(AgentAPIKey).filter(
        AgentAPIKey.key_hash == key_hash,
        AgentAPIKey.is_active == True
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz API key"
        )
    
    # Check expiration
    if api_key.expires_at:
        from datetime import datetime, timezone
        if datetime.now(timezone.utc) > api_key.expires_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key süresi dolmuş"
            )
    
    # Get agent
    agent = db.query(Agent).filter(
        Agent.id == api_key.agent_id,
        Agent.is_active == True,
        Agent.is_public == True
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent bulunamadı veya aktif değil"
        )
    
    # Get organization
    org = db.query(Organization).filter(
        Organization.id == api_key.organization_id,
        Organization.is_active == True
    ).first()
    
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organizasyon aktif değil"
        )
    
    # Check domain restriction (for widget embed)
    origin = request.headers.get("origin", "")
    referer = request.headers.get("referer", "")
    request_domain = ""
    
    if origin or referer:
        from urllib.parse import urlparse
        check_url = origin or referer
        parsed = urlparse(check_url)
        request_domain = parsed.hostname or ""
    
    if agent.allowed_domains:
        if request_domain:
            domain_allowed = False
            for allowed in agent.allowed_domains:
                if allowed.startswith("*."):
                    if request_domain.endswith(allowed[2:]):
                        domain_allowed = True
                        break
                elif request_domain == allowed:
                    domain_allowed = True
                    break
            
            if not domain_allowed:
                if request_domain not in ("localhost", "127.0.0.1"):
                    logger.warning(f"🚫 Domain rejected: {request_domain} not in {agent.allowed_domains} (agent={agent.id})")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Bu domain için erişim yetkisi yok: {request_domain}"
                    )
    else:
        # No domain restrictions — log security warning for non-localhost origins
        if request_domain and request_domain not in ("localhost", "127.0.0.1"):
            logger.warning(
                f"⚠️ SECURITY: Agent {agent.id} ({agent.name}) has no domain restrictions! "
                f"Request from: {request_domain} (org={org.slug})"
            )
    
    # --- Usage anomaly detection ---
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    api_key.last_used_at = now
    api_key.total_requests += 1
    
    # Log high-usage patterns (every 100 requests)
    if api_key.total_requests % 100 == 0:
        logger.info(
            f"📊 Usage milestone: API key {api_key.key_prefix}... "
            f"reached {api_key.total_requests} total requests "
            f"(agent={agent.name}, org={org.slug}, last_domain={request_domain})"
        )
    
    # Detect rapid usage (track via simple threshold)
    if api_key.total_requests > 1000 and not agent.allowed_domains:
        logger.warning(
            f"🔴 HIGH USAGE WITHOUT DOMAIN RESTRICTION: "
            f"API key {api_key.key_prefix}... has {api_key.total_requests} requests "
            f"but NO domain restrictions! (agent={agent.name}, org={org.slug})"
        )
    
    db.commit()
    
    return AgentAuth(agent=agent, org=org, api_key=api_key)
