"""
Debug script for chunk-image relations
"""

import sys
import os
import re
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from backend.database.connection_v2 import SessionLocal
from backend.database.models_v2 import Document, DocumentChunk, DocumentAsset

# Regex pattern for page markers
PAGE_MARKER_PATTERN = re.compile(r'---\s*Sayfa\s+(\d+)\s*---', re.IGNORECASE)

def debug_document(document_id: int = None):
    db = SessionLocal()
    try:
        # Get document
        if document_id:
            docs = db.query(Document).filter(Document.id == document_id).all()
        else:
            docs = db.query(Document).filter(Document.status == 'processed').limit(3).all()
        
        for doc in docs:
            print(f"\n{'='*60}")
            print(f"📄 Document: {doc.name} (ID: {doc.id})")
            print(f"   Status: {doc.status}, Total Chunks: {doc.total_chunks}")
            
            # Get assets
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == doc.id,
                DocumentAsset.asset_type == "image"
            ).all()
            
            print(f"\n🖼️ Assets ({len(assets)} images):")
            for asset in assets[:10]:
                meta = asset.asset_metadata or {}
                print(f"   Asset ID: {asset.id}, Page: {meta.get('page')}, Index: {meta.get('index')}")
                print(f"      File: {Path(asset.file_path).name if asset.file_path else 'N/A'}")
                print(f"      Linked chunks: {meta.get('linked_chunks', [])}")
            
            # Get chunks
            chunks = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == doc.id
            ).order_by(DocumentChunk.chunk_index).all()
            
            print(f"\n📝 Chunks ({len(chunks)} total):")
            
            chunks_with_page_markers = 0
            chunks_with_image_relations = 0
            
            for chunk in chunks[:20]:  # First 20 chunks
                # Check for page markers
                page_matches = PAGE_MARKER_PATTERN.findall(chunk.content)
                has_page_marker = len(page_matches) > 0
                
                if has_page_marker:
                    chunks_with_page_markers += 1
                
                if chunk.image_relations:
                    chunks_with_image_relations += 1
                
                # Show first few chunks with details
                if chunk.chunk_index < 5:
                    print(f"\n   Chunk {chunk.chunk_index} (ID: {chunk.id}):")
                    print(f"      Content preview: {chunk.content[:150]}...")
                    print(f"      Page markers found: {page_matches}")
                    print(f"      Image relations: {chunk.image_relations}")
            
            print(f"\n📊 Summary:")
            print(f"   Chunks with page markers: {chunks_with_page_markers}/{len(chunks)}")
            print(f"   Chunks with image relations: {chunks_with_image_relations}/{len(chunks)}")
            
            # Test extraction manually
            if chunks and assets:
                print(f"\n🔍 Manual extraction test on first chunk:")
                test_chunk = chunks[0]
                page_matches = PAGE_MARKER_PATTERN.findall(test_chunk.content)
                print(f"   Page matches: {page_matches}")
                
                if page_matches:
                    chunk_pages = list(set(int(p) for p in page_matches))
                    print(f"   Chunk pages: {chunk_pages}")
                    
                    # Find matching assets
                    for asset in assets:
                        meta = asset.asset_metadata or {}
                        asset_page = meta.get('page')
                        if asset_page in chunk_pages:
                            print(f"   ✅ Asset {asset.id} (page {asset_page}) should be linked!")
                else:
                    print(f"   ⚠️ No page markers in chunk content!")
                    print(f"   Content sample: {test_chunk.content[:300]}")
                    
    finally:
        db.close()

if __name__ == "__main__":
    doc_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    debug_document(doc_id)
