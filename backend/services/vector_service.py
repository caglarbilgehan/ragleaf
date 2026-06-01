from __future__ import annotations
import os
import json
# import faiss  # Lazy import
# import numpy as np  # Lazy import
from typing import List, Dict, Any, Optional, Tuple, TYPE_CHECKING
import pickle
import logging
from sqlalchemy.orm import Session
from ..database.models import Document, EmbeddingModel

logger = logging.getLogger(__name__)

class VectorService:
    def __init__(self):
        self.indexes: Dict[str, Any] = {}
        self.documents: Dict[str, List[Dict]] = {}
        self.vector_dim = None  # Will be set from active model
        
        # Professional embedding settings
        self.chunk_size = 512  # Optimal chunk size for embeddings
        self.chunk_overlap = 50  # Overlap between chunks
        self.batch_size = 32   # Batch size for embedding generation
        
    def _get_active_embedding_model(self, db: Session) -> EmbeddingModel:
        """Get active embedding model from database"""
        model = db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True,
            EmbeddingModel.is_active == True
        ).first()
        
        if not model:
            # Fallback to first active model
            model = db.query(EmbeddingModel).filter(
                EmbeddingModel.is_active == True
            ).first()
        
        if not model:
            raise ValueError("No active embedding model found. Please configure an embedding model in admin panel.")
        
        return model
    
    def _get_embedding_service(self, db: Session):
        """Get unified embedding service"""
        from .unified_embedding_service import get_unified_embedding_service
        return get_unified_embedding_service()
    
    def create_text_chunks(self, text: str) -> List[str]:
        """Create optimized text chunks for embedding"""
        if not text or not text.strip():
            return []
        
        # Split by sentences first
        sentences = self._split_into_sentences(text)
        
        chunks = []
        current_chunk = ""
        current_length = 0
        
        for sentence in sentences:
            sentence_length = len(sentence)
            
            # If adding this sentence would exceed chunk size
            if current_length + sentence_length > self.chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                
                # Start new chunk with overlap
                if len(chunks) > 0 and self.chunk_overlap > 0:
                    overlap_text = current_chunk[-self.chunk_overlap:] if len(current_chunk) > self.chunk_overlap else current_chunk
                    current_chunk = overlap_text + " " + sentence
                    current_length = len(current_chunk)
                else:
                    current_chunk = sentence
                    current_length = sentence_length
            else:
                if current_chunk:
                    current_chunk += " " + sentence
                    current_length += sentence_length + 1
                else:
                    current_chunk = sentence
                    current_length = sentence_length
        
        # Add the last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        import re
        
        # Simple sentence splitting (can be improved with NLTK)
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        return sentences

    def create_embeddings(self, texts: List[str], db: Session) -> np.ndarray:
        """Create embeddings for a list of texts using active embedding model"""
        if not texts:
            # Get vector dimension from active model
            import numpy as np
            model = self._get_active_embedding_model(db)
            return np.array([]).reshape(0, model.dimension)
        
        # Get unified embedding service
        embedding_service = self._get_embedding_service(db)
        
        # Get active model info
        model = self._get_active_embedding_model(db)
        self.vector_dim = model.dimension
        
        logger.info(f"Creating embeddings using model: {model.model_id} (dimension: {model.dimension})")
        
        # Use unified embedding service
        embeddings = embedding_service.encode(
            texts=texts,
            db=db,
            batch_size=self.batch_size,
            normalize=True,
            show_progress=False
        )
        
        return embeddings.astype('float32') # type: ignore
    
    def create_index(self, index_name: str, dimension: int = None) -> faiss.IndexFlatIP:
        """Create a new FAISS index"""
        if dimension is None:
            dimension = self.vector_dim
        
        # Use Inner Product for cosine similarity
        import faiss
        index = faiss.IndexFlatIP(dimension)
        self.indexes[index_name] = index
        self.documents[index_name] = []
        
        return index
    
    def add_documents_to_index(
        self,
        index_name: str,
        texts: List[str],
        metadatas: List[Dict[str, Any]],
        db: Session
    ) -> bool:
        """Add documents to an existing index"""
        try:
            # Get vector dimension from active model
            model = self._get_active_embedding_model(db)
            
            if index_name not in self.indexes:
                self.create_index(index_name, dimension=model.dimension)
            
            # Create embeddings using active model
            embeddings = self.create_embeddings(texts, db)
            
            # Normalize for cosine similarity
            import faiss
            faiss.normalize_L2(embeddings)
            
            # Add to index
            self.indexes[index_name].add(embeddings)
            
            # Store document metadata
            for i, (text, metadata) in enumerate(zip(texts, metadatas)):
                doc_data = {
                    "id": len(self.documents[index_name]),
                    "text": text,
                    "metadata": metadata
                }
                self.documents[index_name].append(doc_data)
            
            return True
        except Exception as e:
            logger.error(f"Error adding documents to index {index_name}: {e}")
            return False
    
    def search_similar(
        self,
        index_name: str,
        query: str,
        db: Session,
        top_k: int = 5,
        score_threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Search for similar documents in an index"""
        try:
            if index_name not in self.indexes:
                return []
            
            # Create query embedding using active model
            query_embedding = self.create_embeddings([query], db)
            import faiss
            faiss.normalize_L2(query_embedding)
            
            # Search
            scores, indices = self.indexes[index_name].search(query_embedding, top_k)
            
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx != -1 and score >= score_threshold:
                    doc = self.documents[index_name][idx]
                    results.append({
                        "text": doc["text"],
                        "metadata": doc["metadata"],
                        "score": float(score)
                    })
            
            return results
        except Exception as e:
            logger.error(f"Error searching in index {index_name}: {e}")
            return []
    
    def save_index(self, index_name: str, file_path: str) -> bool:
        """Save index and documents to disk"""
        try:
            if index_name not in self.indexes:
                return False
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Save FAISS index
            import faiss
            faiss.write_index(self.indexes[index_name], f"{file_path}.faiss")
            
            # Save documents metadata
            with open(f"{file_path}.docs", 'wb') as f:
                pickle.dump(self.documents[index_name], f)
            
            return True
        except Exception as e:
            print(f"Error saving index {index_name}: {e}")
            return False
    
    def load_index(self, index_name: str, file_path: str) -> bool:
        """Load index and documents from disk"""
        try:
            # Load FAISS index
            if os.path.exists(f"{file_path}.faiss"):
                import faiss
                self.indexes[index_name] = faiss.read_index(f"{file_path}.faiss")
            else:
                return False
            
            # Load documents metadata
            if os.path.exists(f"{file_path}.docs"):
                with open(f"{file_path}.docs", 'rb') as f:
                    self.documents[index_name] = pickle.load(f)
            else:
                self.documents[index_name] = []
            
            return True
        except Exception as e:
            print(f"Error loading index {index_name}: {e}")
            return False
    
    def delete_index(self, index_name: str) -> bool:
        """Delete an index from memory"""
        try:
            if index_name in self.indexes:
                del self.indexes[index_name]
            if index_name in self.documents:
                del self.documents[index_name]
            return True
        except Exception as e:
            print(f"Error deleting index {index_name}: {e}")
            return False
    
    def get_index_stats(self, index_name: str) -> Dict[str, Any]:
        """Get statistics about an index"""
        if index_name not in self.indexes:
            return {}
        
        index = self.indexes[index_name]
        return {
            "name": index_name,
            "total_vectors": index.ntotal,
            "dimension": index.d,
            "documents_count": len(self.documents.get(index_name, [])),
            "is_trained": index.is_trained
        }
    
    def process_document_for_indexing(
        self,
        document_text: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> List[str]:
        """Split document into chunks for indexing"""
        if not document_text:
            return []
        
        chunks = []
        start = 0
        
        while start < len(document_text):
            end = start + chunk_size
            
            # Try to break at sentence boundary
            if end < len(document_text):
                # Look for sentence endings
                for i in range(end, max(start + chunk_size - 200, start), -1):
                    if document_text[i] in '.!?':
                        end = i + 1
                        break
            
            chunk = document_text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - chunk_overlap
            if start >= len(document_text):
                break
        
        return chunks

# Global instance
vector_service = VectorService()
