"""
Chat Modes API - RAG ve CHAT mode yönetimi
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging

from ..database.connection import get_db
from ..database.models import Document
from ..services.ai_service import AIService
from ..services.rag_service import RAGService
from ..services.web_search_service import WebSearchService

logger = logging.getLogger(__name__)

chat_modes_router = APIRouter(prefix="/chat-modes", tags=["Chat Modes"])

class ChatModeRequest(BaseModel):
    mode: str  # "RAG" or "CHAT"
    message: str
    model: str
    conversation_id: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 512

class ChatModeResponse(BaseModel):
    response: str
    mode: str
    sources: Optional[List[Dict[str, Any]]] = None
    web_results: Optional[List[Dict[str, Any]]] = None

# Initialize services
ai_service = AIService()
rag_service = RAGService()
web_search_service = WebSearchService()

@chat_modes_router.post("/process", response_model=ChatModeResponse)
async def process_chat_mode(
    request: ChatModeRequest,
    db: Session = Depends(get_db)
):
    """
    RAG veya CHAT mode'una göre mesajı işle
    """
    try:
        if request.mode.upper() == "RAG":
            return await process_rag_mode(request, db)
        elif request.mode.upper() == "CHAT":
            return await process_chat_mode_with_search(request, db)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Geçersiz mode: {request.mode}. 'RAG' veya 'CHAT' olmalı."
            )
    except Exception as e:
        logger.error(f"Chat mode processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat mode işleme hatası: {str(e)}"
        )

async def process_rag_mode(request: ChatModeRequest, db: Session) -> ChatModeResponse:
    """
    RAG Mode: Admin panel'den yüklenen dökümanlarla çalış
    """
    try:
        # Döküman sayısını kontrol et
        document_count = db.query(Document).count()
        if document_count == 0:
            return ChatModeResponse(
                response="RAG modunda çalışmak için önce admin panelden döküman yüklemeniz gerekiyor.",
                mode="RAG",
                sources=[]
            )
        
        # RAG service ile döküman arama ve yanıt üretme
        rag_result = await rag_service.query_documents(
            query=request.message,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            db=db
        )
        
        return ChatModeResponse(
            response=rag_result["response"],
            mode="RAG",
            sources=rag_result.get("sources", [])
        )
        
    except Exception as e:
        logger.error(f"RAG mode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG mode hatası: {str(e)}"
        )

async def process_chat_mode_with_search(request: ChatModeRequest, db: Session) -> ChatModeResponse:
    """
    CHAT Mode: Normal AI chat + web arama
    """
    try:
        # Web arama yap (isteğe bağlı)
        web_results = []
        enhanced_prompt = request.message
        
        # Eğer soru web araması gerektirebilecek türdeyse arama yap
        if should_perform_web_search(request.message):
            try:
                search_results = await web_search_service.search(request.message)
                if search_results:
                    web_results = search_results
                    # Web sonuçlarını prompt'a ekle
                    web_context = "\n".join([
                        f"Web Kaynağı: {result.get('title', '')}\n{result.get('snippet', '')}"
                        for result in search_results[:3]  # İlk 3 sonucu kullan
                    ])
                    enhanced_prompt = f"""Kullanıcı Sorusu: {request.message}

Web'den Güncel Bilgiler:
{web_context}

Lütfen yukarıdaki güncel bilgileri de dikkate alarak soruyu yanıtla."""
            except Exception as e:
                logger.warning(f"Web search failed: {str(e)}")
        
        # AI ile yanıt üret
        ai_response = await ai_service.generate_response(
            model=request.model,
            prompt=enhanced_prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        # Response'dan text çıkar
        if isinstance(ai_response, dict):
            response_text = ai_response.get("response", ai_response.get("text", str(ai_response)))
        else:
            response_text = str(ai_response)
        
        return ChatModeResponse(
            response=response_text,
            mode="CHAT",
            web_results=web_results if web_results else None
        )
        
    except Exception as e:
        logger.error(f"CHAT mode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CHAT mode hatası: {str(e)}"
        )

def should_perform_web_search(message: str) -> bool:
    """
    Mesajın web araması gerektirip gerektirmediğini belirle
    """
    search_keywords = [
        "güncel", "son", "yeni", "bugün", "bu hafta", "bu ay", "2024", "2025",
        "haber", "fiyat", "kur", "borsa", "hava durumu", "ne zaman", "kim",
        "nerede", "nasıl", "hangi", "kaç", "ne kadar"
    ]
    
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in search_keywords)

@chat_modes_router.get("/available-modes")
async def get_available_modes():
    """
    Mevcut chat mode'larını listele
    """
    return {
        "modes": [
            {
                "id": "RAG",
                "name": "RAG Mode",
                "description": "Admin panelden yüklenen dökümanlarla çalışan profesyonel RAG sistemi",
                "icon": "📚"
            },
            {
                "id": "CHAT", 
                "name": "Chat Mode",
                "description": "Normal yapay zeka sohbeti + web arama özelliği",
                "icon": "💬"
            }
        ]
    }
