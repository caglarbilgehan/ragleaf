"""
ChatUI Authentication API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
import hashlib
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

from ..database.connection import get_db
from ..auth.security import verify_password, get_password_hash, create_access_token, verify_token, ACCESS_TOKEN_EXPIRE_MINUTES

chatui_auth_router = APIRouter()
security = HTTPBearer(auto_error=False)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    is_admin: bool
    is_active: bool
    created_at: str
    last_login: Optional[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    session_id: str  # Unique session ID for chat-ui conversations


def generate_user_session_id(user_id: int, identifier: str) -> str:
    """Generate a unique session ID for chat-ui based on user ID"""
    session_data = f"chatui_user_{user_id}_{identifier}"
    return hashlib.sha256(session_data.encode()).hexdigest()[:32]


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get current user from JWT token"""
    if not credentials:
        return None
    
    payload = verify_token(credentials.credentials)
    if not payload:
        return None
    
    email = payload.get("sub")
    if not email:
        return None
    
    # Get user from database by email
    result = db.execute(text(
        "SELECT * FROM users WHERE email = :email AND is_active = true"
    ), {"email": email})
    user = result.fetchone()
    
    if user is None:
        return None
    
    return UserResponse(
        id=user.id,
        username=user.email,
        email=user.email,
        full_name=user.full_name,
        is_admin=bool(user.is_admin),
        is_active=bool(user.is_active),
        created_at=user.created_at.isoformat() if user.created_at else "",
        last_login=user.last_login.isoformat() if user.last_login else None
    )


@chatui_auth_router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    try:
        # Get user from database by email
        result = db.execute(text(
            "SELECT * FROM users WHERE email = :email AND is_active = true"
        ), {"email": user_data.email})
        user = result.fetchone()
        
        if not user or not verify_password(user_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-posta veya şifre hatalı"
            )
        
        # Update last login
        db.execute(text(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = :user_id"
        ), {"user_id": user.id})
        db.commit()
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        # Generate unique session ID for this user's chat-ui conversations
        session_id = generate_user_session_id(user.id, user.email)
        
        user_response = UserResponse(
            id=user.id,
            username=user.email,
            email=user.email,
            full_name=user.full_name,
            is_admin=bool(user.is_admin),
            is_active=bool(user.is_active),
            created_at=user.created_at.isoformat() if user.created_at else "",
            last_login=datetime.now().isoformat()
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response,
            session_id=session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Giriş işlemi başarısız")


@chatui_auth_router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user information"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Giriş yapmanız gerekiyor"
        )
    return current_user


@chatui_auth_router.post("/logout")
async def logout():
    """Logout user (client-side token removal)"""
    return {"message": "Başarıyla çıkış yapıldı"}
