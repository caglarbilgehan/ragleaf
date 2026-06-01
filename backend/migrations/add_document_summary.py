#!/usr/bin/env python3
"""
Migration: Add summary fields to documents table
Run: python -m backend.migrations.add_document_summary
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from backend.database.connection_v2 import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    """Add summary and summary_generated_at columns to documents table"""
    
    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'documents' AND column_name IN ('summary', 'summary_generated_at')
        """))
        existing_columns = [row[0] for row in result.fetchall()]
        
        if 'summary' not in existing_columns:
            logger.info("📄 Adding 'summary' column to documents table...")
            conn.execute(text("""
                ALTER TABLE documents 
                ADD COLUMN summary TEXT
            """))
            logger.info("✅ 'summary' column added")
        else:
            logger.info("⏭️ 'summary' column already exists")
        
        if 'summary_generated_at' not in existing_columns:
            logger.info("📄 Adding 'summary_generated_at' column to documents table...")
            conn.execute(text("""
                ALTER TABLE documents 
                ADD COLUMN summary_generated_at TIMESTAMP WITH TIME ZONE
            """))
            logger.info("✅ 'summary_generated_at' column added")
        else:
            logger.info("⏭️ 'summary_generated_at' column already exists")
        
        conn.commit()
        logger.info("🚀 Migration completed successfully!")


if __name__ == "__main__":
    migrate()
