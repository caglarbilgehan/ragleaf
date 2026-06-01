#!/usr/bin/env python3
"""
Migration: Add Multi-Modal RAG tables
Run: python -m backend.migrations.add_multimodal_tables
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
    """Create Multi-Modal RAG tables"""
    
    with engine.connect() as conn:
        # ============================================================
        # 1. Create multimodal_settings table
        # ============================================================
        logger.info("🔧 Creating multimodal_settings table...")
        
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'multimodal_settings'
            )
        """))
        table_exists = result.fetchone()[0]
        
        if not table_exists:
            conn.execute(text("""
                CREATE TABLE multimodal_settings (
                    id SERIAL PRIMARY KEY,
                    enabled BOOLEAN DEFAULT FALSE,
                    provider VARCHAR(50) DEFAULT 'openai',
                    model VARCHAR(100) DEFAULT 'gpt-4-vision-preview',
                    max_images_per_query INTEGER DEFAULT 3,
                    max_image_size INTEGER DEFAULT 1024,
                    include_ocr BOOLEAN DEFAULT TRUE,
                    include_caption BOOLEAN DEFAULT TRUE,
                    daily_budget_usd FLOAT DEFAULT 10.0,
                    monthly_budget_usd FLOAT DEFAULT 100.0,
                    cache_enabled BOOLEAN DEFAULT TRUE,
                    cache_ttl_hours INTEGER DEFAULT 24,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            
            # Insert default settings
            conn.execute(text("""
                INSERT INTO multimodal_settings (enabled, provider, model)
                VALUES (FALSE, 'openai', 'gpt-4-vision-preview')
            """))
            
            logger.info("✅ multimodal_settings table created with default values")
        else:
            logger.info("⏭️ multimodal_settings table already exists")
        
        # ============================================================
        # 2. Create multimodal_usage table
        # ============================================================
        logger.info("🔧 Creating multimodal_usage table...")
        
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'multimodal_usage'
            )
        """))
        table_exists = result.fetchone()[0]
        
        if not table_exists:
            conn.execute(text("""
                CREATE TABLE multimodal_usage (
                    id SERIAL PRIMARY KEY,
                    provider VARCHAR(50) NOT NULL,
                    model VARCHAR(100) NOT NULL,
                    tokens_used INTEGER NOT NULL,
                    cost_usd FLOAT NOT NULL,
                    image_count INTEGER NOT NULL,
                    query_id VARCHAR(100),
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            
            # Create indexes
            conn.execute(text("""
                CREATE INDEX idx_multimodal_usage_provider ON multimodal_usage(provider)
            """))
            conn.execute(text("""
                CREATE INDEX idx_multimodal_usage_created ON multimodal_usage(created_at)
            """))
            
            logger.info("✅ multimodal_usage table created with indexes")
        else:
            logger.info("⏭️ multimodal_usage table already exists")
        
        # ============================================================
        # 3. Create image_analysis_cache table
        # ============================================================
        logger.info("🔧 Creating image_analysis_cache table...")
        
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'image_analysis_cache'
            )
        """))
        table_exists = result.fetchone()[0]
        
        if not table_exists:
            conn.execute(text("""
                CREATE TABLE image_analysis_cache (
                    id SERIAL PRIMARY KEY,
                    image_hash VARCHAR(64) NOT NULL,
                    analysis_type VARCHAR(50) NOT NULL,
                    analysis_result JSONB NOT NULL,
                    provider VARCHAR(50) NOT NULL,
                    model VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    expires_at TIMESTAMP WITH TIME ZONE
                )
            """))
            
            # Create indexes
            conn.execute(text("""
                CREATE INDEX idx_image_cache_hash_type ON image_analysis_cache(image_hash, analysis_type)
            """))
            
            logger.info("✅ image_analysis_cache table created with indexes")
        else:
            logger.info("⏭️ image_analysis_cache table already exists")
        
        conn.commit()
        logger.info("🚀 Multi-Modal RAG migration completed successfully!")


def rollback():
    """Rollback: Drop Multi-Modal RAG tables"""
    
    with engine.connect() as conn:
        logger.info("⚠️ Rolling back Multi-Modal RAG tables...")
        
        conn.execute(text("DROP TABLE IF EXISTS image_analysis_cache CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS multimodal_usage CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS multimodal_settings CASCADE"))
        
        conn.commit()
        logger.info("✅ Rollback completed")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--rollback", action="store_true", help="Rollback migration")
    args = parser.parse_args()
    
    if args.rollback:
        rollback()
    else:
        migrate()
