"""
Migration: Add round_robin_state table
Date: 2026-01-11
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, text
from database.connection import engine, SessionLocal
from database.models import Base, RoundRobinState
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """Create round_robin_state table"""
    try:
        logger.info("🚀 Starting migration: add_round_robin_state")
        
        # Create table
        RoundRobinState.__table__.create(engine, checkfirst=True)
        
        logger.info("✅ Migration completed successfully")
        logger.info("📊 Table 'round_robin_state' created")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise


if __name__ == "__main__":
    run_migration()

