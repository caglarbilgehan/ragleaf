"""
Script to migrate users from SQLite (rag_webui.db) to PostgreSQL
"""
import sys
import sqlite3
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import User

def migrate_users():
    # Connect to SQLite
    sqlite_conn = sqlite3.connect('backend/rag_webui.db')
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    # Get PostgreSQL session
    db = SessionLocal()
    
    try:
        # Get all users from SQLite
        sqlite_cursor.execute("SELECT * FROM users")
        sqlite_users = sqlite_cursor.fetchall()
        
        print(f"Found {len(sqlite_users)} users in SQLite database")
        
        added_count = 0
        skipped_count = 0
        
        for row in sqlite_users:
            email = row['email']
            
            # Check if user exists in PostgreSQL
            existing_user = db.query(User).filter(User.email == email).first()
            
            if existing_user:
                print(f"  ⏭️  Skipped (exists): {email}")
                skipped_count += 1
                continue
            
            # Create user in PostgreSQL
            user = User(
                email=email,
                password_hash=row['password_hash'],
                name=row['name'] if 'name' in row.keys() else None,
                surname=row['surname'] if 'surname' in row.keys() else None,
                full_name=row['full_name'] if 'full_name' in row.keys() else None,
                is_active=bool(row['is_active']) if 'is_active' in row.keys() else True,
                is_admin=bool(row['is_admin']) if 'is_admin' in row.keys() else False
            )
            
            db.add(user)
            added_count += 1
            print(f"  ✅ Added: {email}")
        
        db.commit()
        
        print(f"\n📊 Summary:")
        print(f"   Added: {added_count}")
        print(f"   Skipped (already exists): {skipped_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        sqlite_conn.close()
        db.close()

if __name__ == "__main__":
    migrate_users()
