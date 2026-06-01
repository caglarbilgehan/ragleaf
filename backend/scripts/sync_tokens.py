import sqlite3
import sys
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import AIToken, AIProvider

conn = sqlite3.connect('backend/rag_webui.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

db = SessionLocal()

print("=== Syncing AI Tokens from SQLite to PostgreSQL ===\n")

# Get all tokens from SQLite
cursor.execute('SELECT * FROM ai_tokens')
sqlite_tokens = cursor.fetchall()

print(f"Found {len(sqlite_tokens)} tokens in SQLite\n")

for row in sqlite_tokens:
    display_name = row['display_name']
    api_key = row['api_key']
    
    # Check if this token already exists in PostgreSQL (by api_key)
    existing = db.query(AIToken).filter(AIToken.api_key == api_key).first()
    
    if existing:
        print(f"  ⏭️  Exists: {display_name}")
    else:
        # Find provider
        provider = db.query(AIProvider).filter(AIProvider.name == 'huggingface').first()
        if not provider:
            print(f"  ❌ No HuggingFace provider found!")
            continue
            
        token = AIToken(
            provider_id=provider.id,
            display_name=display_name,
            api_key=api_key,
            priority=row['priority'] if 'priority' in row.keys() else 1,
            is_active=True,
            is_available=True
        )
        db.add(token)
        print(f"  ✅ Added: {display_name}")

db.commit()

# Show final PostgreSQL tokens
print("\n=== PostgreSQL AI Tokens ===")
pg_tokens = db.query(AIToken).all()
for t in pg_tokens:
    print(f"  {t.display_name}: {t.api_key[:20]}...")

db.close()
conn.close()
