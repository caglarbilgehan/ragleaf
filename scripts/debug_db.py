
import sys
import os
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from backend.database.connection_v2 import SessionLocal
from backend.database.models_v2 import Document, DocumentChunk

def check_data():
    db = SessionLocal()
    try:
        print("Checking Documents...")
        docs = db.query(Document).all()
        for doc in docs:
            print(f"ID: {doc.id}, Name: {doc.name}, Status: {doc.status}, Total Chunks: {doc.total_chunks}")
            
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
            print(f"  Chunks count: {len(chunks)}")
            for chunk in chunks[:3]: # first 3
                print(f"    Chunk ID: {chunk.id}, Index: {chunk.chunk_index}, Image Rel: {chunk.image_relations}")
                
        print("\nChecking first 5 chunks globally...")
        all_chunks = db.query(DocumentChunk).limit(5).all()
        for c in all_chunks:
            print(f"ID: {c.id}, Document ID: {c.document_id}, Index: {c.chunk_index}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_data()
