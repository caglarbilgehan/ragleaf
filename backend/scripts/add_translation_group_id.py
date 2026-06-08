#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine
from sqlalchemy import text, inspect

def run_migration():
    inspector = inspect(engine)
    print("Checking 'writer_articles' table columns...")
    columns = inspector.get_columns('writer_articles')
    column_names = [c['name'] for c in columns]
    
    if 'translation_group_id' not in column_names:
        print("Adding column 'translation_group_id' to 'writer_articles' table...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE writer_articles ADD COLUMN translation_group_id VARCHAR(36) NULL"))
            conn.commit()
        print("✅ Column 'translation_group_id' added successfully!")
    else:
        print("ℹ️ Column 'translation_group_id' already exists.")

if __name__ == "__main__":
    run_migration()
