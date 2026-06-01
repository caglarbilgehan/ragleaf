"""
Migration Script: Convert embedding_model_id from String to Integer FK
This script migrates the documents.embedding_model_id column from storing
model names (e.g., 'intfloat/multilingual-e5-large') to storing integer IDs
referencing the embedding_models table.
"""

import sqlite3
import sys
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent / "rag_webui.db"

def migrate():
    """Perform the migration"""
    print(f"📁 Database path: {DB_PATH}")
    
    if not DB_PATH.exists():
        print("❌ Database not found!")
        return False
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Step 1: Check current column type
        cursor.execute("PRAGMA table_info(documents)")
        columns = cursor.fetchall()
        embedding_col = [c for c in columns if c[1] == 'embedding_model_id']
        
        if not embedding_col:
            print("❌ embedding_model_id column not found!")
            return False
        
        current_type = embedding_col[0][2]
        print(f"📊 Current column type: {current_type}")
        
        # Step 2: Get embedding_models mapping (model_id string -> id integer)
        cursor.execute("SELECT id, model_id FROM embedding_models")
        model_mapping = {row[1]: row[0] for row in cursor.fetchall()}
        print(f"📋 Found {len(model_mapping)} embedding models")
        
        # Step 3: Get documents with string embedding_model_id
        cursor.execute("SELECT id, embedding_model_id FROM documents WHERE embedding_model_id IS NOT NULL")
        docs_to_update = cursor.fetchall()
        print(f"📄 Found {len(docs_to_update)} documents with embedding_model_id")
        
        # Step 4: Create new column (SQLite doesn't support ALTER COLUMN type)
        # We'll rename old column, create new one, migrate data, drop old column
        
        # Check if migration already done (if embedding_model_id contains integers)
        if docs_to_update:
            first_value = docs_to_update[0][1]
            try:
                int(first_value)
                print("✅ Migration already completed - values are integers")
                return True
            except (ValueError, TypeError):
                print(f"🔄 Need to migrate - current values are strings (e.g., '{first_value}')")
        
        # Step 5: Update documents with integer IDs
        updated_count = 0
        for doc_id, model_id_str in docs_to_update:
            if model_id_str in model_mapping:
                new_id = model_mapping[model_id_str]
                cursor.execute(
                    "UPDATE documents SET embedding_model_id = ? WHERE id = ?",
                    (str(new_id), doc_id)  # SQLite will store as text but we'll fix column type
                )
                updated_count += 1
                print(f"  ✅ Document {doc_id}: '{model_id_str}' → {new_id}")
            else:
                print(f"  ⚠️ Document {doc_id}: Model '{model_id_str}' not found in embedding_models, setting to NULL")
                cursor.execute(
                    "UPDATE documents SET embedding_model_id = NULL WHERE id = ?",
                    (doc_id,)
                )
        
        conn.commit()
        print(f"\n✅ Migration completed: {updated_count} documents updated")
        
        # Step 6: Recreate table with proper INTEGER type (SQLite limitation)
        print("\n🔄 Recreating table with INTEGER type...")
        
        # Get current table schema
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'")
        create_sql = cursor.fetchone()[0]
        
        # Create backup table
        cursor.execute("ALTER TABLE documents RENAME TO documents_backup")
        
        # Create new table with INTEGER type for embedding_model_id
        new_create_sql = create_sql.replace(
            'embedding_model_id VARCHAR(255)',
            'embedding_model_id INTEGER REFERENCES embedding_models(id)'
        ).replace(
            'embedding_model_id TEXT',
            'embedding_model_id INTEGER REFERENCES embedding_models(id)'
        )
        
        cursor.execute(new_create_sql)
        
        # Copy data, converting string to integer
        cursor.execute("""
            INSERT INTO documents 
            SELECT id, folder_name, name, original_filename, file_type, file_size, 
                   status, processing_stage, processing_progress, processing_details,
                   processing_logs, total_pages, total_chunks, ocr_completed, vector_indexed,
                   CAST(embedding_model_id AS INTEGER) as embedding_model_id,
                   created_at, updated_at, processed_at
            FROM documents_backup
        """)
        
        # Drop backup table
        cursor.execute("DROP TABLE documents_backup")
        
        conn.commit()
        print("✅ Table recreation completed")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Embedding Model ID Migration Script")
    print("=" * 60)
    success = migrate()
    sys.exit(0 if success else 1)
