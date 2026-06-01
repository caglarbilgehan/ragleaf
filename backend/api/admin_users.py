# backend/api/admin_users.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import bcrypt
import logging

logger = logging.getLogger(__name__)

from ..database.connection import get_db
from ..auth.dependencies import get_current_admin_user

admin_users_router = APIRouter()

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    surname: Optional[str]
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    departments: Optional[List[str]] = []
    created_at: str
    updated_at: str
    last_login: Optional[str]

class UserCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    surname: Optional[str] = None
    password: str
    is_active: bool = True
    is_admin: bool = False
    departments: Optional[List[str]] = []

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    surname: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    departments: Optional[List[str]] = None

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

@admin_users_router.get("", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get all users with pagination and search"""
    try:
        # Build query with search
        base_query = "SELECT * FROM users"
        params = {}
        
        if search:
            base_query += " WHERE (email LIKE :search OR name LIKE :search OR surname LIKE :search OR full_name LIKE :search)"
            params["search"] = f"%{search}%"
        
        base_query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
        params.update({"limit": limit, "skip": skip})
        
        result = db.execute(text(base_query), params)
        users = []
        
        for row in result:
            # Parse departments from JSONB
            departments = []
            if hasattr(row, 'departments') and row.departments:
                departments = row.departments if isinstance(row.departments, list) else []
            
            users.append(UserResponse(
                id=row.id,
                email=row.email,
                name=row.name,
                surname=row.surname,
                full_name=row.full_name,
                is_active=bool(row.is_active),
                is_admin=bool(row.is_admin),
                departments=departments,
                created_at=row.created_at.isoformat() if row.created_at else "",
                updated_at=row.updated_at.isoformat() if row.updated_at else "",
                last_login=row.last_login.isoformat() if row.last_login else None
            ))
        
        return users
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(status_code=500, detail="Kullanıcılar alınırken hata oluştu")

@admin_users_router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get single user by ID"""
    try:
        result = db.execute(text("SELECT * FROM users WHERE id = :user_id"), {"user_id": user_id})
        user = result.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Parse departments from JSONB
        departments = []
        if hasattr(user, 'departments') and user.departments:
            departments = user.departments if isinstance(user.departments, list) else []
        
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            surname=user.surname,
            full_name=user.full_name,
            is_active=bool(user.is_active),
            is_admin=bool(user.is_admin),
            departments=departments,
            created_at=user.created_at.isoformat() if user.created_at else "",
            updated_at=user.updated_at.isoformat() if user.updated_at else "",
            last_login=user.last_login.isoformat() if user.last_login else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Kullanıcı alınırken hata oluştu")

@admin_users_router.post("", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Create new user"""
    try:
        # Check if email already exists
        result = db.execute(text(
            "SELECT COUNT(*) as count FROM users WHERE email = :email"
        ), {"email": user_data.email})
        
        if result.fetchone().count > 0:
            raise HTTPException(
                status_code=400,
                detail="Bu e-posta adresi zaten kullanılıyor"
            )
        
        # Hash password
        password_hash = hash_password(user_data.password)
        
        # Generate full_name
        full_name = None
        if user_data.name or user_data.surname:
            parts = []
            if user_data.name:
                parts.append(user_data.name)
            if user_data.surname:
                parts.append(user_data.surname)
            full_name = " ".join(parts)
        
        # Create user
        import json
        departments_json = json.dumps(user_data.departments or [])
        
        db.execute(text("""
            INSERT INTO users (email, password_hash, name, surname, full_name, is_active, is_admin, departments, created_at, updated_at)
            VALUES (:email, :password_hash, :name, :surname, :full_name, :is_active, :is_admin, CAST(:departments AS jsonb), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """), {
            "email": user_data.email,
            "password_hash": password_hash,
            "name": user_data.name,
            "surname": user_data.surname,
            "full_name": full_name,
            "is_active": user_data.is_active,
            "is_admin": user_data.is_admin,
            "departments": departments_json
        })
        
        db.commit()
        
        # Get created user
        result = db.execute(text(
            "SELECT * FROM users WHERE email = :email"
        ), {"email": user_data.email})
        user = result.fetchone()
        
        # Parse departments from JSONB
        departments = []
        if hasattr(user, 'departments') and user.departments:
            departments = user.departments if isinstance(user.departments, list) else []
        
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            surname=user.surname,
            full_name=user.full_name,
            is_active=bool(user.is_active),
            is_admin=bool(user.is_admin),
            departments=departments,
            created_at=user.created_at.isoformat() if user.created_at else "",
            updated_at=user.updated_at.isoformat() if user.updated_at else "",
            last_login=user.last_login.isoformat() if user.last_login else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Kullanıcı oluşturulurken hata oluştu")

@admin_users_router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Update user"""
    try:
        logger.info(f"Updating user {user_id} with data: {user_data.dict(exclude_unset=True)}")
        
        # Check if user exists
        result = db.execute(text("SELECT * FROM users WHERE id = :user_id"), {"user_id": user_id})
        user = result.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Build update query
        update_fields = []
        params = {"user_id": user_id}
        
        if user_data.email is not None:
            # Check if new email already exists
            result = db.execute(text(
                "SELECT COUNT(*) as count FROM users WHERE email = :email AND id != :user_id"
            ), {"email": user_data.email, "user_id": user_id})
            
            if result.fetchone().count > 0:
                raise HTTPException(
                    status_code=400,
                    detail="Bu e-posta adresi zaten kullanılıyor"
                )
            
            update_fields.append("email = :email")
            params["email"] = user_data.email
        
        if user_data.name is not None:
            update_fields.append("name = :name")
            params["name"] = user_data.name
        
        if user_data.surname is not None:
            update_fields.append("surname = :surname")
            params["surname"] = user_data.surname
        
        if user_data.password is not None:
            password_hash = hash_password(user_data.password)
            update_fields.append("password_hash = :password_hash")
            params["password_hash"] = password_hash
        
        if user_data.is_active is not None:
            update_fields.append("is_active = :is_active")
            params["is_active"] = user_data.is_active
        
        if user_data.is_admin is not None:
            update_fields.append("is_admin = :is_admin")
            params["is_admin"] = user_data.is_admin
        
        # Update departments if provided
        if user_data.departments is not None:
            import json
            update_fields.append("departments = CAST(:departments AS jsonb)")
            params["departments"] = json.dumps(user_data.departments)
            logger.info(f"Updating departments for user {user_id}: {user_data.departments}")
        
        # Update full_name if name or surname changed
        if user_data.name is not None or user_data.surname is not None:
            # Get current values
            current_name = user_data.name if user_data.name is not None else user.name
            current_surname = user_data.surname if user_data.surname is not None else user.surname
            
            full_name = None
            if current_name or current_surname:
                parts = []
                if current_name:
                    parts.append(current_name)
                if current_surname:
                    parts.append(current_surname)
                full_name = " ".join(parts)
            
            update_fields.append("full_name = :full_name")
            params["full_name"] = full_name
        
        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            update_query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = :user_id"
            logger.info(f"Executing query: {update_query} with params: {params}")
            db.execute(text(update_query), params)
            db.commit()
            logger.info(f"User {user_id} updated successfully")
        
        # Get updated user
        result = db.execute(text("SELECT * FROM users WHERE id = :user_id"), {"user_id": user_id})
        user = result.fetchone()
        
        # Parse departments from JSONB
        departments = []
        if hasattr(user, 'departments') and user.departments:
            departments = user.departments if isinstance(user.departments, list) else []
        
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            surname=user.surname,
            full_name=user.full_name,
            is_active=bool(user.is_active),
            is_admin=bool(user.is_admin),
            departments=departments,
            created_at=user.created_at.isoformat() if user.created_at else "",
            updated_at=user.updated_at.isoformat() if user.updated_at else "",
            last_login=user.last_login.isoformat() if user.last_login else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Kullanıcı güncellenirken hata oluştu")

@admin_users_router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Delete user"""
    try:
        # Check if user exists
        result = db.execute(text("SELECT * FROM users WHERE id = :user_id"), {"user_id": user_id})
        user = result.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Prevent deleting main admin
        if user.email == "admin@ragleaf.com":
            raise HTTPException(status_code=400, detail="Ana admin hesabı silinemez")
        
        # Delete user
        db.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id})
        db.commit()
        
        return {"message": "Kullanıcı başarıyla silindi"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Kullanıcı silinirken hata oluştu")
