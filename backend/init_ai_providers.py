"""
Initialize AI Providers and migrate data from settings table
Run this script once to set up the new table structure
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.database.connection import engine, SessionLocal
from backend.database.models import Base, AIProvider, AIToken, Settings
import json

def init_tables():
    """Create tables if they don't exist"""
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully")

def seed_default_providers():
    """Add default providers if none exist"""
    db = SessionLocal()
    try:
        # Check if providers exist
        existing = db.query(AIProvider).count()
        if existing > 0:
            print(f"Found {existing} existing providers, skipping seed")
            return
        
        # Default providers
        default_providers = [
            {
                "name": "huggingface",
                "display_name": "HuggingFace",
                "service_type": "inference",
                "api_url": "https://api-inference.huggingface.co/models",
                "priority": 1,
                "is_enabled": True,
                "is_active": False
            },
            {
                "name": "openai",
                "display_name": "OpenAI",
                "service_type": "inference",
                "api_url": "https://api.openai.com/v1",
                "priority": 2,
                "is_enabled": True,
                "is_active": False
            },
            {
                "name": "deepseek",
                "display_name": "DeepSeek",
                "service_type": "inference",
                "api_url": "https://api.deepseek.com/v1",
                "priority": 3,
                "is_enabled": True,
                "is_active": False
            },
            {
                "name": "anthropic",
                "display_name": "Anthropic",
                "service_type": "inference",
                "api_url": "https://api.anthropic.com/v1",
                "priority": 4,
                "is_enabled": True,
                "is_active": False
            }
        ]
        
        for provider_data in default_providers:
            provider = AIProvider(**provider_data)
            db.add(provider)
        
        db.commit()
        print(f"Added {len(default_providers)} default providers")
        
    except Exception as e:
        print(f"Error seeding providers: {e}")
        db.rollback()
    finally:
        db.close()

def migrate_tokens_from_settings():
    """Migrate tokens from settings table to ai_tokens table"""
    db = SessionLocal()
    try:
        # Get ai_services from settings
        setting = db.query(Settings).filter(Settings.key == "ai_services").first()
        if not setting or not setting.value:
            print("No ai_services found in settings, skipping migration")
            return
        
        services = setting.value
        if not isinstance(services, list):
            print("ai_services is not a list, skipping migration")
            return
        
        migrated = 0
        for service in services:
            provider_name = service.get("name")
            api_key = service.get("api_key")
            
            if not provider_name or not api_key:
                continue
            
            # Find provider
            provider = db.query(AIProvider).filter(AIProvider.name == provider_name).first()
            if not provider:
                print(f"Provider '{provider_name}' not found, skipping token")
                continue
            
            # Check if token already exists
            existing = db.query(AIToken).filter(
                AIToken.provider_id == provider.id,
                AIToken.api_key == api_key
            ).first()
            
            if existing:
                print(f"Token already exists for {provider_name}, skipping")
                continue
            
            # Create token
            token = AIToken(
                provider_id=provider.id,
                display_name=service.get("display_name", f"{provider.display_name} Token"),
                api_key=api_key,
                api_url=service.get("api_url"),
                priority=service.get("priority", 1),
                is_active=service.get("is_active", True),
                is_available=service.get("is_available", True)
            )
            db.add(token)
            migrated += 1
        
        db.commit()
        print(f"Migrated {migrated} tokens from settings")
        
    except Exception as e:
        print(f"Error migrating tokens: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    print("=" * 50)
    print("AI Providers Initialization Script")
    print("=" * 50)
    
    # Step 1: Create tables
    init_tables()
    
    # Step 2: Seed default providers
    seed_default_providers()
    
    # Step 3: Migrate tokens from settings
    migrate_tokens_from_settings()
    
    print("=" * 50)
    print("Initialization complete!")
    print("=" * 50)

if __name__ == "__main__":
    main()
