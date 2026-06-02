# backend/api/auth.py
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from typing import Optional

from ..database.connection import get_db
from ..auth.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from ..auth.dependencies import get_current_user

auth_router = APIRouter()

# Pydantic models
class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    surname: Optional[str] = None
    full_name: Optional[str] = None
    password: str
    phone: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None
    sector: Optional[str] = None
    plan: Optional[str] = "free"
    # Template-based onboarding
    template_slug: Optional[str] = None
    brand_config: Optional[dict] = None

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    surname: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    is_admin: bool
    is_superadmin: bool = False
    default_org_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

def authenticate_user(db: Session, email: str, password: str):
    """Authenticate user with email and password"""
    import logging
    logger = logging.getLogger(__name__)
    
    result = db.execute(text("SELECT * FROM users WHERE email = :email"), {"email": email})
    user = result.fetchone()
    
    if not user:
        logger.info(f"User not found: {email}")
        return None
    
    logger.info(f"User found: {email}, checking password...")
    password_valid = verify_password(password, user.password_hash)
    logger.info(f"Password valid: {password_valid}")
    
    if not password_valid:
        return None
    return user

# Plan limits configuration
PLAN_LIMITS = {
    "free": {"max_agents": 1, "max_documents": 10, "max_queries_per_month": 100, "max_storage_mb": 50},
    "starter": {"max_agents": 3, "max_documents": 100, "max_queries_per_month": 5000, "max_storage_mb": 500},
    "pro": {"max_agents": 10, "max_documents": 500, "max_queries_per_month": 25000, "max_storage_mb": 2000},
    "enterprise": {"max_agents": 999, "max_documents": 9999, "max_queries_per_month": 999999, "max_storage_mb": 50000},
}

@auth_router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user with organization auto-provisioning"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Check if email already exists
    result = db.execute(text("SELECT COUNT(*) as count FROM users WHERE email = :email"), {"email": user_data.email})
    if result.fetchone().count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta adresi zaten kayıtlı"
        )
    
    # Generate full_name if not provided
    full_name = user_data.full_name
    if not full_name and (user_data.name or user_data.surname):
        parts = []
        if user_data.name:
            parts.append(user_data.name)
        if user_data.surname:
            parts.append(user_data.surname)
        full_name = " ".join(parts)
    
    # Create new user
    password_hash = get_password_hash(user_data.password)
    
    db.execute(text("""
        INSERT INTO users (email, password_hash, name, surname, full_name, phone, city, district, company_name, website, sector, is_active, is_admin, created_at, updated_at)
        VALUES (:email, :password_hash, :name, :surname, :full_name, :phone, :city, :district, :company_name, :website, :sector, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """), {
        "email": user_data.email,
        "password_hash": password_hash,
        "name": user_data.name,
        "surname": user_data.surname,
        "full_name": full_name,
        "phone": user_data.phone,
        "city": user_data.city,
        "district": user_data.district,
        "company_name": user_data.company_name,
        "website": user_data.website,
        "sector": user_data.sector,
    })
    db.flush()
    
    # Get created user
    result = db.execute(text("SELECT * FROM users WHERE email = :email"), {"email": user_data.email})
    user = result.fetchone()
    
    # Create organization
    plan = user_data.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    org_name = user_data.company_name or full_name or user_data.email.split("@")[0]
    org_slug = org_name.lower().replace(" ", "-").replace(".", "-")[:50]
    
    # Ensure unique slug
    slug_check = db.execute(text("SELECT COUNT(*) as count FROM organizations WHERE slug = :slug"), {"slug": org_slug})
    if slug_check.fetchone().count > 0:
        org_slug = f"{org_slug}-{user.id}"
    
    db.execute(text("""
        INSERT INTO organizations (name, slug, plan, max_agents, max_documents, max_queries_per_month, max_storage_mb, is_active, created_at, updated_at)
        VALUES (:name, :slug, :plan, :max_agents, :max_documents, :max_queries_per_month, :max_storage_mb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """), {
        "name": org_name,
        "slug": org_slug,
        "plan": plan,
        **limits
    })
    db.flush()
    
    # Get org id
    org_result = db.execute(text("SELECT id FROM organizations WHERE slug = :slug"), {"slug": org_slug})
    org = org_result.fetchone()
    
    # Create membership (owner)
    db.execute(text("""
        INSERT INTO organization_members (organization_id, user_id, role, is_active, created_at, accepted_at)
        VALUES (:org_id, :user_id, 'owner', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """), {"org_id": org.id, "user_id": user.id})
    
    # Set default org
    db.execute(text("UPDATE users SET default_org_id = :org_id WHERE id = :user_id"), 
               {"org_id": org.id, "user_id": user.id})
    
    db.commit()
    logger.info(f"✅ New user registered: {user_data.email}, org: {org_name}, plan: {plan}")
    
    # Auto-create agent from template if template_slug provided
    if user_data.template_slug:
        try:
            from backend.api.agent_templates import _create_agent_from_template
            _create_agent_from_template(
                db=db,
                template_slug=user_data.template_slug,
                config_data=user_data.brand_config or {},
                org_id=org.id,
                user_id=user.id,
                agent_name=org_name + " AI Asistan"
            )
            logger.info(f"✅ Auto-created agent from template: {user_data.template_slug}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to auto-create agent: {e}")
    
    # Auto-login: generate token
    access_token = create_access_token(
        data={"sub": user_data.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            surname=user.surname,
            full_name=full_name,
            is_active=True,
            is_admin=False,
            is_superadmin=False,
            default_org_id=org.id
        )
    )

@auth_router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login and get access token"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"🔐 Login attempt for email: {login_data.email}")
    
    # Use raw SQL to avoid SQLAlchemy model issues
    result = db.execute(text("SELECT * FROM users WHERE email = :email"), {"email": login_data.email})
    user = result.fetchone()
    
    if not user:
        logger.warning(f"❌ User not found: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info(f"✅ User found: {user.email}, ID: {user.id}, Admin: {user.is_admin}")
    
    if not verify_password(login_data.password, user.password_hash):
        logger.warning(f"❌ Invalid password for user: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        logger.warning(f"❌ Inactive user: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    logger.info(f"🔑 Creating access token for user: {user.email}")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Create UserResponse from raw SQL result
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        surname=user.surname,
        full_name=user.full_name,
        is_active=bool(user.is_active),
        is_admin=bool(user.is_admin),
        is_superadmin=bool(getattr(user, 'is_superadmin', False)),
        default_org_id=getattr(user, 'default_org_id', None)
    )
    
    logger.info(f"✅ Login successful for user: {user.email}, Admin: {user.is_admin}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_response
    }

@auth_router.post("/token", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and get access token (OAuth2 form-data for Swagger UI)"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        surname=user.surname,
        full_name=user.full_name,
        is_active=bool(user.is_active),
        is_admin=bool(user.is_admin),
        is_superadmin=bool(getattr(user, 'is_superadmin', False)),
        default_org_id=getattr(user, 'default_org_id', None)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_response
    }

@auth_router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        surname=current_user.surname,
        full_name=current_user.full_name,
        is_active=bool(current_user.is_active),
        is_admin=bool(current_user.is_admin),
        is_superadmin=bool(getattr(current_user, 'is_superadmin', False)),
        default_org_id=getattr(current_user, 'default_org_id', None)
    )

@auth_router.post("/logout")
def logout():
    """Logout (client should delete token)"""
    return {"message": "Successfully logged out"}
