# backend/database/connection_v2.py
"""
PostgreSQL + pgvector Connection Module
Replaces SQLite connection
"""

import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from decouple import config
import logging

logger = logging.getLogger(__name__)

# PostgreSQL connection
POSTGRES_HOST = config("POSTGRES_HOST", default="localhost")
POSTGRES_PORT = config("POSTGRES_PORT", default="5432")
POSTGRES_USER = config("POSTGRES_USER", default="ragleaf")
POSTGRES_PASSWORD = config("POSTGRES_PASSWORD", default="ragleaf_pass")
POSTGRES_DB = config("POSTGRES_DB", default="ragleaf_db")

DATABASE_URL = config(
    "DATABASE_URL", 
    default=f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

# SQLAlchemy setup
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=False  # Set to True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables"""
    from . import models_v2  # Import new models
    
    # Enable pgvector extension before creating tables
    with engine.connect() as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        conn.commit()
    
    Base.metadata.create_all(bind=engine)
    logger.info("✅ PostgreSQL tables created")


def check_connection():
    """Check database connection"""
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False
