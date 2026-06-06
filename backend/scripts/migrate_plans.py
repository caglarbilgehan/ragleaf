#!/usr/bin/env python3
"""
Migration script: Create plans table, seed default plans, and add trial_ends_at to organizations
"""
import sys
import os
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine
from database.connection_v2 import Base
from database.models_platform import Plan
from sqlalchemy import text, inspect
from sqlalchemy.orm import sessionmaker

def run_migration():
    """Run migration and seeding"""
    # 1. Add trial_ends_at column to organizations if not exists
    inspector = inspect(engine)
    print("Checking 'organizations' table columns...")
    columns = inspector.get_columns('organizations')
    column_names = [c['name'] for c in columns]
    
    if 'trial_ends_at' not in column_names:
        print("Adding column 'trial_ends_at' to 'organizations' table...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE organizations ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE NULL"))
            # Update existing organizations to have trial_ends_at (e.g. none, or set to null)
            conn.commit()
        print("✅ Column 'trial_ends_at' added successfully!")
    else:
        print("ℹ️ Column 'trial_ends_at' already exists in 'organizations' table.")

    # 2. Create tables (specifically plans table)
    print("Creating 'plans' table if not exists...")
    Base.metadata.create_all(bind=engine)
    print("✅ 'plans' table checked/created!")

    # 3. Seed plans
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        plan_count = db.query(Plan).count()
        if plan_count == 0:
            print("Seeding initial plans...")
            default_plans = [
                Plan(
                    key="starter",
                    name="Starter",
                    price=490.00,
                    billing_cycle="monthly",
                    max_agents=3,
                    max_documents=100,
                    max_queries_per_month=5000,
                    max_storage_mb=500,
                    is_active=True
                ),
                Plan(
                    key="pro",
                    name="Pro",
                    price=1490.00,
                    billing_cycle="monthly",
                    max_agents=10,
                    max_documents=500,
                    max_queries_per_month=25000,
                    max_storage_mb=2000,
                    is_active=True
                ),
                Plan(
                    key="enterprise",
                    name="Enterprise",
                    price=9990.00,
                    billing_cycle="monthly",
                    max_agents=999,
                    max_documents=9999,
                    max_queries_per_month=999999,
                    max_storage_mb=50000,
                    is_active=True
                )
            ]
            db.add_all(default_plans)
            db.commit()
            print("✅ Default plans seeded successfully!")
        else:
            print(f"ℹ️ Plans table already seeded with {plan_count} records.")
            
        # Update existing organizations with 'free' plan to 'starter' with active trial
        print("Updating existing 'free' organizations...")
        with engine.connect() as conn:
            # We will change 'free' plans to 'starter' as we deprecated the free plan
            conn.execute(text("UPDATE organizations SET plan = 'starter' WHERE plan = 'free'"))
            conn.commit()
        print("✅ Existing organizations updated!")
            
    except Exception as e:
        print(f"❌ Migration error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
