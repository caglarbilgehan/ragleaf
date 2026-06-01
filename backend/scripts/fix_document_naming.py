#!/usr/bin/env python3
"""
Document Naming Fix Script
==========================
Bu script:
1. Döküman adlarından numeric prefix'i kaldırır (0023_Installation Manual → Installation Manual)
2. Dosya sistemindeki prefix'leri 4 haneli olarak standardize eder
3. Veritabanı ile dosya sistemini senkronize eder

Kullanım:
    docker exec ragleaf_api python backend/scripts/fix_document_naming.py [--dry-run]
"""

import sys
import os
import re
import shutil
from pathlib import Path

# Add backend to path
sys.path.insert(0, '/app/backend')

from database.connection import SessionLocal
from database.models import Document
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# Documents base path
DOCUMENTS_PATH = Path('/app/documents')


def get_prefix_length(total_docs: int) -> int:
    """Calculate required prefix length based on total documents"""
    if total_docs < 10000:
        return 4
    elif total_docs < 100000:
        return 5
    else:
        return 6


def format_prefix(doc_id: int, prefix_length: int) -> str:
    """Format document ID with leading zeros"""
    return str(doc_id).zfill(prefix_length)


def remove_prefix_from_name(name: str) -> str:
    """Remove numeric prefix from display name"""
    # Remove patterns like "0023_", "023_", "23_" from start
    cleaned = re.sub(r'^\d+_', '', name)
    return cleaned.strip()


def fix_document_naming(dry_run: bool = False):
    """Main function to fix document naming"""
    db = SessionLocal()
    
    try:
        # Get all documents
        documents = db.query(Document).order_by(Document.id).all()
        total_docs = len(documents)
        
        logger.info(f"🔍 Toplam {total_docs} döküman bulundu")
        
        # Calculate prefix length
        prefix_length = get_prefix_length(total_docs)
        logger.info(f"📏 Prefix uzunluğu: {prefix_length} karakter")
        
        fixed_count = 0
        error_count = 0
        
        for doc in documents:
            try:
                changes = []
                new_prefix = format_prefix(doc.id, prefix_length)
                
                # 1. Fix name - remove prefix
                if doc.name:
                    clean_name = remove_prefix_from_name(doc.name)
                    if clean_name != doc.name:
                        changes.append(f"name: '{doc.name}' → '{clean_name}'")
                        if not dry_run:
                            doc.name = clean_name
                
                # 2. Check and fix folder_name prefix
                if doc.folder_name:
                    # Extract current prefix and base name
                    match = re.match(r'^(\d+)_(.+)$', doc.folder_name)
                    if match:
                        current_prefix = match.group(1)
                        base_folder_name = match.group(2)
                        expected_prefix = new_prefix
                        
                        if current_prefix != expected_prefix:
                            new_folder_name = f"{expected_prefix}_{base_folder_name}"
                            old_folder_path = DOCUMENTS_PATH / doc.folder_name
                            new_folder_path = DOCUMENTS_PATH / new_folder_name
                            
                            if old_folder_path.exists() and not new_folder_path.exists():
                                changes.append(f"folder: '{doc.folder_name}' → '{new_folder_name}'")
                                if not dry_run:
                                    shutil.move(str(old_folder_path), str(new_folder_path))
                                    doc.folder_name = new_folder_name
                
                # 3. Check and fix original_filename prefix
                if doc.original_filename:
                    match = re.match(r'^(\d+)_(.+)$', doc.original_filename)
                    if match:
                        current_prefix = match.group(1)
                        base_filename = match.group(2)
                        expected_prefix = new_prefix
                        
                        if current_prefix != expected_prefix:
                            new_filename = f"{expected_prefix}_{base_filename}"
                            
                            # Find and rename the actual file
                            folder_path = DOCUMENTS_PATH / doc.folder_name
                            original_dir = folder_path / "original"
                            
                            if original_dir.exists():
                                # Try to find the file with any prefix
                                for f in original_dir.iterdir():
                                    if f.is_file():
                                        f_match = re.match(r'^\d+_(.+)$', f.name)
                                        if f_match and f_match.group(1) == base_filename:
                                            new_file_path = original_dir / new_filename
                                            if not new_file_path.exists():
                                                changes.append(f"file: '{f.name}' → '{new_filename}'")
                                                if not dry_run:
                                                    shutil.move(str(f), str(new_file_path))
                                            break
                            
                            if not dry_run:
                                doc.original_filename = new_filename
                
                if changes:
                    fixed_count += 1
                    logger.info(f"\n📄 Döküman #{doc.id}:")
                    for change in changes:
                        logger.info(f"   ✏️  {change}")
                
            except Exception as e:
                error_count += 1
                logger.error(f"❌ Döküman #{doc.id} hatası: {e}")
        
        if not dry_run:
            db.commit()
            logger.info(f"\n✅ Değişiklikler kaydedildi")
        else:
            logger.info(f"\n⚠️  DRY RUN - Değişiklikler kaydedilmedi")
        
        logger.info(f"\n📊 Özet:")
        logger.info(f"   Düzeltilen: {fixed_count}")
        logger.info(f"   Hata: {error_count}")
        logger.info(f"   Değişmeyen: {total_docs - fixed_count - error_count}")
        
    except Exception as e:
        logger.error(f"❌ Genel hata: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        logger.info("🔄 DRY RUN modu - değişiklik yapılmayacak\n")
    else:
        logger.info("🚀 Döküman isimlendirme düzeltmesi başlıyor...\n")
    
    fix_document_naming(dry_run=dry_run)
