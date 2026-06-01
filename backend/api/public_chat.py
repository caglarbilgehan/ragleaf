# backend/api/public_chat.py
"""
Public Chat API for Ragleaf platform.
OpenAI-compatible chat endpoint for widget and external integrations.

This is the endpoint that the embeddable widget and REST API clients call.
Authentication is via Agent API key (not user JWT).
"""

import uuid
import time
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import (
    Agent, AgentKnowledgeBase, PublicConversation, PublicMessage, UsageLog
)
from backend.database.models_v2 import Document, DocumentChunk
from backend.auth.org_dependencies import get_agent_from_api_key, AgentAuth

import json

logger = logging.getLogger(__name__)

public_chat_router = APIRouter()


# ============================================================================
# Schemas (OpenAI-compatible where possible)
# ============================================================================

class ChatCompletionMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatCompletionRequest(BaseModel):
    messages: List[ChatCompletionMessage] = Field(
        ..., min_length=1, 
        description="Conversation messages"
    )
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")
    visitor_id: Optional[str] = Field(None, description="Persistent visitor ID")
    stream: bool = Field(default=False, description="Enable streaming")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Visitor metadata (page_url, etc.)")


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatCompletionMessage
    finish_reason: str = "stop"


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: ChatCompletionUsage
    # Ragleaf-specific extensions
    sources: Optional[List[Dict[str, Any]]] = None
    agent_name: Optional[str] = None
    response_time_ms: Optional[int] = None


class AgentInfoResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    welcome_message: Optional[str] = None
    appearance: Optional[Dict[str, Any]] = None
    personality: Optional[Dict[str, Any]] = None


# ============================================================================
# Public Endpoints
# ============================================================================

@public_chat_router.get("/agents/{agent_public_id}/info", response_model=AgentInfoResponse)
async def get_agent_public_info(
    agent_public_id: str,
    auth: AgentAuth = Depends(get_agent_from_api_key),
    db: Session = Depends(get_db)
):
    """
    Get public info about an agent (for widget initialization).
    Returns name, welcome message, and appearance settings.
    """
    agent = auth.agent
    
    # Verify the requested agent matches the API key's agent
    if agent.public_id != agent_public_id:
        raise HTTPException(status_code=403, detail="API key bu agent için geçerli değil")
    
    return AgentInfoResponse(
        id=agent.public_id,
        name=agent.name,
        description=agent.description,
        welcome_message=agent.welcome_message,
        appearance=agent.appearance,
        personality={
            "tone": (agent.personality or {}).get("tone", "professional"),
            "language": (agent.personality or {}).get("language", "tr")
        }
    )


@public_chat_router.post("/chat/completions", response_model=ChatCompletionResponse)
async def chat_completion(
    request: ChatCompletionRequest,
    req: Request,
    auth: AgentAuth = Depends(get_agent_from_api_key),
    db: Session = Depends(get_db)
):
    """
    OpenAI-compatible chat completion endpoint.
    Authenticates via Agent API key and uses the agent's knowledge base for RAG.
    """
    start_time = time.time()
    agent = auth.agent
    org = auth.organization
    
    # --- Rate Limiting ---
    from backend.middleware.rate_limiter import check_rate_limit
    await check_rate_limit(
        agent_id=agent.id,
        limit_per_minute=agent.rate_limit_per_minute or 20,
        limit_per_day=agent.rate_limit_per_day or 500,
        identifier=req.client.host if req.client else None
    )
    
    # --- Get or Create Conversation ---
    session_id = request.session_id or str(uuid.uuid4())
    
    conversation = None
    if request.session_id:
        conversation = db.query(PublicConversation).filter(
            PublicConversation.agent_id == agent.id,
            PublicConversation.session_id == session_id,
            PublicConversation.status == "active"
        ).first()
    
    if not conversation:
        conversation = PublicConversation(
            agent_id=agent.id,
            session_id=session_id,
            visitor_id=request.visitor_id,
            visitor_metadata=request.metadata or {
                "user_agent": req.headers.get("user-agent", ""),
                "origin": req.headers.get("origin", ""),
                "referer": req.headers.get("referer", "")
            }
        )
        db.add(conversation)
        db.flush()
    
    # --- Save User Message ---
    user_message = request.messages[-1]
    if user_message.role != "user":
        raise HTTPException(status_code=400, detail="Son mesaj 'user' rolünde olmalı")
    
    user_msg = PublicMessage(
        conversation_id=conversation.id,
        role="user",
        content=user_message.content
    )
    db.add(user_msg)
    
    # --- Build RAG Context ---
    context = ""
    sources = []
    
    try:
        context, sources = await _build_rag_context(agent, user_message.content, db)
    except Exception as e:
        logger.error(f"RAG context error for agent {agent.id}: {e}")
    
    # --- Build System Prompt ---
    system_prompt = _build_system_prompt(agent, context)
    
    # --- Build Messages for LLM ---
    llm_messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history (last N messages from request)
    for msg in request.messages[:-1]:
        llm_messages.append({"role": msg.role, "content": msg.content})
    
    # Add current message
    llm_messages.append({"role": "user", "content": user_message.content})
    
    # --- Call LLM ---
    response_text = ""
    model_used = ""
    tokens_used = 0
    
    try:
        response_text, model_used, tokens_used = await _call_llm(
            agent, llm_messages, db
        )
    except Exception as e:
        logger.error(f"LLM call error for agent {agent.id}: {e}")
        # Use fallback message
        fallback = (agent.personality or {}).get(
            "fallback_message",
            "Şu anda yanıt veremiyorum. Lütfen daha sonra tekrar deneyin."
        )
        response_text = fallback
        model_used = "fallback"
    
    # --- Save Assistant Message ---
    response_time_ms = int((time.time() - start_time) * 1000)
    
    assistant_msg = PublicMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
        rag_sources=sources if sources else None,
        tokens_used=tokens_used,
        model_used=model_used,
        response_time_ms=response_time_ms
    )
    db.add(assistant_msg)
    
    # --- Update Conversation Stats ---
    conversation.message_count = (conversation.message_count or 0) + 2
    conversation.last_message_at = datetime.now(timezone.utc)
    
    # --- Update Agent Stats ---
    if conversation.message_count == 2:  # New conversation
        agent.total_conversations = (agent.total_conversations or 0) + 1
    agent.total_messages = (agent.total_messages or 0) + 2
    
    # --- Log Usage ---
    usage_log = UsageLog(
        organization_id=org.id,
        agent_id=agent.id,
        event_type="chat_query",
        tokens_used=tokens_used,
        details={
            "model": model_used,
            "response_time_ms": response_time_ms,
            "rag_sources_count": len(sources),
            "session_id": session_id
        }
    )
    db.add(usage_log)
    
    db.commit()
    
    # --- Build Response ---
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    
    return ChatCompletionResponse(
        id=completion_id,
        created=int(time.time()),
        model=model_used,
        choices=[ChatCompletionChoice(
            message=ChatCompletionMessage(role="assistant", content=response_text),
            finish_reason="stop"
        )],
        usage=ChatCompletionUsage(
            prompt_tokens=0,  # Will be filled by LLM response
            completion_tokens=0,
            total_tokens=tokens_used
        ),
        sources=sources if sources else None,
        agent_name=agent.name,
        response_time_ms=response_time_ms
    )


@public_chat_router.get("/conversations/{session_id}/history")
async def get_conversation_history(
    session_id: str,
    auth: AgentAuth = Depends(get_agent_from_api_key),
    db: Session = Depends(get_db)
):
    """Get conversation history for a session."""
    conversation = db.query(PublicConversation).filter(
        PublicConversation.agent_id == auth.agent.id,
        PublicConversation.session_id == session_id
    ).first()
    
    if not conversation:
        return {"messages": [], "session_id": session_id}
    
    messages = db.query(PublicMessage).filter(
        PublicMessage.conversation_id == conversation.id
    ).order_by(PublicMessage.created_at).all()
    
    return {
        "session_id": session_id,
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                "sources": msg.rag_sources
            }
            for msg in messages
        ],
        "total": len(messages)
    }


# ============================================================================
# Internal Helpers
# ============================================================================

async def _build_rag_context(
    agent: Agent, 
    query: str, 
    db: Session
) -> tuple:
    """
    Build RAG context from the agent's knowledge base documents.
    Returns (context_string, sources_list).
    """
    rag_config = agent.rag_config or {}
    top_k = rag_config.get("top_k", 5)
    max_context_chars = rag_config.get("max_context_chars", 4000)
    similarity_threshold = rag_config.get("similarity_threshold", 0.3)
    
    # Get agent's document IDs
    kb_links = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.agent_id == agent.id
    ).all()
    
    if not kb_links:
        return "", []
    
    doc_ids = [link.document_id for link in kb_links]
    
    # Use the existing RAG service for vector search
    try:
        from backend.services.enhanced_rag_service import enhanced_rag_service
        
        rag_results = await enhanced_rag_service.search_documents_enhanced(
            query=query,
            db=db,
            max_chunks=top_k,
            document_ids=doc_ids,  # Filter by agent's documents
            enable_query_expansion=True,
            enable_reranking=True
        )
        
        chunks = rag_results.get("chunks", [])
        
        if not chunks:
            return "", []
        
        # Build context and sources
        context_parts = []
        sources = []
        total_chars = 0
        
        for i, chunk in enumerate(chunks, 1):
            score = chunk.get("similarity_score", 0)
            if score < similarity_threshold:
                continue
            
            text = chunk.get("content", "")
            
            if total_chars + len(text) > max_context_chars:
                break
            
            context_parts.append(f"[Kaynak {i} - {chunk.get('document_name', 'Bilinmeyen')}]\n{text}")
            sources.append({
                "document_name": chunk.get("document_name", ""),
                "chunk_id": chunk.get("chunk_id"),
                "score": round(score, 3),
                "preview": text[:150] + "..." if len(text) > 150 else text
            })
            total_chars += len(text)
        
        context = "\n\n".join(context_parts)
        return context, sources
        
    except Exception as e:
        logger.warning(f"Enhanced RAG failed, falling back to basic search: {e}")
        
        # Fallback: basic pgvector search
        try:
            from backend.services.pgvector_service import pgvector_service
            
            chunks = await pgvector_service.search_similar(
                query=query,
                db=db,
                limit=top_k,
                document_ids=doc_ids
            )
            
            context_parts = []
            sources = []
            
            for i, chunk in enumerate(chunks, 1):
                context_parts.append(f"[Kaynak {i}]\n{chunk.get('content', '')}")
                sources.append({
                    "document_name": chunk.get("document_name", ""),
                    "score": round(chunk.get("score", 0), 3),
                    "preview": chunk.get("content", "")[:150]
                })
            
            return "\n\n".join(context_parts), sources
            
        except Exception as e2:
            logger.error(f"Fallback search also failed: {e2}")
            return "", []


def _build_system_prompt(agent: Agent, context: str) -> str:
    """Build the full system prompt for the agent with RAG context."""
    personality = agent.personality or {}
    tone = personality.get("tone", "professional")
    language = personality.get("language", "tr")
    response_style = personality.get("response_style", "balanced")
    
    # Base system prompt
    base_prompt = agent.system_prompt or f"Sen {agent.name} adlı bir AI asistansın."
    
    # Add tone instructions
    tone_instructions = {
        "professional": "Profesyonel ve resmi bir dil kullan.",
        "friendly": "Samimi ve sıcak bir dil kullan, ama bilgilendirici ol.",
        "casual": "Rahat ve günlük bir dil kullan."
    }
    
    style_instructions = {
        "concise": "Yanıtlarını kısa ve öz tut.",
        "detailed": "Detaylı ve kapsamlı yanıtlar ver.",
        "balanced": "Yanıtlarını dengeli tut — gerektiğinde detay ver, gerektiğinde özet."
    }
    
    language_instructions = {
        "tr": "Her zaman Türkçe yanıt ver.",
        "en": "Always respond in English.",
        "auto": "Kullanıcının dilinde yanıt ver."
    }
    
    system = f"""{base_prompt}

{tone_instructions.get(tone, "")}
{style_instructions.get(response_style, "")}
{language_instructions.get(language, language_instructions["tr"])}
"""
    
    # Add RAG context
    if context:
        system += f"""
Aşağıdaki bilgi tabanı içeriklerini kullanarak kullanıcının sorusunu yanıtla.
Bilgi tabanında bulunmayan konularda bunu belirt.

--- BİLGİ TABANI ---
{context}
--- BİLGİ TABANI SONU ---
"""
    else:
        fallback = (agent.personality or {}).get(
            "fallback_message",
            "Bu konuda bilgi tabanımda yeterli bilgi bulunamadı."
        )
        system += f"\nBilgi tabanında ilgili içerik bulunamazsa şu mesajı ver: '{fallback}'"
    
    return system


async def _call_llm(
    agent: Agent,
    messages: List[Dict[str, str]],
    db: Session
) -> tuple:
    """
    Call the LLM using the agent's model configuration.
    Returns (response_text, model_name, tokens_used).
    """
    model_config = agent.model_config_data or {}
    temperature = model_config.get("temperature", 0.3)
    max_tokens = model_config.get("max_tokens", 1024)
    
    # Use the existing LLM Router for failover support
    try:
        from backend.services.llm_router import LLMRouter
        from backend.database.models import ModelConfig
        
        llm_router = LLMRouter()
        
        # Get model config from database
        model_name = model_config.get("model", "")
        model = db.query(ModelConfig).filter(
            ModelConfig.model_name == model_name,
            ModelConfig.is_active == True
        ).first()
        
        if not model:
            # Get default model
            model = llm_router.get_default_model(db)
        
        if not model:
            raise Exception("Aktif model bulunamadı")
        
        response, metadata = await llm_router.make_request_with_failover(
            db=db,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        if response and metadata.get("success"):
            # Extract response text
            choices = response.get("choices", [])
            if choices:
                response_text = choices[0].get("message", {}).get("content", "")
            else:
                response_text = ""
            
            # Extract token usage
            usage = response.get("usage", {})
            tokens = usage.get("total_tokens", 0)
            
            return response_text, model.model_name, tokens
        else:
            raise Exception(metadata.get("error", "LLM request failed"))
            
    except ImportError:
        logger.warning("LLM Router not available, using fallback")
        raise
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise
