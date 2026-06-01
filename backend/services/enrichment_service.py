"""
Enrichment Service for Document Enrichment Management
Handles CRUD operations for JSON and Q&A enrichments
"""

import json
import logging
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..database.models_v2 import DocumentEnrichment, Document, DocumentChunk

logger = logging.getLogger(__name__)


class EnrichmentService:
    """Service for managing document enrichments"""
    
    def validate_json(self, content: str) -> Tuple[bool, Optional[str]]:
        """
        Validate JSON content.
        
        Args:
            content: JSON string to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not content or not content.strip():
            return False, "JSON içeriği boş olamaz"
        
        try:
            json.loads(content)
            return True, None
        except json.JSONDecodeError as e:
            return False, f"Geçersiz JSON formatı: {str(e)}"
    
    def validate_qa(self, question: str, answer: str) -> Tuple[bool, Optional[str]]:
        """
        Validate Q&A content.
        
        Args:
            question: Question text
            answer: Answer text
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not question or not question.strip():
            return False, "Soru alanı boş olamaz"
        
        if not answer or not answer.strip():
            return False, "Cevap alanı boş olamaz"
        
        return True, None
    
    async def create_enrichment(
        self,
        document_id: int,
        enrichment_type: str,
        title: str,
        content: str,
        db: Session
    ) -> DocumentEnrichment:
        """
        Create a new enrichment for a document.
        
        Args:
            document_id: ID of the document
            enrichment_type: 'json' or 'qa'
            title: Title for JSON or question for Q&A
            content: JSON content or answer
            db: Database session
            
        Returns:
            Created DocumentEnrichment object
            
        Raises:
            ValueError: If validation fails
            Exception: If document not found
        """
        # Validate document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception(f"Döküman bulunamadı: {document_id}")
        
        # Validate based on type
        if enrichment_type == 'json':
            is_valid, error = self.validate_json(content)
            if not is_valid:
                raise ValueError(error)
        elif enrichment_type == 'qa':
            is_valid, error = self.validate_qa(title, content)
            if not is_valid:
                raise ValueError(error)
        else:
            raise ValueError(f"Geçersiz zenginleştirme tipi: {enrichment_type}")
        
        # Create enrichment
        enrichment = DocumentEnrichment(
            document_id=document_id,
            type=enrichment_type,
            title=title.strip(),
            content=content.strip()
        )
        
        db.add(enrichment)
        db.commit()
        db.refresh(enrichment)
        
        logger.info(f"✅ Created enrichment {enrichment.id} for document {document_id}")
        return enrichment
    
    async def get_enrichments(
        self,
        document_id: int,
        db: Session,
        enrichment_type: Optional[str] = None
    ) -> List[DocumentEnrichment]:
        """
        Get all enrichments for a document.
        
        Args:
            document_id: ID of the document
            db: Database session
            enrichment_type: Optional filter by type ('json' or 'qa')
            
        Returns:
            List of DocumentEnrichment objects
        """
        query = db.query(DocumentEnrichment).filter(
            DocumentEnrichment.document_id == document_id
        )
        
        if enrichment_type:
            query = query.filter(DocumentEnrichment.type == enrichment_type)
        
        return query.order_by(DocumentEnrichment.created_at.desc()).all()
    
    async def get_enrichment_by_id(
        self,
        enrichment_id: int,
        db: Session
    ) -> Optional[DocumentEnrichment]:
        """
        Get a single enrichment by ID.
        
        Args:
            enrichment_id: ID of the enrichment
            db: Database session
            
        Returns:
            DocumentEnrichment object or None
        """
        return db.query(DocumentEnrichment).filter(
            DocumentEnrichment.id == enrichment_id
        ).first()
    
    async def update_enrichment(
        self,
        enrichment_id: int,
        title: str,
        content: str,
        db: Session
    ) -> DocumentEnrichment:
        """
        Update an existing enrichment.
        
        Args:
            enrichment_id: ID of the enrichment
            title: New title/question
            content: New content/answer
            db: Database session
            
        Returns:
            Updated DocumentEnrichment object
            
        Raises:
            ValueError: If validation fails
            Exception: If enrichment not found
        """
        enrichment = await self.get_enrichment_by_id(enrichment_id, db)
        if not enrichment:
            raise Exception(f"Zenginleştirme bulunamadı: {enrichment_id}")
        
        # Validate based on type
        if enrichment.type == 'json':
            is_valid, error = self.validate_json(content)
            if not is_valid:
                raise ValueError(error)
        elif enrichment.type == 'qa':
            is_valid, error = self.validate_qa(title, content)
            if not is_valid:
                raise ValueError(error)
        
        # Update fields
        enrichment.title = title.strip()
        enrichment.content = content.strip()
        
        db.commit()
        db.refresh(enrichment)
        
        logger.info(f"✅ Updated enrichment {enrichment_id}")
        return enrichment
    
    async def delete_enrichment(
        self,
        enrichment_id: int,
        db: Session
    ) -> bool:
        """
        Delete an enrichment and its associated embedding chunk.
        
        Args:
            enrichment_id: ID of the enrichment
            db: Database session
            
        Returns:
            True if deleted successfully
            
        Raises:
            Exception: If enrichment not found
        """
        enrichment = await self.get_enrichment_by_id(enrichment_id, db)
        if not enrichment:
            raise Exception(f"Zenginleştirme bulunamadı: {enrichment_id}")
        
        # Delete associated embedding chunk if exists
        if enrichment.embedding_chunk_id:
            chunk = db.query(DocumentChunk).filter(
                DocumentChunk.id == enrichment.embedding_chunk_id
            ).first()
            if chunk:
                db.delete(chunk)
                logger.info(f"🗑️ Deleted embedding chunk {enrichment.embedding_chunk_id}")
        
        # Delete enrichment
        db.delete(enrichment)
        db.commit()
        
        logger.info(f"✅ Deleted enrichment {enrichment_id}")
        return True
    
    async def get_enrichment_count(
        self,
        document_id: int,
        db: Session
    ) -> Dict[str, int]:
        """
        Get count of enrichments by type for a document.
        
        Args:
            document_id: ID of the document
            db: Database session
            
        Returns:
            Dict with counts: {'json': N, 'qa': M, 'total': N+M}
        """
        enrichments = await self.get_enrichments(document_id, db)
        
        json_count = sum(1 for e in enrichments if e.type == 'json')
        qa_count = sum(1 for e in enrichments if e.type == 'qa')
        
        return {
            'json': json_count,
            'qa': qa_count,
            'total': json_count + qa_count
        }


# Singleton instance
enrichment_service = EnrichmentService()
