"""
Enhanced RAG Service with Advanced Query Processing and Document Matching
Gelişmiş sorgu işleme ve döküman eşleştirme ile RAG servisi

MIGRATED: Now uses new unified services:
- embedding_service for embeddings
- chunking_service for text chunking
"""

import logging
import os
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import numpy as np
import json
from sqlalchemy.orm import Session
from ..database.models import Document
from .embedding.embedding_service import embedding_service
from .chunking.chunking_service import chunking_service
from .query_processor import query_processor, QueryAnalysis
from .vectorstore.vector_store_manager import vector_store_manager

logger = logging.getLogger(__name__)

class EnhancedRAGService:
    """Gelişmiş RAG servisi"""
    
    def __init__(self):
        # Use absolute path to root documents folder
        from backend.services.storage_service import get_storage
        _storage = get_storage()
        self.base_dir = _storage.get_document_root(os.getenv("DEFAULT_TENANT_SLUG", "default"))
        self.max_chunks = 5
        self.similarity_threshold = 0.3
        self.diversity_threshold = 0.8  # Çeşitlilik için
        self.rerank_enabled = True
    
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
                    "similarity_threshold": 0.3,
                    "max_chunks": 5,
                    "diversity_threshold": 0.8,
                    "enable_reranking": True,
                    "enable_query_expansion": True
                }
        except Exception as e:
            logger.warning(f"Could not load RAG settings from database: {e}")
            return {
                "similarity_threshold": 0.3,
                "max_chunks": 5,
                "diversity_threshold": 0.8,
                "enable_reranking": True,
                "enable_query_expansion": True
            }
        
    async def search_documents_enhanced(
        self, 
        query: str, 
        db: Session,
        max_chunks: int = 5,
        enable_query_expansion: bool = True,
        enable_reranking: bool = True,
        language: Optional[str] = None,
        document_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Gelişmiş döküman arama
        
        Args:
            document_ids: If provided, only search within these document IDs (for agent-scoped RAG)
        """
        try:
            # Load RAG settings from database
            rag_settings = self._load_rag_settings(db)
            self.similarity_threshold = rag_settings.get("similarity_threshold", 0.3)
            self.diversity_threshold = rag_settings.get("diversity_threshold", 0.8)
            
            # Store language filter for use in search methods
            self._current_language = language
            
            logger.info(f"🔍 RAG search: query='{query[:50]}...', language={language}, doc_filter={document_ids}")
            
            # Query analizi
            query_analysis = query_processor.analyze_query(query)
            
            if query_analysis.confidence < 0.3:
                logger.warning(f"Low confidence query: {query}")
                return {
                    "chunks": [],
                    "query_analysis": query_analysis.__dict__,
                    "search_strategy": "failed_low_confidence"
                }
            
            # Processed documents kontrolü (indexed, enriched, processed)
            doc_query = db.query(Document).filter(
                Document.status.in_(["indexed", "enriched", "processed"]),
                Document.vector_indexed == True
            )
            
            # Agent-scoped filtering: only search specific documents
            if document_ids:
                doc_query = doc_query.filter(Document.id.in_(document_ids))
            
            documents = doc_query.all()
            
            if not documents:
                logger.warning("No processed documents with vector indexes found")
                return {
                    "chunks": [],
                    "query_analysis": query_analysis.__dict__,
                    "search_strategy": "no_documents"
                }
            
            # Multi-strategy search
            search_results = await self._multi_strategy_search(
                query_analysis, documents, max_chunks, enable_query_expansion, db
            )
            
            # Re-ranking
            if enable_reranking and search_results["chunks"]:
                search_results["chunks"] = await self._rerank_results(
                    query_analysis, search_results["chunks"]
                )
            
            # Diversity filtering
            search_results["chunks"] = self._apply_diversity_filter(
                search_results["chunks"]
            )
            
            return search_results
            
        except Exception as e:
            logger.error(f"Enhanced search error: {e}")
            return {
                "chunks": [],
                "error": str(e),
                "search_strategy": "error"
            }
    
    async def _multi_strategy_search(
        self,
        query_analysis: QueryAnalysis,
        documents: List[Document],
        max_chunks: int,
        enable_expansion: bool,
        db: Session = None
    ) -> Dict[str, Any]:
        """Çoklu strateji ile arama"""
        
        all_results = []
        search_strategies = []
        
        # Strategy 1: Original query
        original_results = await self._vector_search(
            query_analysis.processed_query, documents, max_chunks, db
        )
        all_results.extend(original_results)
        search_strategies.append("original_query")
        
        # Strategy 2: Query expansion (if enabled and needed)
        if enable_expansion and query_analysis.should_expand:
            expanded_queries = query_processor.expand_query(query_analysis)
            for expanded_query in expanded_queries[1:]:  # Skip original
                expanded_results = await self._vector_search(
                    expanded_query, documents, max_chunks // 2, db
                )
                all_results.extend(expanded_results)
                search_strategies.append(f"expanded_query: {expanded_query}")
        
        # Strategy 3: Keyword-based search (fallback)
        if len(all_results) < max_chunks // 2:
            keyword_results = await self._keyword_search(
                query_analysis, documents, max_chunks // 2
            )
            all_results.extend(keyword_results)
            search_strategies.append("keyword_fallback")
        
        # Deduplicate and sort
        unique_results = self._deduplicate_results(all_results)
        unique_results.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        return {
            "chunks": unique_results[:max_chunks],
            "query_analysis": query_analysis.__dict__,
            "search_strategies": search_strategies,
            "total_candidates": len(all_results)
        }
    
    async def _vector_search(
        self, 
        query: str, 
        documents: List[Document], 
        max_chunks: int,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """Vector similarity search using VectorStoreManager (PgVector)"""
        try:
            # Prepare query for embedding
            query_for_embedding = query_processor.prepare_for_embedding(
                query_processor.analyze_query(query)
            )
            
            query_vector = embedding_service.encode_query(query_for_embedding, db)
            
            if query_vector is None or (hasattr(query_vector, 'shape') and query_vector.shape[0] == 0):
                logger.warning(f"Could not create embeddings from query: {query}")
                return []
            
            all_results = []
            
            # Build filter metadata with language if set
            filter_meta = {}
            if hasattr(self, '_current_language') and self._current_language:
                filter_meta["language"] = self._current_language
                logger.info(f"🌍 Applying language filter: {self._current_language}")
            
            # Loop through documents and search
            for doc in documents:
                # Add document_id to filter
                doc_filter = filter_meta.copy()
                doc_filter["document_id"] = doc.id
                
                # Use vector_store_manager with language filter
                results = vector_store_manager.search_with_filter(
                    query_embedding=query_vector,
                    top_k=max_chunks,
                    filter_metadata=doc_filter
                )
                
                # Format results
                for res in results:
                    all_results.append({
                        'document_id': doc.id,
                        'document_name': doc.name,
                        'chunk_id': res.metadata.get('chunk_index', 0),
                        'content': res.text,
                        'similarity_score': res.score,
                        'search_method': 'vector',
                        'chunk_metadata': res.metadata
                    })
                    
            return all_results
            
        except Exception as e:
            logger.error(f"Vector search error: {e}")
            return []
    
    async def _keyword_search(
        self,
        query_analysis: QueryAnalysis,
        documents: List[Document],
        max_chunks: int
    ) -> List[Dict[str, Any]]:
        """Keyword-based fallback search"""
        results = []
        
        for doc in documents:
            try:
                # Döküman metadata'sını oku
                doc_folder = self.base_dir / doc.folder_name
                vectors_folder = doc_folder / "vectors"
                metadata_path = vectors_folder / f"doc_{doc.id}_metadata.json"
                
                if not metadata_path.exists():
                    continue
                
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                
                chunks = metadata.get('chunks', [])
                
                # Keyword matching
                for chunk in chunks:
                    chunk_text = chunk['text'].lower()
                    score = 0.0
                    
                    # Keyword matching score
                    for keyword in query_analysis.keywords:
                        if keyword in chunk_text:
                            score += 0.3
                    
                    # Exact phrase bonus
                    if query_analysis.processed_query.lower() in chunk_text:
                        score += 0.5
                    
                    if score > 0.2:
                        results.append({
                            'document_id': doc.id,
                            'document_name': doc.name,
                            'chunk_id': chunk['id'],
                            'content': chunk['text'],
                            'similarity_score': score,
                            'search_method': 'keyword',
                            'matched_keywords': [kw for kw in query_analysis.keywords if kw in chunk_text]
                        })
                
            except Exception as e:
                logger.error(f"Keyword search error for doc {doc.id}: {e}")
                continue
        
        # Sort by score
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        return results[:max_chunks]
    
    # _search_document_index removed (replaced by PgVector)
    
    async def _rerank_results(
        self, 
        query_analysis: QueryAnalysis, 
        results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Sonuçları yeniden sırala"""
        try:
            for result in results:
                # Original similarity score
                base_score = result['similarity_score']
                
                # Intent-based boosting
                content_lower = result['content'].lower()
                intent_boost = 0.0
                
                if query_analysis.intent == "information_seeking":
                    if any(word in content_lower for word in ['tanım', 'açıklama', 'nedir']):
                        intent_boost += 0.1
                
                elif query_analysis.intent == "procedural":
                    if any(word in content_lower for word in ['adım', 'süreç', 'yöntem', 'nasıl']):
                        intent_boost += 0.1
                
                elif query_analysis.intent == "comparison":
                    if any(word in content_lower for word in ['fark', 'karşılaştırma', 'arasında']):
                        intent_boost += 0.1
                
                # Keyword density boost
                keyword_count = sum(1 for kw in query_analysis.keywords if kw in content_lower)
                keyword_boost = (keyword_count / len(query_analysis.keywords)) * 0.1 if query_analysis.keywords else 0
                
                # Length penalty (çok kısa veya çok uzun chunk'lar)
                content_length = len(result['content'])
                length_penalty = 0.0
                if content_length < 50:
                    length_penalty = -0.05
                elif content_length > 2000:
                    length_penalty = -0.03
                
                # Final score
                result['reranked_score'] = base_score + intent_boost + keyword_boost + length_penalty
                result['boost_details'] = {
                    'intent_boost': intent_boost,
                    'keyword_boost': keyword_boost,
                    'length_penalty': length_penalty
                }
            
            # Sort by reranked score
            results.sort(key=lambda x: x.get('reranked_score', x['similarity_score']), reverse=True)
            return results
            
        except Exception as e:
            logger.error(f"Reranking error: {e}")
            return results
    
    def _deduplicate_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Duplicate sonuçları temizle"""
        seen = set()
        unique_results = []
        
        for result in results:
            # Unique key: document_id + chunk_id
            key = f"{result['document_id']}_{result.get('chunk_id', 0)}"
            if key not in seen:
                seen.add(key)
                unique_results.append(result)
        
        return unique_results
    
    def _apply_diversity_filter(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Çeşitlilik filtresi uygula"""
        if len(results) <= 2:
            return results
        
        diverse_results = [results[0]]  # En iyi sonucu al
        
        for result in results[1:]:
            # Mevcut sonuçlarla benzerlik kontrolü
            is_diverse = True
            for existing in diverse_results:
                # Basit text similarity check
                similarity = self._calculate_text_similarity(
                    result['content'], existing['content']
                )
                if similarity > self.diversity_threshold:
                    is_diverse = False
                    break
            
            if is_diverse:
                diverse_results.append(result)
        
        return diverse_results
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Basit text similarity hesapla"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0

# Global instance
enhanced_rag_service = EnhancedRAGService()
