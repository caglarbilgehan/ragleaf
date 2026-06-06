# backend/auth/superadmin.py
"""
Super Admin authentication dependency for Ragleaf platform.
Provides platform-level admin access control.

Role hierarchy:
- is_superadmin: Platform-wide access (manage all orgs, global settings)
- is_admin: Backward-compatible org-level admin (existing admin endpoints)
- org member: Tenant-level access via org membership
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database.connection import get_db
from .dependencies import get_current_active_user

import logging
logger = logging.getLogger(__name__)


async def get_superadmin_user(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Require platform-level super admin access.
    Only users with is_superadmin=True can access protected endpoints.
    """
    if not getattr(current_user, 'is_superadmin', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için platform yöneticisi (super admin) yetkisi gerekli"
        )
    return current_user


async def get_admin_or_superadmin(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Require either is_admin or is_superadmin.
    Used for backward-compatible admin endpoints.
    """
    is_admin = getattr(current_user, 'is_admin', False)
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    
    if not (is_admin or is_superadmin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    return current_user
