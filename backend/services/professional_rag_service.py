"""
Professional RAG Service
FAISS-based vector search for ChatUI RAG mode

MIGRATED: Now uses new unified services:
- embedding_service for embeddings
- vector_store_manager for vector operations
- chunking_service for text chunking
"""

import os
import json
import logging
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import faiss
from sqlalchemy.orm import Session

from ..database.models import Document
from .embedding.embedding_service import embedding_service
from .chunking.chunking_service import chunking_service
from .query_processor import query_processor

logger = logging.getLogger(__name__)

class ProfessionalRAGService:
    """Professional RAG service using FAISS vector search"""
    
    def __init__(self):
        # Use absolute path to root documents folder
        from backend.services.storage_service import get_storage
        _storage = get_storage()
        self.base_dir = _storage.get_document_root(os.getenv("DEFAULT_TENANT_SLUG", "default"))
        self.max_chunks = 3  # Reduced from 5 for faster processing
        self.similarity_threshold = 0.4  # Increased from 0.3 for better quality
    
    def _load_rag_settings(self, db: Session) -> Dict[str, Any]:
        """Load RAG settings from database"""
        try:
            from ..database.models import Settings
            setting = db.query(Settings).filter(Settings.key == "rag_settings").first()
            
            if setting and setting.value:
                return setting.value
            else:
                # Return default settings
                return {
                    "similarity_threshold": 0.4,
                    "max_chunks": 5,
                    "diversity_threshold": 0.8,
                    "enable_reranking": True,
                    "enable_query_expansion": True
                }
        except Exception as e:
            logger.warning(f"Could not load RAG settings from database: {e}")
            return {
                "similarity_threshold": 0.4,
                "max_chunks": 5,
                "diversity_threshold": 0.8,
                "enable_reranking": True,
                "enable_query_expansion": True
            }
        
    async def search_documents(
        self, 
        query: str, 
        db: Session,
        max_chunks: int = 5
    ) -> List[Dict[str, Any]]:
        """Search documents using FAISS vector similarity"""
        try:
            # Load RAG settings from database
            rag_settings = self._load_rag_settings(db)
            self.similarity_threshold = rag_settings.get("similarity_threshold", 0.4)
            
            # Get processed documents with vector indexes
            documents = db.query(Document).filter(
                Document.status == "processed",
                Document.vector_indexed == True
            ).all()
            
            if not documents:
                logger.warning("No processed documents with vector indexes found")
                return []
            
            # Analyze and process query
            query_analysis = query_processor.analyze_query(query)
            
            if query_analysis.confidence < 0.2:
                logger.warning(f"Very low confidence query: {query} (confidence: {query_analysis.confidence})")
                return []
            
            # Prepare query for embedding
            processed_query = query_processor.prepare_for_embedding(query_analysis)
            
            # Create query embedding using new embedding_service
            query_embedding = embedding_service.encode_query(processed_query, db)
            if query_embedding.shape[0] == 0:
                logger.warning("Could not create embeddings from query")
                return []
            
            # Use the query embedding (shape: (1, dimension))
            query_vector = query_embedding
            
            all_results = []
            
            # Search each document's FAISS index
            for doc in documents:
                try:
                    results = await self._search_document_index(
                        doc, query_vector, query, max_chunks
                    )
                    all_results.extend(results)
                except Exception as e:
                    logger.error(f"Error searching document {doc.id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            all_results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return all_results[:max_chunks]
            
        except Exception as e:
            logger.error(f"Error in document search: {e}")
            return []
    
    async def _search_document_index(
        self, 
        document: Document, 
        query_vector: np.ndarray,
        query_text: str,
        max_chunks: int
    ) -> List[Dict[str, Any]]:
        """Search a single document's FAISS index"""
        
        # Look for index files in document's vectors folder
        doc_folder = self.base_dir / document.folder_name
        vectors_folder = doc_folder / "vectors"
        
        index_path = vectors_folder / f"doc_{document.id}.faiss"
        metadata_path = vectors_folder / f"doc_{document.id}_metadata.json"
        
        if not index_path.exists() or not metadata_path.exists():
            logger.warning(f"Index files not found for document {document.id} in {vectors_folder}")
            return []
        
        try:
            # Load FAISS index
            index = faiss.read_index(str(index_path))
            
            # Load metadata
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            chunks = metadata.get('chunks', [])
            if not chunks:
                logger.warning(f"No chunks found in metadata for document {document.id}")
                return []
            
            # Search similar vectors
            k = min(max_chunks, index.ntotal)  # Don't search for more than available
            if k == 0:
                return []
            
            similarities, indices = index.search(query_vector, k)
            
            results = []
            for i, (similarity, idx) in enumerate(zip(similarities[0], indices[0])):
                if idx == -1:  # Invalid index
                    continue
                    
                if similarity < self.similarity_threshold:
                    continue
                
                if idx >= len(chunks):
                    logger.warning(f"Index {idx} out of range for document {document.id}")
                    continue
                
                chunk = chunks[idx]
                
                results.append({
                    'document_id': document.id,
                    'document_name': document.name,
                    'chunk_id': chunk.get('id', idx),
                    'content': chunk.get('text', ''),
                    'similarity_score': float(similarity),
                    'chunk_metadata': {
                        'length': chunk.get('length', 0),
                        'word_count': chunk.get('word_count', 0),
                        'paragraph_index': chunk.get('paragraph_index', 0)
                    },
                    'source_info': {
                        'file_name': document.original_filename,
                        'file_type': document.file_type,
                        'processed_at': document.processed_at.isoformat() if document.processed_at else None
                    }
                })
            
            logger.info(f"Found {len(results)} relevant chunks in document {document.id}")
            return results
            
        except Exception as e:
            logger.error(f"Error searching document {document.id}: {e}")
            return []
    
    def build_context(self, search_results: List[Dict[str, Any]]) -> str:
        """Build context string from search results with enhanced source info"""
        if not search_results:
            return ""
        
        context_parts = []
        for i, result in enumerate(search_results):
            doc_name = result['document_name']
            file_name = result['source_info']['file_name']
            content = result['content']
            chunk_id = result.get('chunk_id', i)
            
            # Extract page info from content if available
            page_info = ""
            if "--- Sayfa" in content:
                try:
                    page_match = content.split("--- Sayfa")[1].split("---")[0].strip()
                    page_info = f" - Sayfa {page_match}"
                except:
                    pass
            
            source_info = f"[Döküman: {doc_name} ({file_name}){page_info} - Chunk #{chunk_id}]"
            context_parts.append(f"{source_info}\n{content}")
        
        return "\n\n".join(context_parts)
    
    def build_sources_list(self, search_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build enhanced sources list with page and image information"""
        sources = []
        
        for result in search_results:
            content = result['content']
            
            # Extract page number
            page_number = None
            if "--- Sayfa" in content:
                try:
                    page_match = content.split("--- Sayfa")[1].split("---")[0].strip()
                    page_number = int(page_match)
                except:
                    pass
            
            # Check for image content
            has_image_content = "Görsel" in content and "metni:" in content
            image_references = []
            
            if has_image_content:
                # Extract image references
                lines = content.split('\n')
                for line in lines:
                    if "Görsel" in line and "metni:" in line:
                        try:
                            img_num = line.split("Görsel")[1].split("metni:")[0].strip()
                            img_text = line.split("metni:")[1].strip()[:100]
                            image_references.append({
                                'image_number': img_num,
                                'ocr_text_preview': img_text,
                                'page': page_number,
                                'image_file': f"page_{page_number}_img_{img_num}.png" if page_number else None
                            })
                        except:
                            pass
            
            source_info = {
                'document_id': result['document_id'],
                'document_name': result['document_name'],
                'file_name': result['source_info']['file_name'],
                'chunk_id': result.get('chunk_id', 0),
                'page_number': page_number,
                'similarity_score': result['similarity_score'],
                'content_preview': content[:200] + "..." if len(content) > 200 else content,
                'has_images': has_image_content,
                'image_references': image_references,
                'clickable': True  # For UI modal functionality
            }
            
            sources.append(source_info)
        
        return sources

# Global instance
professional_rag_service = ProfessionalRAGService()
