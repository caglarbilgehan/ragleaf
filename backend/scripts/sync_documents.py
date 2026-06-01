"""
Script to sync documents from filesystem to database
"""
import sys
import os
import json
from pathlib import Path
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import Document

def sync_documents():
    db = SessionLocal()
    documents_dir = Path("./documents")
    
    try:
        # Get all document folders
        doc_folders = [f for f in documents_dir.iterdir() 
                       if f.is_dir() and f.name.startswith("doc_")]
        
        print(f"Found {len(doc_folders)} document folders in filesystem")
        
        # Get existing documents in database
        existing_docs = db.query(Document).all()
        existing_folder_names = {doc.folder_name for doc in existing_docs}
        print(f"Found {len(existing_docs)} documents in database")
        
        added_count = 0
        skipped_count = 0
        
        for folder in sorted(doc_folders):
            folder_name = folder.name
            
            if folder_name in existing_folder_names:
                skipped_count += 1
                continue
            
            # Check for metadata.json
            metadata_path = folder / "metadata.json"
            original_folder = folder / "original"
            
            # Try to find original file
            original_file = None
            file_size = 0
            file_type = "pdf"
            
            if original_folder.exists():
                files = list(original_folder.iterdir())
                if files:
                    original_file = files[0]
                    file_size = original_file.stat().st_size
                    file_type = original_file.suffix.lstrip('.') or 'pdf'
            
            # Parse folder name for document name
            # Format: doc_XXX_YYY_DocumentName
            parts = folder_name.split('_', 3)
            if len(parts) >= 4:
                doc_name = parts[3].replace('_', ' ')
            else:
                doc_name = folder_name
            
            original_filename = original_file.name if original_file else f"{doc_name}.pdf"
            
            # Check if already processed (has vectors folder with content)
            vectors_folder = folder / "vectors"
            is_processed = vectors_folder.exists() and any(vectors_folder.iterdir()) if vectors_folder.exists() else False
            
            # Create document record
            doc = Document(
                folder_name=folder_name,
                name=doc_name,
                original_filename=original_filename,
                file_type=file_type,
                file_size=file_size,
                status="processed" if is_processed else "uploaded",
                vector_indexed=is_processed,
                total_pages=None,
                total_chunks=None
            )
            
            db.add(doc)
            added_count += 1
            print(f"  ✅ Added: {doc_name[:50]}...")
        
        db.commit()
        
        print(f"\n📊 Summary:")
        print(f"   Added: {added_count}")
        print(f"   Skipped (already exists): {skipped_count}")
        print(f"   Total in database: {len(existing_docs) + added_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    sync_documents()
