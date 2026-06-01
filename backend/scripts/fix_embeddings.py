#!/usr/bin/env python3
"""
Fix embeddings stored as JSON strings to proper vector format.
This script converts string embeddings to PostgreSQL vector type.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.database.connection import SessionLocal
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_embeddings():
    """Convert string embeddings to vector format"""
    db = SessionLocal()
    
    try:
        # Count chunks with string embeddings
        result = db.execute(text("""
            SELECT COUNT(*) FROM document_chunks 
            WHERE embedding IS NOT NULL 
            AND pg_typeof(embedding)::text != 'vector'
        """))
        # This won't work directly, let's check differently
        
        # Get all chunks
        result = db.execute(text("SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL"))
        total = result.scalar()
        logger.info(f"📊 Total chunks with embeddings: {total}")
        
        # Check if embeddings are strings by sampling
        result = db.execute(text("SELECT id, embedding FROM document_chunks WHERE embedding IS NOT NULL LIMIT 1"))
        row = result.fetchone()
        
        if row:
            emb = row[1]
            if isinstance(emb, str):
                logger.info("⚠️ Embeddings are stored as strings, converting to vectors...")
                
                # Process in batches
                batch_size = 100
                offset = 0
                fixed_count = 0
                
                while True:
                    result = db.execute(text(f"""
                        SELECT id, embedding FROM document_chunks 
                        WHERE embedding IS NOT NULL 
                        ORDER BY id 
                        LIMIT {batch_size} OFFSET {offset}
                    """))
                    rows = result.fetchall()
                    
                    if not rows:
                        break
                    
                    for chunk_id, embedding_str in rows:
                        if isinstance(embedding_str, str):
                            try:
                                # Parse JSON string to list
                                embedding_list = json.loads(embedding_str)
                                
                                # Convert to PostgreSQL vector format
                                vector_str = '[' + ','.join(str(x) for x in embedding_list) + ']'
                                
                                # Update with proper vector cast
                                db.execute(text("""
                                    UPDATE document_chunks 
                                    SET embedding = :vector::vector 
                                    WHERE id = :id
                                """), {"vector": vector_str, "id": chunk_id})
                                
                                fixed_count += 1
                                
                            except Exception as e:
                                logger.error(f"❌ Error fixing chunk {chunk_id}: {e}")
                    
                    db.commit()
                    offset += batch_size
                    logger.info(f"✅ Processed {offset} chunks, fixed {fixed_count}")
                
                logger.info(f"🎉 Fixed {fixed_count} embeddings")
                
            else:
                logger.info("✅ Embeddings are already in vector format")
        else:
            logger.info("⚠️ No chunks with embeddings found")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_embeddings()
