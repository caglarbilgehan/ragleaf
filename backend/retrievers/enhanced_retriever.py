# backend/retrievers/enhanced_retriever.py
import logging
import json
from typing import List, Dict, Union, Optional
from pathlib import Path
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

class EnhancedRetriever:
    """
    RAG-V01 tarzı gelişmiş retriever sistemi.
    
    DEPRECATED: This class is deprecated in favor of PgVector-based retrieval.
    FAISS and local file indexing support has been removed.
    """
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.base_dir = Path(".")
        logger.warning("EnhancedRetriever is deprecated and will return empty results. Please use EnhancedRAGService.")
        
    def _load_index_bundle(self, doc_name: str, index_type: str = "faiss"):
        """Deprecated"""
        raise NotImplementedError("FAISS support removed. Use PgVectorStore.")
    
    def query_documents(self, 
                       query: str, 
                       doc_name: str, 
                       top_k: int = 5, 
                       as_documents: bool = True,
                       distance_threshold: Optional[float] = None) -> List[Union[Document, Dict]]:
        """Dökümanları sorgula (RAG-V01 tarzı) - Disabled"""
        logger.warning(f"Querying deprecated EnhancedRetriever for {doc_name}. Returning empty results.")
        return []
    
    def search_multiple_documents(self, 
                                 query: str, 
                                 doc_names: List[str], 
                                 top_k: int = 5,
                                 as_documents: bool = True) -> List[Union[Document, Dict]]:
        """Birden fazla döküman içinde arama yap - Disabled"""
        logger.warning(f"Querying deprecated EnhancedRetriever for multiple docs. Returning empty results.")
        return []
    
    def get_available_documents(self) -> List[str]:
        """Mevcut dökümanları listele"""
        return []

# Global instance
enhanced_retriever = EnhancedRetriever()
