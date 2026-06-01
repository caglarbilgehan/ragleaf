# backend/services/pgvector_service.py
"""
PgVector Service
Replaces ChromaDB and FAISS with PostgreSQL + pgvector
"""

import logging
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class PgVectorService:
    """
    PostgreSQL + pgvector based vector store
    
    Replaces:
    - ChromaDB (persistent vector store)
    - FAISS (per-document vector store)
    
    All vectors are stored in document_chunks table using pgvector
    """
    
    def __init__(self):
        self._dimension: Optional[int] = None
    
    @property
    def dimension(self) -> int:
        """Get current vector dimension"""
        return self._dimension or 768
    
    def add_document_chunks(
        self,
        db: Session,
        document_id: int,
        chunks: List[Dict[str, Any]],
        embeddings: np.ndarray
    ) -> Dict[str, Any]:
        """
        Add document chunks with embeddings to PostgreSQL
        
        Args:
            db: SQLAlchemy session
            document_id: Document ID
            chunks: List of chunk dictionaries with 'text', 'id', etc.
            embeddings: numpy array of shape (n_chunks, dimension)
        
        Returns:
            Dict with success status and count
        """
        try:
            # Set dimension from embeddings
            if embeddings.shape[0] > 0:
                self._dimension = embeddings.shape[1]
            
            # Delete existing chunks for this document
            db.execute(
                text("DELETE FROM document_chunks WHERE document_id = :doc_id"),
                {"doc_id": document_id}
            )
            
            # Insert new chunks
            inserted = 0
            for i, chunk in enumerate(chunks):
                if i >= len(embeddings):
                    break
                
                embedding = embeddings[i].tolist()
                embedding_str = f"[{','.join(str(v) for v in embedding)}]"
                
                db.execute(
                    text("""
                        INSERT INTO document_chunks 
                        (document_id, chunk_index, content, embedding, word_count, char_count, paragraph_index)
                        VALUES (:doc_id, :idx, :content, :embedding::vector, :word_count, :char_count, :para_idx)
                    """),
                    {
                        "doc_id": document_id,
                        "idx": chunk.get("id", i),
                        "content": chunk.get("text", ""),
                        "embedding": embedding_str,
                        "word_count": chunk.get("word_count", len(chunk.get("text", "").split())),
                        "char_count": chunk.get("char_count", len(chunk.get("text", ""))),
                        "para_idx": chunk.get("paragraph_index", 0)
                    }
                )
                inserted += 1
            
            db.commit()
            
            logger.info(f"✅ Added {inserted} chunks for document {document_id}")
            
            return {
                "success": True,
                "chunks_added": inserted,
                "document_id": document_id
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Failed to add chunks for document {document_id}: {e}")
            return {"success": False, "error": str(e)}
    
    def search(
        self,
        db: Session,
        query_embedding: np.ndarray,
        top_k: int = 10,
        document_ids: Optional[List[int]] = None,
        min_score: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Search for similar chunks using pgvector
        
        Args:
            db: SQLAlchemy session
            query_embedding: Query vector of shape (dimension,) or (1, dimension)
            top_k: Number of results to return
            document_ids: Optional list of document IDs to filter
            min_score: Minimum similarity score (0-1)
        
        Returns:
            List of result dictionaries with id, content, score, metadata
        """
        try:
            # Normalize query embedding
            if query_embedding.ndim == 2:
                query_embedding = query_embedding[0]
            
            embedding_str = f"[{','.join(str(v) for v in query_embedding.tolist())}]"
            
            # Build filter clause
            filter_clause = ""
            params = {"embedding": embedding_str, "top_k": top_k}
            
            if document_ids:
                filter_clause = "AND dc.document_id = ANY(:doc_ids)"
                params["doc_ids"] = document_ids
            
            # Cosine similarity search using pgvector
            query = text(f"""
                SELECT 
                    dc.id,
                    dc.document_id,
                    dc.chunk_index,
                    dc.content,
                    dc.word_count,
                    dc.char_count,
                    d.name as document_name,
                    d.folder_name,
                    1 - (dc.embedding <=> :embedding::vector) as score
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                WHERE dc.embedding IS NOT NULL
                {filter_clause}
                ORDER BY dc.embedding <=> :embedding::vector
                LIMIT :top_k
            """)
            
            result = db.execute(query, params)
            
            results = []
            for row in result:
                score = float(row.score) if row.score else 0.0
                if score >= min_score:
                    results.append({
                        "id": f"doc_{row.document_id}_chunk_{row.chunk_index}",
                        "document_id": row.document_id,
                        "document_name": row.document_name,
                        "folder_name": row.folder_name,
                        "chunk_index": row.chunk_index,
                        "content": row.content,
                        "score": score,
                        "word_count": row.word_count,
                        "char_count": row.char_count
                    })
            
            logger.info(f"🔍 Search returned {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"❌ Search failed: {e}")
            return []
    
    def delete_document(self, db: Session, document_id: int) -> int:
        """
        Delete all chunks for a document
        
        Returns:
            Number of deleted chunks
        """
        try:
            result = db.execute(
                text("DELETE FROM document_chunks WHERE document_id = :doc_id RETURNING id"),
                {"doc_id": document_id}
            )
            deleted = len(list(result))
            db.commit()
            
            logger.info(f"🗑️ Deleted {deleted} chunks for document {document_id}")
            return deleted
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Failed to delete chunks for document {document_id}: {e}")
            return 0
    
    def clear_all(self, db: Session) -> bool:
        """Clear all chunks (for model change)"""
        try:
            db.execute(text("TRUNCATE TABLE document_chunks"))
            db.commit()
            logger.info("🗑️ All chunks cleared")
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Failed to clear chunks: {e}")
            return False
    
    def get_stats(self, db: Session) -> Dict[str, Any]:
        """Get vector store statistics"""
        try:
            result = db.execute(text("""
                SELECT 
                    COUNT(*) as total_chunks,
                    COUNT(DISTINCT document_id) as total_documents,
                    AVG(char_count) as avg_chunk_size
                FROM document_chunks
            """))
            row = result.fetchone()
            
            return {
                "total_chunks": row.total_chunks or 0,
                "total_documents": row.total_documents or 0,
                "avg_chunk_size": float(row.avg_chunk_size) if row.avg_chunk_size else 0,
                "dimension": self._dimension or 768,
                "store_type": "pgvector"
            }
        except Exception as e:
            logger.error(f"❌ Failed to get stats: {e}")
            return {"error": str(e)}
    
    def get_document_chunks(self, db: Session, document_id: int) -> List[Dict[str, Any]]:
        """Get all chunks for a document (without embeddings)"""
        try:
            result = db.execute(
                text("""
                    SELECT id, chunk_index, content, word_count, char_count
                    FROM document_chunks
                    WHERE document_id = :doc_id
                    ORDER BY chunk_index
                """),
                {"doc_id": document_id}
            )
            
            return [
                {
                    "id": row.id,
                    "chunk_index": row.chunk_index,
                    "content": row.content,
                    "word_count": row.word_count,
                    "char_count": row.char_count
                }
                for row in result
            ]
        except Exception as e:
            logger.error(f"❌ Failed to get chunks for document {document_id}: {e}")
            return []


# Global instance
pgvector_service = PgVectorService()
