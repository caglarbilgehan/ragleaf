# backend/database/connection.py
"""
Database Connection Module
Supports both PostgreSQL (production) and SQLite (fallback)
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from decouple import config
import logging

logger = logging.getLogger(__name__)

# Database URL - PostgreSQL as primary, SQLite as fallback
DATABASE_URL = config("DATABASE_URL", default=None)

if DATABASE_URL is None or "sqlite" in DATABASE_URL.lower():
    # SQLite fallback (development/legacy)
    DB_PATH = (Path(__file__).parent.parent / "rag_webui.db").resolve()
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    connect_args = {"check_same_thread": False, "timeout": 30}
    logger.info(f"Using SQLite database: {DB_PATH}")
else:
    # PostgreSQL (production)
    connect_args = {}
    logger.info(f"Using PostgreSQL database")

# SQLAlchemy setup
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_size=10 if "postgresql" in DATABASE_URL else 5,
    max_overflow=20 if "postgresql" in DATABASE_URL else 10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Redis setup - lazy initialization
REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/0")
_redis_client = None

def get_redis():
    """Redis client dependency - lazy initialization"""
    global _redis_client
    if _redis_client is None:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=5)
    return _redis_client

def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all tables"""
    # Import models based on database type
    if "postgresql" in DATABASE_URL:
        # For PostgreSQL, we use connection_v2's base and models
        from . import connection_v2
        from . import models_v2
        from . import models_platform  # Agentik platform models
        
        # Enable pgvector extension before creating tables
        with connection_v2.engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
            conn.commit()
            
        connection_v2.Base.metadata.create_all(bind=connection_v2.engine)
        logger.info("✅ PostgreSQL tables created using models_v2 + models_platform")
    else:
        # SQLite fallback (legacy)
        from . import models
        from . import statistics_model
        Base.metadata.create_all(bind=engine)
        logger.info("Using SQLite models (legacy)")

def check_connection() -> bool:
    """Check database connection"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False

def is_postgresql() -> bool:
    """Check if using PostgreSQL"""
    return "postgresql" in DATABASE_URL
