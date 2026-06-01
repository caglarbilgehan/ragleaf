"""
Data Migration Script: SQLite → PostgreSQL (Simplified)
"""

import sys
import os
sys.path.insert(0, '.')

import sqlite3
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_sqlite_connection():
    db_path = os.path.join(os.path.dirname(__file__), 'backend', 'rag_webui.db')
    if not os.path.exists(db_path):
        logger.warning(f"SQLite database not found: {db_path}")
        return None
    return sqlite3.connect(db_path)


def get_postgres_connection():
    import psycopg2
    from decouple import config
    
    conn = psycopg2.connect(
        host=config("POSTGRES_HOST", default="localhost"),
        port=config("POSTGRES_PORT", default="5432"),
        database=config("POSTGRES_DB", default="ragleaf_db"),
        user=config("POSTGRES_USER", default="ragleaf"),
        password=config("POSTGRES_PASSWORD", default="ragleaf_pass")
    )
    return conn


def migrate_table(sqlite_conn, pg_conn, table_name, columns, pg_table_name=None):
    """Generic table migration"""
    logger.info(f"Migrating {table_name}...")
    
    pg_table = pg_table_name or table_name
    
    try:
        cursor = sqlite_conn.cursor()
        cursor.execute(f"SELECT {','.join(columns)} FROM {table_name}")
        rows = cursor.fetchall()
        
        if not rows:
            logger.info(f"  No data in {table_name}")
            return 0
        
        pg_cursor = pg_conn.cursor()
        
        # Create placeholders
        placeholders = ','.join(['%s'] * len(columns))
        col_names = ','.join(columns)
        
        migrated = 0
        for row in rows:
            try:
                pg_cursor.execute(f"""
                    INSERT INTO {pg_table} ({col_names})
                    VALUES ({placeholders})
                    ON CONFLICT DO NOTHING
                """, row)
                migrated += 1
            except Exception as e:
                pg_conn.rollback()
                logger.warning(f"  Row error: {e}")
                continue
        
        pg_conn.commit()
        
        # Reset sequence if id column exists
        if 'id' in columns:
            try:
                pg_cursor.execute(f"SELECT setval('{pg_table}_id_seq', COALESCE((SELECT MAX(id) FROM {pg_table}), 1))")
                pg_conn.commit()
            except:
                pg_conn.rollback()
        
        logger.info(f"  ✅ Migrated {migrated}/{len(rows)} rows")
        return migrated
        
    except Exception as e:
        pg_conn.rollback()
        logger.error(f"  ❌ Failed: {e}")
        return 0


def main():
    logger.info("=" * 60)
    logger.info("SQLite → PostgreSQL Migration")
    logger.info("=" * 60)
    
    sqlite_conn = get_sqlite_connection()
    if not sqlite_conn:
        logger.error("Could not connect to SQLite")
        return 1
    
    try:
        pg_conn = get_postgres_connection()
        logger.info("✅ Connected to PostgreSQL")
    except Exception as e:
        logger.error(f"Could not connect to PostgreSQL: {e}")
        return 1
    
    total = 0
    
    # Users
    total += migrate_table(sqlite_conn, pg_conn, "users", 
        ["id", "email", "password_hash", "name", "surname", "full_name", "is_active", "is_admin", "created_at", "updated_at", "last_login"])
    
    # Embedding Models
    total += migrate_table(sqlite_conn, pg_conn, "embedding_models",
        ["id", "model_id", "display_name", "description", "dimension", "max_sequence_length", 
         "size_mb", "deployment_type", "api_endpoint", "requires_api_key", "api_key_env_var",
         "multilingual", "performance_tier", "is_active", "is_default", "is_downloaded",
         "provider", "model_family", "created_at", "updated_at", "last_used"])
    
    # Documents (without processing_logs which needs JSON handling)
    total += migrate_table(sqlite_conn, pg_conn, "documents",
        ["id", "folder_name", "name", "original_filename", "file_type", "file_size", "status",
         "processing_stage", "processing_progress", "processing_details",
         "total_pages", "total_chunks", "ocr_completed", "vector_indexed", "embedding_model_id",
         "created_at", "updated_at", "processed_at"])
    
    # AI Providers (table name change)
    total += migrate_table(sqlite_conn, pg_conn, "ai_provider",
        ["id", "name", "display_name", "service_type", "api_url", 
         "priority", "is_enabled", "is_active", "default_model", "default_model_display_name", 
         "created_at", "updated_at"],
        pg_table_name="ai_providers")
    
    # AI Tokens
    total += migrate_table(sqlite_conn, pg_conn, "ai_tokens",
        ["id", "provider_id", "display_name", "api_key", "api_url", "priority", "is_active", "is_available",
         "total_requests", "failed_requests", "last_used_at", "last_error", "last_error_at",
         "requests_per_minute", "requests_per_day", "created_at", "updated_at"])
    
    # Settings (value is JSON, handle separately)
    logger.info("Migrating settings...")
    try:
        cursor = sqlite_conn.cursor()
        cursor.execute("SELECT id, key, value, description, created_at, updated_at FROM settings")
        settings = cursor.fetchall()
        
        pg_cursor = pg_conn.cursor()
        for s in settings:
            try:
                pg_cursor.execute("""
                    INSERT INTO settings (id, key, value, description, created_at, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s, %s)
                    ON CONFLICT (key) DO NOTHING
                """, (s[0], s[1], s[2] or '{}', s[3], s[4], s[5]))
            except Exception as e:
                pg_conn.rollback()
                logger.warning(f"  Settings row error: {e}")
        pg_conn.commit()
        logger.info(f"  ✅ Migrated {len(settings)} settings")
        total += len(settings)
    except Exception as e:
        pg_conn.rollback()
        logger.warning(f"  Settings error: {e}")
    
    logger.info("=" * 60)
    logger.info(f"✅ Migration complete! Total: {total} records")
    logger.info("=" * 60)
    
    sqlite_conn.close()
    pg_conn.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
