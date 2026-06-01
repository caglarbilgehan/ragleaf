
import sys
import os
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from backend.database.connection_v2 import SessionLocal
from backend.database.models_v2 import Document, DocumentChunk

def check_data():
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == 16).first()
        if doc:
            print(f"Doc 16 -> Name: {doc.name}, Status: {doc.status}, Total Chunks: {doc.total_chunks}, vector_indexed: {doc.vector_indexed}")
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == 16).all()
            print(f"Chunks count: {len(chunks)}")
        else:
            print("Doc 16 not found")
    finally:
        db.close()

if __name__ == "__main__":
    check_data()
