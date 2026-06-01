"""
Enrichment Embedding Service for Document Enrichment Feature
Handles embedding creation, update, and deletion for enrichments
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session
import numpy as np

from ..database.models_v2 import DocumentEnrichment, DocumentChunk, Document
from .embeddings import EmbeddingService

logger = logging.getLogger(__name__)


class EnrichmentEmbeddingService:
    """Service for managing enrichment embeddings"""
    
    def __init__(self):
        self._embedding_service: Optional[EmbeddingService] = None
        self._vector_store_manager = None
    
    @property
    def embedding_service(self) -> EmbeddingService:
        """Lazy load embedding service"""
        if self._embedding_service is None:
            self._embedding_service = EmbeddingService()
        return self._embedding_service
    
    @property
    def vector_store_manager(self):
        """Lazy load vector store manager"""
        if self._vector_store_manager is None:
            try:
                from .vectorstore import vector_store_manager
                self._vector_store_manager = vector_store_manager
            except Exception as e:
                logger.warning(f"⚠️ Vector store manager not available: {e}")
        return self._vector_store_manager
    
    def format_for_embedding(
        self,
        enrichment_type: str,
        title: str,
        content: str
    ) -> str:
        """
        Format enrichment content for embedding.
        
        Args:
            enrichment_type: 'json' or 'qa'
            title: Title for JSON or question for Q&A
            content: JSON content or answer
            
        Returns:
            Formatted string for embedding
        """
        if enrichment_type == 'json':
            return f"Başlık: {title}\nİçerik: {content}"
        else:  # qa
            return f"Soru: {title}\nCevap: {content}"
    
    async def create_embedding(
        self,
        document_id: int,
        enrichment_id: int,
        enrichment_type: str,
        title: str,
        content: str,
        db: Session
    ) -> DocumentChunk:
        """
        Create embedding chunk for an enrichment.
        
        Args:
            document_id: ID of the document
            enrichment_id: ID of the enrichment
            enrichment_type: 'json' or 'qa'
            title: Title/question
            content: Content/answer
            db: Database session
            
        Returns:
            Created DocumentChunk with embedding
        """
        # Format content for embedding
        embedding_text = self.format_for_embedding(enrichment_type, title, content)
        
        # Generate embedding
        embeddings = self.embedding_service.encode([embedding_text])
        embedding_vector = embeddings[0].tolist()
        
        # Get document to find max chunk_index
        max_chunk = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index.desc()).first()
        
        next_chunk_index = (max_chunk.chunk_index + 1) if max_chunk else 0
        
        # Create chunk
        chunk = DocumentChunk(
            document_id=document_id,
            chunk_index=next_chunk_index,
            content=embedding_text,
            language='tr',  # Default to Turkish
            embedding=embedding_vector,
            enrichment_type=enrichment_type,
            enrichment_id=enrichment_id,
            word_count=len(embedding_text.split()),
            char_count=len(embedding_text)
        )
        
        db.add(chunk)
        db.commit()
        db.refresh(chunk)
        
        # Update enrichment with chunk reference
        enrichment = db.query(DocumentEnrichment).filter(
            DocumentEnrichment.id == enrichment_id
        ).first()
        if enrichment:
            enrichment.embedding_chunk_id = chunk.id
            db.commit()
        
        # Add to vector store for RAG search
        await self._add_to_vector_store(
            document_id=document_id,
            chunk_id=chunk.id,
            content=embedding_text,
            embedding=embedding_vector,
            enrichment_type=enrichment_type,
            db=db
        )
        
        logger.info(f"✅ Created embedding chunk {chunk.id} for enrichment {enrichment_id}")
        return chunk
    
    async def _add_to_vector_store(
        self,
        document_id: int,
        chunk_id: int,
        content: str,
        embedding: list,
        enrichment_type: str,
        db: Session
    ):
        """Add enrichment chunk to vector store for RAG search"""
        try:
            if not self.vector_store_manager:
                logger.warning("⚠️ Vector store manager not available, skipping vector store add")
                return
            
            # Get document name
            document = db.query(Document).filter(Document.id == document_id).first()
            doc_name = document.name if document else f"doc_{document_id}"
            
            # Add to vector store
            self.vector_store_manager.add_document(
                chunks=[content],
                embeddings=[embedding],
                document_id=document_id,
                document_name=doc_name,
                metadata=[{
                    'chunk_id': chunk_id,
                    'enrichment_type': enrichment_type,
                    'is_enrichment': True
                }]
            )
            logger.info(f"✅ Added enrichment chunk {chunk_id} to vector store")
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to add to vector store: {e}")
    
    async def update_embedding(
        self,
        enrichment_id: int,
        title: str,
        content: str,
        db: Session
    ) -> Optional[DocumentChunk]:
        """
        Update embedding chunk for an enrichment.
        
        Args:
            enrichment_id: ID of the enrichment
            title: New title/question
            content: New content/answer
            db: Database session
            
        Returns:
            Updated DocumentChunk or None if not found
        """
        # Get enrichment
        enrichment = db.query(DocumentEnrichment).filter(
            DocumentEnrichment.id == enrichment_id
        ).first()
        
        if not enrichment:
            logger.warning(f"⚠️ Enrichment {enrichment_id} not found")
            return None
        
        # Get existing chunk
        chunk = db.query(DocumentChunk).filter(
            DocumentChunk.enrichment_id == enrichment_id
        ).first()
        
        if not chunk:
            # Create new chunk if doesn't exist
            logger.info(f"📄 Creating new embedding for enrichment {enrichment_id}")
            return await self.create_embedding(
                document_id=enrichment.document_id,
                enrichment_id=enrichment_id,
                enrichment_type=enrichment.type,
                title=title,
                content=content,
                db=db
            )
        
        # Format content for embedding
        embedding_text = self.format_for_embedding(enrichment.type, title, content)
        
        # Generate new embedding
        embeddings = self.embedding_service.encode([embedding_text])
        embedding_vector = embeddings[0].tolist()
        
        # Update chunk
        chunk.content = embedding_text
        chunk.embedding = embedding_vector
        chunk.word_count = len(embedding_text.split())
        chunk.char_count = len(embedding_text)
        
        db.commit()
        db.refresh(chunk)
        
        logger.info(f"✅ Updated embedding chunk {chunk.id} for enrichment {enrichment_id}")
        return chunk
    
    async def delete_embedding(
        self,
        enrichment_id: int,
        db: Session
    ) -> bool:
        """
        Delete embedding chunk for an enrichment.
        
        Args:
            enrichment_id: ID of the enrichment
            db: Database session
            
        Returns:
            True if deleted, False if not found
        """
        # Find chunk by enrichment_id
        chunk = db.query(DocumentChunk).filter(
            DocumentChunk.enrichment_id == enrichment_id
        ).first()
        
        if not chunk:
            logger.warning(f"⚠️ No embedding chunk found for enrichment {enrichment_id}")
            return False
        
        chunk_id = chunk.id
        document_id = chunk.document_id
        
        # Remove from vector store
        await self._remove_from_vector_store(document_id, chunk_id)
        
        # Delete from database
        db.delete(chunk)
        db.commit()
        
        logger.info(f"🗑️ Deleted embedding chunk {chunk_id} for enrichment {enrichment_id}")
        return True
    
    async def _remove_from_vector_store(self, document_id: int, chunk_id: int):
        """Remove enrichment chunk from vector store"""
        try:
            if not self.vector_store_manager:
                return
            
            # Vector store manager may have delete_by_id or similar method
            # For now, log the intent - actual implementation depends on vector store
            logger.info(f"📤 Removing chunk {chunk_id} from vector store (document {document_id})")
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to remove from vector store: {e}")
    
    async def get_embedding_chunk(
        self,
        enrichment_id: int,
        db: Session
    ) -> Optional[DocumentChunk]:
        """
        Get embedding chunk for an enrichment.
        
        Args:
            enrichment_id: ID of the enrichment
            db: Database session
            
        Returns:
            DocumentChunk or None
        """
        return db.query(DocumentChunk).filter(
            DocumentChunk.enrichment_id == enrichment_id
        ).first()


# Singleton instance
enrichment_embedding_service = EnrichmentEmbeddingService()
