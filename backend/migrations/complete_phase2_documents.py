"""
Complete Phase 2 Documents Migration
Add missing embedding metadata columns to documents table
"""

from sqlalchemy import create_engine, text
from backend.database.connection import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upgrade():
    """Add missing embedding metadata columns to documents"""
    logger.info("Adding missing embedding metadata columns to documents table...")
    
    with engine.connect() as conn:
        try:
            # Check existing columns using information_schema (Postgres compatible)
            result = conn.execute(text("""
                SELECT column_name 
                from information_schema.columns 
                where table_name = 'documents'
            """))
            existing_columns = [row[0] for row in result.fetchall()]
            
            # Add embedding_created_at column
            if 'embedding_created_at' not in existing_columns:
                conn.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN embedding_created_at TIMESTAMP WITH TIME ZONE;
                """))
                logger.info("  ✓ Added embedding_created_at column")
            else:
                logger.info("  ✓ embedding_created_at column already exists")
            
            # Add index_type column
            if 'index_type' not in existing_columns:
                conn.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN index_type VARCHAR(50);
                """))
                logger.info("  ✓ Added index_type column")
            else:
                logger.info("  ✓ index_type column already exists")
            
            # Add index_params column
            if 'index_params' not in existing_columns:
                conn.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN index_params TEXT;
                """))
                logger.info("  ✓ Added index_params column")
            else:
                logger.info("  ✓ index_params column already exists")
            
            conn.commit()
            logger.info("✅ All missing columns added successfully")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    upgrade()
