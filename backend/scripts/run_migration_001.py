#!/usr/bin/env python3
"""
Run migration 001: Add operations table
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection_v2 import engine
from sqlalchemy import text

def run_migration():
    """Run the migration"""
    migration_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'migrations',
        '001_add_operations_table.sql'
    )
    
    print(f"📄 Reading migration file: {migration_file}")
    with open(migration_file, 'r') as f:
        sql = f.read()
    
    print("🔄 Executing migration...")
    with engine.connect() as conn:
        # Split by semicolon and execute each statement
        statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
        for stmt in statements:
            if stmt:
                print(f"  Executing: {stmt[:50]}...")
                conn.execute(text(stmt))
        conn.commit()
    
    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
