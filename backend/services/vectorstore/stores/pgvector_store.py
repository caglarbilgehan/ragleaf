"""
PgVector Vector Store
Persistent vector storage with PostgreSQL pgvector extension
Supports: Vector Search, Full-Text Search (BM25), Hybrid Search (RRF)
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sqlalchemy import text, func as sql_func

# Database connection
from ....database.connection_v2 import SessionLocal
from ....database.models_v2 import DocumentChunk, DocumentAsset

# Base interface
from .base_store import BaseVectorStore, SearchResult

logger = logging.getLogger(__name__)

# Regex pattern for page markers in chunk content
# Matches: --- Sayfa X --- where X is the page number
PAGE_MARKER_PATTERN = re.compile(r'---\s*Sayfa\s+(\d+)\s*---', re.IGNORECASE)

# Regex pattern for image references in chunk content (backup method)
# Matches: [Görsel X metni: ...] where X is the image index
IMAGE_REF_PATTERN = re.compile(r'\[Görsel\s+(\d+)\s+metni:', re.IGNORECASE)


class PgVectorStore(BaseVectorStore):
    """PostgreSQL pgvector store implementation"""
    
    name: str = "pgvector"
    
    def __init__(self):
        # Initialize connection settings if needed
        pass
    
    def _extract_image_relations(
        self, 
        content: str, 
        document_id: int, 
        db,
        page_numbers: List[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract image relations from chunk based on page numbers.
        
        Strategy (Priority Order):
        1. Use page_numbers from chunk metadata (most reliable - set during chunking)
        2. Fallback: Find page numbers in chunk content (--- Sayfa X ---)
        
        Returns list of image relation dicts with asset_id, page, index info.
        """
        relations = []
        
        # Priority 1: Use page_numbers from metadata (set during chunking)
        chunk_pages = []
        if page_numbers:
            chunk_pages = list(set(page_numbers))
        else:
            # Fallback: Find page numbers in content (legacy method)
            page_matches = PAGE_MARKER_PATTERN.findall(content)
            if page_matches:
                chunk_pages = list(set(int(p) for p in page_matches))
        
        if not chunk_pages:
            return relations
        
        # Query DocumentAsset records for this document
        assets = db.query(DocumentAsset).filter(
            DocumentAsset.document_id == document_id,
            DocumentAsset.asset_type == "image"
        ).all()
        
        if not assets:
            return relations
        
        # Find images that belong to pages mentioned in this chunk
        for asset in assets:
            if not asset.asset_metadata:
                continue
            
            asset_page = asset.asset_metadata.get("page")
            asset_index = asset.asset_metadata.get("index")
            
            # Only link if image's page is mentioned in this chunk
            if asset_page and asset_page in chunk_pages:
                relations.append({
                    "asset_id": asset.id,
                    "page": asset_page,
                    "index": asset_index,
                    "file_path": asset.file_path,
                    "auto_linked": True
                })
        
        # Sort by page then index for consistent ordering
        relations.sort(key=lambda x: (x.get("page", 0), x.get("index", 0)))
        
        return relations
    
    def _update_asset_linked_chunks(self, db) -> None:
        """
        Update DocumentAsset.asset_metadata.linked_chunks for bidirectional relations.
        Called after chunks are committed to database.
        """
        try:
            # Get all chunks with image_relations
            chunks_with_images = db.query(DocumentChunk).filter(
                DocumentChunk.image_relations != None,
                DocumentChunk.image_relations != []
            ).all()
            
            # Build asset_id -> chunk_ids mapping
            asset_chunks_map: Dict[int, List[int]] = {}
            
            for chunk in chunks_with_images:
                if not chunk.image_relations:
                    continue
                for relation in chunk.image_relations:
                    asset_id = relation.get("asset_id")
                    if asset_id:
                        if asset_id not in asset_chunks_map:
                            asset_chunks_map[asset_id] = []
                        if chunk.id not in asset_chunks_map[asset_id]:
                            asset_chunks_map[asset_id].append(chunk.id)
            
            # Update each asset's metadata
            updated_count = 0
            for asset_id, chunk_ids in asset_chunks_map.items():
                asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
                if asset:
                    # Update asset_metadata with linked_chunks
                    metadata = asset.asset_metadata or {}
                    metadata["linked_chunks"] = chunk_ids
                    asset.asset_metadata = metadata
                    updated_count += 1
            
            if updated_count > 0:
                db.commit()
                logger.info(f"🔗 Updated {updated_count} assets with linked_chunks info")
                
        except Exception as e:
            logger.warning(f"⚠️ Failed to update asset linked_chunks: {e}")
            # Don't fail the main operation
    
    def add(
        self,
        ids: List[str],
        embeddings: np.ndarray,
        texts: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> int:
        """Add vectors to PostgreSQL with automatic image relation detection"""
        db = SessionLocal()
        try:
            # Ensure embeddings are list format
            embeddings_list = embeddings.tolist() if isinstance(embeddings, np.ndarray) else embeddings
            
            if metadatas is None:
                metadatas = [{} for _ in ids]
            
            count = 0
            linked_images_count = 0
            
            for i, text_content in enumerate(texts):
                metadata = metadatas[i]
                embedding = embeddings_list[i]
                
                # Extract required fields from metadata
                document_id = metadata.get("document_id")
                
                if not document_id:
                    logger.warning(f"⚠️ Skipping vector without document_id: {ids[i]}")
                    continue
                
                # 🖼️ Auto-detect image relations from chunk metadata or content
                image_relations = metadata.get("image_relations", [])
                if not image_relations:
                    # Try to extract using page_numbers from metadata (preferred) or content parsing (fallback)
                    page_numbers = metadata.get("page_numbers", [])
                    image_relations = self._extract_image_relations(text_content, document_id, db, page_numbers)
                    if image_relations:
                        linked_images_count += len(image_relations)
                
                chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=metadata.get("chunk_index", i),
                    content=text_content,
                    embedding=embedding,
                    word_count=metadata.get("word_count", 0),
                    char_count=metadata.get("char_count", len(text_content)),
                    paragraph_index=metadata.get("paragraph_index", 0),
                    # New Fields
                    language=metadata.get("language", "tr"),
                    original_chunk_id=metadata.get("original_chunk_id"),
                    enrichment_data=metadata.get("enrichment_data", {}),
                    image_relations=image_relations
                )
                db.add(chunk)
                count += 1
            
            db.commit()
            
            # 🔗 Update reverse relations: DocumentAsset.asset_metadata.linked_chunks
            if linked_images_count > 0:
                self._update_asset_linked_chunks(db)
            
            if linked_images_count > 0:
                logger.info(f"✅ Added {count} vectors to PostgreSQL (🖼️ {linked_images_count} auto-linked images)")
            else:
                logger.info(f"✅ Added {count} vectors to PostgreSQL")
            
            return count
            
        except Exception as e:
            logger.error(f"❌ Failed to add to PgVector: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None,
        document_ids: Optional[List[int]] = None,
        include_images: bool = True
    ) -> List[SearchResult]:
        """Search similar vectors using pgvector cosine distance
        
        Args:
            query_embedding: Query vector
            top_k: Number of results to return
            filter_metadata: Metadata filters (document_id, language)
            document_ids: List of document IDs to filter by
            include_images: Whether to include image_relations in results
        """
        from ....database.models_v2 import Document
        
        db = SessionLocal()
        try:
            # Ensure query is list format
            if isinstance(query_embedding, np.ndarray):
                query_list = query_embedding.flatten().tolist()
            else:
                query_list = query_embedding
            
            # Join with documents table to get document name and folder
            # Calculate actual cosine similarity: 1 - cosine_distance
            from sqlalchemy import func
            
            cosine_dist = DocumentChunk.embedding.cosine_distance(query_list)
            
            query = db.query(
                DocumentChunk,
                Document.name.label("document_name"),
                Document.original_filename.label("original_filename"),
                Document.folder_name.label("folder_name"),
                (1 - cosine_dist).label("similarity_score")
            ).join(
                Document, DocumentChunk.document_id == Document.id
            )
            
            # Apply filters
            if filter_metadata:
                if "document_id" in filter_metadata:
                    query = query.filter(DocumentChunk.document_id == filter_metadata["document_id"])
                
                # Language Filter
                if "language" in filter_metadata:
                    query = query.filter(DocumentChunk.language == filter_metadata["language"])
            
            # Apply document_ids filter (for metadata-based filtering)
            if document_ids:
                query = query.filter(DocumentChunk.document_id.in_(document_ids))
            
            # PgVector Cosine Similarity Search - order by distance (ascending)
            results = query.order_by(cosine_dist).limit(top_k).all()
            
            # Convert to SearchResult
            search_results = []
            for row in results:
                chunk = row[0]  # DocumentChunk object
                document_name = row.document_name or row.original_filename or "unknown"
                similarity_score = float(row.similarity_score) if row.similarity_score else 0.0
                
                # Clamp score between 0 and 1
                similarity_score = max(0.0, min(1.0, similarity_score))
                
                # Build metadata
                metadata = {
                    "document_id": chunk.document_id,
                    "document_name": document_name,
                    "chunk_index": chunk.chunk_index,
                    "word_count": chunk.word_count,
                    "folder_name": row.folder_name
                }
                
                # 🖼️ Include image relations if requested
                if include_images and chunk.image_relations:
                    metadata["image_relations"] = chunk.image_relations
                
                search_results.append(SearchResult(
                    id=str(chunk.id),
                    text=chunk.content,
                    score=similarity_score, 
                    metadata=metadata
                ))
            
            return search_results
            
        except Exception as e:
            logger.error(f"❌ PgVector search failed: {e}")
            import traceback
            traceback.print_exc()
            return []
        finally:
            db.close()
            
    def delete(
        self,
        ids: Optional[List[str]] = None,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """Delete vectors"""
        db = SessionLocal()
        try:
            query = db.query(DocumentChunk)
            deleted_count = 0
            
            if filter_metadata:
                if "document_id" in filter_metadata:
                    count = query.filter(DocumentChunk.document_id == filter_metadata["document_id"]).delete()
                    deleted_count = count
            
            db.commit()
            return deleted_count
            
        except Exception as e:
            logger.error(f"❌ PgVector delete failed: {e}")
            db.rollback()
            return 0
        finally:
            db.close()
    
    def delete_by_document(self, document_id: int) -> int:
        """Delete all vectors for a specific document"""
        return self.delete(filter_metadata={"document_id": document_id})
    
    def count(self) -> int:
        """Get total vector count"""
        db = SessionLocal()
        try:
            return db.query(DocumentChunk).count()
        except:
            return 0
        finally:
            db.close()
    
    def clear(self) -> bool:
        """Clear all vectors"""
        db = SessionLocal()
        try:
            db.query(DocumentChunk).delete()
            db.commit()
            logger.info("🗑️ PostgreSQL document_chunks cleared")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to clear PgVector: {e}")
            db.rollback()
            return False
        finally:
            db.close()
            
    def update_dimension(self, new_dimension: int) -> bool:
        """Update vector dimension in database"""
        db = SessionLocal()
        try:
            # Drop index first
            db.execute(text("DROP INDEX IF EXISTS idx_chunk_embedding_ivfflat;"))
            
            # Alter column type
            # Note: handle_model_change calls clear_all() first, so table should be empty.
            db.execute(text(f"ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector({new_dimension});"))
            
            # Recreate index
            db.execute(text("CREATE INDEX idx_chunk_embedding_ivfflat ON document_chunks USING ivfflat (embedding vector_cosine_ops);"))
            
            db.commit()
            logger.info(f"✅ Updated document_chunks embedding dimension to {new_dimension}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to update dimension: {e}")
            db.rollback()
            return False
        finally:
            db.close()
            
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics"""
        count = self.count()
        return {
            'name': self.name,
            'count': count,
            'total_documents': count, 
            'collection_name': 'document_chunks',
            'persist_directory': 'postgres'
        }
    
    # =========================================================================
    # HYBRID SEARCH METHODS (Vector + Full-Text BM25)
    # =========================================================================
    
    def full_text_search(
        self,
        query_text: str,
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None,
        document_ids: Optional[List[int]] = None,
        language: str = "turkish"
    ) -> List[SearchResult]:
        """
        PostgreSQL Full-Text Search using tsvector and ts_rank (BM25-like)
        
        Args:
            query_text: Search query string
            top_k: Number of results
            filter_metadata: Metadata filters
            document_ids: Document ID filter
            language: PostgreSQL text search config (turkish, english, simple)
        
        Returns:
            List of SearchResult with BM25-like scores
        """
        from ....database.models_v2 import Document
        
        db = SessionLocal()
        try:
            # Clean and prepare query for full-text search
            # Remove special characters, keep alphanumeric and Turkish chars
            clean_query = re.sub(r'[^\w\sğüşıöçĞÜŞİÖÇ]', ' ', query_text)
            clean_query = ' '.join(clean_query.split())  # Normalize whitespace
            
            if not clean_query.strip():
                return []
            
            # Convert query words to tsquery format with OR operator for flexibility
            query_words = clean_query.split()
            # Use plainto_tsquery for simple queries, or build custom tsquery
            ts_query_str = ' | '.join(query_words)  # OR between words
            
            # Build the full-text search query using PostgreSQL functions
            # ts_rank gives BM25-like relevance scoring
            sql = text("""
                SELECT 
                    dc.id,
                    dc.document_id,
                    dc.chunk_index,
                    dc.content,
                    dc.word_count,
                    dc.language,
                    dc.image_relations,
                    dc.enrichment_data,
                    d.name as document_name,
                    d.original_filename,
                    d.folder_name,
                    ts_rank_cd(
                        to_tsvector(:lang, dc.content),
                        to_tsquery(:lang, :query),
                        32  -- Normalization: divide by document length
                    ) as rank_score
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE to_tsvector(:lang, dc.content) @@ to_tsquery(:lang, :query)
                    AND (:doc_ids IS NULL OR dc.document_id = ANY(:doc_ids_arr))
                    AND (:filter_lang IS NULL OR dc.language = :filter_lang)
                ORDER BY rank_score DESC
                LIMIT :limit
            """)
            
            # Prepare parameters
            filter_lang = filter_metadata.get("language") if filter_metadata else None
            doc_ids_arr = document_ids if document_ids else None
            
            results = db.execute(sql, {
                "lang": language,
                "query": ts_query_str,
                "doc_ids": doc_ids_arr is not None,
                "doc_ids_arr": doc_ids_arr,
                "filter_lang": filter_lang,
                "limit": top_k
            }).fetchall()
            
            search_results = []
            for row in results:
                # Normalize rank score to 0-1 range (ts_rank typically returns 0-1 but can exceed)
                rank_score = float(row.rank_score) if row.rank_score else 0.0
                normalized_score = min(1.0, max(0.0, rank_score))
                
                metadata = {
                    "document_id": row.document_id,
                    "document_name": row.document_name or row.original_filename or "unknown",
                    "chunk_index": row.chunk_index,
                    "word_count": row.word_count,
                    "folder_name": row.folder_name,
                    "search_type": "full_text"
                }
                
                if row.image_relations:
                    metadata["image_relations"] = row.image_relations
                if row.enrichment_data:
                    metadata["enrichment_data"] = row.enrichment_data
                
                search_results.append(SearchResult(
                    id=str(row.id),
                    text=row.content,
                    score=normalized_score,
                    metadata=metadata
                ))
            
            logger.info(f"🔍 Full-text search returned {len(search_results)} results for: {query_text[:50]}...")
            return search_results
            
        except Exception as e:
            logger.error(f"❌ Full-text search failed: {e}")
            import traceback
            traceback.print_exc()
            return []
        finally:
            db.close()
    
    def hybrid_search(
        self,
        query_text: str,
        query_embedding: np.ndarray,
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None,
        document_ids: Optional[List[int]] = None,
        vector_weight: float = 0.5,
        keyword_weight: float = 0.5,
        rrf_k: int = 60
    ) -> List[SearchResult]:
        """
        Hybrid Search combining Vector (semantic) and Full-Text (keyword) search
        using Reciprocal Rank Fusion (RRF) for score combination.
        
        RRF Formula: score = sum(1 / (k + rank_i)) for each ranking
        
        Args:
            query_text: Original query string for full-text search
            query_embedding: Query vector for semantic search
            top_k: Final number of results to return
            filter_metadata: Metadata filters
            document_ids: Document ID filter
            vector_weight: Weight for vector search (0-1)
            keyword_weight: Weight for keyword search (0-1)
            rrf_k: RRF constant (default 60, higher = smoother blending)
        
        Returns:
            List of SearchResult with combined RRF scores
        """
        logger.info(f"🔀 Hybrid Search: vector_weight={vector_weight}, keyword_weight={keyword_weight}")
        
        # Fetch more results from each method for better fusion
        fetch_k = top_k * 3
        
        # 1. Vector Search (Semantic)
        vector_results = self.search(
            query_embedding=query_embedding,
            top_k=fetch_k,
            filter_metadata=filter_metadata,
            document_ids=document_ids,
            include_images=True
        )
        
        # 2. Full-Text Search (Keyword/BM25)
        # Determine language for full-text search
        ft_language = "turkish"  # Default
        if filter_metadata and filter_metadata.get("language") == "en":
            ft_language = "english"
        
        keyword_results = self.full_text_search(
            query_text=query_text,
            top_k=fetch_k,
            filter_metadata=filter_metadata,
            document_ids=document_ids,
            language=ft_language
        )
        
        logger.info(f"📊 Vector results: {len(vector_results)}, Keyword results: {len(keyword_results)}")
        
        # 3. Apply Reciprocal Rank Fusion (RRF)
        # Build rank maps for each result set
        vector_ranks: Dict[str, int] = {}
        keyword_ranks: Dict[str, int] = {}
        all_results: Dict[str, SearchResult] = {}
        
        for rank, result in enumerate(vector_results, start=1):
            vector_ranks[result.id] = rank
            all_results[result.id] = result
        
        for rank, result in enumerate(keyword_results, start=1):
            keyword_ranks[result.id] = rank
            if result.id not in all_results:
                all_results[result.id] = result
        
        # Calculate RRF scores
        rrf_scores: Dict[str, float] = {}
        
        for doc_id in all_results:
            score = 0.0
            
            # Vector contribution
            if doc_id in vector_ranks:
                score += vector_weight * (1.0 / (rrf_k + vector_ranks[doc_id]))
            
            # Keyword contribution
            if doc_id in keyword_ranks:
                score += keyword_weight * (1.0 / (rrf_k + keyword_ranks[doc_id]))
            
            rrf_scores[doc_id] = score
        
        # Sort by RRF score
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        
        # Build final results
        final_results = []
        for doc_id in sorted_ids[:top_k]:
            result = all_results[doc_id]
            
            # Update metadata with hybrid search info
            result.metadata["search_type"] = "hybrid"
            result.metadata["vector_rank"] = vector_ranks.get(doc_id)
            result.metadata["keyword_rank"] = keyword_ranks.get(doc_id)
            result.metadata["rrf_score"] = rrf_scores[doc_id]
            
            # Normalize RRF score to 0-1 range for display
            # Max possible RRF score = vector_weight/(rrf_k+1) + keyword_weight/(rrf_k+1)
            max_rrf = (vector_weight + keyword_weight) / (rrf_k + 1)
            normalized_rrf = min(1.0, rrf_scores[doc_id] / max_rrf) if max_rrf > 0 else 0.0
            
            # Keep original vector score but add RRF info
            result.metadata["original_vector_score"] = result.score
            
            # Use a blended score for display (weighted average of original scores)
            vector_score = result.score if doc_id in vector_ranks else 0.0
            # For keyword results, use their original score
            keyword_score = 0.0
            if doc_id in keyword_ranks:
                for kr in keyword_results:
                    if kr.id == doc_id:
                        keyword_score = kr.score
                        break
            
            # Final display score: weighted combination
            blended_score = (vector_weight * vector_score + keyword_weight * keyword_score)
            result.score = max(vector_score, blended_score)  # Use higher of the two
            
            final_results.append(result)
        
        logger.info(f"✅ Hybrid search returned {len(final_results)} results")
        
        # Log top results for debugging
        for i, r in enumerate(final_results[:3]):
            v_rank = r.metadata.get("vector_rank", "N/A")
            k_rank = r.metadata.get("keyword_rank", "N/A")
            logger.info(f"  #{i+1}: score={r.score:.3f}, v_rank={v_rank}, k_rank={k_rank}, doc={r.metadata.get('document_name', 'unknown')[:30]}")
        
        return final_results
    
    def ensure_fulltext_index(self) -> bool:
        """
        Ensure PostgreSQL full-text search index exists on content column.
        Creates GIN index for faster full-text queries.
        """
        db = SessionLocal()
        try:
            # Check if index exists
            check_sql = text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE indexname = 'idx_chunk_content_fulltext'
                )
            """)
            exists = db.execute(check_sql).scalar()
            
            if not exists:
                logger.info("🔧 Creating full-text search index on document_chunks.content...")
                
                # Create GIN index for Turkish full-text search
                create_sql = text("""
                    CREATE INDEX idx_chunk_content_fulltext 
                    ON document_chunks 
                    USING GIN (to_tsvector('turkish', content))
                """)
                db.execute(create_sql)
                db.commit()
                
                logger.info("✅ Full-text search index created successfully")
            else:
                logger.info("✅ Full-text search index already exists")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create full-text index: {e}")
            db.rollback()
            return False
        finally:
            db.close()
