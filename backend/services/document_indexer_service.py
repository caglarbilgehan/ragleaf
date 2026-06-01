"""
Document Indexer Service
Generates embeddings for document chunks using enriched content.

This service is responsible for:
1. Building enriched content for each chunk (original + enrichments)
2. Generating embeddings using the embedding service
3. Saving embeddings to PgVector
4. Managing re-indexing operations

Part of the 3-stage document pipeline:
Upload → Process → Enrich → INDEX → RAG Ready
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session
import numpy as np

from .enriched_content_builder import (
    EnrichedContentBuilder,
    EnrichmentData,
    LinkedAsset,
    DocumentEnrichmentData
)
from .embedding.embedding_service import embedding_service
from ..database.models_v2 import Document, DocumentChunk, DocumentAsset, DocumentEnrichment

logger = logging.getLogger(__name__)


@dataclass
class IndexResult:
    """Result of indexing operation"""
    success: bool
    document_id: int
    chunks_indexed: int
    errors: List[str]
    duration_seconds: float
    message: str


class DocumentIndexerService:
    """
    Service for generating embeddings and indexing documents to PgVector.
    
    Uses EnrichedContentBuilder to create enriched content that includes:
    - Original chunk text
    - Suggested questions
    - Tags
    - Special instructions
    - Linked image OCR/captions
    - Document enrichments (JSON/QA)
    
    The enriched content is then embedded and stored in PgVector for RAG queries.
    """
    
    def __init__(self, max_content_length: int = 8192):
        """
        Initialize the indexer service.
        
        Args:
            max_content_length: Maximum length for enriched content
        """
        self.content_builder = EnrichedContentBuilder(max_length=max_content_length)
    
    async def index_document(
        self,
        document_id: int,
        db: Session,
        batch_size: int = 32
    ) -> IndexResult:
        """
        Index a document by generating embeddings for all chunks.
        
        This method:
        1. Loads all chunks for the document
        2. Builds enriched content for each chunk
        3. Generates embeddings in batches
        4. Updates chunk.embedding in database
        5. Updates document status to 'indexed'
        
        Args:
            document_id: ID of document to index
            db: Database session
            batch_size: Batch size for embedding generation
        
        Returns:
            IndexResult with success status and statistics
        """
        import time
        start_time = time.time()
        errors = []
        
        try:
            # 1. Get document
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return IndexResult(
                    success=False,
                    document_id=document_id,
                    chunks_indexed=0,
                    errors=["Document not found"],
                    duration_seconds=0,
                    message="Document not found"
                )
            
            # 2. Validate document status
            if document.status not in ['processed', 'enriched', 'indexed']:
                return IndexResult(
                    success=False,
                    document_id=document_id,
                    chunks_indexed=0,
                    errors=[f"Invalid document status: {document.status}. Must be 'processed' or 'enriched'"],
                    duration_seconds=0,
                    message=f"Document must be processed first (current status: {document.status})"
                )
            
            # 3. Update status to indexing
            document.status = 'indexing'
            document.processing_stage = 'embedding_generation'
            document.processing_progress = 0
            db.commit()
            
            logger.info(f"🚀 Starting indexing for document {document_id}: {document.name}")
            
            # 4. Load chunks
            chunks = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).order_by(DocumentChunk.chunk_index).all()
            
            if not chunks:
                document.status = 'indexed'
                document.vector_indexed = True
                document.processed_at = datetime.utcnow()
                db.commit()
                
                return IndexResult(
                    success=True,
                    document_id=document_id,
                    chunks_indexed=0,
                    errors=[],
                    duration_seconds=time.time() - start_time,
                    message="No chunks to index"
                )
            
            # 5. Load assets for image relations
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id
            ).all()
            assets_by_id = {a.id: {"ocr_text": a.ocr_text, "caption": a.caption} for a in assets}
            
            # 6. Load document enrichments
            doc_enrichments = db.query(DocumentEnrichment).filter(
                DocumentEnrichment.document_id == document_id
            ).all()
            doc_enrichment_data = [
                {"type": e.type, "title": e.title, "content": e.content}
                for e in doc_enrichments
            ]
            
            # 7. Build enriched content for all chunks
            enriched_contents = []
            for chunk in chunks:
                enriched_content = self.content_builder.build_from_chunk_dict(
                    chunk_content=chunk.content,
                    enrichment_data_dict=chunk.enrichment_data,
                    image_relations=chunk.image_relations if chunk.image_relations else None,
                    assets_by_id=assets_by_id,
                    document_enrichments=doc_enrichment_data
                )
                enriched_contents.append(enriched_content)
            
            logger.info(f"📝 Built enriched content for {len(enriched_contents)} chunks")
            
            # 8. Generate embeddings in batches
            total_chunks = len(chunks)
            indexed_count = 0
            
            for i in range(0, total_chunks, batch_size):
                batch_end = min(i + batch_size, total_chunks)
                batch_contents = enriched_contents[i:batch_end]
                batch_chunks = chunks[i:batch_end]
                
                try:
                    # Generate embeddings
                    embeddings = embedding_service.encode(
                        texts=batch_contents,
                        db=db,
                        batch_size=batch_size,
                        normalize=True
                    )
                    
                    # Update chunks with embeddings
                    for j, chunk in enumerate(batch_chunks):
                        chunk.embedding = embeddings[j].tolist()
                        indexed_count += 1
                    
                    # Update progress
                    progress = int((batch_end / total_chunks) * 100)
                    document.processing_progress = progress
                    db.commit()
                    
                    logger.info(f"📊 Indexed batch {i//batch_size + 1}: {batch_end}/{total_chunks} chunks ({progress}%)")
                    
                except Exception as e:
                    error_msg = f"Batch {i//batch_size + 1} failed: {str(e)}"
                    logger.error(f"❌ {error_msg}")
                    errors.append(error_msg)
                    # Continue with next batch
            
            # 9. Update document status
            if indexed_count > 0:
                document.status = 'indexed'
                document.vector_indexed = True
                document.processed_at = datetime.utcnow()
                document.processing_stage = None
                document.processing_progress = 100
                document.total_chunks = indexed_count
                db.commit()
                
                logger.info(f"✅ Document {document_id} indexed successfully: {indexed_count} chunks")
            else:
                document.status = 'error'
                document.processing_details = "No chunks were indexed"
                db.commit()
            
            duration = time.time() - start_time
            
            return IndexResult(
                success=indexed_count > 0,
                document_id=document_id,
                chunks_indexed=indexed_count,
                errors=errors,
                duration_seconds=duration,
                message=f"Indexed {indexed_count}/{total_chunks} chunks in {duration:.2f}s"
            )
            
        except Exception as e:
            logger.error(f"❌ Indexing failed for document {document_id}: {e}")
            
            # Update document status to error
            try:
                document = db.query(Document).filter(Document.id == document_id).first()
                if document:
                    document.status = 'error'
                    document.processing_details = str(e)
                    db.commit()
            except:
                pass
            
            return IndexResult(
                success=False,
                document_id=document_id,
                chunks_indexed=0,
                errors=[str(e)],
                duration_seconds=time.time() - start_time,
                message=f"Indexing failed: {str(e)}"
            )
    
    async def reindex_document(
        self,
        document_id: int,
        db: Session,
        batch_size: int = 32
    ) -> IndexResult:
        """
        Re-index a document by clearing existing embeddings and regenerating.
        
        This is used when:
        - Enrichment data has been updated
        - Embedding model has changed
        - User wants to refresh embeddings
        
        Args:
            document_id: ID of document to re-index
            db: Database session
            batch_size: Batch size for embedding generation
        
        Returns:
            IndexResult with success status and statistics
        """
        logger.info(f"🔄 Re-indexing document {document_id}")
        
        # 1. Clear existing embeddings
        cleared = await self.clear_embeddings(document_id, db)
        logger.info(f"🗑️ Cleared {cleared} existing embeddings")
        
        # 2. Re-index
        return await self.index_document(document_id, db, batch_size)
    
    async def clear_embeddings(
        self,
        document_id: int,
        db: Session
    ) -> int:
        """
        Clear all embeddings for a document.
        
        Sets embedding=NULL for all chunks but preserves chunk content and enrichments.
        
        Args:
            document_id: ID of document
            db: Database session
        
        Returns:
            Number of embeddings cleared
        """
        try:
            # Update all chunks to have NULL embedding
            result = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).update({DocumentChunk.embedding: None})
            
            # Update document status
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.vector_indexed = False
                # Keep status as 'enriched' if it was indexed, otherwise keep current
                if document.status == 'indexed':
                    document.status = 'enriched' if self._has_enrichments(document_id, db) else 'processed'
            
            db.commit()
            
            logger.info(f"🗑️ Cleared {result} embeddings for document {document_id}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to clear embeddings: {e}")
            db.rollback()
            return 0
    
    def _has_enrichments(self, document_id: int, db: Session) -> bool:
        """Check if document has any enrichment data"""
        # Check chunk enrichments
        chunk_with_enrichment = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.enrichment_data != None,
            DocumentChunk.enrichment_data != {}
        ).first()
        
        if chunk_with_enrichment:
            return True
        
        # Check document enrichments
        doc_enrichment = db.query(DocumentEnrichment).filter(
            DocumentEnrichment.document_id == document_id
        ).first()
        
        return doc_enrichment is not None
    
    async def index_single_chunk(
        self,
        chunk_id: int,
        db: Session
    ) -> Tuple[bool, str]:
        """
        Index a single chunk (useful for incremental updates).
        
        Args:
            chunk_id: ID of chunk to index
            db: Database session
        
        Returns:
            Tuple of (success, message)
        """
        try:
            chunk = db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
            if not chunk:
                return False, "Chunk not found"
            
            # Load assets
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == chunk.document_id
            ).all()
            assets_by_id = {a.id: {"ocr_text": a.ocr_text, "caption": a.caption} for a in assets}
            
            # Load document enrichments
            doc_enrichments = db.query(DocumentEnrichment).filter(
                DocumentEnrichment.document_id == chunk.document_id
            ).all()
            doc_enrichment_data = [
                {"type": e.type, "title": e.title, "content": e.content}
                for e in doc_enrichments
            ]
            
            # Build enriched content
            enriched_content = self.content_builder.build_from_chunk_dict(
                chunk_content=chunk.content,
                enrichment_data_dict=chunk.enrichment_data,
                image_relations=chunk.image_relations if chunk.image_relations else None,
                assets_by_id=assets_by_id,
                document_enrichments=doc_enrichment_data
            )
            
            # Generate embedding
            embedding = embedding_service.encode_single(
                text=enriched_content,
                db=db,
                normalize=True
            )
            
            # Update chunk
            chunk.embedding = embedding.tolist()
            db.commit()
            
            logger.info(f"✅ Indexed single chunk {chunk_id}")
            return True, "Chunk indexed successfully"
            
        except Exception as e:
            logger.error(f"❌ Failed to index chunk {chunk_id}: {e}")
            return False, str(e)
    
    def get_indexing_stats(self, document_id: int, db: Session) -> Dict[str, Any]:
        """
        Get indexing statistics for a document.
        
        Args:
            document_id: ID of document
            db: Database session
        
        Returns:
            Dict with indexing statistics
        """
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return {"error": "Document not found"}
        
        total_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).count()
        
        indexed_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.embedding != None
        ).count()
        
        enriched_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.enrichment_data != None,
            DocumentChunk.enrichment_data != {}
        ).count()
        
        doc_enrichments = db.query(DocumentEnrichment).filter(
            DocumentEnrichment.document_id == document_id
        ).count()
        
        return {
            "document_id": document_id,
            "document_name": document.name,
            "status": document.status,
            "total_chunks": total_chunks,
            "indexed_chunks": indexed_chunks,
            "enriched_chunks": enriched_chunks,
            "document_enrichments": doc_enrichments,
            "vector_indexed": document.vector_indexed,
            "processed_at": document.processed_at.isoformat() if document.processed_at else None
        }


# Global instance
document_indexer_service = DocumentIndexerService()
