#!/usr/bin/env python3
"""
Migration: Add document_enrichments table and enrichment fields to document_chunks
Run: python -m backend.migrations.add_document_enrichments
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
    """Add document_enrichments table and enrichment columns to document_chunks"""
    
    with engine.connect() as conn:
        # ============================================================
        # 1. Create document_enrichments table
        # ============================================================
        logger.info("🔧 Checking if document_enrichments table exists...")
        
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'document_enrichments'
            )
        """))
        table_exists = result.fetchone()[0]
        
        if not table_exists:
            logger.info("📄 Creating document_enrichments table...")
            conn.execute(text("""
                CREATE TABLE document_enrichments (
                    id SERIAL PRIMARY KEY,
                    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    type VARCHAR(10) NOT NULL CHECK (type IN ('json', 'qa')),
                    title VARCHAR(500) NOT NULL,
                    content TEXT NOT NULL,
                    embedding_chunk_id INTEGER REFERENCES document_chunks(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            logger.info("✅ document_enrichments table created")
            
            # Create indexes
            logger.info("🔍 Creating indexes for document_enrichments...")
            conn.execute(text("""
                CREATE INDEX idx_enrichments_document ON document_enrichments(document_id)
            """))
            conn.execute(text("""
                CREATE INDEX idx_enrichments_type ON document_enrichments(type)
            """))
            logger.info("✅ Indexes created")
        else:
            logger.info("⏭️ document_enrichments table already exists")
        
        # ============================================================
        # 2. Add enrichment columns to document_chunks
        # ============================================================
        logger.info("🔧 Checking document_chunks columns...")
        
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'document_chunks' 
            AND column_name IN ('enrichment_type', 'enrichment_id')
        """))
        existing_columns = [row[0] for row in result.fetchall()]
        
        # Add enrichment_type column
        if 'enrichment_type' not in existing_columns:
            logger.info("📄 Adding 'enrichment_type' column to document_chunks...")
            conn.execute(text("""
                ALTER TABLE document_chunks 
                ADD COLUMN enrichment_type VARCHAR(10) CHECK (enrichment_type IN ('json', 'qa', NULL))
            """))
            logger.info("✅ 'enrichment_type' column added")
        else:
            logger.info("⏭️ 'enrichment_type' column already exists")
        
        # Add enrichment_id column
        if 'enrichment_id' not in existing_columns:
            logger.info("📄 Adding 'enrichment_id' column to document_chunks...")
            conn.execute(text("""
                ALTER TABLE document_chunks 
                ADD COLUMN enrichment_id INTEGER REFERENCES document_enrichments(id) ON DELETE CASCADE
            """))
            logger.info("✅ 'enrichment_id' column added")
            
            # Create partial index for enrichment chunks
            logger.info("🔍 Creating partial index for enrichment chunks...")
            conn.execute(text("""
                CREATE INDEX idx_chunk_enrichment ON document_chunks(enrichment_id) 
                WHERE enrichment_id IS NOT NULL
            """))
            logger.info("✅ Partial index created")
        else:
            logger.info("⏭️ 'enrichment_id' column already exists")
        
        conn.commit()
        logger.info("🚀 Document enrichments migration completed successfully!")


def rollback():
    """Rollback the migration (for development/testing)"""
    
    with engine.connect() as conn:
        logger.info("⚠️ Rolling back document enrichments migration...")
        
        # Drop columns from document_chunks
        try:
            conn.execute(text("DROP INDEX IF EXISTS idx_chunk_enrichment"))
            conn.execute(text("ALTER TABLE document_chunks DROP COLUMN IF EXISTS enrichment_id"))
            conn.execute(text("ALTER TABLE document_chunks DROP COLUMN IF EXISTS enrichment_type"))
            logger.info("✅ Dropped columns from document_chunks")
        except Exception as e:
            logger.warning(f"⚠️ Could not drop columns: {e}")
        
        # Drop document_enrichments table
        try:
            conn.execute(text("DROP TABLE IF EXISTS document_enrichments CASCADE"))
            logger.info("✅ Dropped document_enrichments table")
        except Exception as e:
            logger.warning(f"⚠️ Could not drop table: {e}")
        
        conn.commit()
        logger.info("🔄 Rollback completed")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Document Enrichments Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    args = parser.parse_args()
    
    if args.rollback:
        rollback()
    else:
        migrate()
