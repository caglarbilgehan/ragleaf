#!/usr/bin/env python3
"""
Migration script: Add ragleaf_leaves column to organizations table
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine
from sqlalchemy import text, inspect

def run_migration():
    """Run the migration query"""
    inspector = inspect(engine)
    print("Checking 'organizations' table columns...")
    columns = inspector.get_columns('organizations')
    column_names = [c['name'] for c in columns]
    
    if 'ragleaf_leaves' not in column_names:
        print("Adding column 'ragleaf_leaves' to 'organizations' table...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE organizations ADD COLUMN ragleaf_leaves INTEGER DEFAULT 0 NOT NULL"))
            conn.commit()
        print("✅ Column added successfully!")
    else:
        print("ℹ️ Column 'ragleaf_leaves' already exists in 'organizations' table.")

if __name__ == "__main__":
    run_migration()
