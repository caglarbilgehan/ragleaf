# backend/api/chat.py
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any, Optional
import json
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.services.ai_service import ai_service
from backend.services.vector_service import vector_service
from backend.services.enhanced_rag_service import enhanced_rag_service
from backend.auth.dependencies import get_current_active_user
from backend.database.models import User, ModelConfig, Document
from backend.database.connection import get_db
from backend.retrievers.enhanced_retriever import enhanced_retriever
from backend.utils.monitor import get_system_stats, get_ram_usage, get_ollama_ram_mb
from backend.utils.snapshots import save_json_snapshot
import logging

logger = logging.getLogger(__name__)

chat_router = APIRouter()

# Ragleaf Default System Prompt (fallback when no tenant-specific prompt is defined)
DEFAULT_SYSTEM_PROMPT = """Sen bir yapay zeka asistanısın.

Kurallar:
- Kullanıcının dilinde yanıt ver
- Emin olmadığın konularda bunu belirt
"""

class ChatRequest(BaseModel):
    model: str = Field(..., example="tinyllama:1.1b")  # model_name from database
    message: str = Field(..., example="Merhaba! Nasılsın?")
    mode: Optional[str] = Field("chat", example="chat")  # "chat" or "rag"
    document_filter: Optional[str] = Field(None, example="document_name")  # For RAG mode
    language: Optional[str] = Field("tr", example="tr")  # Language filter for RAG (ISO 639-1)
    provider: Optional[str] = Field(None, example="ollama")
    max_tokens: Optional[int] = Field(1000, ge=1, le=4000)
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    stream: Optional[bool] = Field(False)
    top_k: Optional[int] = Field(5, ge=1, le=20)  # RAG-V01 style
    include_chunks: Optional[bool] = Field(False)  # RAG-V01 style
    save_snapshot: Optional[bool] = Field(True)  # Auto-save chat history

class ChatResponse(BaseModel):
    response: str
    model: str
    provider: str
    mode: str
    timestamp: str
    sources: Optional[List[str]] = None  # For RAG mode
    chunks: Optional[List[Dict[str, Any]]] = None  # RAG-V01 style chunk previews
    system_stats: Optional[Dict[str, Any]] = None  # RAG-V01 style monitoring
    processing_time_ms: Optional[float] = None
    
    # Enhanced Timing Metrics
    timing: Optional[Dict[str, Any]] = None  # Detailed timing breakdown
    # timing = {
    #   "total_ms": float,
    #   "embedding_ms": float (RAG only),
    #   "vector_search_ms": float (RAG only),
    #   "reranking_ms": float (RAG only),
    #   "context_build_ms": float (RAG only),
    #   "llm_generation_ms": float,
    #   "time_to_first_token_ms": float (if available)
    # }
    
    # Token Usage Metrics
    token_usage: Optional[Dict[str, Any]] = None
    # token_usage = {
    #   "input_tokens": int,
    #   "output_tokens": int,
    #   "total_tokens": int,
    #   "tokens_per_second": float
    # }
    
    # Model Parameters Used
    model_params: Optional[Dict[str, Any]] = None
    # model_params = {
    #   "temperature": float,
    #   "max_tokens": int,
    #   "top_p": float,
    #   "top_k": int,
    #   "repeat_penalty": float,
    #   "num_ctx": int
    # }
    
    # RAG-specific Retrieval Metrics
    retrieval_stats: Optional[Dict[str, Any]] = None
    # retrieval_stats = {
    #   "documents_searched": int,
    #   "chunks_evaluated": int,
    #   "candidates_returned": int,
    #   "avg_similarity_score": float,
    #   "search_method": str,
    #   "query_analysis": dict
    # }

@chat_router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Main chat endpoint - supports both chat and RAG modes"""
    start_time = time.time()
    timing_breakdown = {}
    retrieval_stats = None
    rag_results = None
    all_results = []
    
    try:
        # Get model configuration from database
        model_config = db.query(ModelConfig).filter(
            ModelConfig.model_name == request.model,
            ModelConfig.is_active == True
        ).first()
        
        if not model_config:
            model_config = db.query(ModelConfig).filter(
                ModelConfig.name == request.model,
                ModelConfig.is_active == True
            ).first()
        
        if not model_config:
            model_config = db.query(ModelConfig).filter(
                ModelConfig.is_default == True,
                ModelConfig.is_active == True
            ).first()
            
            if not model_config:
                raise HTTPException(
                    status_code=404,
                    detail=f"Model '{request.model}' not found and no default model configured"
                )
        
        # Use parameters from database
        max_tokens = model_config.num_predict or request.max_tokens or 512
        temperature = model_config.temperature or request.temperature or 0.7
        provider = request.provider or model_config.provider
        
        # Build model params dict for response
        model_params = {
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": model_config.top_p,
            "top_k": model_config.top_k,
            "repeat_penalty": model_config.repeat_penalty,
            "num_ctx": model_config.num_ctx
        }
        
        # Get the appropriate service
        if provider not in ai_service.providers:
            raise HTTPException(
                status_code=400,
                detail=f"Provider '{provider}' not supported"
            )
        
        service = ai_service.providers[provider]
        
        # Prepare context based on mode
        context = None
        sources = None
        
        if request.mode == "rag":
            # RAG Mode: Use Enhanced RAG Service with timing
            try:
                logger.info(f"Starting enhanced RAG search for query: {request.message}")
                rag_start = time.time()
                
                # Use enhanced RAG service
                rag_results = await enhanced_rag_service.search_documents_enhanced(
                    query=request.message,
                    db=db,
                    max_chunks=model_config.rag_top_k or 5,
                    enable_query_expansion=True,
                    enable_reranking=True,
                    language=request.language  # Language filter for RAG
                )
                
                rag_end = time.time()
                timing_breakdown["rag_search_ms"] = round((rag_end - rag_start) * 1000, 2)
                
                # Extract timing from rag_results if available
                if rag_results.get('timing'):
                    timing_breakdown["embedding_ms"] = rag_results['timing'].get('embedding_ms', 0)
                    timing_breakdown["vector_search_ms"] = rag_results['timing'].get('vector_search_ms', 0)
                    timing_breakdown["reranking_ms"] = rag_results['timing'].get('reranking_ms', 0)
                
                logger.info(f"Enhanced RAG results: {len(rag_results.get('chunks', []))} chunks found")
                
                # Build retrieval stats
                chunks_list = rag_results.get('chunks', [])
                if chunks_list:
                    avg_score = sum(c.get('similarity_score', 0) for c in chunks_list) / len(chunks_list)
                else:
                    avg_score = 0
                    
                retrieval_stats = {
                    "documents_searched": rag_results.get('documents_searched', 0),
                    "chunks_evaluated": rag_results.get('chunks_evaluated', 0),
                    "candidates_returned": len(chunks_list),
                    "avg_similarity_score": round(avg_score, 4),
                    "search_method": rag_results.get('search_method', 'enhanced_hybrid'),
                    "query_analysis": rag_results.get('query_analysis', {})
                }
                
                if rag_results.get('chunks'):
                    # Build context from enhanced search results
                    context_start = time.time()
                    context_parts = []
                    sources = []
                    
                    for i, chunk in enumerate(rag_results['chunks'], 1):
                        context_parts.append(f"[Kaynak {i} - {chunk['document_name']}]\n{chunk['content']}")
                        sources.append(f"{chunk['document_name']} (Score: {chunk['similarity_score']:.3f})")
                        
                        # Add to all_results for chunk previews
                        all_results.append({
                            "text": chunk['content'],
                            "score": chunk['similarity_score'],
                            "document_name": chunk['document_name'],
                            "rank": i,
                            "search_method": chunk.get('search_method', 'enhanced')
                        })
                    
                    context = "\n\n".join(context_parts)
                    
                    # Limit context size
                    max_context_chars = model_config.max_context_chars or 1500
                    if len(context) > max_context_chars:
                        context = context[:max_context_chars] + "..."
                    
                    system_prompt = DEFAULT_SYSTEM_PROMPT + f"\n\nAşağıdaki döküman içeriklerini kullanarak kullanıcının sorusunu yanıtla:\n\n{context}"
                    
                    context_end = time.time()
                    timing_breakdown["context_build_ms"] = round((context_end - context_start) * 1000, 2)
                    
                    logger.info(f"RAG context built successfully. Query analysis: {rag_results.get('query_analysis', {})}")
                    
                else:
                    # No results found
                    query_analysis = rag_results.get('query_analysis', {})
                    if query_analysis.get('confidence', 0) < 0.3:
                        system_prompt = DEFAULT_SYSTEM_PROMPT + f"\n\nNot: Sorgunuz çok belirsiz (güven: {query_analysis.get('confidence', 0):.2f}). Lütfen daha spesifik bir soru sorun veya genel bilgilerimle yanıt vereyim."
                    else:
                        system_prompt = DEFAULT_SYSTEM_PROMPT + "\n\nNot: Sorunuzla ilgili döküman bulunamadı. Genel bilgilerimle yanıt veriyorum."
            
            except Exception as e:
                logger.error(f"Enhanced RAG search error: {e}")
                system_prompt = DEFAULT_SYSTEM_PROMPT + f"\n\nNot: Döküman aramasında hata oluştu ({str(e)}). Genel bilgilerimle yanıt veriyorum."
        else:
            # Chat Mode: No document context
            system_prompt = DEFAULT_SYSTEM_PROMPT
        
        # Generate response with database parameters
        logger.info(f"Generating response with model: {model_config.model_name}, provider: {provider}")
        logger.info(f"Request message: {request.message}")
        
        llm_start = time.time()
        result = await service.generate_response(
            model=model_config.model_name,
            prompt=request.message,
            system_prompt=system_prompt,
            context=context,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=model_config.top_p,
            top_k=model_config.top_k,
            repeat_penalty=model_config.repeat_penalty,
            num_ctx=model_config.num_ctx
        )
        llm_end = time.time()
        timing_breakdown["llm_generation_ms"] = round((llm_end - llm_start) * 1000, 2)
        
        logger.info(f"AI Service result: {result}")
        
        # Extract response text from result
        response_text = result.get("response", "") if isinstance(result, dict) else str(result)
        logger.info(f"Extracted response text: '{response_text}'")
        
        # Calculate processing time
        end_time = time.time()
        processing_time_ms = (end_time - start_time) * 1000
        timing_breakdown["total_ms"] = round(processing_time_ms, 2)
        
        # Extract token usage if available from result
        token_usage = None
        if isinstance(result, dict):
            input_tokens = result.get("prompt_eval_count", result.get("input_tokens", 0))
            output_tokens = result.get("eval_count", result.get("output_tokens", 0))
            
            if input_tokens or output_tokens:
                total_tokens = input_tokens + output_tokens
                llm_time_seconds = timing_breakdown.get("llm_generation_ms", 1) / 1000
                tokens_per_second = output_tokens / llm_time_seconds if llm_time_seconds > 0 else 0
                
                token_usage = {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "tokens_per_second": round(tokens_per_second, 2)
                }
        
        # Get system stats (RAG-V01 style)
        system_stats = get_system_stats()
        
        # Prepare chunk previews for RAG mode
        chunks = None
        if request.mode == "rag" and request.include_chunks and all_results:
            chunks = []
            for res in all_results[:5]:  # Top 5 chunks
                chunks.append({
                    "rank": res.get("rank", 0),
                    "score": res.get("score", 0),
                    "document": res.get("document_name", "unknown"),
                    "preview": res.get("text", "")[:200] + "..." if len(res.get("text", "")) > 200 else res.get("text", "")
                })
        
        # Create response object with all enhanced metrics
        response_obj = ChatResponse(
            response=response_text,
            model=model_config.model_name,
            provider=provider,
            mode=request.mode or "chat",
            timestamp=datetime.now(timezone.utc).isoformat(),
            sources=sources if request.mode == "rag" else None,
            chunks=chunks,
            system_stats=system_stats,
            processing_time_ms=round(processing_time_ms, 2),
            timing=timing_breakdown,
            token_usage=token_usage,
            model_params=model_params,
            retrieval_stats=retrieval_stats if request.mode == "rag" else None
        )
        
        # Save snapshot (RAG-V01 style) - disabled for now due to missing current_user
        # if request.save_snapshot:
        #     try:
        #         snapshot_data = {
        #             "user_id": current_user.id,
        #             "username": current_user.username,
        #             "request": request.dict(),
        #             "response": response_obj.dict(),
        #             "processing_time_ms": processing_time_ms,
        #             "system_stats": system_stats
        #         }
        #         save_json_snapshot(snapshot_data, "chat")
        #     except Exception as e:
        #         print(f"Snapshot save error: {e}")
        
        return response_obj
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat error: {str(e)}"
        )

@chat_router.post("/simple", response_model=ChatResponse)
async def simple_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Simple chat endpoint without RAG - uses model parameters from database"""
    try:
        # Get model configuration from database
        model_config = db.query(ModelConfig).filter(
            ModelConfig.model_name == request.model,
            ModelConfig.is_active == True
        ).first()
        
        if not model_config:
            # Try to find by name
            model_config = db.query(ModelConfig).filter(
                ModelConfig.name == request.model,
                ModelConfig.is_active == True
            ).first()
        
        if not model_config:
            # Fallback to default model
            model_config = db.query(ModelConfig).filter(
                ModelConfig.is_default == True,
                ModelConfig.is_active == True
            ).first()
            
            if not model_config:
                raise HTTPException(
                    status_code=404,
                    detail=f"Model '{request.model}' not found and no default model configured"
                )
        
        # Use parameters from database (override request parameters)
        max_tokens = model_config.num_predict or request.max_tokens or 512
        temperature = model_config.temperature or request.temperature or 0.7
        
        # Determine provider
        provider = request.provider or model_config.provider
        
        # Get the appropriate service
        if provider not in ai_service.providers:
            raise HTTPException(
                status_code=400,
                detail=f"Provider '{provider}' not supported"
            )
        
        service = ai_service.providers[provider]
        
        # Generate response with database parameters
        result = await service.generate_response(
            model=model_config.model_name,
            prompt=request.message,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=model_config.top_p,
            top_k=model_config.top_k,
            repeat_penalty=model_config.repeat_penalty,
            num_ctx=model_config.num_ctx
        )
        
        # Extract response text from result
        response_text = result.get("response", "") if isinstance(result, dict) else str(result)
        
        return ChatResponse(
            response=response_text,
            model=model_config.model_name,
            provider=provider,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Simple chat error: {str(e)}"
        )

@chat_router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Streaming chat endpoint - RAG-V01 style"""
    
    async def generate_stream():
        start_time = time.time()
        
        try:
            # Get model configuration
            model_config = db.query(ModelConfig).filter(
                ModelConfig.model_name == request.model,
                ModelConfig.is_active == True
            ).first()
            
            if not model_config:
                model_config = db.query(ModelConfig).filter(
                    ModelConfig.is_default == True,
                    ModelConfig.is_active == True
                ).first()
            
            if not model_config:
                yield f"data: {json.dumps({'error': 'Model not found'})}\n\n"
                return
            
            # Send initial system stats
            system_stats = get_system_stats()
            yield f"data: {json.dumps({'type': 'system_stats', 'data': system_stats})}\n\n"
            
            # Handle RAG mode
            context = None
            sources = None
            
            if request.mode == "rag":
                yield f"data: {json.dumps({'type': 'status', 'message': 'Dökümanlar aranıyor...'})}\n\n"
                
                # Use enhanced retriever
                available_docs = enhanced_retriever.get_available_documents()
                
                if available_docs:
                    if request.document_filter:
                        if request.document_filter in available_docs:
                            search_results = enhanced_retriever.query_documents(
                                query=request.message,
                                doc_name=request.document_filter,
                                top_k=request.top_k or 5,
                                as_documents=False
                            )
                        else:
                            search_results = []
                    else:
                        search_results = enhanced_retriever.search_multiple_documents(
                            query=request.message,
                            doc_names=available_docs,
                            top_k=request.top_k or 5,
                            as_documents=False
                        )
                    
                    if search_results:
                        yield f"data: {json.dumps({'type': 'status', 'message': f'{len(search_results)} ilgili döküman parçası bulundu'})}\n\n"
                        
                        # Build context
                        context_parts = []
                        sources = []
                        
                        for i, result in enumerate(search_results[:3], 1):
                            context_parts.append(f"[Kaynak {i}]\n{result['text']}")
                            sources.append({
                                "document": result["metadata"].get("doc_name", "unknown"),
                                "score": 1.0 - result["distance"],
                                "text_preview": result["text"][:100] + "..."
                            })
                        
                        context = "\n\n".join(context_parts)
                        
                        # Send sources info
                        yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"
            
            # Prepare system prompt
            if request.mode == "rag" and context:
                system_prompt = DEFAULT_SYSTEM_PROMPT + f"\n\nAşağıdaki döküman içeriklerini kullanarak kullanıcının sorusunu yanıtla:\n\n{context}"
            else:
                system_prompt = DEFAULT_SYSTEM_PROMPT
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'AI yanıtı oluşturuluyor...'})}\n\n"
            
            # Get AI service
            provider = request.provider or model_config.provider
            service = ai_service.providers.get(provider)
            
            if not service:
                yield f"data: {json.dumps({'error': f'Provider {provider} not supported'})}\n\n"
                return
            
            # Generate streaming response
            async for chunk in service.generate_response_stream(
                model=model_config.model_name,
                prompt=request.message,
                system_prompt=system_prompt,
                context=context,
                max_tokens=model_config.num_predict or 512,
                temperature=model_config.temperature or 0.7,
                top_p=model_config.top_p,
                top_k=model_config.top_k,
                repeat_penalty=model_config.repeat_penalty,
                num_ctx=model_config.num_ctx
            ):
                yield f"data: {json.dumps({'type': 'content', 'data': chunk})}\n\n"
            
            # Send final stats
            processing_time_ms = (time.time() - start_time) * 1000
            final_stats = get_system_stats()
            
            yield f"data: {json.dumps({'type': 'final_stats', 'data': {'processing_time_ms': processing_time_ms, 'system_stats': final_stats}})}\n\n"
            yield f"data: [DONE]\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@chat_router.get("/models")
async def list_available_models(
    current_user: User = Depends(get_current_active_user)
):
    """List all available models from all providers"""
    try:
        models_data = await ai_service.list_all_models()
        return models_data
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing models: {str(e)}"
        )
