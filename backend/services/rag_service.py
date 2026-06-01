"""
RAG Service - Retrieval Augmented Generation
Profesyonel RAG sistemi için gelişmiş döküman arama ve yanıt üretme
ChromaDB öncelikli, FAISS yedek olarak kullanılır

Updated to use new refactored services:
- vectorstore.vector_store_manager for search
- embedding.embedding_service for query encoding
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging
import re
from pathlib import Path
import numpy as np

from ..database.models import Document
from .ai_service import AIService
# New imports - refactored services
from .embedding.embedding_service import embedding_service
from .vectorstore import vector_store_manager

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        self.ai_service = AIService()
        self.max_context_length = 4000  # Maximum context length for AI
        self.chunk_overlap = 200  # Overlap between chunks
        self.use_chromadb = True  # ChromaDB öncelikli
    
    async def query_documents(
        self,
        query: str,
        model: str,
        temperature: Optional[float] = 0.7,
        max_tokens: Optional[int] = 512,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Profesyonel RAG query - dökümanları ara ve AI ile yanıt üret
        """
        try:
            if not db:
                return {
                    "response": "Veritabanı bağlantısı bulunamadı.",
                    "sources": []
                }
            
            # 1. Döküman sayısını kontrol et (indexed, enriched veya processed)
            document_count = db.query(Document).filter(
                Document.status.in_(["indexed", "enriched", "processed"])
            ).count()
            
            if document_count == 0:
                return {
                    "response": "RAG modunda çalışmak için önce admin panelden döküman yüklemeniz ve işlemeniz gerekiyor. Şu anda işlenmiş döküman bulunmuyor.",
                    "sources": []
                }
            
            # 2. İşlenmiş dökümanları getir (indexed öncelikli)
            documents = db.query(Document).filter(
                Document.status.in_(["indexed", "enriched", "processed"])
            ).limit(10).all()
            
            # 3. Döküman içeriklerini ara ve skorla
            relevant_chunks = await self._search_documents(query, documents, db)
            
            if not relevant_chunks:
                return {
                    "response": "Sorgunuzla ilgili bilgi yüklenen dökümanlar arasında bulunamadı. Lütfen sorunuzu farklı kelimelerle tekrar deneyin veya ilgili dökümanları yüklediğinizden emin olun.",
                    "sources": []
                }
            
            # 4. Context oluştur
            context = self._build_context(relevant_chunks)
            
            # 5. RAG prompt oluştur
            rag_prompt = self._build_rag_prompt(query, context)
            
            # 6. AI ile yanıt üret
            ai_response = await self.ai_service.generate_response(
                model=model,
                prompt=rag_prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # 7. Response'dan text çıkar
            if isinstance(ai_response, dict):
                response_text = ai_response.get("response", ai_response.get("text", str(ai_response)))
            else:
                response_text = str(ai_response)
            
            # 8. Kaynakları hazırla
            sources = self._prepare_sources(relevant_chunks)
            
            return {
                "response": response_text,
                "sources": sources,
                "context_used": len(context),
                "documents_searched": len(documents)
            }
            
        except Exception as e:
            logger.error(f"RAG query error: {str(e)}")
            return {
                "response": f"RAG sorgusu sırasında hata oluştu: {str(e)}. Lütfen tekrar deneyin.",
                "sources": []
            }
    
    async def _search_documents(self, query: str, documents: List[Document], db: Session = None) -> List[Dict[str, Any]]:
        """
        Dökümanları arayıp ilgili parçaları bul
        PgVector öncelikli, başarısız olursa keyword matching kullan
        """
        # PgVector ile semantic search dene
        if self.use_chromadb and db:
            try:
                pgvector_results = await self._search_pgvector(query, db=db)
                if pgvector_results:
                    logger.info(f"PgVector returned {len(pgvector_results)} results")
                    return pgvector_results
            except Exception as e:
                logger.warning(f"PgVector search failed, falling back to keyword: {e}")
        
        # Fallback: Keyword matching
        return await self._search_keyword(query, documents)
    
    async def _search_pgvector(self, query: str, n_results: int = 5, db: Session = None) -> List[Dict[str, Any]]:
        """
        PgVector ile semantic search - using new vectorstore manager
        """
        try:
            # Get query embedding using new embedding service
            query_embedding = embedding_service.encode_query(query, db)
            
            # Search using vector store manager
            results = vector_store_manager.search(
                query_embedding=query_embedding,
                top_k=n_results,
                use_chroma=True,
                use_faiss=False
            )
            
            if not results:
                logger.info("PgVector search returned no results")
                return []
            
            relevant_chunks = []
            for i, result in enumerate(results):
                # Convert SearchResult to dict format
                relevant_chunks.append({
                    "document_id": result.metadata.get('document_id'),
                    "document_name": result.metadata.get('document_name', 'Unknown'),
                    "chunk_index": result.metadata.get('chunk_index', i),
                    "content": result.text,
                    "score": result.score,
                    "file_type": "pdf",
                    "search_method": "pgvector"
                })
            
            logger.info(f"PgVector returned {len(relevant_chunks)} results")
            return relevant_chunks
            
        except Exception as e:
            logger.error(f"PgVector search error: {e}")
            raise
    
    async def _search_keyword(self, query: str, documents: List[Document]) -> List[Dict[str, Any]]:
        """
        Fallback: Keyword-based search
        """
        relevant_chunks = []
        query_lower = query.lower()
        query_words = set(re.findall(r'\w+', query_lower))
        
        for doc in documents:
            if not doc.content:
                continue
                
            # Dökümanı parçalara böl
            chunks = self._split_text(doc.content)
            
            for i, chunk in enumerate(chunks):
                chunk_lower = chunk.lower()
                chunk_words = set(re.findall(r'\w+', chunk_lower))
                
                # Basit skorlama: ortak kelime sayısı
                common_words = query_words.intersection(chunk_words)
                score = len(common_words) / len(query_words) if query_words else 0
                
                # Exact match bonus
                if query_lower in chunk_lower:
                    score += 0.5
                
                if score > 0.1:  # Minimum relevance threshold
                    relevant_chunks.append({
                        "document_id": doc.id,
                        "document_name": doc.name,
                        "chunk_index": i,
                        "content": chunk,
                        "score": score,
                        "file_type": doc.file_type,
                        "search_method": "keyword"
                    })
        
        # Skora göre sırala ve en iyi 5'ini al
        relevant_chunks.sort(key=lambda x: x["score"], reverse=True)
        return relevant_chunks[:5]
    
    def _split_text(self, text: str, chunk_size: int = 1000) -> List[str]:
        """
        Metni parçalara böl
        """
        if not text:
            return []
            
        # Paragraf bazında böl
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) < chunk_size:
                current_chunk += paragraph + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = paragraph + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _build_context(self, relevant_chunks: List[Dict[str, Any]]) -> str:
        """
        İlgili parçalardan context oluştur
        """
        context_parts = []
        total_length = 0
        
        for chunk in relevant_chunks:
            chunk_text = f"[Kaynak: {chunk['document_name']}]\n{chunk['content']}\n"
            
            if total_length + len(chunk_text) < self.max_context_length:
                context_parts.append(chunk_text)
                total_length += len(chunk_text)
            else:
                break
        
        return "\n---\n".join(context_parts)
    
    def _build_rag_prompt(self, query: str, context: str) -> str:
        """
        RAG için özel prompt oluştur
        """
        return f"""Sen profesyonel bir RAG (Retrieval Augmented Generation) yapay zeka asistanısın. Aşağıdaki dökümanlar temelinde kullanıcının sorusunu yanıtla.

ÖNEMLI TALİMATLAR:
1. Sadece verilen dökümanlar temelinde yanıt ver
2. Dökümanlar yeterli bilgi içermiyorsa bunu belirt
3. Yanıtını kaynaklarla destekle
4. Profesyonel ve detaylı bir dil kullan
5. Eğer soruyla ilgili bilgi yoksa, bunu açıkça söyle

DÖKÜMANLAR:
{context}

KULLANICI SORUSU: {query}

YANITINIZ:"""
    
    def _prepare_sources(self, relevant_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Kaynak bilgilerini hazırla
        """
        sources = []
        seen_docs = set()
        
        for chunk in relevant_chunks:
            doc_id = chunk["document_id"]
            if doc_id not in seen_docs:
                sources.append({
                    "document_id": doc_id,
                    "document_name": chunk["document_name"],
                    "file_type": chunk["file_type"],
                    "relevance_score": round(chunk["score"], 2),
                    "preview": chunk["content"][:200] + "..." if len(chunk["content"]) > 200 else chunk["content"]
                })
                seen_docs.add(doc_id)
        
        return sources
