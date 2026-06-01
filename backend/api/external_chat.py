"""
External Chat API with API Key authentication
Designed for app-to-app communication (Laravel -> RAG WebUI)
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import json
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.services.ai_service import ai_service
from backend.services.enhanced_rag_service import enhanced_rag_service
from backend.auth.api_key_auth import require_chat_read, APIKey
from backend.database.models import User
from backend.database.models_v2 import LLMModel
from backend.database.connection import get_db
from backend.retrievers.enhanced_retriever import enhanced_retriever
import logging

logger = logging.getLogger(__name__)

external_router = APIRouter(prefix="/api/v1", tags=["External API v1"])

# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class ExternalChatRequest(BaseModel):
    """External chat request - simplified for external integrations"""
    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    mode: Optional[str] = Field(None, description="Override mode (if allowed by API key)")
    language: Optional[str] = Field(None, description="Override language (if allowed)")
    stream: Optional[bool] = Field(False, description="Enable streaming response")
    # Optional overrides (API key settings take precedence)
    max_tokens: Optional[int] = Field(None, ge=100, le=4000)
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)

class SourceDocument(BaseModel):
    """Source document in response"""
    title: str
    page: Optional[int] = None
    confidence: float
    snippet: Optional[str] = None

class ExternalChatResponse(BaseModel):
    """External chat response"""
    success: bool = True
    message: str = Field(..., description="AI response message")
    sources: List[SourceDocument] = Field(default=[], description="Source documents (RAG mode)")
    images: List[Dict[str, Any]] = Field(default=[], description="Related images")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Response confidence")
    suggested_questions: List[str] = Field(default=[], description="Suggested follow-up questions")
    # Metadata
    model_used: str = Field(..., description="Model that generated the response")
    mode_used: str = Field(..., description="Mode used (rag/chat)")
    processing_time: float = Field(..., description="Processing time in seconds")
    chunks_retrieved: int = Field(default=0, description="Number of chunks retrieved")

class ExternalErrorResponse(BaseModel):
    """Error response"""
    success: bool = False
    error: str
    error_code: str
    message: str  # User-friendly message (from API key templates)

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN CHAT ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@external_router.post("/chat", response_model=ExternalChatResponse)
async def external_chat(
    request: ExternalChatRequest,
    auth_data: tuple[APIKey, User] = Depends(require_chat_read()),
    db: Session = Depends(get_db),
    http_request: Request = None
):
    """
    External chat endpoint for app-to-app communication
    
    **Authentication:** API Key required (X-API-Key header or Authorization: Bearer)
    
    **Features:**
    - Mode determined by API key configuration (rag/chat/hybrid)
    - Department filtering for RAG mode
    - Custom system prompts per API key
    - Rate limiting per API key
    - IP whitelist support
    
    **Example:**
    ```
    curl -X POST https://api.ragleaf.com/api/v1/chat \\
      -H "X-API-Key: mk_live_abc123_secret" \\
      -H "Content-Type: application/json" \\
      -d '{"message": "Detectomat kurulumu nasıl yapılır?"}'
    ```
    """
    api_key, user = auth_data
    start_time = time.time()
    
    try:
        logger.info(f"External chat: API key '{api_key.name}' | Mode: {api_key.allowed_mode}")
        
        # ─────────────────────────────────────────────────────────────
        # 1. VALIDATE REQUEST AGAINST API KEY SETTINGS
        # ─────────────────────────────────────────────────────────────
        
        # Check IP whitelist
        if http_request:
            client_ip = http_request.client.host
            if not api_key.is_ip_allowed(client_ip):
                logger.warning(f"IP not allowed: {client_ip} for API key {api_key.name}")
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "IP address not allowed",
                        "error_code": "IP_NOT_ALLOWED",
                        "message": api_key.get_error_message()
                    }
                )
        
        # Determine mode (API key setting or request override if hybrid)
        mode = api_key.allowed_mode
        if request.mode and api_key.allowed_mode == "hybrid":
            if request.mode in ["rag", "chat"]:
                mode = request.mode
            else:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": f"Invalid mode: {request.mode}",
                        "error_code": "INVALID_MODE",
                        "message": "Geçersiz mod. 'rag' veya 'chat' kullanın."
                    }
                )
        elif request.mode and request.mode != api_key.allowed_mode:
            logger.warning(f"Mode override attempted: {request.mode} (allowed: {api_key.allowed_mode})")
            # Silently use API key's mode
        
        # Determine language
        language = request.language or api_key.default_language
        if not api_key.is_language_allowed(language):
            logger.warning(f"Language not allowed: {language}")
            language = api_key.default_language
        
        # Get model settings
        max_tokens = request.max_tokens or api_key.max_tokens
        temperature = request.temperature or api_key.temperature
        
        # ─────────────────────────────────────────────────────────────
        # 2. GET MODEL CONFIGURATION
        # ─────────────────────────────────────────────────────────────
        
        # Use API key's specific LLM model or system default
        if api_key.llm_model_id:
            model_config = db.query(LLMModel).filter(
                LLMModel.id == api_key.llm_model_id,
                LLMModel.is_active == True
            ).first()
            
            if not model_config:
                logger.warning(f"⚠️ API key's LLM model (ID: {api_key.llm_model_id}) not found, using default")
                model_config = db.query(LLMModel).filter(
                    LLMModel.is_active == True
                ).first()
        else:
            # Use system default
            model_config = db.query(LLMModel).filter(
                LLMModel.is_active == True
            ).first()
        
        if not model_config:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "No active AI model available",
                    "error_code": "NO_MODEL",
                    "message": api_key.get_error_message()
                }
            )
        
        model_name = model_config.model_name
        logger.info(f"📊 Using LLM model: {model_name} (ID: {model_config.id})")
        
        # ─────────────────────────────────────────────────────────────
        # 3. PROCESS REQUEST BASED ON MODE
        # ─────────────────────────────────────────────────────────────
        
        response_data = {
            "success": True,
            "message": "",
            "sources": [],
            "images": [],
            "confidence": 0.0,
            "suggested_questions": [],
            "model_used": model_name,
            "mode_used": mode,
            "processing_time": 0.0,
            "chunks_retrieved": 0
        }
        
        if mode == "rag":
            # ─────────────────────────────────────────────────────────
            # RAG MODE: Document-based responses
            # ─────────────────────────────────────────────────────────
            
            rag_results = await enhanced_rag_service.process_query(
                query=request.message,
                model_name=model_name,
                language=language,
                user_departments=api_key.department_ids,
                system_prompt=api_key.get_system_prompt(),
                max_tokens=max_tokens,
                temperature=temperature,
                top_k=api_key.top_k,
                similarity_threshold=api_key.similarity_threshold,
                db=db
            )
            
            # Check if we got results
            chunks_retrieved = rag_results.get("chunks_retrieved", 0)
            
            if chunks_retrieved == 0:
                response_data["message"] = api_key.get_no_results_message()
                response_data["confidence"] = 0.0
            else:
                response_data["message"] = rag_results.get("response", api_key.get_no_results_message())
                response_data["confidence"] = rag_results.get("confidence", 0.0)
            
            response_data["chunks_retrieved"] = chunks_retrieved
            
            # Add sources if enabled
            if api_key.include_sources:
                response_format = api_key.response_format or {}
                max_sources = response_format.get("max_sources", 5)
                source_format = response_format.get("source_format", "detailed")
                
                raw_sources = rag_results.get("sources", [])[:max_sources]
                
                if source_format == "detailed":
                    response_data["sources"] = [
                        SourceDocument(
                            title=s.get("title", "Unknown"),
                            page=s.get("page"),
                            confidence=s.get("confidence", 0.0),
                            snippet=s.get("snippet", "")[:200] if s.get("snippet") else None
                        ).dict()
                        for s in raw_sources
                    ]
                elif source_format == "simple":
                    response_data["sources"] = [
                        SourceDocument(
                            title=s.get("title", "Unknown"),
                            confidence=s.get("confidence", 0.0)
                        ).dict()
                        for s in raw_sources
                    ]
                # "none" = empty list (already default)
            
            # Add images if enabled
            if api_key.include_images:
                response_data["images"] = rag_results.get("images", [])[:5]
            
            # Add suggested questions if enabled
            response_format = api_key.response_format or {}
            if response_format.get("include_suggested_questions", True):
                response_data["suggested_questions"] = rag_results.get("suggested_questions", [])[:3]
        
        else:
            # ─────────────────────────────────────────────────────────
            # CHAT MODE: Direct LLM conversation
            # ─────────────────────────────────────────────────────────
            
            chat_response = await ai_service.generate_response(
                prompt=request.message,
                model_name=model_name,
                system_prompt=api_key.get_system_prompt(),
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            response_data["message"] = chat_response.get("response", api_key.get_error_message())
            response_data["confidence"] = 1.0  # Direct LLM response
        
        # ─────────────────────────────────────────────────────────────
        # 4. FINALIZE RESPONSE
        # ─────────────────────────────────────────────────────────────
        
        processing_time = time.time() - start_time
        response_data["processing_time"] = round(processing_time, 3)
        
        # Update API key stats
        api_key.update_last_used()
        db.commit()
        
        logger.info(f"External chat completed: {processing_time:.3f}s | Mode: {mode} | Chunks: {response_data['chunks_retrieved']}")
        
        return ExternalChatResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"External chat error: {e}", exc_info=True)
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "error_code": "INTERNAL_ERROR",
                "message": api_key.get_error_message() if api_key else "Teknik bir sorun oluştu."
            }
        )

# ═══════════════════════════════════════════════════════════════════════════════
# STREAMING ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@external_router.post("/chat/stream")
async def external_chat_stream(
    request: ExternalChatRequest,
    auth_data: tuple[APIKey, User] = Depends(require_chat_read()),
    db: Session = Depends(get_db)
):
    """
    Streaming chat endpoint for real-time responses
    
    **Response Format:** Server-Sent Events (SSE)
    
    **Event Types:**
    - `start`: Stream started, includes metadata
    - `chunk`: Response text chunk
    - `sources`: Source documents (RAG mode)
    - `end`: Stream completed
    - `error`: Error occurred
    """
    api_key, user = auth_data
    
    async def generate_stream():
        try:
            # Start event
            yield f"data: {json.dumps({'type': 'start', 'mode': api_key.allowed_mode})}\n\n"
            
            # Get model
            model_config = db.query(LLMModel).filter(LLMModel.is_active == True).first()
            if not model_config:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No model available'})}\n\n"
                return
            
            # Process based on mode
            if api_key.allowed_mode in ["rag", "hybrid"]:
                async for chunk in enhanced_rag_service.process_query_stream(
                    query=request.message,
                    model_name=model_config.model_name,
                    language=request.language or api_key.default_language,
                    user_departments=api_key.department_ids,
                    system_prompt=api_key.get_system_prompt(),
                    max_tokens=api_key.max_tokens,
                    temperature=api_key.temperature,
                    db=db
                ):
                    yield f"data: {json.dumps(chunk)}\n\n"
            else:
                # Chat mode streaming
                async for chunk in ai_service.generate_response_stream(
                    prompt=request.message,
                    model_name=model_config.model_name,
                    system_prompt=api_key.get_system_prompt(),
                    max_tokens=api_key.max_tokens,
                    temperature=api_key.temperature
                ):
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            
            # End event
            yield f"data: {json.dumps({'type': 'end'})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': api_key.get_error_message()})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# ═══════════════════════════════════════════════════════════════════════════════
# INFO ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@external_router.get("/info")
async def external_api_info(
    auth_data: tuple[APIKey, User] = Depends(require_chat_read()),
    db: Session = Depends(get_db)
):
    """
    Get API key configuration and capabilities
    
    Returns information about what this API key can do.
    """
    api_key, user = auth_data
    
    return {
        "api_key": {
            "name": api_key.name,
            "description": api_key.description,
            "mode": api_key.allowed_mode,
            "departments": api_key.department_ids,
            "languages": api_key.allowed_languages,
            "default_language": api_key.default_language
        },
        "settings": {
            "max_tokens": api_key.max_tokens,
            "temperature": api_key.temperature,
            "top_k": api_key.top_k,
            "include_sources": api_key.include_sources,
            "include_images": api_key.include_images
        },
        "rate_limits": {
            "per_minute": api_key.rate_limit_per_minute,
            "per_day": api_key.rate_limit_per_day
        },
        "stats": {
            "total_requests": api_key.total_requests or 0,
            "last_used": api_key.last_used_at.isoformat() if api_key.last_used_at else None
        }
    }

@external_router.get("/models")
async def external_get_models(
    auth_data: tuple[APIKey, User] = Depends(require_chat_read()),
    db: Session = Depends(get_db)
):
    """Get available AI models"""
    api_key, user = auth_data
    
    models = db.query(LLMModel).filter(LLMModel.is_active == True).all()
    
    # Get default model (either API key's model or system default)
    default_model_name = None
    if api_key.llm_model_id:
        default_model = db.query(LLMModel).filter(LLMModel.id == api_key.llm_model_id).first()
        if default_model:
            default_model_name = default_model.model_name
    
    if not default_model_name and models:
        # Use first active model as default
        default_model_name = models[0].model_name
    
    return {
        "models": [
            {
                "name": model.model_name,
                "provider": model.provider,
                "is_default": model.model_name == default_model_name
            }
            for model in models
        ],
        "default_model": default_model_name
    }

@external_router.get("/health")
async def external_health_check(
    auth_data: tuple[APIKey, User] = Depends(require_chat_read()),
    db: Session = Depends(get_db)
):
    """Health check endpoint"""
    api_key, user = auth_data
    
    try:
        db.execute("SELECT 1")
        active_models = db.query(LLMModel).filter(LLMModel.is_active == True).count()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "api_key_name": api_key.name,
            "mode": api_key.allowed_mode,
            "active_models": active_models
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail="Service unhealthy")