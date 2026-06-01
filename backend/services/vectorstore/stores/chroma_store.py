"""
ChromaDB Vector Store
Persistent vector storage with ChromaDB
"""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np
import chromadb
from chromadb.config import Settings

from .base_store import BaseVectorStore, SearchResult

logger = logging.getLogger(__name__)


class ChromaStore(BaseVectorStore):
    """ChromaDB vector store implementation"""
    
    name: str = "chromadb"
    
    def __init__(
        self,
        persist_directory: Path,
        collection_name: str = "documents"
    ):
        self.persist_directory = Path(persist_directory)
        self.collection_name = collection_name
        self._client: Optional[chromadb.PersistentClient] = None
        self._collection = None
    
    @property
    def client(self) -> chromadb.PersistentClient:
        """Lazy load ChromaDB client"""
        if self._client is None:
            self.persist_directory.mkdir(parents=True, exist_ok=True)
            
            self._client = chromadb.PersistentClient(
                path=str(self.persist_directory),
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            logger.info(f"✅ ChromaDB initialized at {self.persist_directory}")
        
        return self._client
    
    @property
    def collection(self):
        """Get or create collection"""
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info(f"✅ ChromaDB collection '{self.collection_name}' ready")
        
        return self._collection
    
    def add(
        self,
        ids: List[str],
        embeddings: np.ndarray,
        texts: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> int:
        """Add vectors to ChromaDB"""
        try:
            # Ensure embeddings are list format
            embeddings_list = embeddings.tolist() if isinstance(embeddings, np.ndarray) else embeddings
            
            # Prepare metadatas
            if metadatas is None:
                metadatas = [{} for _ in ids]
            
            # Add to collection
            self.collection.add(
                ids=ids,
                embeddings=embeddings_list,
                documents=texts,
                metadatas=metadatas
            )
            
            logger.info(f"✅ Added {len(ids)} vectors to ChromaDB")
            return len(ids)
            
        except Exception as e:
            logger.error(f"❌ Failed to add to ChromaDB: {e}")
            raise
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """Search ChromaDB for similar vectors"""
        try:
            # Ensure query is list format
            if isinstance(query_embedding, np.ndarray):
                query_list = query_embedding.flatten().tolist()
            else:
                query_list = query_embedding
            
            # Build query
            query_params = {
                'query_embeddings': [query_list],
                'n_results': top_k,
                'include': ['documents', 'metadatas', 'distances']
            }
            
            if filter_metadata:
                query_params['where'] = filter_metadata
            
            # Execute search
            results = self.collection.query(**query_params)
            
            # Convert to SearchResult objects
            search_results = []
            if results['ids'] and results['ids'][0]:
                for i, id_ in enumerate(results['ids'][0]):
                    # ChromaDB returns distances, convert to similarity scores
                    distance = results['distances'][0][i] if results['distances'] else 0
                    score = 1 - distance  # Convert distance to similarity
                    
                    search_results.append(SearchResult(
                        id=id_,
                        text=results['documents'][0][i] if results['documents'] else "",
                        score=score,
                        metadata=results['metadatas'][0][i] if results['metadatas'] else {}
                    ))
            
            return search_results
            
        except Exception as e:
            logger.error(f"❌ ChromaDB search failed: {e}")
            return []
    
    def delete(
        self,
        ids: Optional[List[str]] = None,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """Delete vectors from ChromaDB"""
        try:
            if ids:
                self.collection.delete(ids=ids)
                logger.info(f"🗑️ Deleted {len(ids)} vectors from ChromaDB")
                return len(ids)
            elif filter_metadata:
                # Get matching IDs first
                results = self.collection.get(where=filter_metadata)
                if results['ids']:
                    self.collection.delete(ids=results['ids'])
                    logger.info(f"🗑️ Deleted {len(results['ids'])} vectors from ChromaDB")
                    return len(results['ids'])
            return 0
            
        except Exception as e:
            logger.error(f"❌ ChromaDB delete failed: {e}")
            return 0
    
    def delete_by_document(self, document_id: int) -> int:
        """Delete all vectors for a specific document"""
        return self.delete(filter_metadata={"document_id": document_id})
    
    def count(self) -> int:
        """Get total vector count"""
        return self.collection.count()
    
    def clear(self) -> bool:
        """Clear all vectors"""
        try:
            # Delete and recreate collection
            self.client.delete_collection(self.collection_name)
            self._collection = None
            _ = self.collection  # Recreate
            logger.info("🗑️ ChromaDB collection cleared")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to clear ChromaDB: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get ChromaDB statistics"""
        count = self.count()
        return {
            'name': self.name,
            'count': count,
            'total_documents': count,  # Alias for compatibility
            'collection_name': self.collection_name,
            'persist_directory': str(self.persist_directory)
        }
