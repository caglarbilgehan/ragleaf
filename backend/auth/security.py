# backend/auth/security.py
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from decouple import config

logger = logging.getLogger(__name__)

# Configuration
SECRET_KEY = config("SECRET_KEY", default="")
if not SECRET_KEY or SECRET_KEY in (
    "your-super-secret-key-change-this-in-production",
    "dev-secret-key-change-in-production",
):
    # Generate a random key for development — warn loudly
    import secrets
    SECRET_KEY = secrets.token_urlsafe(64)
    logger.warning(
        "⚠️  SECRET_KEY is not set or is using a default value! "
        "A random key was generated for this session. "
        "Set a persistent SECRET_KEY in .env for production. "
        "All existing JWT tokens will be invalidated on restart."
    )

ALGORITHM = config("ALGORITHM", default="HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = config("ACCESS_TOKEN_EXPIRE_MINUTES", default=1440, cast=int)

# Password hashing - use pbkdf2_sha256 for stability
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
