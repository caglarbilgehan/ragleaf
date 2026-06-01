"""
Comprehensive migration script - SQLite to PostgreSQL
Migrates all tables: users, documents, models, ai_provider, ai_tokens, embedding_models, settings
"""
import sys
import sqlite3
import json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import User, Document, ModelConfig, AIProvider, AIToken, EmbeddingModel, Settings

def migrate_all():
    sqlite_conn = sqlite3.connect('backend/rag_webui.db')
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    db = SessionLocal()
    
    try:
        # 1. Migrate Models
        print("\n=== Migrating Models ===")
        sqlite_cursor.execute("SELECT * FROM models")
        for row in sqlite_cursor.fetchall():
            if not db.query(ModelConfig).filter(ModelConfig.name == row['name']).first():
                model = ModelConfig(
                    name=row['name'],
                    provider=row['provider'],
                    model_name=row['model_name'],
                    description=row['description'] if 'description' in row.keys() else None,
                    num_ctx=row['num_ctx'] if 'num_ctx' in row.keys() else 32768,
                    num_predict=row['num_predict'] if 'num_predict' in row.keys() else 4096,
                    temperature=row['temperature'] if 'temperature' in row.keys() else 0.3,
                    top_p=row['top_p'] if 'top_p' in row.keys() else 0.9,
                    top_k=row['top_k'] if 'top_k' in row.keys() else 40,
                    repeat_penalty=row['repeat_penalty'] if 'repeat_penalty' in row.keys() else 1.1,
                    is_active=bool(row['is_active']) if 'is_active' in row.keys() else True,
                    is_default=bool(row['is_default']) if 'is_default' in row.keys() else False
                )
                db.add(model)
                print(f"  + {row['name']}")
        db.commit()
        
        # 2. Migrate AI Providers
        print("\n=== Migrating AI Providers ===")
        sqlite_cursor.execute("SELECT * FROM ai_provider")
        for row in sqlite_cursor.fetchall():
            if not db.query(AIProvider).filter(AIProvider.name == row['name']).first():
                provider = AIProvider(
                    name=row['name'],
                    display_name=row['display_name'],
                    service_type=row['service_type'] if 'service_type' in row.keys() else 'inference',
                    api_url=row['api_url'] if 'api_url' in row.keys() else None,
                    priority=row['priority'] if 'priority' in row.keys() else 1,
                    is_enabled=bool(row['is_enabled']) if 'is_enabled' in row.keys() else True,
                    is_active=bool(row['is_active']) if 'is_active' in row.keys() else False,
                    default_model=row['default_model'] if 'default_model' in row.keys() else None,
                    default_model_display_name=row['default_model_display_name'] if 'default_model_display_name' in row.keys() else None
                )
                db.add(provider)
                print(f"  + {row['name']}")
        db.commit()
        
        # 3. Migrate AI Tokens
        print("\n=== Migrating AI Tokens ===")
        sqlite_cursor.execute("SELECT * FROM ai_tokens")
        for row in sqlite_cursor.fetchall():
            # Find provider by ID or name
            provider = db.query(AIProvider).filter(AIProvider.id == row['provider_id']).first()
            if not provider:
                print(f"  ! Skipped token (provider not found): {row['display_name']}")
                continue
            
            if not db.query(AIToken).filter(AIToken.display_name == row['display_name'], AIToken.provider_id == provider.id).first():
                token = AIToken(
                    provider_id=provider.id,
                    display_name=row['display_name'],
                    api_key=row['api_key'],
                    api_url=row['api_url'] if 'api_url' in row.keys() else None,
                    priority=row['priority'] if 'priority' in row.keys() else 1,
                    is_active=bool(row['is_active']) if 'is_active' in row.keys() else True,
                    is_available=bool(row['is_available']) if 'is_available' in row.keys() else True
                )
                db.add(token)
                print(f"  + {row['display_name']}")
        db.commit()
        
        # 4. Migrate Embedding Models
        print("\n=== Migrating Embedding Models ===")
        sqlite_cursor.execute("SELECT * FROM embedding_models")
        for row in sqlite_cursor.fetchall():
            if not db.query(EmbeddingModel).filter(EmbeddingModel.model_id == row['model_id']).first():
                model = EmbeddingModel(
                    model_id=row['model_id'],
                    display_name=row['display_name'],
                    description=row['description'] if 'description' in row.keys() else None,
                    dimension=row['dimension'],
                    max_sequence_length=row['max_sequence_length'] if 'max_sequence_length' in row.keys() else 512,
                    deployment_type=row['deployment_type'] if 'deployment_type' in row.keys() else 'local',
                    multilingual=bool(row['multilingual']) if 'multilingual' in row.keys() else False,
                    is_active=bool(row['is_active']) if 'is_active' in row.keys() else True,
                    is_default=bool(row['is_default']) if 'is_default' in row.keys() else False,
                    is_downloaded=bool(row['is_downloaded']) if 'is_downloaded' in row.keys() else False,
                    provider=row['provider'] if 'provider' in row.keys() else 'huggingface'
                )
                db.add(model)
                print(f"  + {row['model_id']}")
        db.commit()
        
        # 5. Migrate Settings
        print("\n=== Migrating Settings ===")
        sqlite_cursor.execute("SELECT * FROM settings")
        for row in sqlite_cursor.fetchall():
            if not db.query(Settings).filter(Settings.key == row['key']).first():
                value = row['value']
                if isinstance(value, str):
                    try:
                        value = json.loads(value)
                    except:
                        pass
                setting = Settings(
                    key=row['key'],
                    value=value,
                    description=row['description'] if 'description' in row.keys() else None
                )
                db.add(setting)
                print(f"  + {row['key']}")
        db.commit()
        
        # 6. Migrate Documents
        print("\n=== Migrating Documents ===")
        sqlite_cursor.execute("SELECT * FROM documents")
        for row in sqlite_cursor.fetchall():
            if not db.query(Document).filter(Document.folder_name == row['folder_name']).first():
                doc = Document(
                    folder_name=row['folder_name'],
                    name=row['name'],
                    original_filename=row['original_filename'],
                    file_type=row['file_type'],
                    file_size=row['file_size'],
                    status=row['status'] if 'status' in row.keys() else 'uploaded',
                    total_pages=row['total_pages'] if 'total_pages' in row.keys() else None,
                    total_chunks=row['total_chunks'] if 'total_chunks' in row.keys() else None,
                    ocr_completed=bool(row['ocr_completed']) if 'ocr_completed' in row.keys() else False,
                    vector_indexed=bool(row['vector_indexed']) if 'vector_indexed' in row.keys() else False
                )
                db.add(doc)
                print(f"  + {row['name'][:50]}...")
        db.commit()
        
        print("\n" + "=" * 50)
        print("Migration complete!")
        print("=" * 50)
        
        # Final counts
        print(f"\nFinal PostgreSQL counts:")
        print(f"  Users: {db.query(User).count()}")
        print(f"  Documents: {db.query(Document).count()}")
        print(f"  Models: {db.query(ModelConfig).count()}")
        print(f"  AI Providers: {db.query(AIProvider).count()}")
        print(f"  AI Tokens: {db.query(AIToken).count()}")
        print(f"  Embedding Models: {db.query(EmbeddingModel).count()}")
        print(f"  Settings: {db.query(Settings).count()}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        sqlite_conn.close()
        db.close()

if __name__ == "__main__":
    migrate_all()
