import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.database.connection import engine

def insert_ultimate():
    print("Checking for ultimate plan in database...")
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id FROM plans WHERE key = 'ultimate'")).fetchone()
        if not res:
            print("Inserting ultimate plan...")
            conn.execute(text("""
                INSERT INTO plans (key, name, price, billing_cycle, max_agents, max_documents, max_queries_per_month, max_storage_mb, is_active, has_ai_assistant, has_ai_writer, has_ai_social)
                VALUES ('ultimate', 'Ultimate', 149.00, 'monthly', 50, 2000, 100000, 10000, true, true, true, true)
            """))
            conn.commit()
            print("✅ Ultimate plan inserted successfully!")
        else:
            print("ℹ️ Ultimate plan already exists.")

if __name__ == "__main__":
    insert_ultimate()
