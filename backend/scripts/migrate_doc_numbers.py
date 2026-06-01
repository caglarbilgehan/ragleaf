#!/usr/bin/env python3
"""
Migration script to:
1. Add doc_number column to documents table
2. Add departments column to users table  
3. Migrate existing documents to new numbering format (0001_filename)
4. Clean Turkish characters from filenames
5. Rename physical folder paths to match new format
6. Initialize department access settings

Run this script:
    docker cp backend/scripts/migrate_doc_numbers.py ragleaf_api:/tmp/migrate_doc_numbers.py
    docker exec ragleaf_api python /tmp/migrate_doc_numbers.py
"""

import sys
import os
import re
import shutil

sys.path.insert(0, '/app')

from backend.database.connection_v2 import SessionLocal, engine
from backend.database.models_v2 import Settings
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

DOCUMENTS_DIR = "/app/documents"

DEPARTMENTS = [
    "Teknik Servis", "Proje", "Uygulama", "Arge",
    "Satış", "Muhasebe", "Müşteri Hizmetleri"
]

TURKISH_CHAR_MAP = {
    'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O',
    'ç': 'c', 'Ç': 'C', 'ı': 'i', 'İ': 'I'
}


def clean_turkish_chars(text_str):
    for tr_char, ascii_char in TURKISH_CHAR_MAP.items():
        text_str = text_str.replace(tr_char, ascii_char)
    return text_str


def add_doc_number_column():
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'documents' AND column_name = 'doc_number'"
        ))
        if not result.fetchone():
            logger.info("Adding doc_number column...")
            conn.execute(text("ALTER TABLE documents ADD COLUMN doc_number INTEGER UNIQUE"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_doc_number ON documents(doc_number)"))
            conn.commit()
            logger.info("✅ doc_number column added")
        else:
            logger.info("ℹ️ doc_number column already exists")


def add_departments_column():
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'users' AND column_name = 'departments'"
        ))
        if not result.fetchone():
            logger.info("Adding departments column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN departments JSONB DEFAULT '[]'::jsonb"))
            conn.commit()
            logger.info("✅ departments column added")
        else:
            logger.info("ℹ️ departments column already exists")


def extract_clean_name(name):
    """Only remove old doc_XXX_XXX_ format, keep other prefixes like 53115___"""
    match = re.match(r'^doc_\d+_\d+_(.+)$', name)
    if match:
        return match.group(1)
    return name


def migrate_documents_and_folders():
    """Migrate documents using raw SQL"""
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT id, folder_name, name, original_filename, doc_number "
            "FROM documents ORDER BY id"
        ))
        documents = result.fetchall()
        
        if not documents:
            logger.info("No documents to migrate")
            return
        
        logger.info(f"📄 Migrating {len(documents)} documents...")
        logger.info("=" * 60)
        
        migrated = skipped = errors = 0
        
        for doc_id, folder_name, name, original_filename, doc_number in documents:
            try:
                if doc_number is None:
                    doc_number = doc_id
                    conn.execute(text("UPDATE documents SET doc_number = :num WHERE id = :id"),
                                {"num": doc_number, "id": doc_id})
                
                formatted_num = f"{doc_number:04d}"
                base_name = extract_clean_name(folder_name)
                clean_name = clean_turkish_chars(base_name)
                new_folder = f"{formatted_num}_{clean_name}"
                
                if re.match(r'^\d{4}_', folder_name) and folder_name == new_folder:
                    logger.info(f"  [{formatted_num}] Already done: {folder_name}")
                    skipped += 1
                    continue
                
                old_path = os.path.join(DOCUMENTS_DIR, folder_name)
                new_path = os.path.join(DOCUMENTS_DIR, new_folder)
                
                logger.info(f"\n  [{formatted_num}] Doc ID {doc_id}")
                logger.info(f"      Old: {folder_name}")
                logger.info(f"      New: {new_folder}")
                
                if os.path.exists(old_path):
                    if os.path.exists(new_path) and old_path != new_path:
                        logger.warning("      ⚠️ Target exists, skipping rename")
                    elif old_path != new_path:
                        shutil.move(old_path, new_path)
                        logger.info("      ✅ Folder renamed")
                else:
                    logger.warning(f"      ⚠️ Source not found: {old_path}")
                
                clean_orig = clean_turkish_chars(original_filename)
                conn.execute(text(
                    "UPDATE documents SET folder_name = :folder, name = :name, "
                    "original_filename = :orig WHERE id = :id"
                ), {"folder": new_folder, "name": new_folder, "orig": clean_orig, "id": doc_id})
                
                if clean_orig != original_filename:
                    logger.info(f"      Cleaned: {original_filename} -> {clean_orig}")
                
                migrated += 1
            except Exception as e:
                logger.error(f"  ❌ Error doc {doc_id}: {e}")
                errors += 1
        
        conn.commit()
        logger.info("\n" + "=" * 60)
        logger.info(f"Summary: Migrated={migrated}, Skipped={skipped}, Errors={errors}")


def initialize_department_settings():
    """Initialize department access matrix"""
    db = SessionLocal()
    try:
        setting = db.query(Settings).filter(Settings.key == "department_access_matrix").first()
        if not setting:
            default_matrix = {
                "enabled": False,
                "departments": DEPARTMENTS,
                "access_rules": {d: [d] for d in DEPARTMENTS},
                "admin_bypass": True
            }
            setting = Settings(
                key="department_access_matrix",
                value=default_matrix,
                description="Departman bazli dokuman erisim matrisi"
            )
            db.add(setting)
            db.commit()
            logger.info("✅ Department settings initialized")
        else:
            logger.info("ℹ️ Department settings already exist")
    finally:
        db.close()


def verify_migration():
    """Verify migration results"""
    with engine.connect() as conn:
        logger.info("\n🔍 Verifying migration...")
        
        result = conn.execute(text("SELECT COUNT(*) FROM documents WHERE doc_number IS NULL"))
        no_num = result.scalar()
        logger.info(f"   Docs without number: {no_num}")
        
        result = conn.execute(text("SELECT folder_name, original_filename FROM documents"))
        invalid = turkish = 0
        for folder, orig in result.fetchall():
            if not re.match(r'^\d{4}_', folder):
                invalid += 1
            for c in TURKISH_CHAR_MAP.keys():
                if c in folder or c in orig:
                    turkish += 1
                    break
        
        logger.info(f"   Invalid format: {invalid}")
        logger.info(f"   Turkish chars: {turkish}")
        logger.info("✅ Verification complete")


def main():
    logger.info("=" * 60)
    logger.info("🚀 DOCUMENT MIGRATION SCRIPT")
    logger.info("=" * 60)
    
    logger.info("\n1️⃣ Adding database columns...")
    add_doc_number_column()
    add_departments_column()
    
    logger.info("\n2️⃣ Migrating documents...")
    migrate_documents_and_folders()
    
    logger.info("\n3️⃣ Initializing settings...")
    initialize_department_settings()
    
    logger.info("\n4️⃣ Verifying...")
    verify_migration()
    
    logger.info("\n" + "=" * 60)
    logger.info("✅ MIGRATION COMPLETED!")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
