"""
Action Suggestion Service
Suggests next logical action for documents based on status and history
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from sqlalchemy.orm import Session

from backend.database.models_v2 import Document

logger = logging.getLogger(__name__)


class ActionSuggestionService:
    """Service for suggesting next actions for documents"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def suggest_action(self, document: Document) -> Optional[Dict]:
        """
        Suggest next logical action for a document
        
        Args:
            document: Document object
        
        Returns:
            Action suggestion dict or None
        """
        try:
            # uploaded → Suggest "İşle"
            if document.status == "uploaded":
                return {
                    "action": "process",
                    "priority": "high",
                    "reason": "Döküman henüz işlenmedi. İşleme başlatın.",
                    "dismissible": False
                }
            
            # processed → Suggest "İndeksle"
            if document.status == "processed":
                return {
                    "action": "index",
                    "priority": "high",
                    "reason": "Döküman işlendi. RAG için indeksleyin.",
                    "dismissible": False
                }
            
            # enriched → Suggest "İndeksle"
            if document.status == "enriched":
                return {
                    "action": "index",
                    "priority": "high",
                    "reason": "Döküman zenginleştirildi. RAG için indeksleyin.",
                    "dismissible": False
                }
            
            # indexed + >7 days → Suggest "Yeniden İndeksle"
            if document.status == "indexed" and document.processed_at:
                days_since_index = (datetime.utcnow() - document.processed_at).days
                if days_since_index > 7:
                    return {
                        "action": "reindex",
                        "priority": "medium",
                        "reason": f"Döküman {days_since_index} gün önce indekslendi. Yeniden indekslemeyi düşünün.",
                        "dismissible": True
                    }
            
            # error → Suggest "Yeniden Dene"
            if document.status == "error":
                return {
                    "action": "retry",
                    "priority": "high",
                    "reason": "Döküman işlenirken hata oluştu. Yeniden deneyin.",
                    "dismissible": False
                }
            
            # No suggestion
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to suggest action: {str(e)}")
            return None
    
    async def get_suggestions_for_documents(
        self,
        document_ids: List[int]
    ) -> Dict[int, Optional[Dict]]:
        """
        Get action suggestions for multiple documents
        
        Args:
            document_ids: List of document IDs
        
        Returns:
            Dict mapping document_id to suggestion
        """
        try:
            suggestions = {}
            
            # Get documents
            documents = self.db.query(Document).filter(
                Document.id.in_(document_ids)
            ).all()
            
            # Get suggestions
            for doc in documents:
                suggestion = await self.suggest_action(doc)
                suggestions[doc.id] = suggestion
            
            logger.info(f"💡 Generated {len(suggestions)} action suggestions")
            
            return suggestions
            
        except Exception as e:
            logger.error(f"❌ Failed to get suggestions: {str(e)}")
            raise
