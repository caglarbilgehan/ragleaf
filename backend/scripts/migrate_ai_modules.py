#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine
from sqlalchemy import text

def run_migration():
    print("Running migration for AI Modules (Assistant, Writer, Social) & Automations...")
    
    with engine.connect() as conn:
        # 1. Add columns to plans table
        print("Adding columns to 'plans' table...")
        conn.execute(text("ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_ai_assistant BOOLEAN NOT NULL DEFAULT TRUE"))
        conn.execute(text("ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_ai_writer BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_ai_social BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE plans ADD COLUMN IF NOT EXISTS ai_writer_price_addon NUMERIC(10, 2) NOT NULL DEFAULT 0.00"))
        conn.execute(text("ALTER TABLE plans ADD COLUMN IF NOT EXISTS ai_social_price_addon NUMERIC(10, 2) NOT NULL DEFAULT 0.00"))
        
        # 2. Add columns to organizations table
        print("Adding columns to 'organizations' table...")
        conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS has_ai_assistant BOOLEAN NOT NULL DEFAULT TRUE"))
        conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS has_ai_writer BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS has_ai_social BOOLEAN NOT NULL DEFAULT FALSE"))
        
        # Ensure that pro/enterprise or existing plan types have active modules if they did before
        # Update existing plans: let's give 'starter' AIAssistant. Let's give 'pro' and 'enterprise' both AI Assistant & AI Writer
        conn.execute(text("UPDATE plans SET has_ai_writer = TRUE WHERE key IN ('pro', 'enterprise')"))
        
        # Update existing organizations based on their current plan type
        conn.execute(text("UPDATE organizations SET has_ai_writer = TRUE WHERE plan IN ('pro', 'enterprise')"))
        
        # 3. Create writer_automations table
        print("Creating 'writer_automations' table...")
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS writer_automations (
            id SERIAL PRIMARY KEY,
            organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
            title VARCHAR(200) NOT NULL,
            interval_days INTEGER NOT NULL DEFAULT 7,
            keywords JSONB DEFAULT '[]'::jsonb,
            mode VARCHAR(30) NOT NULL DEFAULT 'autonomous',
            publishing_platform VARCHAR(50) NOT NULL DEFAULT 'nextjs',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            last_run_at TIMESTAMP WITH TIME ZONE,
            next_run_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        """))
        
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_writer_automations_org ON writer_automations(organization_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_writer_automations_agent ON writer_automations(agent_id)"))
        
        conn.commit()
    print("✅ Migration executed successfully!")

if __name__ == "__main__":
    run_migration()
