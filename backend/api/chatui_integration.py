from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, AsyncGenerator
import json
import asyncio
import logging
from datetime import datetime

from ..database.connection import get_db
from ..database.models import ModelConfig, User, Settings
from ..auth.dependencies import get_current_user_optional, get_current_user
from ..auth.security import create_access_token, verify_token, verify_password
from ..services.ai_service import ai_service
from ..services.query_processor import query_processor, ConfidenceLevel, RelevanceScore

logger = logging.getLogger(__name__)

chatui_router = APIRouter()

# ==================== AUTH ENDPOINTS ====================

class ChatUILoginRequest(BaseModel):
    username: str
    password: str

class ChatUILoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

@chatui_router.post("/auth/login")
async def chatui_login(
    request: ChatUILoginRequest,
    db: Session = Depends(get_db)
):
    """ChatUI login endpoint - returns JWT token and user info"""
    # Find user by email (username field in request can be email)
    user = db.query(User).filter(User.email == request.username).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Hesabınız devre dışı bırakılmış")
    
    # Verify password (field is password_hash in User model)
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")
    
    # Create JWT token
    token = create_access_token(data={"sub": user.email, "user_id": user.id})
    
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.email.split("@")[0] if user.email else user.name,  # Use email prefix as username
            "full_name": user.full_name or f"{user.name or ''} {user.surname or ''}".strip(),
            "is_admin": user.is_admin,
            "is_active": user.is_active
        }
    }

@chatui_router.get("/auth/me")
async def chatui_get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get current user info from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token gerekli")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Geçersiz token")
        
        user_email = payload.get("sub")
        user = db.query(User).filter(User.email == user_email).first()
        
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        
        return {
            "id": user.id,
            "email": user.email,
            "username": user.email.split("@")[0] if user.email else user.name,
            "full_name": user.full_name or f"{user.name or ''} {user.surname or ''}".strip(),
            "is_admin": user.is_admin,
            "is_active": user.is_active
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Geçersiz token")

@chatui_router.get("/settings/languages")
async def chatui_get_languages(
    db: Session = Depends(get_db)
    # Auth is optional for this endpoint to allow fetching before login if needed, 
    # but practically user is logged in. Let's make it public for simplicity unless restricted.
):
    """Get active languages for Chat UI"""
    try:
        # Get multilingual settings
        setting = db.query(Settings).filter(Settings.key == "multilingual_settings").first()
        active_codes = ["tr"] # Default
        
        if setting and setting.value:
            active_codes = setting.value.get("active_languages", ["tr"])
        
        # Prepare response list with names and flags
        # Define all supported languages map
        ALL_LANGUAGES = {
            "tr": {"code": "tr", "name": "Türkçe", "flag": "🇹🇷"},
            "en": {"code": "en", "name": "English", "flag": "🇬🇧"},
            "de": {"code": "de", "name": "Deutsch", "flag": "🇩🇪"},
            "fr": {"code": "fr", "name": "Français", "flag": "🇫🇷"},
            "es": {"code": "es", "name": "Español", "flag": "🇪🇸"},
        }
        
        # Filter and maintain order
        response_languages = []
        for code in active_codes:
            if code in ALL_LANGUAGES:
                response_languages.append(ALL_LANGUAGES[code])
            else:
                # Fallback for unknown codes
                response_languages.append({"code": code, "name": code.upper(), "flag": "🌐"})
                
        return {"languages": response_languages}
            
    except Exception as e:
        logger.error(f"Error fetching languages: {e}")
        # Fallback to TR only on error
        return {"languages": [{"code": "tr", "name": "Türkçe", "flag": "🇹🇷"}]}


@chatui_router.post("/auth/logout")
async def chatui_logout():
    """ChatUI logout endpoint"""
    return {"success": True, "message": "Çıkış yapıldı"}


@chatui_router.get("/settings/metadata-options")
async def chatui_get_metadata_options(
    db: Session = Depends(get_db)
):
    """
    Get available metadata filter options for Chat UI.
    Returns unique departments, categories, and product codes from documents.
    """
    try:
        from sqlalchemy import distinct, func
        
        # Get unique departments
        departments = db.query(
            Document.doc_metadata["department"].astext
        ).filter(
            Document.doc_metadata["department"].astext.isnot(None),
            Document.doc_metadata["department"].astext != ""
        ).distinct().all()
        
        # Get unique categories
        categories = db.query(
            Document.doc_metadata["category"].astext
        ).filter(
            Document.doc_metadata["category"].astext.isnot(None),
            Document.doc_metadata["category"].astext != ""
        ).distinct().all()
        
        # Get unique product codes
        product_codes = db.query(
            Document.doc_metadata["product"]["code"].astext
        ).filter(
            Document.doc_metadata["product"]["code"].astext.isnot(None),
            Document.doc_metadata["product"]["code"].astext != ""
        ).distinct().all()
        
        return {
            "departments": [d[0] for d in departments if d[0]],
            "categories": [c[0] for c in categories if c[0]],
            "product_codes": [p[0] for p in product_codes if p[0]],
            "predefined_departments": [
                "Teknik Servis", "Satış", "Proje", "ArGe", "Muhasebe", "Üretim", "Kalite"
            ],
            "predefined_categories": [
                "Manual", "Datasheet", "Specification", "Guide", "Installation", "Maintenance"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error fetching metadata options: {e}")
        return {
            "departments": [],
            "categories": [],
            "product_codes": [],
            "predefined_departments": [
                "Teknik Servis", "Satış", "Proje", "ArGe", "Muhasebe"
            ],
            "predefined_categories": [
                "Manual", "Datasheet", "Specification", "Guide"
            ]
        }


# ==================== CONFIG ENDPOINT ====================

@chatui_router.get("/config")
async def get_chatui_config(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get ChatUI configuration based on user role"""
    from ..services.llm_router import llm_router
    from ..database.models import AIProvider, AIToken
    
    is_admin = False
    user_info = None
    
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        try:
            payload = verify_token(token)
            if payload:
                user_email = payload.get("sub")
                user = db.query(User).filter(User.email == user_email).first()
                if user:
                    is_admin = user.is_admin
                    user_info = {
                        "id": user.id,
                        "email": user.email,
                        "username": user.email.split("@")[0] if user.email else user.name,
                        "full_name": user.full_name or f"{user.name or ''} {user.surname or ''}".strip(),
                        "is_admin": user.is_admin
                    }
        except:
            pass
    
    # Get active model and provider info
    active_model_info = None
    active_provider_info = None
    
    try:
        default_model = llm_router.get_default_model(db)
        if default_model:
            active_model_info = {
                "id": default_model.id,
                "name": default_model.name,
                "model_name": default_model.model_name,
                "provider": default_model.provider
            }
            
            # Get provider info
            provider = db.query(AIProvider).filter(
                AIProvider.name == default_model.provider,
                AIProvider.is_enabled == True
            ).first()
            
            if provider:
                # Count active tokens
                active_token_count = db.query(AIToken).filter(
                    AIToken.provider_id == provider.id,
                    AIToken.is_active == True,
                    AIToken.is_available == True
                ).count()
                
                active_provider_info = {
                    "id": provider.id,
                    "name": provider.name,
                    "display_name": provider.display_name,
                    "priority": provider.priority,
                    "active_tokens": active_token_count
                }
    except Exception as e:
        logger.warning(f"Error getting model/provider info: {e}")
    
    return {
        "require_login": True,
        "allow_chat_mode": is_admin,  # Only admin can use chat mode
        "allow_rag_mode": True,  # Everyone can use RAG mode
        "show_model_selector": False,  # Model selection disabled
        "show_rag_debug": is_admin,  # Only admin can see RAG debug info
        "user": user_info,
        "active_model": active_model_info,
        "active_provider": active_provider_info
    }

class ChatUIMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatUIRequest(BaseModel):
    model: str
    messages: List[ChatUIMessage]
    stream: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class ChatUIModelResponse(BaseModel):
    id: str
    name: str
    displayName: str
    description: Optional[str] = None
    isDefault: bool = False

@chatui_router.get("/models")
async def get_chatui_models(
    db: Session = Depends(get_db)
):
    """Get models in ChatUI format - return default model with AI service validation"""
    from ..services.llm_router import llm_router
    
    try:
        # Get the default model using LLM Router
        default_model = llm_router.get_default_model(db)
        
        if not default_model:
            logger.warning("No active models found in database")
            return {"data": []}
        
        # Validate that we have tokens for this model's provider using new ai_tokens table
        tokens = llm_router.get_tokens_for_provider(db, default_model.provider)
        
        ai_service_available = len(tokens) > 0
        
        if ai_service_available:
            logger.info(f"Found {len(tokens)} active token(s) for provider: {default_model.provider}")
        else:
            logger.warning(f"No active tokens found for provider: {default_model.provider}")
            
            # Try to find any provider with tokens and a compatible model
            all_providers = llm_router.get_providers_with_tokens(db)
            
            for provider in all_providers:
                # Find a model for this provider
                compatible_model = db.query(ModelConfig).filter(
                    ModelConfig.is_active == True,
                    ModelConfig.provider == provider["name"]
                ).first()
                
                if compatible_model:
                    default_model = compatible_model
                    ai_service_available = True
                    logger.info(f"Switched to compatible model: {default_model.name} with provider: {provider['display_name']}")
                    break
        
        if not ai_service_available:
            logger.error("No active AI services found - ChatUI will not work properly")
            return {"data": []}
        
        logger.info(f"✅ Using model: {default_model.name} ({default_model.model_name})")
        logger.info(f"✅ AI service validation passed for provider: {default_model.provider}")
        
        chatui_models = []
        model = default_model
        
        # Get sub-provider info from JSON field
        sub_provider_name = "HuggingFace"  # Default
        if model.providers:
            try:
                providers_data = json.loads(model.providers)
                if providers_data and len(providers_data) > 0:
                    sub_provider_name = providers_data[0].get("display_name", "HuggingFace")
            except (json.JSONDecodeError, KeyError, IndexError):
                sub_provider_name = "HuggingFace"
        
        # Create ChatUI compatible model object (full format with endpoints)
        chatui_model = {
            "id": model.model_name,
            "name": model.name,
            "displayName": f"{model.name} ({sub_provider_name})",
            "description": f"{model.name} - {sub_provider_name} model",
            "parameters": {
                "temperature": model.temperature or 0.3,
                "max_new_tokens": model.num_predict or 4096,
                "top_p": model.top_p or 0.9,
            },
            "endpoints": [{
                "type": "openai",
                "baseURL": ""  # Empty = use OPENAI_BASE_URL env var which points to backend
            }]
        }
        chatui_models.append(chatui_model)
        
        logger.info(f"Returning {len(chatui_models)} models to ChatUI")
        return {"data": chatui_models}
        
    except Exception as e:
        logger.error(f"Error getting ChatUI models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting models: {str(e)}")

@chatui_router.get("/chatui-config")
async def get_chatui_config(db: Session = Depends(get_db)):
    """
    Get complete ChatUI configuration from admin panel settings.
    Returns: model, provider, sub-provider, and API token for ChatUI to use.
    """
    from ..services.llm_router import llm_router
    from ..database.models import AIProvider, AIToken
    
    try:
        # Get default model based on provider priority
        default_model = llm_router.get_default_model(db)
        
        if not default_model:
            return {"error": "No active models configured"}
        
        # Get provider info
        provider = db.query(AIProvider).filter(
            AIProvider.name == default_model.provider,
            AIProvider.is_active == True
        ).first()
        
        if not provider:
            return {"error": f"Provider {default_model.provider} not found or inactive"}
        
        # Get active token for this provider (priority-based)
        token = db.query(AIToken).filter(
            AIToken.provider_id == provider.id,
            AIToken.is_active == True
        ).order_by(AIToken.priority.asc()).first()
        
        if not token:
            return {"error": f"No active tokens for provider {provider.display_name}"}
        
        # Build response - Return empty baseURL so ChatUI uses OPENAI_BASE_URL env var
        # which should point to backend's /api/v2 endpoint
        # Backend will then use the token from database to call HuggingFace
        config = {
            "openai_base_url": "",  # Empty = use env var OPENAI_BASE_URL (backend)
            "openai_api_key": "backend-managed",  # ChatUI will use this but backend ignores it
            "model": {
                "id": default_model.model_name,
                "name": default_model.name,
                "display_name": default_model.name,
            },
            "provider": {
                "name": provider.name,
                "display_name": provider.display_name,
            },
            "token": {
                "display_name": token.display_name,
            }
        }
        
        logger.info(f"ChatUI config: model={default_model.model_name}, provider={provider.name}")
        return config
        
    except Exception as e:
        logger.error(f"Error getting ChatUI config: {e}")
        return {"error": str(e)}

# Track config version for cache invalidation
_config_version = 0

@chatui_router.get("/config-version")
async def get_config_version():
    """Get current config version - used by Chat-UI to detect changes"""
    return {"version": _config_version}

@chatui_router.post("/invalidate-cache")
async def invalidate_cache():
    """Invalidate Chat-UI cache - called when admin changes default model"""
    global _config_version
    _config_version += 1
    logger.info(f"Chat-UI cache invalidated, new version: {_config_version}")
    return {"success": True, "version": _config_version}

def check_user_limits_and_trial(authorization: Optional[str], db: Session):
    """Enforce active trial period and query limits for standard platform users"""
    if not authorization or not authorization.startswith("Bearer "):
        return
    token = authorization.replace("Bearer ", "")
    try:
        from ..auth.security import verify_token
        payload = verify_token(token)
        if not payload:
            return
        user_email = payload.get("sub")
        from ..database.models import User
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            return
            
        is_superadmin = getattr(user, 'is_superadmin', False)
        if not is_superadmin and getattr(user, 'default_org_id', None):
            from backend.database.models_platform import Organization, UsageLog
            from datetime import datetime, timezone
            
            org = db.query(Organization).filter(Organization.id == user.default_org_id).first()
            if org and not getattr(org, "is_system", False):
                # 1. Check Trial Expiration (only for starter plan)
                if org.plan == "starter" and org.trial_ends_at:
                    now = datetime.now(timezone.utc)
                    trial_ends = org.trial_ends_at
                    if trial_ends.tzinfo is None:
                        trial_ends = trial_ends.replace(tzinfo=timezone.utc)
                    if now > trial_ends:
                        raise HTTPException(
                            status_code=403,
                            detail="Deneme süreniz dolmuştur. Devam etmek için lütfen planınızı yükseltin."
                        )

                # 2. Check Monthly Query Limit
                now = datetime.now(timezone.utc)
                month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
                
                query_count = db.query(UsageLog).filter(
                    UsageLog.organization_id == org.id,
                    UsageLog.event_type == "chat_query",
                    UsageLog.created_at >= month_start
                ).count()
                
                if query_count >= org.max_queries_per_month:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Aylık sorgu limitiniz doldu ({org.max_queries_per_month}). Lütfen planınızı yükseltin."
                    )
                    
                # 3. Log usage
                usage_log = UsageLog(
                    organization_id=org.id,
                    event_type="chat_query",
                    details={"source": "chatui"}
                )
                db.add(usage_log)
                db.commit()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Error checking user limits: {e}")

@chatui_router.post("/chat/completions")
async def chat_completions(
    request: ChatUIRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Handle chat completions in OpenAI format - simple pass-through to LLM"""
    check_user_limits_and_trial(authorization, db)
    from ..services.llm_router import llm_router
    import time
    start_time = time.time()
    
    try:
        # Get model from database using model name
        model = db.query(ModelConfig).filter(
            ModelConfig.model_name == request.model,
            ModelConfig.is_active == True
        ).first()
        
        if not model:
            # If specific model not found, use default model from LLM Router
            logger.warning(f"Model {request.model} not found, using default model")
            model = llm_router.get_default_model(db)
            
            if not model:
                raise HTTPException(status_code=404, detail="No active models available")
        
        # Initialize token for the model's provider
        ai_service.initialize_tokens_for_model(db, model.provider)
        
        logger.info("=" * 80)
        logger.info(f"📊 Model: {model.name} ({model.model_name})")
        logger.info(f"🏢 Provider: {model.provider}")
        logger.info(f"📝 Message: {request.messages[-1].content[:100] if request.messages else 'No messages'}...")
        logger.info("=" * 80)
        
        # Convert Pydantic messages to dict format
        messages_dict = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        logger.info(f"🚀 Calling LLM Router...")
        ai_start = time.time()
        
        # Determine if we should stream
        should_stream = request.stream if request.stream is not None else (model.stream_enabled if hasattr(model, 'stream_enabled') else False)
        
        try:
            # Use LLM Router for direct stream support
            response, metadata = await llm_router.make_request_with_failover(
                db=db,
                model=model,
                messages=messages_dict,
                temperature=request.temperature or model.temperature,
                max_tokens=request.max_tokens or model.num_predict,
                stream=should_stream
            )
            
            ai_duration = time.time() - ai_start
            logger.info(f"✅ LLM Router response received in {ai_duration:.2f}s")
            
            # Record successful request statistics
            try:
                logger.info(f"📊 Recording chat statistics for model={model.model_name}, duration={ai_duration:.2f}s")
                from ..services.simple_statistics_service import simple_stats
                simple_stats.log_request(
                    db=db,
                    model_name=model.model_name,
                    mode="chat",
                    duration=ai_duration,
                    tokens_used=metadata.get("tokens_used") if metadata else None,
                    success=True
                )
                logger.info(f"✅ Chat statistics recorded successfully")
            except Exception as stat_error:
                logger.error(f"❌ Failed to log chat statistics: {stat_error}")
                import traceback
                logger.error(traceback.format_exc())
                
        except Exception as ai_error:
            ai_duration = time.time() - ai_start
            logger.error(f"❌ LLM Router error after {ai_duration:.2f}s: {ai_error}")
            
            # Record failed request statistics
            try:
                from ..services.simple_statistics_service import simple_stats
                simple_stats.log_request(
                    db=db,
                    model_name=model.model_name if model else "unknown",
                    mode="chat",
                    duration=ai_duration,
                    success=False,
                    error=str(ai_error)
                )
            except Exception as stat_error:
                logger.warning(f"Failed to log statistics: {stat_error}")
            
            raise HTTPException(
                status_code=503,
                detail=f"AI service temporarily unavailable: {str(ai_error)}"
            )
        
        # Check if response is None (all tokens failed)
        if response is None:
            error_msg = metadata.get("error", "All tokens failed") if metadata else "LLM request failed"
            logger.error(f"❌ LLM response is None: {error_msg}")
            
            # Record failed request statistics
            try:
                from ..services.simple_statistics_service import simple_stats
                simple_stats.log_request(
                    db=db,
                    model_name=model.model_name if model else "unknown",
                    mode="chat",
                    duration=ai_duration,
                    success=False,
                    error=error_msg
                )
                logger.info(f"📊 Statistics recorded for failed request")
            except Exception as stat_error:
                logger.warning(f"Failed to log statistics: {stat_error}")
            
            raise HTTPException(
                status_code=503,
                detail=f"AI service unavailable: {error_msg}"
            )
        
        # Get sub-provider from metadata (use token display name as provider info)
        sub_provider = None
        if metadata:
            sub_provider = metadata.get("sub_provider", {}).get("name") if metadata.get("sub_provider") else metadata.get("token_used")
        
        if not sub_provider:
            sub_provider = "HuggingFace"
        
        # Return ChatUI compatible response
        if should_stream:
            # For streaming, response is already a StreamingResponse from llm_router
            # Just return it directly with proper headers
            if hasattr(response, '__aiter__'):
                # It's already an async generator, wrap it
                return response  # LLM Router already returns StreamingResponse
            else:
                # Fallback: If response is text or dict, convert to stream format
                if isinstance(response, dict) and "choices" in response and len(response["choices"]) > 0:
                    # Extract content from OpenAI format dict
                    response_text = response["choices"][0].get("message", {}).get("content", "")
                    logger.info(f"Fallback streaming: Extracted {len(response_text)} chars from OpenAI dict")
                else:
                    response_text = str(response) if response else ""
                async def generate_stream():
                    # Stream character by character to preserve markdown
                    for i, char in enumerate(response_text):
                        chunk = {
                            "id": f"chatcmpl-{int(time.time()*1000)}",
                            "object": "chat.completion.chunk",
                            "created": int(time.time()),
                            "model": request.model,
                            "choices": [{
                                "index": 0,
                                "delta": {"content": char},
                                "finish_reason": None if i < len(response_text) - 1 else "stop"
                            }]
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                        await asyncio.sleep(0.001)
                    yield "data: [DONE]\n\n"
                
                response_headers = {
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                }
                
                if sub_provider:
                    response_headers["x-inference-provider"] = str(sub_provider)
                    response_headers["x-router-model"] = str(model.model_name)
                    response_headers["X-Router-Model"] = str(model.model_name)
                    response_headers["X-Router-Route"] = "direct"
                
                return StreamingResponse(
                    generate_stream(),
                    media_type="text/event-stream",
                    headers=response_headers
                )
        else:
            # Non-streaming response - LLM Router already returns OpenAI format
            # Clean up response to only include standard OpenAI fields
            if isinstance(response, dict):
                # Extract just the content from the response
                content = ""
                if "choices" in response and len(response["choices"]) > 0:
                    message = response["choices"][0].get("message", {})
                    content = message.get("content", "")
                
                # Return clean OpenAI format (ChatUI expects this exact structure)
                return {
                    "id": response.get("id", f"chatcmpl-{int(time.time()*1000)}"),
                    "object": "chat.completion",
                    "created": response.get("created", int(time.time())),
                    "model": request.model,
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": content
                        },
                        "finish_reason": "stop"
                    }],
                    "usage": response.get("usage", {
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "total_tokens": 0
                    })
                }
            else:
                # Fallback: If response is text, wrap it
                response_text = str(response) if response else ""
                return {
                    "id": f"chatcmpl-{int(time.time()*1000)}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": request.model,
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": response_text
                        },
                        "finish_reason": "stop"
                    }],
                    "usage": {
                        "prompt_tokens": sum(len(m.content.split()) for m in request.messages),
                        "completion_tokens": len(response_text.split()),
                        "total_tokens": sum(len(m.content.split()) for m in request.messages) + len(response_text.split())
                    }
                }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat completions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

@chatui_router.get("/health")
async def chatui_health():
    """Health check for ChatUI integration"""
    return {
        "status": "healthy",
        "service": "Ragleaf ChatUI Integration",
        "version": "1.0.0"
    }

@chatui_router.get("/status")
async def chatui_status(db: Session = Depends(get_db)):
    """Get detailed ChatUI status including models"""
    try:
        from ..services.llm_router import llm_router
        
        # Get active models
        active_models = db.query(ModelConfig).filter(
            ModelConfig.is_active == True
        ).all()
        
        # Get default model
        default_model = llm_router.get_default_model(db)
        
        return {
            "status": "operational" if active_models else "degraded",
            "timestamp": datetime.now().isoformat(),
            "statistics": {
                "total_models": len(active_models),
                "has_default_model": bool(default_model)
            },
            "default_model": {
                "name": default_model.name,
                "model_name": default_model.model_name,
                "provider": default_model.provider
            } if default_model else None,
            "models": [
                {
                    "id": m.id,
                    "name": m.name,
                    "model_name": m.model_name,
                    "provider": m.provider,
                    "is_default": m.is_default
                }
                for m in active_models
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting ChatUI status: {e}")
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


# ==================== RAG CHAT ENDPOINT ====================

class MetadataFilter(BaseModel):
    """Metadata filter for RAG search"""
    department: Optional[str] = None  # Teknik Servis, Satış, Proje, ArGe, Muhasebe
    category: Optional[str] = None  # Manual, Datasheet, Specification, Guide
    tags: Optional[List[str]] = None  # List of tags to match
    product_code: Optional[str] = None  # Product code filter


class RAGChatRequest(BaseModel):
    """Request model for RAG-enhanced chat"""
    messages: List[ChatUIMessage]
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: Optional[bool] = True
    # RAG specific parameters
    top_k: int = 5  # Number of chunks to retrieve
    include_sources: bool = True  # Include source references in response
    language: str = "tr"  # Language for RAG filtering (tr, en, de, fr, es)
    metadata_filter: Optional[MetadataFilter] = None  # Metadata-based filtering

@chatui_router.post("/chat/rag")
async def rag_chat_completions(
    request: RAGChatRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    check_user_limits_and_trial(authorization, db)
    """
    RAG-enhanced chat completions.
    
    Process:
    1. Extract user question from last message
    2. Query ChromaDB for relevant document chunks
    3. Build context from retrieved chunks
    4. Send context + question to LLM
    5. Return response with source references
    """
    from ..services.llm_router import llm_router
    import time
    
    start_time = time.time()
    
    try:
        # Get user's question (last message)
        if not request.messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        user_question = request.messages[-1].content
        logger.info(f"🔍 RAG Query: {user_question[:100]}...")
        
        # === DEPARTMENT FILTERING ===
        # Get current user and their departments for filtering
        user_departments = None
        is_admin = False
        
        if authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
            try:
                payload = verify_token(token)
                if payload:
                    user_email = payload.get("sub")
                    user = db.query(User).filter(User.email == user_email).first()
                    if user:
                        is_admin = user.is_admin
                        user_departments = user.departments or []
                        logger.info(f"👤 User: {user_email}, Admin: {is_admin}, Departments: {user_departments}")
            except Exception as e:
                logger.warning(f"Error getting user info: {e}")
        
        # Get department access matrix settings
        department_filter_enabled = False
        admin_bypass = True
        access_rules = {}
        
        try:
            dept_settings = db.query(Settings).filter(Settings.key == "department_access_matrix").first()
            if dept_settings and dept_settings.value:
                dept_matrix = dept_settings.value if isinstance(dept_settings.value, dict) else json.loads(dept_settings.value)
                department_filter_enabled = dept_matrix.get("enabled", False)
                admin_bypass = dept_matrix.get("admin_bypass", True)
                access_rules = dept_matrix.get("access_rules", {})
                logger.info(f"🏢 Department filtering: enabled={department_filter_enabled}, admin_bypass={admin_bypass}")
        except Exception as e:
            logger.warning(f"Error reading department settings: {e}")
        
        # Calculate accessible departments for this user
        accessible_departments = None
        if department_filter_enabled and not (is_admin and admin_bypass):
            if user_departments:
                accessible_departments = set()
                for dept in user_departments:
                    # Add departments this user's department can access
                    dept_access = access_rules.get(dept, [dept])
                    accessible_departments.update(dept_access)
                accessible_departments = list(accessible_departments)
                logger.info(f"📋 Accessible departments for user: {accessible_departments}")
            else:
                # User has no departments assigned - they can't access any department-specific docs
                logger.warning("⚠️ User has no departments assigned, limiting to unassigned documents")
                accessible_departments = []
        
        # Step 1: Retrieve relevant chunks from PgVector using new services
        rag_start = time.time()
        logger.info("🔍 Getting Vector Store Manager...")
        
        from ..services.vectorstore.vector_store_manager import vector_store_manager
        from ..services.embedding.embedding_service import embedding_service
        
        try:
            # Get PgVector stats
            stats = vector_store_manager.get_stats()
            pgvector_stats = stats.get("pgvector", {})
            doc_count = pgvector_stats.get("count", 0)
            logger.info(f"🗄️ PgVector collection ready, chunks: {doc_count}")
            
            if doc_count == 0:
                logger.warning("⚠️ PgVector is empty, falling back to regular chat")
                return await _fallback_to_regular_chat(request, db, "Sistemde henüz indekslenmiş döküman bulunmuyor. Lütfen yöneticinizle iletişime geçin veya dökümanların yüklenmesini bekleyin.")
            
            # Encode query using new embedding_service
            query_embedding = embedding_service.encode_query(user_question, db)
            
            # Get RAG settings from database
            rag_settings = {}
            try:
                settings_record = db.query(Settings).filter(Settings.key == "rag_settings").first()
                if settings_record and settings_record.value:
                    if isinstance(settings_record.value, str):
                        rag_settings = json.loads(settings_record.value)
                    else:
                        rag_settings = settings_record.value
            except Exception as e:
                logger.error(f"Error reading RAG settings: {e}")
            
            # Build filter metadata
            filter_meta = {"language": request.language}
            
            # Apply metadata filter if provided
            filtered_doc_ids = None
            if request.metadata_filter:
                logger.info(f"🏷️ Applying metadata filter: {request.metadata_filter}")
                filtered_doc_ids = await _get_filtered_document_ids(request.metadata_filter, db)
                if not filtered_doc_ids:
                    logger.warning("⚠️ No documents match metadata filter")
                    return await _fallback_to_regular_chat(
                        request, db, 
                        f"Metadata filtresine uyan döküman bulunamadı: {request.metadata_filter.model_dump()}"
                    )
                logger.info(f"📋 Filtered to {len(filtered_doc_ids)} documents")
            
            # === DEPARTMENT FILTERING ===
            # Apply department-based document filtering
            if accessible_departments is not None:
                logger.info(f"🏢 Applying department filter: {accessible_departments}")
                dept_filtered_ids = await _get_department_filtered_document_ids(accessible_departments, db)
                
                if filtered_doc_ids is not None:
                    # Intersect with existing metadata filter
                    filtered_doc_ids = list(set(filtered_doc_ids) & set(dept_filtered_ids))
                else:
                    filtered_doc_ids = dept_filtered_ids
                
                if not filtered_doc_ids:
                    logger.warning("⚠️ No documents accessible for user's departments")
                    return await _fallback_to_regular_chat(
                        request, db, 
                        "Departmanınıza ait erişilebilir döküman bulunamadı."
                    )
                logger.info(f"📋 Department filtered to {len(filtered_doc_ids)} documents")
            
            # Check if hybrid search is enabled
            hybrid_enabled = rag_settings.get("hybrid_search_enabled", False)
            vector_weight = float(rag_settings.get("hybrid_vector_weight", 0.5))
            keyword_weight = float(rag_settings.get("hybrid_keyword_weight", 0.5))
            
            # Search using PgVector with language and document filtering
            logger.info(f"🔍 Searching with language filter: {request.language}, hybrid={hybrid_enabled}")
            
            if hybrid_enabled:
                # 🔀 HYBRID SEARCH: Vector + Full-Text (BM25)
                logger.info(f"🔀 Using Hybrid Search (vector={vector_weight}, keyword={keyword_weight})")
                search_results = vector_store_manager.pg_store.hybrid_search(
                    query_text=user_question,
                    query_embedding=query_embedding,
                    top_k=request.top_k,
                    filter_metadata=filter_meta,
                    document_ids=filtered_doc_ids,
                    vector_weight=vector_weight,
                    keyword_weight=keyword_weight
                )
            else:
                # Standard vector-only search
                search_results = vector_store_manager.pg_store.search(
                    query_embedding=query_embedding,
                    top_k=request.top_k,
                    filter_metadata=filter_meta,
                    document_ids=filtered_doc_ids
                )
            
            rag_duration = time.time() - rag_start
            
            # Convert results to expected format
            results = []
            if search_results:
                for result in search_results:
                    # Create a simple object with page_content and metadata
                    class DocResult:
                        def __init__(self, content, metadata):
                            self.page_content = content
                            self.metadata = metadata
                    
                    doc_result = DocResult(result.text, result.metadata)
                    results.append((doc_result, result.score))
            
            logger.info(f"📚 Retrieved {len(results)} chunks in {rag_duration:.2f}s")
            
            # Check if results are relevant enough (minimum score threshold)
            # Note: E5 embeddings typically give high scores (0.7-0.9)
            # 0.70 = Very relevant, 0.60 = Somewhat relevant, below 0.50 = Not relevant
            # Default threshold or from settings
            MIN_RELEVANCE_SCORE = float(rag_settings.get("similarity_threshold", 0.65))
            logger.info(f"⚙️ RAG Settings: similarity_threshold={MIN_RELEVANCE_SCORE}, hybrid={hybrid_enabled}")
            best_score = 0.0  # Initialize for later use
            overall_confidence = ConfidenceLevel.NONE
            confidence_warning = None
            
            if results:
                best_score = max(score for _, score in results)
                logger.info(f"📊 Best embedding score: {best_score:.3f}")
                
                # === YENİ: Keyword overlap ve güven seviyesi kontrolü ===
                # Her chunk için keyword overlap hesapla
                results_for_evaluation = [(doc.page_content, score) for doc, score in results]
                evaluated_results, overall_confidence, confidence_warning = query_processor.evaluate_search_results(
                    user_question, results_for_evaluation, min_threshold=MIN_RELEVANCE_SCORE
                )
                
                logger.info(f"🎯 Overall confidence level: {overall_confidence.value}")
                if confidence_warning:
                    logger.warning(f"⚠️ Confidence warning: {confidence_warning}")
                
                # Log detailed relevance info for each chunk
                for i, eval_result in enumerate(evaluated_results):
                    relevance = eval_result['relevance']
                    logger.info(
                        f"  Chunk {i+1}: embedding={relevance.embedding_score:.3f}, "
                        f"keyword_overlap={relevance.keyword_overlap:.3f}, "
                        f"hybrid={relevance.hybrid_score:.3f}, "
                        f"matched_keywords={relevance.matched_keywords}"
                    )
                
                # Güven seviyesine göre karar ver
                if overall_confidence == ConfidenceLevel.NONE:
                    logger.warning(f"⚠️ Confidence level NONE, falling back to chat")
                    return await _fallback_to_regular_chat(
                        request, db, 
                        f"İlgili doküman bulunamadı (en yüksek benzerlik: {best_score:.1%})"
                    )
                
                # Eski threshold kontrolü de kalsın (yedek)
                if best_score < MIN_RELEVANCE_SCORE:
                    logger.warning(f"⚠️ Best score {best_score:.3f} below threshold {MIN_RELEVANCE_SCORE}, falling back to chat")
                    return await _fallback_to_regular_chat(
                        request, db, 
                        f"İlgili doküman bulunamadı (en yüksek benzerlik: {best_score:.1%})"
                    )
            else:
                logger.warning("⚠️ No results from ChromaDB query, falling back to chat")
                return await _fallback_to_regular_chat(request, db, "ChromaDB sorgusu sonuç döndürmedi")
            
        except Exception as e:
            logger.error(f"ChromaDB query failed: {e}")
            import traceback
            traceback.print_exc()
            return await _fallback_to_regular_chat(request, db, f"ChromaDB sorgu hatası: {str(e)}")
        
        # Step 2: Build context from retrieved chunks
        context_parts = []
        sources = []
        
        # Import DocumentChunk for enrichment_data retrieval
        from ..database.models_v2 import DocumentChunk
        
        for doc, score in results:
            # Include document name in the context so LLM knows source
            doc_name = doc.metadata.get("document_name", doc.metadata.get("source", "unknown"))
            
            # Retrieve enrichment data for this chunk
            enrichment_data = {}
            chunk_id = doc.metadata.get("chunk_id")  # If available in metadata
            
            # Try to find chunk by document_id + chunk_index
            if not chunk_id and "document_id" in doc.metadata and "chunk_index" in doc.metadata:
                chunk_record = db.query(DocumentChunk).filter(
                    DocumentChunk.document_id == doc.metadata["document_id"],
                    DocumentChunk.chunk_index == doc.metadata["chunk_index"]
                ).first()
                
                if chunk_record and chunk_record.enrichment_data:
                    enrichment_data = chunk_record.enrichment_data
            
            # Build context with enrichment data if available
            doc_context_parts = [f"### Belge Kaynağı: {doc_name}"]
            
            # Add enrichment metadata to help LLM
            if enrichment_data:
                # Add special instructions for this chunk
                if enrichment_data.get("special_instructions"):
                    doc_context_parts.append(f"**Özel Not:** {enrichment_data['special_instructions']}")
                
                # Add tags for context
                if enrichment_data.get("tags"):
                    tags_str = ", ".join(enrichment_data["tags"])
                    doc_context_parts.append(f"**Etiketler:** {tags_str}")
                
                # Add suggested questions as guidance
                if enrichment_data.get("suggested_questions"):
                    questions = enrichment_data["suggested_questions"][:3]  # Max 3 questions
                    doc_context_parts.append(f"**İlgili Sorular:** {'; '.join(questions)}")
            
            doc_context_parts.append(f"\n{doc.page_content}")
            doc_context = "\n".join(doc_context_parts)
            
            context_parts.append(doc_context)
            source_info = {
                "source": doc.metadata.get("document_name", doc.metadata.get("source", "unknown")),
                "chunk_index": doc.metadata.get("chunk_index", 0),
                "score": float(score),
                "document_id": doc.metadata.get("document_id"),
                "enrichment_data": enrichment_data  # NEW: Enrichment metadata for frontend
            }
            sources.append(source_info)
        
        # 🖼️ Collect related images from all retrieved chunks
        related_images = []
        seen_image_ids = set()  # Prevent duplicates
        
        # Get DOCUMENTS_DIR for file existence check (multi-tenant)
        from pathlib import Path
        from backend.services.storage_service import get_storage
        _storage = get_storage()
        import os as _os
        DOCUMENTS_DIR = _storage.get_document_root(_os.getenv("DEFAULT_TENANT_SLUG", "default"))
        logger.info(f"🖼️ DOCUMENTS_DIR: {DOCUMENTS_DIR} (exists: {DOCUMENTS_DIR.exists()})")
        
        for doc, score in results:
            image_relations = doc.metadata.get("image_relations", [])
            document_id = doc.metadata.get("document_id")
            folder_name = doc.metadata.get("folder_name", "")
            
            if image_relations:
                logger.info(f"🖼️ Chunk has {len(image_relations)} image_relations, doc_id={document_id}, folder={folder_name}")
            
            for img_rel in image_relations:
                asset_id = img_rel.get("asset_id")
                if asset_id and asset_id not in seen_image_ids:
                    seen_image_ids.add(asset_id)
                    
                    # Build image URL using existing endpoint
                    file_path = img_rel.get("file_path", "")
                    filename = file_path.split("/")[-1] if file_path else ""
                    
                    logger.info(f"🖼️ Processing image: asset_id={asset_id}, file_path={file_path}, filename={filename}")
                    
                    if filename and document_id and folder_name:
                        # Check if image file actually exists before adding
                        doc_folder = DOCUMENTS_DIR / folder_name
                        path1 = doc_folder / "images" / filename
                        path2 = doc_folder / "images" / "extracted" / filename
                        img_exists = path1.exists() or path2.exists()
                        
                        logger.info(f"🖼️ Checking paths: {path1} (exists: {path1.exists()}), {path2} (exists: {path2.exists()})")
                        
                        if img_exists:
                            related_images.append({
                                "asset_id": asset_id,
                                "document_id": document_id,
                                "page": img_rel.get("page"),
                                "index": img_rel.get("index"),
                                "url": f"/api/images/{document_id}/{filename}",
                                "chunk_score": float(score),
                                "auto_linked": img_rel.get("auto_linked", True)
                            })
                            logger.info(f"✅ Image added: {filename}")
                        else:
                            logger.warning(f"🖼️ Image file not found: {filename} for doc {document_id}")
                            logger.warning(f"   Searched: {path1}, {path2}")
                    else:
                        logger.warning(f"🖼️ Missing data: filename={filename}, doc_id={document_id}, folder={folder_name}")
        
        # Sort by chunk score (most relevant first) and limit to top 5
        related_images = sorted(related_images, key=lambda x: x["chunk_score"], reverse=True)[:5]
        
        if related_images:
            logger.info(f"🖼️ Found {len(related_images)} related images from RAG results")
        
        # 💡 Collect suggested questions from all retrieved chunks
        suggested_questions = []
        seen_questions = set()
        for doc, score in results:
            enrichment_data = doc.metadata.get("enrichment_data", {})
            if enrichment_data and enrichment_data.get("suggested_questions"):
                for q in enrichment_data["suggested_questions"]:
                    q_lower = q.lower().strip()
                    if q_lower not in seen_questions and q_lower != user_question.lower().strip():
                        seen_questions.add(q_lower)
                        suggested_questions.append(q)
        
        # Limit to top 3 suggestions
        suggested_questions = suggested_questions[:3]
        
        if suggested_questions:
            logger.info(f"💡 Found {len(suggested_questions)} suggested questions from RAG results")
        
        # 🖼️ Multi-Modal RAG: Analyze images with vision model
        multimodal_result = None
        vision_context = ""
        try:
            from ..services.multimodal_rag_service import MultiModalRAGService
            multimodal_service = MultiModalRAGService(db)
            
            if multimodal_service.is_enabled() and related_images:
                logger.info(f"🖼️ Multi-Modal RAG enabled, analyzing {len(related_images)} images...")
                
                # Get chunk IDs and document IDs from results
                chunk_ids = []
                document_ids = set()
                for doc, score in results:
                    if doc.metadata.get("chunk_id"):
                        chunk_ids.append(doc.metadata["chunk_id"])
                    if doc.metadata.get("document_id"):
                        document_ids.add(doc.metadata["document_id"])
                
                # Get image asset IDs from related_images
                image_asset_ids = [img.get("asset_id") for img in related_images if img.get("asset_id")]
                
                # Process query with images
                multimodal_result = await multimodal_service.process_query_with_images(
                    query=user_question,
                    rag_context=context,
                    chunk_ids=chunk_ids if chunk_ids else None,
                    document_id=list(document_ids)[0] if document_ids else None,
                    image_ids=image_asset_ids if image_asset_ids else None,
                )
                
                # Add vision response to context if available
                if multimodal_result.get("vision_response"):
                    vision_context = f"\n\n### 🖼️ Görsel Analizi:\n{multimodal_result['vision_response']}"
                    logger.info(f"✅ Multi-Modal analysis complete: {multimodal_result.get('images_analyzed', 0)} images, cost: ${multimodal_result.get('cost_usd', 0):.4f}")
                elif multimodal_result.get("fallback_reason"):
                    logger.info(f"⚠️ Multi-Modal fallback: {multimodal_result.get('fallback_reason')}")
        except Exception as mm_error:
            logger.warning(f"⚠️ Multi-Modal RAG error (continuing with text-only): {mm_error}")
        
        # Deduplicate sources by document name, keeping the highest score
        # This prevents the same document appearing multiple times in the UI list
        unique_sources = {}
        for s in sources:
            doc_name = s["source"]
            if doc_name not in unique_sources or s["score"] > unique_sources[doc_name]["score"]:
                unique_sources[doc_name] = s
        
        # Sort by score descending and update sources list
        sources = sorted(unique_sources.values(), key=lambda x: x["score"], reverse=True)
        
        context = "\n\n---\n\n".join(context_parts)
        
        # Add vision context if available
        if vision_context:
            context += vision_context
        
        # Build source links for LLM to include in response
        source_links_text = ""
        if sources:
            source_links_parts = []
            for i, src in enumerate(sources[:5], 1):  # Top 5 sources
                doc_name = src.get("source", "unknown")
                doc_id = src.get("document_id")
                score = src.get("score", 0)
                if doc_id:
                    # Create clickable link format for frontend
                    source_links_parts.append(f"{i}. [{doc_name}](/api/admin/documents/{doc_id}/file) (skor: {score:.2f})")
                else:
                    source_links_parts.append(f"{i}. {doc_name} (skor: {score:.2f})")
            source_links_text = "\n".join(source_links_parts)
        
        logger.info(f"📝 Context created: {len(context)} chars from {len(context_parts)} chunks")
        logger.debug(f"Context preview: {context[:500]}...")
        
        # Step 3: Build RAG prompt - güven seviyesine göre dinamik
        # Güven seviyesine göre ek talimatlar
        confidence_instruction = ""
        if overall_confidence == ConfidenceLevel.LOW:
            confidence_instruction = """
⚠️ DİKKAT - DÜŞÜK GÜVEN SEVİYESİ:
Aşağıdaki dokümanlar kullanıcının sorusuyla DOĞRUDAN İLGİLİ DEĞİL olabilir.
- Önce dokümanların gerçekten soruyla ilgili olup olmadığını değerlendir
- Eğer dokümanlar soruyla ilgili DEĞİLSE, açıkça "Bu konuda dokümanlarda doğrudan bilgi bulunamadı" de
- Sadece gerçekten ilgili bilgileri paylaş, ASLA bilgi uydurma
- Doküman adlarını ve içeriklerini doğrudan alıntıla
"""
        elif overall_confidence == ConfidenceLevel.MEDIUM:
            confidence_instruction = """
ℹ️ NOT - ORTA GÜVEN SEVİYESİ:
Dokümanlar soruyla kısmen ilgili görünüyor.
- Yanıtında hangi bilgilerin dokümanlarda olduğunu açıkça belirt
- Emin olmadığın kısımları "Bu konuda kesin bilgi yok" şeklinde işaretle
"""
        
        rag_system_prompt = f"""Sen bir AI asistanısın.

KİMLİĞİN:
Sistemde tanımlı teknik dokümanlara dayanarak kullanıcılara net, doğru ve güvenilir yanıtlar verirsin. Profesyonel ve yardımsever bir üslupla iletişim kurarsın.
{confidence_instruction}
DOKÜMANTASYON:
{context}

GÖREV:
- Önce dokümanların kullanıcının sorusuyla gerçekten ilgili olup olmadığını değerlendir
- Eğer dokümanlar soruyla ilgili DEĞİLSE, bunu açıkça belirt: "Bu konuda dokümanlarda bilgi bulunamadı"
- Sadece dokümanlarda GERÇEKTEN BULUNAN bilgileri kullan
- Teknik terimleri açıklayarak detaylı, anlaşılır yanıt ver
- Adım adım talimatlar gerekiyorsa numaralı liste kullan
- Doğrudan ilgili bölümleri alıntıla ve referans göster
- Türkçe yanıt ver

ÖNEMLİ KURALLAR:
- ASLA bilgi uydurma veya tahmin etme
- Dokümanlarda olmayan bilgileri "var" gibi gösterme
- Emin olmadığın bilgileri "Bu konuda dokümantasyonda bilgi bulamadım" şeklinde belirt
- Güvenlik ve kurulum konularında dikkatli ol, gerekirse uzman desteği öner
- Yanıtında kullandığın bilgilerin hangi dokümandan geldiğini belirt

FORMAT KURALLARI:
- Düz Markdown formatı kullan (HTML kullanma)
- Yanıtın sonunda "📚 Kaynaklar:" başlığı altında kullandığın kaynakları listele
- Kaynakları aşağıdaki formatta göster (tıklanabilir linkler):

📚 **Kaynaklar:**
{source_links_text}"""

        # Build messages with RAG context
        rag_messages = [
            {"role": "system", "content": rag_system_prompt},
            {"role": "user", "content": user_question}
        ]
        
        # Step 4: Get model and generate response
        model = db.query(ModelConfig).filter(
            ModelConfig.model_name == request.model,
            ModelConfig.is_active == True
        ).first()
        
        if not model:
            model = llm_router.get_default_model(db)
            if not model:
                raise HTTPException(status_code=404, detail="No active models available")
        
        # Initialize tokens
        ai_service.initialize_tokens_for_model(db, model.provider)
        
        logger.info(f"🤖 Sending to LLM: {model.name}")
        llm_start = time.time()
        
        should_stream = request.stream if request.stream is not None else True
        
        # Set appropriate max_tokens for RAG responses
        # RAG responses need more tokens: context (5 chunks) + formatted detailed answer
        default_max_tokens = 4096  # Increased for comprehensive technical documentation responses
        max_tokens = request.max_tokens or model.num_predict or default_max_tokens
        
        # Ensure minimum for RAG
        if max_tokens < 2048:
            logger.warning(f"⚠️ max_tokens {max_tokens} too low for RAG, using 4096")
            max_tokens = 4096
        
        logger.info(f"🔢 Using max_tokens: {max_tokens}")
        
        response, metadata = await llm_router.make_request_with_failover(
            db=db,
            model=model,
            messages=rag_messages,
            temperature=request.temperature or 0.7,
            max_tokens=max_tokens,
            stream=should_stream
        )
        
        llm_duration = time.time() - llm_start
        total_duration = time.time() - start_time
        
        # Check if LLM request failed
        if response is None:
            error_msg = metadata.get("error", "LLM request failed")
            logger.error(f"LLM request failed: {error_msg}")
            
            # Record failed request statistics
            try:
                from ..services.simple_statistics_service import simple_stats
                simple_stats.log_request(
                    db=db,
                    model_name=model.model_name,
                    mode="rag",
                    duration=time.time() - start_time,
                    success=False,
                    error=error_msg
                )
            except Exception as stat_error:
                logger.warning(f"Failed to log statistics: {stat_error}")
            
            raise HTTPException(status_code=503, detail=f"LLM request failed: {error_msg}")
        
        logger.info(f"✅ RAG response generated in {total_duration:.2f}s (RAG: {rag_duration:.2f}s, LLM: {llm_duration:.2f}s)")
        
        # Extract response text from the API response
        response_text = ""
        if isinstance(response, dict):
            # OpenAI-style response
            choices = response.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                response_text = message.get("content", "")
        elif isinstance(response, str):
            response_text = response
        else:
            response_text = str(response)
        
        # Check if LLM couldn't find relevant information in context
        # Only flag as unfound if multiple strong indicators are present
        strong_no_info_phrases = [
            "hakkında bilgi bulunmamaktadır",
            "hakkında bilgi yok",
            "yer almamaktadır",
            "hiçbir bilgi verilmemiş",
            "dokümanlarda yer almamaktadır",
            "cannot find any information",
            "no information available"
        ]
        
        # Count how many indicators are present
        indicator_count = sum(1 for phrase in strong_no_info_phrases if phrase.lower() in response_text.lower())
        
        # Only mark as unfound if we have strong evidence (multiple indicators or very explicit phrases)
        is_no_info_response = indicator_count >= 2 or any(
            phrase.lower() in response_text.lower() 
            for phrase in ["hiçbir bilgi", "hiçbir dokümanda", "tamamen yok"]
        )
        
        # Record statistics
        try:
            from ..services.simple_statistics_service import simple_stats
            
            if is_no_info_response:
                # LLM couldn't find relevant info despite retrieving chunks
                logger.warning(f"⚠️ LLM indicated no relevant information found in context")
                logger.info(f"📊 Recording as RAG unfound (chunks retrieved but semantically not matching)")
                simple_stats.log_request(
                    db=db,
                    model_name=model.model_name,
                    mode="rag_unfound",
                    duration=total_duration,
                    tokens_used=metadata.get("tokens_used"),
                    success=False,
                    error=f"Aranan bilgi dokümanlar arasında bulunamadı (benzerlik skoru: {best_score:.2f})",
                    query=user_question
                )
                logger.warning(f"⚠️ RAG unfound recorded - Chunks retrieved but LLM couldn't extract requested information")
            else:
                # Successful RAG response
                logger.info(f"📊 Recording successful RAG statistics for model={model.model_name}, duration={total_duration:.2f}s")
                simple_stats.log_request(
                    db=db,
                    model_name=model.model_name,
                    mode="rag",
                    duration=total_duration,
                    tokens_used=metadata.get("tokens_used"),
                    success=True
                )
                logger.info(f"✅ RAG statistics recorded successfully")
        except Exception as stat_error:
            logger.error(f"❌ Failed to log RAG statistics: {stat_error}")
            import traceback
            logger.error(traceback.format_exc())
        
        # NOTE: Sources are already included in the prompt template with clickable links
        # The LLM uses them in its response, so we don't add them again here
        # This prevents duplicate "Kaynaklar:" sections in the response
        
        # Build detailed RAG metadata for admin debugging
        chunks_detail = []
        for i, (doc, score) in enumerate(results):
            # Get relevance info from evaluated results if available
            relevance_info = {}
            if i < len(evaluated_results):
                rel = evaluated_results[i]['relevance']
                relevance_info = {
                    "keyword_overlap": rel.keyword_overlap,
                    "hybrid_score": rel.hybrid_score,
                    "matched_keywords": rel.matched_keywords,
                    "chunk_confidence": rel.confidence_level.value
                }
            
            chunks_detail.append({
                "content": doc.page_content,
                "score": float(score),
                "source": doc.metadata.get("document_name", "unknown"),
                "chunk_index": doc.metadata.get("chunk_index"),
                "document_id": doc.metadata.get("document_id"),
                **relevance_info
            })
        
        # 📊 Log RAG query for analytics
        query_id = f"rag-{int(time.time()*1000)}"
        try:
            from ..services.rag_analytics_service import RAGAnalyticsService
            analytics_service = RAGAnalyticsService(db)
            
            # Prepare documents_used list
            documents_used = [
                {
                    "doc_id": s.get("document_id"),
                    "doc_name": s.get("source"),
                    "score": s.get("score")
                }
                for s in sources
            ]
            
            await analytics_service.log_query(
                query_id=query_id,
                query_text=user_question,
                user_id=None,  # TODO: Get from auth if available
                language=request.language,
                chunks_retrieved=len(results),
                best_score=best_score,
                confidence_level=overall_confidence.value,
                documents_used=documents_used,
                rag_duration_ms=int(rag_duration * 1000),
                llm_duration_ms=int(llm_duration * 1000),
                total_duration_ms=int(total_duration * 1000),
                success=True,
                fallback_reason=None,
            )
        except Exception as analytics_error:
            logger.warning(f"⚠️ Failed to log RAG analytics: {analytics_error}")
        
        # Return response in OpenAI format
        return {
            "id": query_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model or model.model_name,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "rag_metadata": {
                "chunks_retrieved": len(results),
                "sources": sources,
                "related_images": related_images,  # 🖼️ NEW: Images from retrieved chunks
                "suggested_questions": suggested_questions,  # 💡 NEW: Suggested follow-up questions
                "rag_duration_ms": int(rag_duration * 1000),
                "llm_duration_ms": int(llm_duration * 1000),
                "total_duration_ms": int(total_duration * 1000),
                "best_score": float(best_score),
                "confidence_level": overall_confidence.value,
                "confidence_warning": confidence_warning,
                "provider": "HuggingFace",
                "alt_provider": model.provider if model else None,
                "model_name": model.model_name if model else None,
                # 🖼️ Multi-Modal RAG metadata
                "multimodal": {
                    "enabled": multimodal_result.get("multimodal_enabled", False) if multimodal_result else False,
                    "images_analyzed": multimodal_result.get("images_analyzed", 0) if multimodal_result else 0,
                    "vision_cost_usd": multimodal_result.get("cost_usd", 0) if multimodal_result else 0,
                    "vision_tokens": multimodal_result.get("tokens_used", 0) if multimodal_result else 0,
                    "vision_provider": multimodal_result.get("provider") if multimodal_result else None,
                    "fallback_reason": multimodal_result.get("fallback_reason") if multimodal_result else None,
                } if multimodal_result else None,
                # Detailed info for admin debugging
                "debug": {
                    "query": user_question,
                    "chunks": chunks_detail,
                    "system_prompt": rag_system_prompt,
                    "context_length": len(context),
                    "llm_messages": rag_messages,
                    "model_params": {
                        "temperature": request.temperature or 0.7,
                        "max_tokens": max_tokens,
                        "top_k": request.top_k
                    }
                }
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG chat error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def _get_filtered_document_ids(metadata_filter: MetadataFilter, db: Session) -> Optional[List[int]]:
    """
    Get document IDs that match the metadata filter.
    
    Args:
        metadata_filter: MetadataFilter with department, category, tags, product_code
        db: Database session
        
    Returns:
        List of document IDs or None if no filter applied
    """
    from sqlalchemy import and_, or_
    
    # Support new pipeline statuses: indexed, enriched, processed
    query = db.query(Document.id).filter(
        Document.status.in_(["indexed", "enriched", "processed"]),
        Document.vector_indexed == True
    )
    
    conditions = []
    
    # Department filter
    if metadata_filter.department:
        conditions.append(
            Document.doc_metadata["department"].astext == metadata_filter.department
        )
    
    # Category filter
    if metadata_filter.category:
        conditions.append(
            Document.doc_metadata["category"].astext == metadata_filter.category
        )
    
    # Product code filter
    if metadata_filter.product_code:
        conditions.append(
            Document.doc_metadata["product"]["code"].astext == metadata_filter.product_code
        )
    
    # Tags filter (any tag matches)
    if metadata_filter.tags:
        tag_conditions = []
        for tag in metadata_filter.tags:
            tag_conditions.append(
                Document.doc_metadata["tags"].contains([tag])
            )
        if tag_conditions:
            conditions.append(or_(*tag_conditions))
    
    # Apply conditions
    if conditions:
        query = query.filter(and_(*conditions))
    else:
        return None  # No filter applied
    
    result = query.all()
    return [doc_id for (doc_id,) in result] if result else []


async def _get_department_filtered_document_ids(accessible_departments: List[str], db: Session) -> List[int]:
    """
    Get document IDs that belong to accessible departments.
    
    Args:
        accessible_departments: List of department names the user can access
        db: Database session
        
    Returns:
        List of document IDs accessible to the user
    """
    from sqlalchemy import or_
    
    # Support new pipeline statuses: indexed, enriched, processed
    query = db.query(Document.id).filter(
        Document.status.in_(["indexed", "enriched", "processed"]),
        Document.vector_indexed == True
    )
    
    if not accessible_departments:
        # User has no departments - only return documents without department assignment
        query = query.filter(
            or_(
                Document.doc_metadata["department"].astext == "",
                Document.doc_metadata["department"].astext.is_(None),
                ~Document.doc_metadata.has_key("department")
            )
        )
    else:
        # Build OR conditions for each accessible department
        dept_conditions = []
        for dept in accessible_departments:
            # Check if document's department contains this department
            # Department field can be comma-separated like "Teknik Servis, Proje"
            dept_conditions.append(
                Document.doc_metadata["department"].astext.contains(dept)
            )
        
        # Also include documents without department (accessible to all)
        dept_conditions.append(
            or_(
                Document.doc_metadata["department"].astext == "",
                Document.doc_metadata["department"].astext.is_(None),
                ~Document.doc_metadata.has_key("department")
            )
        )
        
        query = query.filter(or_(*dept_conditions))
    
    result = query.all()
    return [doc_id for (doc_id,) in result] if result else []


async def _fallback_to_regular_chat(request: RAGChatRequest, db: Session, fallback_reason: str = "Vector store not available"):
    """Return error message instead of falling back to chat - non-admin users should only use RAG"""
    import time
    
    # Get user query for logging
    user_query = request.messages[-1].content if request.messages else ""
    
    # Record RAG failure in statistics
    try:
        from ..services.simple_statistics_service import simple_stats
        simple_stats.log_request(
            db=db,
            model_name=request.model or "unknown",
            mode="rag_failed",
            duration=0,
            success=False,
            error=f"RAG failed: {fallback_reason}",
            query=user_query
        )
    except Exception as stat_error:
        logger.error(f"Failed to log RAG failure statistics: {stat_error}")
    
    # Return informative error message instead of falling back to chat
    error_messages = {
        "ChromaDB boş - indekslenmiş doküman yok": 
            "Üzgünüm, sistemde henüz indekslenmiş doküman bulunmuyor. Lütfen yöneticinizle iletişime geçin veya dokümanların yüklenmesini bekleyin.",
        "İlgili doküman bulunamadı": 
            "Üzgünüm, sorunuzla ilgili bilgi içeren bir doküman bulamadım. Lütfen sorunuzu farklı kelimelerle ifade etmeyi deneyin veya daha spesifik bir soru sorun.",
        "ChromaDB sorgusu sonuç döndürmedi": 
            "Üzgünüm, arama sonuç vermedi. Lütfen sorunuzu farklı şekilde ifade etmeyi deneyin.",
    }
    
    # Find matching error message or use default
    error_message = error_messages.get(
        fallback_reason,
        f"Üzgünüm, sorunuzla ilgili bilgi bulamadım. Lütfen farklı bir soru sormayı deneyin. (Sebep: {fallback_reason})"
    )
    
    return {
        "id": f"rag-error-{int(time.time()*1000)}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request.model or "rag",
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": error_message
            },
            "finish_reason": "stop"
        }],
        "rag_metadata": {
            "fallback": False,
            "error": True,
            "error_reason": fallback_reason,
            "mode_used": "rag",
            "chunks_found": 0,
            "message": error_message
        }
    }
