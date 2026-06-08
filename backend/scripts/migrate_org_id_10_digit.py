#!/usr/bin/env python3
import sys
import os
import random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import SessionLocal
from sqlalchemy import text

def run():
    db = SessionLocal()
    try:
        # Check if org 99049672 exists
        org = db.execute(text("SELECT id, name, slug FROM organizations WHERE id = 99049672")).fetchone()
        if not org:
            # Maybe it is still 1?
            org = db.execute(text("SELECT id, name, slug FROM organizations WHERE id = 1")).fetchone()
            if not org:
                print("Organization with ID 99049672 or 1 not found.")
                return

        current_id = org.id
        print(f"FOUND ORGANIZATION: ID={current_id} | Name={org.name} | Slug={org.slug}")

        # Generate a random 10-digit ID within signed 32-bit int range [1000000000, 2147483647]
        new_id = random.randint(1000000000, 2147483647)
        while db.execute(text("SELECT 1 FROM organizations WHERE id = :id"), {"id": new_id}).fetchone():
            new_id = random.randint(1000000000, 2147483647)

        print(f"NEW GENERATED 10-DIGIT ID: {new_id}")

        # Let's get all foreign key constraints referencing 'organizations'
        fk_query = """
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            tc.constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'organizations';
        """
        # Note: Distinct query to avoid duplicates
        fks_raw = db.execute(text(fk_query)).fetchall()
        
        # Deduplicate constraints
        seen = set()
        fks = []
        for fk in fks_raw:
            key = (fk.table_name, fk.column_name, fk.constraint_name)
            if key not in seen:
                seen.add(key)
                fks.append(fk)
                
        print(f"Found {len(fks)} unique foreign key constraints referencing 'organizations':")
        for fk in fks:
            print(f"  Table: {fk.table_name} | Column: {fk.column_name} | Constraint: {fk.constraint_name}")

        # Let's execute the migration in a transaction
        print("Starting 10-digit migration transaction...")
        
        # 1. Drop the constraints
        for fk in fks:
            db.execute(text(f"ALTER TABLE {fk.table_name} DROP CONSTRAINT {fk.constraint_name}"))
        print("Dropped foreign key constraints.")

        # 2. Update the parent table (organizations)
        db.execute(text("UPDATE organizations SET id = :new_id WHERE id = :current_id"), {"new_id": new_id, "current_id": current_id})
        print("Updated organizations table primary key.")

        # 3. Update the child tables
        for fk in fks:
            db.execute(text(f"UPDATE {fk.table_name} SET {fk.column_name} = :new_id WHERE {fk.column_name} = :current_id"), {"new_id": new_id, "current_id": current_id})
            print(f"Updated child table '{fk.table_name}' column '{fk.column_name}' from {current_id} to {new_id}.")

        # 4. Recreate the constraints
        for fk in fks:
            db.execute(text(f"""
                ALTER TABLE {fk.table_name} 
                ADD CONSTRAINT {fk.constraint_name} 
                FOREIGN KEY ({fk.column_name}) 
                REFERENCES organizations(id) 
                ON DELETE CASCADE
            """))
        print("Recreated foreign key constraints.")

        db.commit()
        print(f"✅ MIGRATION SUCCESSFUL! Organization ID {current_id} is now {new_id}.")

    except Exception as e:
        db.rollback()
        print(f"❌ MIGRATION FAILED: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
