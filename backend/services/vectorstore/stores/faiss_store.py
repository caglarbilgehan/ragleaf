"""
FAISS Vector Store
Fast similarity search with FAISS
"""

import json
import logging
import tempfile
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np
import faiss

from .base_store import BaseVectorStore, SearchResult

logger = logging.getLogger(__name__)


class FAISSStore(BaseVectorStore):
    """FAISS vector store implementation"""
    
    name: str = "faiss"
    
    def __init__(
        self,
        dimension: int,
        index_path: Optional[Path] = None,
        index_type: str = "auto"
    ):
        """
        Initialize FAISS store
        
        Args:
            dimension: Vector dimension
            index_path: Path to save/load index
            index_type: Index type ('flat', 'hnsw', 'ivf', 'auto')
        """
        self.dimension = dimension
        self.index_path = Path(index_path) if index_path else None
        self.index_type = index_type
        
        self._index: Optional[faiss.Index] = None
        self._id_map: Dict[int, str] = {}  # FAISS internal ID -> string ID
        self._metadata: Dict[str, Dict[str, Any]] = {}  # string ID -> metadata
        self._texts: Dict[str, str] = {}  # string ID -> text
        self._next_id: int = 0
    
    @property
    def index(self) -> faiss.Index:
        """Get or create FAISS index"""
        if self._index is None:
            if self.index_path and self.index_path.exists():
                self._load_index()
            else:
                self._create_index(0)  # Create empty index
        return self._index
    
    def _create_index(self, n_vectors: int):
        """Create appropriate FAISS index based on dataset size"""
        
        if self.index_type == "flat" or (self.index_type == "auto" and n_vectors < 1000):
            # Small dataset: flat index
            self._index = faiss.IndexFlatIP(self.dimension)
            logger.info(f"Created IndexFlatIP (dim={self.dimension})")
            
        elif self.index_type == "hnsw" or (self.index_type == "auto" and n_vectors < 10000):
            # Medium dataset: HNSW
            self._index = faiss.IndexHNSWFlat(self.dimension, 32)
            self._index.hnsw.efConstruction = 200
            self._index.hnsw.efSearch = 50
            logger.info(f"Created IndexHNSWFlat (dim={self.dimension})")
            
        else:
            # Large dataset: IVF
            nlist = min(int(np.sqrt(n_vectors)), 1000)
            quantizer = faiss.IndexFlatIP(self.dimension)
            self._index = faiss.IndexIVFFlat(quantizer, self.dimension, nlist)
            logger.info(f"Created IndexIVFFlat (dim={self.dimension}, nlist={nlist})")
    
    def add(
        self,
        ids: List[str],
        embeddings: np.ndarray,
        texts: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> int:
        """Add vectors to FAISS index"""
        try:
            n_vectors = len(ids)
            
            # Ensure embeddings are float32
            embeddings = embeddings.astype('float32')
            
            # Create or resize index if needed
            if self._index is None:
                self._create_index(n_vectors)
            
            # Train IVF index if needed
            if hasattr(self._index, 'is_trained') and not self._index.is_trained:
                logger.info("Training IVF index...")
                self._index.train(embeddings)
            
            # Add vectors
            self._index.add(embeddings)
            
            # Store mappings
            for i, (id_, text) in enumerate(zip(ids, texts)):
                internal_id = self._next_id + i
                self._id_map[internal_id] = id_
                self._texts[id_] = text
                if metadatas and i < len(metadatas):
                    self._metadata[id_] = metadatas[i]
            
            self._next_id += n_vectors
            
            logger.info(f"✅ Added {n_vectors} vectors to FAISS")
            return n_vectors
            
        except Exception as e:
            logger.error(f"❌ Failed to add to FAISS: {e}")
            raise
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """Search FAISS for similar vectors"""
        try:
            if self._index is None or self._index.ntotal == 0:
                return []
            
            # Ensure query is correct shape
            query = query_embedding.astype('float32')
            if query.ndim == 1:
                query = query.reshape(1, -1)
            
            # Search
            scores, indices = self._index.search(query, min(top_k * 2, self._index.ntotal))
            
            # Convert to SearchResult objects
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0:  # FAISS returns -1 for not found
                    continue
                
                string_id = self._id_map.get(idx)
                if not string_id:
                    continue
                
                # Apply metadata filter if provided
                if filter_metadata:
                    metadata = self._metadata.get(string_id, {})
                    if not all(metadata.get(k) == v for k, v in filter_metadata.items()):
                        continue
                
                results.append(SearchResult(
                    id=string_id,
                    text=self._texts.get(string_id, ""),
                    score=float(score),
                    metadata=self._metadata.get(string_id, {})
                ))
                
                if len(results) >= top_k:
                    break
            
            return results
            
        except Exception as e:
            logger.error(f"❌ FAISS search failed: {e}")
            return []
    
    def delete(
        self,
        ids: Optional[List[str]] = None,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Delete vectors from FAISS
        
        Note: FAISS doesn't support efficient deletion.
        This marks vectors as deleted but doesn't remove them.
        Use rebuild() to actually remove deleted vectors.
        """
        deleted = 0
        
        if ids:
            for id_ in ids:
                if id_ in self._texts:
                    del self._texts[id_]
                    if id_ in self._metadata:
                        del self._metadata[id_]
                    deleted += 1
        
        elif filter_metadata:
            to_delete = []
            for id_, meta in self._metadata.items():
                if all(meta.get(k) == v for k, v in filter_metadata.items()):
                    to_delete.append(id_)
            
            for id_ in to_delete:
                del self._texts[id_]
                del self._metadata[id_]
                deleted += 1
        
        logger.info(f"🗑️ Marked {deleted} vectors as deleted in FAISS")
        return deleted
    
    def count(self) -> int:
        """Get total vector count"""
        if self._index is None:
            return 0
        return self._index.ntotal
    
    def clear(self) -> bool:
        """Clear all vectors"""
        try:
            self._index = None
            self._id_map.clear()
            self._metadata.clear()
            self._texts.clear()
            self._next_id = 0
            
            if self.index_path and self.index_path.exists():
                self.index_path.unlink()
            
            logger.info("🗑️ FAISS index cleared")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to clear FAISS: {e}")
            return False
    
    def save(self, path: Optional[Path] = None):
        """Save index to disk"""
        save_path = path or self.index_path
        if not save_path:
            raise ValueError("No save path specified")
        
        save_path = Path(save_path)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # Save FAISS index (handle non-ASCII paths)
            with tempfile.NamedTemporaryFile(suffix='.faiss', delete=False) as tmp:
                temp_path = tmp.name
            
            faiss.write_index(self._index, temp_path)
            shutil.move(temp_path, str(save_path))
            
            # Save metadata
            meta_path = save_path.with_suffix('.meta.json')
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'id_map': {str(k): v for k, v in self._id_map.items()},
                    'metadata': self._metadata,
                    'texts': self._texts,
                    'next_id': self._next_id,
                    'dimension': self.dimension
                }, f, ensure_ascii=False)
            
            logger.info(f"✅ FAISS index saved to {save_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save FAISS index: {e}")
            raise
    
    def _load_index(self):
        """Load index from disk"""
        if not self.index_path or not self.index_path.exists():
            return
        
        try:
            self._index = faiss.read_index(str(self.index_path))
            
            # Load metadata
            meta_path = self.index_path.with_suffix('.meta.json')
            if meta_path.exists():
                with open(meta_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._id_map = {int(k): v for k, v in data.get('id_map', {}).items()}
                    self._metadata = data.get('metadata', {})
                    self._texts = data.get('texts', {})
                    self._next_id = data.get('next_id', 0)
            
            logger.info(f"✅ FAISS index loaded from {self.index_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to load FAISS index: {e}")
            self._index = None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get FAISS statistics"""
        return {
            'name': self.name,
            'count': self.count(),
            'dimension': self.dimension,
            'index_type': type(self._index).__name__ if self._index else None,
            'index_path': str(self.index_path) if self.index_path else None
        }
