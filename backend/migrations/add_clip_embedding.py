#!/usr/bin/env python3
"""
Migration: Add CLIP embedding fields to document_assets table
Run: python -m backend.migrations.add_clip_embedding
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
    """Add CLIP embedding columns to document_assets table"""
    
    with engine.connect() as conn:
        # Ensure pgvector extension is enabled
        logger.info("🔧 Ensuring pgvector extension is enabled...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'document_assets' 
            AND column_name IN ('clip_embedding', 'clip_embedding_generated_at', 'clip_model_version')
        """))
        existing_columns = [row[0] for row in result.fetchall()]
        
        # Add clip_embedding column (vector 512 for CLIP ViT-B/32)
        if 'clip_embedding' not in existing_columns:
            logger.info("🖼️ Adding 'clip_embedding' column to document_assets table...")
            conn.execute(text("""
                ALTER TABLE document_assets 
                ADD COLUMN clip_embedding vector(512)
            """))
            logger.info("✅ 'clip_embedding' column added (vector 512)")
        else:
            logger.info("⏭️ 'clip_embedding' column already exists")
        
        # Add clip_embedding_generated_at column
        if 'clip_embedding_generated_at' not in existing_columns:
            logger.info("📄 Adding 'clip_embedding_generated_at' column...")
            conn.execute(text("""
                ALTER TABLE document_assets 
                ADD COLUMN clip_embedding_generated_at TIMESTAMP WITH TIME ZONE
            """))
            logger.info("✅ 'clip_embedding_generated_at' column added")
        else:
            logger.info("⏭️ 'clip_embedding_generated_at' column already exists")
        
        # Add clip_model_version column
        if 'clip_model_version' not in existing_columns:
            logger.info("📄 Adding 'clip_model_version' column...")
            conn.execute(text("""
                ALTER TABLE document_assets 
                ADD COLUMN clip_model_version VARCHAR(50)
            """))
            logger.info("✅ 'clip_model_version' column added")
        else:
            logger.info("⏭️ 'clip_model_version' column already exists")
        
        # Create IVFFlat index for CLIP embedding similarity search
        logger.info("🔍 Creating IVFFlat index for CLIP embedding search...")
        
        # Check if index exists
        result = conn.execute(text("""
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'document_assets' 
            AND indexname = 'idx_asset_clip_embedding_ivfflat'
        """))
        index_exists = result.fetchone() is not None
        
        if not index_exists:
            # Count rows to determine if we can create IVFFlat index
            result = conn.execute(text("SELECT COUNT(*) FROM document_assets WHERE clip_embedding IS NOT NULL"))
            row_count = result.fetchone()[0]
            
            if row_count > 0:
                # IVFFlat requires some data to build the index
                conn.execute(text("""
                    CREATE INDEX idx_asset_clip_embedding_ivfflat 
                    ON document_assets 
                    USING ivfflat (clip_embedding vector_cosine_ops)
                    WITH (lists = 100)
                """))
                logger.info("✅ IVFFlat index created")
            else:
                logger.info("⚠️ Skipping IVFFlat index creation (no embeddings yet)")
                logger.info("   Index will be created when first embeddings are added")
        else:
            logger.info("⏭️ IVFFlat index already exists")
        
        conn.commit()
        logger.info("🚀 CLIP embedding migration completed successfully!")


def create_index_if_needed():
    """Create IVFFlat index if embeddings exist but index doesn't"""
    
    with engine.connect() as conn:
        # Check if index exists
        result = conn.execute(text("""
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'document_assets' 
            AND indexname = 'idx_asset_clip_embedding_ivfflat'
        """))
        index_exists = result.fetchone() is not None
        
        if not index_exists:
            # Count rows with embeddings
            result = conn.execute(text("SELECT COUNT(*) FROM document_assets WHERE clip_embedding IS NOT NULL"))
            row_count = result.fetchone()[0]
            
            if row_count > 0:
                logger.info(f"🔍 Creating IVFFlat index ({row_count} embeddings found)...")
                conn.execute(text("""
                    CREATE INDEX idx_asset_clip_embedding_ivfflat 
                    ON document_assets 
                    USING ivfflat (clip_embedding vector_cosine_ops)
                    WITH (lists = 100)
                """))
                conn.commit()
                logger.info("✅ IVFFlat index created")
            else:
                logger.info("⚠️ No embeddings found, index not needed yet")
        else:
            logger.info("✅ IVFFlat index already exists")


if __name__ == "__main__":
    migrate()
