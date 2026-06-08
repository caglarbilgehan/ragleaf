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

from fastapi import APIRouter, HTTPException, Depends, Request, Query, status
from fastapi.responses import StreamingResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import (
    Agent, AgentKnowledgeBase, PublicConversation, PublicMessage, UsageLog,
    Appointment, AgentTemplate, AgentTemplateDocument, Organization
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
    model: Optional[str] = Field("default", description="Model name")
    messages: List[ChatCompletionMessage] = Field(..., description="Messages list")
    stream: Optional[bool] = Field(False, description="Stream response")
    temperature: Optional[float] = Field(0.7, description="Temperature")
    max_tokens: Optional[int] = Field(None, description="Max tokens")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")
    visitor_id: Optional[str] = Field(None, description="Persistent visitor ID")
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

@public_chat_router.get("/ref/click")
async def handle_ref_click(ref: str, db: Session = Depends(get_db)):
    """
    Track click on branding/referral link.
    Increments referrer organization's leaves by 1 and redirects to landing page.
    """
    # Try finding by ID first, then by slug
    org = None
    try:
        org_id = int(ref)
        org = db.query(Organization).filter(Organization.id == org_id).first()
    except ValueError:
        org = db.query(Organization).filter(Organization.slug == ref).first()
        
    if org:
        org.ragleaf_leaves = (org.ragleaf_leaves or 0) + 1
        db.add(org)
        db.commit()
        
    return RedirectResponse(url="https://ragleaf.com")


@public_chat_router.get("/agents/{agent_public_id}/info", response_model=AgentInfoResponse)
async def get_agent_public_info(
    agent_public_id: str,
    req: Request,
    lang: Optional[str] = None,
    widget_id: Optional[str] = None,
    auth: AgentAuth = Depends(get_agent_from_api_key),
    db: Session = Depends(get_db)
):
    """
    Get public info about an agent (for widget initialization).
    Returns name, welcome message, and appearance settings.
    """
    agent = auth.agent
    org = auth.organization
    
    # Verify the requested agent matches the API key's agent
    if agent.public_id != agent_public_id:
        raise HTTPException(status_code=403, detail="API key bu agent için geçerli değil")
        
    # Determine the requested language
    requested_lang = lang
    if not requested_lang:
        requested_lang = req.headers.get("x-language") or req.headers.get("X-Language")
        
    name = agent.name
    description = agent.description
    welcome_message = agent.welcome_message
    appearance = agent.appearance or {}
    
    # Override with widget-specific settings if widgets are defined in agent.appearance
    if isinstance(agent.appearance, dict) and "widgets" in agent.appearance:
        widgets = agent.appearance.get("widgets", [])
        if widgets:
            # Find matching widget or default to the first one
            target_widget = None
            if widget_id:
                for w in widgets:
                    if w.get("id") == widget_id:
                        target_widget = w
                        break
            if not target_widget:
                target_widget = widgets[0]
                
            if target_widget:
                if target_widget.get("welcome_message"):
                    welcome_message = target_widget.get("welcome_message")
                # Exclude widgets list from response appearance
                appearance = {
                    "primary_color": target_widget.get("primary_color", "#4F46E5"),
                    "secondary_color": target_widget.get("secondary_color", "#8B5CF6"),
                    "text_color": target_widget.get("text_color", "#FFFFFF"),
                    "position": target_widget.get("position", "bottom-right"),
                    "width": target_widget.get("width", 380),
                    "height": target_widget.get("height", 520),
                    "border_radius": target_widget.get("border_radius", 16),
                    "show_branding": target_widget.get("show_branding", True),
                    "auto_open": target_widget.get("auto_open", True),
                    "auto_open_desktop": target_widget.get("auto_open_desktop", target_widget.get("auto_open", True)),
                    "auto_open_mobile": target_widget.get("auto_open_mobile", target_widget.get("auto_open", True)),
                    "layout_mode": target_widget.get("layout_mode", "floating"),
                    "auto_theme": target_widget.get("auto_theme", False),
                    "theme": target_widget.get("theme", "auto"),
                    "bg_color": target_widget.get("bg_color"),
                    "border_color": target_widget.get("border_color"),
                    "input_bg_color": target_widget.get("input_bg_color"),
                    "input_text_color": target_widget.get("input_text_color"),
                    "bg_color_dark": target_widget.get("bg_color_dark"),
                    "text_color_dark": target_widget.get("text_color_dark"),
                    "border_color_dark": target_widget.get("border_color_dark"),
                    "input_bg_color_dark": target_widget.get("input_bg_color_dark"),
                    "input_text_color_dark": target_widget.get("input_text_color_dark"),
                    "theme_style": target_widget.get("theme_style", "classic"),
                    "bubble_icon": target_widget.get("bubble_icon", "chat"),
                    "custom_icon_svg": target_widget.get("custom_icon_svg"),
                    "org_id": str(org.id),
                    "bottom_offset": target_widget.get("bottom_offset"),
                    "right_offset": target_widget.get("right_offset"),
                    "left_offset": target_widget.get("left_offset"),
                    "mobile_bottom_offset": target_widget.get("mobile_bottom_offset"),
                    "mobile_right_offset": target_widget.get("mobile_right_offset"),
                    "mobile_left_offset": target_widget.get("mobile_left_offset"),
                }
    
    # Translate default agent info for Ragleaf System Agent if requested in English
    if requested_lang == "en":
        if agent.public_id == "ag_ragleaf_system01" or "ragleaf" in agent.name.lower():
            name = "Ragleaf Assistant"
            description = "Ragleaf System Assistant"
            welcome_message = "Hello! 👋 I am Ragleaf Assistant. I can help you with platform usage, agent creation, integrations, and technical support. How can I help you?"
    
    return AgentInfoResponse(
        id=agent.public_id,
        name=name,
        description=description,
        welcome_message=welcome_message,
        appearance=appearance,
        personality={
            **(agent.personality or {}),
            "tone": (agent.personality or {}).get("tone", "professional"),
            "language": requested_lang if requested_lang in ("tr", "en") else (agent.personality or {}).get("language", "tr")
        }
    )


@public_chat_router.get("/agents/{agent_public_id}/available-slots")
async def get_available_booking_slots(
    agent_public_id: str,
    auth: AgentAuth = Depends(get_agent_from_api_key),
    db: Session = Depends(get_db)
):
    """
    Get available 1-hour booking slots for the next 7 days based on agent personality.
    Takes existing conflicting appointments into account.
    """
    agent = auth.agent
    if agent.public_id != agent_public_id:
        raise HTTPException(status_code=403, detail="API key is not valid for this agent")

    personality = agent.personality or {}
    working_days = personality.get("working_days", ["monday", "tuesday", "wednesday", "thursday", "friday"])
    start_hour_str = personality.get("working_start_hour", "09:00")
    end_hour_str = personality.get("working_end_hour", "18:00")
    duration = int(personality.get("session_duration_minutes") or 60)

    from datetime import datetime, timedelta, timezone as tz
    
    # Parse start and end working hour
    try:
        sh_parts = [int(p) for p in start_hour_str.split(":")]
        eh_parts = [int(p) for p in end_hour_str.split(":")]
    except Exception:
        sh_parts = [9, 0]
        eh_parts = [18, 0]

    # Get conflicting appointments for the next 8 days (buffer)
    now = datetime.now(tz(timedelta(hours=3)))
    start_search = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_search = start_search + timedelta(days=8)

    appointments = db.query(Appointment).filter(
        Appointment.organization_id == agent.organization_id,
        Appointment.status.in_(["pending", "confirmed"]),
        Appointment.appointment_date >= start_search,
        Appointment.appointment_date <= end_search
    ).all()

    # Create slot ranges representing conflicts
    conflict_slots = []
    for apt in appointments:
        ad = apt.appointment_date
        ae = apt.appointment_end or (ad + timedelta(minutes=(apt.duration_minutes or 60)))
        conflict_slots.append((ad, ae))

    # Day of week mapping
    dow_map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

    available_slots = []
    
    # Generate slots for next 7 days starting today
    for day_offset in range(7):
        target_day = now + timedelta(days=day_offset)
        day_name = dow_map[target_day.weekday() + 1 if target_day.weekday() < 6 else 0] # align weekday index: python weekday is Mon=0, Sun=6. JS Sunday=0, Monday=1
        # Correct align: python target_day.strftime('%A').lower()
        py_day_name = target_day.strftime('%A').lower()
        if py_day_name not in working_days:
            continue

        # Set slots boundaries
        slot_time = target_day.replace(hour=sh_parts[0], minute=sh_parts[1], second=0, microsecond=0)
        end_time_limit = target_day.replace(hour=eh_parts[0], minute=eh_parts[1], second=0, microsecond=0)

        while slot_time + timedelta(minutes=duration) <= end_time_limit:
            # Skip past slots today
            if slot_time <= now:
                slot_time += timedelta(minutes=duration)
                continue

            slot_end = slot_time + timedelta(minutes=duration)
            
            # Check conflict
            has_conflict = False
            for cs, ce in conflict_slots:
                # overlaps: max(start1, start2) < min(end1, end2)
                overlap_start = max(slot_time, cs)
                overlap_end = min(slot_end, ce)
                if overlap_start < overlap_end:
                    has_conflict = True
                    break

            if not has_conflict:
                available_slots.append(slot_time.strftime("%Y-%m-%dT%H:%M"))

            slot_time += timedelta(minutes=duration)

    return {"slots": available_slots}


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

    # --- Trial & Limits Enforcements ---
    if not getattr(org, "is_system", False):
        # 1. Check Trial Expiration (only for starter plan)
        if org.plan == "starter" and org.trial_ends_at:
            now = datetime.now(timezone.utc)
            trial_ends = org.trial_ends_at
            if trial_ends.tzinfo is None:
                trial_ends = trial_ends.replace(tzinfo=timezone.utc)
            if now > trial_ends:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
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
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Aylık sorgu limitiniz doldu ({org.max_queries_per_month}). Lütfen planınızı yükseltin."
            )
    
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

    # --- Check for PROMOTION command trigger ---
    cleaned_content = user_message.content.strip().lower()
    if cleaned_content in ("promotion", "/promotion", "promo"):
        response_text = ""
        try:
            import os
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            system_overview_path = os.path.join(base_dir, "docs", "promotions", "system_overview.md")
            
            if os.path.exists(system_overview_path):
                with open(system_overview_path, "r", encoding="utf-8") as f:
                    response_text = f.read()
            else:
                response_text = "### 🍃 Ragleaf Tanıtım ve Destek Programları\n\nDestek programları dokümanları `docs/promotions/` klasörü altında hazırlandı."
        except Exception as ex:
            response_text = f"Tanıtım dökümanları hazırlandı, ancak okunurken bir hata oldu: {ex}"
            
        response_time_ms = 5
        assistant_msg = PublicMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=response_text,
            tokens_used=0,
            model_used="system_command",
            response_time_ms=response_time_ms
        )
        db.add(assistant_msg)
        
        conversation.message_count = (conversation.message_count or 0) + 2
        conversation.last_message_at = datetime.now(timezone.utc)
        if conversation.message_count == 2:
            agent.total_conversations = (agent.total_conversations or 0) + 1
        agent.total_messages = (agent.total_messages or 0) + 2
        
        usage_log = UsageLog(
            organization_id=org.id,
            agent_id=agent.id,
            event_type="chat_query",
            tokens_used=0,
            details={
                "model": "system_command",
                "response_time_ms": response_time_ms,
                "session_id": session_id,
                "command": cleaned_content
            }
        )
        db.add(usage_log)
        db.commit()
        
        completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        return ChatCompletionResponse(
            id=completion_id,
            created=int(time.time()),
            model="system_command",
            choices=[ChatCompletionChoice(
                message=ChatCompletionMessage(role="assistant", content=response_text),
                finish_reason="stop"
            )],
            usage=ChatCompletionUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            agent_name=agent.name,
            response_time_ms=response_time_ms
        )

    # --- Check for BOOKING_FORM_SUBMITTED form submission intercept ---
    if user_message.content.strip().startswith("[BOOKING_FORM_SUBMITTED]"):
        import json
        payload_str = user_message.content.replace("[BOOKING_FORM_SUBMITTED]", "").strip()
        response_text = "Randevu kaydınız başarıyla oluşturulmuştur. Teşekkür ederiz!"
        is_turkish = (agent.personality or {}).get("language", "tr") == "tr"
        if not is_turkish:
            response_text = "Your appointment has been successfully created. Thank you!"

        try:
            apt_data = json.loads(payload_str)
            
            # Parse datetime-local string (typically YYYY-MM-DDTHH:MM)
            apt_date_str = apt_data.get("appointment_date")
            from datetime import timedelta
            apt_date = None
            for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"]:
                try:
                    apt_date = datetime.strptime(apt_date_str, fmt)
                    break
                except Exception:
                    continue
            
            if not apt_date:
                raise ValueError("Tarih formatı geçersiz")
            
            # Turkey timezone offset
            from datetime import timezone as tz
            apt_date = apt_date.replace(tzinfo=tz(timedelta(hours=3)))
            duration = int((agent.personality or {}).get("session_duration_minutes") or 60)
            apt_end = apt_date + timedelta(minutes=duration)

            # Check for conflicts if resource is specified
            resource_management_enabled = (agent.personality or {}).get("res_resource_management_enabled", False)
            selected_resource = apt_data.get("resource") if resource_management_enabled else None
            
            if selected_resource:
                from sqlalchemy import cast, String
                conflict_query = db.query(Appointment).filter(
                    Appointment.organization_id == agent.organization_id,
                    Appointment.status.in_(["pending", "confirmed"]),
                    Appointment.appointment_date < apt_end,
                    Appointment.appointment_end > apt_date
                ).filter(
                    cast(Appointment.extra_data['resource'].astext, String) == selected_resource
                )
                if conflict_query.count() > 0:
                    if is_turkish:
                        response_text = "⚠️ *Seçtiğiniz masa/alan bu saat diliminde doludur. Lütfen farklı bir saat veya masa seçin.*"
                    else:
                        response_text = "⚠️ *The selected table/area is booked for this timeframe. Please choose another slot or table.*"
                    raise ValueError("Resource conflict detected")

            apt_extra_data = {}
            if apt_data.get("party_size"):
                try:
                    apt_extra_data["party_size"] = int(apt_data["party_size"])
                except (ValueError, TypeError):
                    pass
            if selected_resource:
                apt_extra_data["resource"] = selected_resource
            if apt_data.get("guest_details"):
                apt_extra_data["guest_details"] = apt_data["guest_details"]

            is_res = (agent.personality or {}).get("reservation_module_enabled", False)
            default_svc_tr = "Masa Rezervasyonu" if is_res else "Genel Randevu"
            default_svc_en = "Table Reservation" if is_res else "General Appointment"

            appointment = Appointment(
                organization_id=agent.organization_id,
                agent_id=agent.id,
                conversation_id=conversation.id,
                customer_name=apt_data.get("customer_name") or "Misafir",
                customer_phone=apt_data.get("customer_phone"),
                customer_email=apt_data.get("customer_email"),
                customer_notes=apt_data.get("customer_notes"),
                service_type=apt_data.get("service_type") or (default_svc_tr if is_turkish else default_svc_en),
                service_details={"services": [apt_data.get("service_type") or (default_svc_tr if is_turkish else default_svc_en)]},
                appointment_date=apt_date,
                appointment_end=apt_end,
                duration_minutes=duration,
                status="pending",
                extra_data=apt_extra_data
            )
            db.add(appointment)
            db.flush()
            
            if is_turkish:
                response_text = f"✅ *Rezervasyonunuz/Randevunuz başarıyla oluşturulmuştur!* (Referans: {appointment.public_id})"
            else:
                response_text = f"✅ *Your reservation/appointment has been successfully created!* (Ref: {appointment.public_id})"
            
            logger.info(f"📅 Intercepted booking form and created appointment {appointment.public_id} with extra_data={apt_extra_data}")
        except Exception as ex:
            logger.error(f"Error handling intercepted booking form submit: {ex}")
            if is_turkish:
                response_text = "⚠️ Randevu oluşturulurken teknik bir sorun yaşandı. Lütfen tekrar deneyin."
            else:
                response_text = "⚠️ A technical problem occurred while creating the appointment. Please try again."

        response_time_ms = int((time.time() - start_time) * 1000)
        assistant_msg = PublicMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=response_text,
            tokens_used=0,
            model_used="form_handler",
            response_time_ms=response_time_ms
        )
        db.add(assistant_msg)
        
        conversation.message_count = (conversation.message_count or 0) + 2
        conversation.last_message_at = datetime.now(timezone.utc)
        if conversation.message_count == 2:
            agent.total_conversations = (agent.total_conversations or 0) + 1
        agent.total_messages = (agent.total_messages or 0) + 2

        usage_log = UsageLog(
            organization_id=org.id,
            agent_id=agent.id,
            event_type="chat_query",
            tokens_used=0,
            details={
                "model": "form_handler",
                "response_time_ms": response_time_ms,
                "session_id": session_id
            }
        )
        db.add(usage_log)
        
        # Increment Ragleaf leaves
        org.ragleaf_leaves = (org.ragleaf_leaves or 0) + 1
        db.add(org)
        db.commit()

        completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        return ChatCompletionResponse(
            id=completion_id,
            created=int(time.time()),
            model="form_handler",
            choices=[ChatCompletionChoice(
                message=ChatCompletionMessage(role="assistant", content=response_text),
                finish_reason="stop"
            )],
            usage=ChatCompletionUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            agent_name=agent.name,
            response_time_ms=response_time_ms
        )

    # --- Build RAG Context ---
    context = ""
    sources = []
    
    try:
        context, sources = await _build_rag_context(agent, user_message.content, db)
    except Exception as e:
        logger.error(f"RAG context error for agent {agent.id}: {e}")
    
    # Determine widget_id and override module flags
    widget_id = None
    requested_lang = None
    if request.metadata and isinstance(request.metadata, dict):
        widget_id = request.metadata.get("widget_id")
        requested_lang = request.metadata.get("lang")
    if not requested_lang:
        requested_lang = req.headers.get("x-language") or req.headers.get("X-Language")

    # --- Build System Prompt ---
    system_prompt = _build_system_prompt(agent, context, requested_lang=requested_lang, widget_id=widget_id)
    
    # --- Build Messages for LLM ---
    llm_messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history (last N messages from request)
    for msg in request.messages[:-1]:
        role = "assistant" if msg.role in ("bot", "assistant") else msg.role
        llm_messages.append({"role": role, "content": msg.content})
    
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
    
    # --- Post-process: Extract Appointment & Sponsorship Deals ---
    response_text = await _process_appointment_from_response(
        response_text, agent, conversation, db, widget_id=widget_id
    )
    response_text = await _process_sponsorship_from_response(
        response_text, agent, conversation, db
    )
    
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
    
    # Increment Ragleaf leaves for the organization (1 leaf per chat query)
    org.ragleaf_leaves = (org.ragleaf_leaves or 0) + 1
    db.add(org)
    
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
    
    doc_ids = []
    
    # 1. Custom agent documents
    kb_links = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.agent_id == agent.id
    ).all()
    for link in kb_links:
        doc_ids.append(link.document_id)
        
    # 2. Template documents
    template_slug = (agent.personality or {}).get("template_slug")
    if template_slug:
        template = db.query(AgentTemplate).filter(AgentTemplate.slug == template_slug).first()
        if template:
            template_doc_links = db.query(AgentTemplateDocument).filter(
                AgentTemplateDocument.template_id == template.id
            ).all()
            for t_link in template_doc_links:
                if t_link.document_id not in doc_ids:
                    doc_ids.append(t_link.document_id)
                    
    if not doc_ids:
        return "", []
    
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


def _build_system_prompt(agent: Agent, context: str, requested_lang: Optional[str] = None, widget_id: Optional[str] = None) -> str:
    """Build the full system prompt for the agent with RAG context."""
    personality = agent.personality or {}
    
    # Resolve widget-specific overrides for modules if widget_id is provided
    appointment_module_enabled = personality.get("appointment_module_enabled", False)
    reservation_module_enabled = personality.get("reservation_module_enabled", False)
    order_module_enabled = personality.get("order_module_enabled", False)
    lead_module_enabled = personality.get("lead_module_enabled", False)
    
    if widget_id and isinstance(agent.appearance, dict) and "widgets" in agent.appearance:
        for w in agent.appearance.get("widgets", []):
            if w.get("id") == widget_id:
                appointment_module_enabled = w.get("appointment_module_enabled", appointment_module_enabled)
                reservation_module_enabled = w.get("reservation_module_enabled", reservation_module_enabled)
                order_module_enabled = w.get("order_module_enabled", order_module_enabled)
                lead_module_enabled = w.get("lead_module_enabled", lead_module_enabled)
                break

    tone = personality.get("tone", "professional")
    
    # Override language if requested_lang is provided and valid (e.g. "tr", "en")
    language = requested_lang if requested_lang in ("tr", "en") else personality.get("language", "tr")
    if not language or language == "auto":
        language = "tr"
        
    response_style = personality.get("response_style", "balanced")
    
    # Base system prompt
    base_prompt = agent.system_prompt or f"Sen {agent.name} adlı bir AI asistansın."
    if language == "en" and (agent.public_id == "ag_ragleaf_system01" or "ragleaf" in agent.name.lower()):
        base_prompt = "You are an AI assistant named Ragleaf Assistant. Help the user with platform features, code integrations, and sadakat (leaves) loyalty system."
    
    # Add tone instructions
    tone_instructions_tr = {
        "professional": "Profesyonel ve resmi bir dil kullan.",
        "friendly": "Samimi ve sıcak bir dil kullan, ama bilgilendirici ol.",
        "casual": "Rahat ve günlük bir dil kullan."
    }
    
    tone_instructions_en = {
        "professional": "Use a professional and formal tone.",
        "friendly": "Use a friendly and warm tone, but be informative.",
        "casual": "Use a relaxed and casual tone."
    }
    
    style_instructions_tr = {
        "concise": "Yanıtlarını kısa ve öz tut.",
        "detailed": "Detaylı ve kapsamlı yanıtlar ver.",
        "balanced": "Yanıtlarını dengeli tut — gerektiğinde detay ver, gerektiğinde özet."
    }
    
    style_instructions_en = {
        "concise": "Keep your responses short and concise.",
        "detailed": "Provide detailed and comprehensive responses.",
        "balanced": "Keep your responses balanced — provide details when needed, summarize when appropriate."
    }
    
    language_instructions = {
        "tr": "Her zaman Türkçe yanıt ver.",
        "en": "Always respond in English.",
        "auto": "Kullanıcının dilinde yanıt ver."
    }
    
    # Select instructions based on language
    tone_instructions = tone_instructions_en if language == "en" else tone_instructions_tr
    style_instructions = style_instructions_en if language == "en" else style_instructions_tr
    
    system = f"""{base_prompt}

{tone_instructions.get(tone, "")}
{style_instructions.get(response_style, "")}
{language_instructions.get(language, language_instructions["tr"])}
"""
    
    # Add appointment instructions for template-based agents or when appointment/reservation module is enabled
    template_slug = personality.get("template_slug")
    if template_slug or appointment_module_enabled or reservation_module_enabled:
        is_reservation = reservation_module_enabled and not appointment_module_enabled
        
        w_days = personality.get("res_working_days") or personality.get("working_days", ["monday", "tuesday", "wednesday", "thursday", "friday"])
        w_start = personality.get("res_working_start_hour") or personality.get("working_start_hour", "09:00")
        w_end = personality.get("res_working_end_hour") or personality.get("working_end_hour", "18:00")
        
        apt_type = personality.get("appointment_type", "face_to_face")
        if is_reservation:
            apt_type = "face_to_face"
            
        resource_enabled = personality.get("res_resource_management_enabled")
        if resource_enabled is None:
            resource_enabled = personality.get("resource_management_enabled", False)
            
        resources = personality.get("res_resources")
        if resources is None:
            resources = personality.get("resources", [])
        
        resource_names = []
        resource_details_str_tr = []
        resource_details_str_en = []
        if resources:
            for r in resources:
                if isinstance(r, dict):
                    name = r.get("name")
                    min_cap = r.get("min_capacity", 1)
                    max_cap = r.get("max_capacity", 10)
                    if name:
                        resource_names.append(name)
                        resource_details_str_tr.append(f"{name} ({min_cap}-{max_cap} kişilik)")
                        resource_details_str_en.append(f"{name} (for {min_cap}-{max_cap} people)")
                elif isinstance(r, str):
                    resource_names.append(r)
                    resource_details_str_tr.append(r)
                    resource_details_str_en.append(r)

        resources_list_tr = ", ".join(resource_details_str_tr)
        resources_list_en = ", ".join(resource_details_str_en)

        days_map_tr = {"monday": "Pazartesi", "tuesday": "Salı", "wednesday": "Çarşamba", "thursday": "Perşembe", "friday": "Cuma", "saturday": "Cumartesi", "sunday": "Pazar"}
        days_map_en = {"monday": "Monday", "tuesday": "Tuesday", "wednesday": "Wednesday", "thursday": "Thursday", "friday": "Friday", "saturday": "Saturday", "sunday": "Sunday"}
        active_days_tr = ", ".join([days_map_tr.get(d, d) for d in w_days])
        active_days_en = ", ".join([days_map_en.get(d, d) for d in w_days])

        capacity_mode = personality.get("res_capacity_mode") or personality.get("capacity_mode", "single")
        max_capacity = personality.get("res_max_capacity") or personality.get("max_capacity_per_booking", 10)

        # Build type instructions
        type_inst_en = ""
        type_inst_tr = ""
        if apt_type == "online":
            type_inst_en = "- All appointments are conducted ONLINE. Inform the customer."
            type_inst_tr = "- Tüm randevular ONLINE (çevrimiçi) olarak gerçekleştirilecektir. Müşteriyi bu konuda bilgilendir."
        elif apt_type == "face_to_face":
            type_inst_en = "- All appointments/reservations are conducted IN-PERSON at our physical location."
            type_inst_tr = "- Tüm randevu/rezervasyonlar YÜZ YÜZE (fiziksel olarak) iş yerimizde gerçekleştirilecektir."
        elif apt_type == "visitor_choice":
            type_inst_en = "- Ask the customer whether they prefer an Online or In-Person (face_to_face) meeting, and save the chosen value in 'meeting_type' field of the JSON."
            type_inst_tr = "- Müşteriye randevuyu Online mı yoksa Yüz yüze mi istediklerini sor ve seçilen değeri JSON'daki 'meeting_type' alanına ('online' veya 'face_to_face' olarak) kaydet."

        # Build resource instructions
        res_inst_en = ""
        res_inst_tr = ""
        if resource_enabled and resource_names:
            if is_reservation:
                res_inst_en = f"- We have the following tables/areas available: {resources_list_en}. Ask the customer if they have a table/area preference or assign an available one automatically. Write the chosen table/area in the 'resource' field of the JSON."
                res_inst_tr = f"- Kafe/Restoranımızda şu masalar/alanlar mevcuttur: {resources_list_tr}. Müşteriye bir masa/alan tercihi olup olmadığını sor veya boş olan bir masayı ata. Seçilen masayı/alanı JSON'daki 'resource' alanına yaz."
            else:
                res_inst_en = f"- We have the following resources/staff available: {resources_list_en}. Ask the customer if they have a preference or assign an available one automatically. Write the chosen resource/staff in the 'resource' field of the JSON."
                res_inst_tr = f"- İşletmemizde şu kaynaklar/personeller mevcuttur: {resources_list_tr}. Müşteriye bir kaynak/personel tercihi olup olmadığını sor veya boş olanı ata. Seçilen kaynağı/personeli JSON'daki 'resource' alanına yaz."

        # Reservation specific capacity/guest rules
        res_rules_en = ""
        res_rules_tr = ""
        if is_reservation:
            min_booking_size = int(personality.get("res_min_booking_size") or 1)
            if min_booking_size >= 2:
                res_rules_en += f"\n- Minimum party size for a reservation is {min_booking_size} people. Do NOT accept single-person bookings."
                res_rules_tr += f"\n- Rezervasyonlar için minimum kişi sayısı {min_booking_size}'dir. Tek kişilik rezervasyonları kesinlikle kabul etme."
            if personality.get("res_require_all_guest_details"):
                res_rules_en += "\n- We require the name and contact details (phone or email) of ALL guests in the party. Ask for guest names/contacts."
                res_rules_tr += "\n- Gruptaki TÜM misafirlerin isim ve iletişim (telefon veya e-posta) bilgilerinin girilmesi zorunludur. Tüm katılımcıların bilgilerini iste."

        # Build capacity instructions
        if language == "en":
            system += f"""
## {'RESERVATION' if is_reservation else 'APPOINTMENT'} SYSTEM INSTRUCTIONS
If the customer expresses interest in {'booking a table or making a reservation' if is_reservation else 'booking an appointment or scheduling a session/visit'}, you MUST prompt them by ending your response with the exact tag: `[SHOW_BOOKING_FORM]`.
Once this tag is appended to your message, the system will automatically display an interactive booking form to the customer.

RULES:
- When they mention booking or scheduling, write a short inviting message and output `[SHOW_BOOKING_FORM]` at the end of the text.
- Do NOT output any JSON code blocks.{res_rules_en}
"""
        else:
            system += f"""
## {'REZERVASYON' if is_reservation else 'RANDEVU'} SİSTEMİ TALİMATI
Eğer müşteri {'masa rezervasyonu yapmak veya yer ayırtmak' if is_reservation else 'randevu almak, seans planlamak veya ziyaret kaydı oluşturmak'} istediğini belirtirse, yanıtınızın sonuna mutlaka şu etiketi eklemelisiniz: `[SHOW_BOOKING_FORM]`.
Bu etiketi yanıtınızın sonuna eklediğinizde, sistem kullanıcıya otomatik olarak doldurabileceği interaktif bir randevu/rezervasyon formu sunacaktır.

KURALLAR:
- Kullanıcı randevu veya rezervasyondan bahsettiği anda, kısa ve davetkar bir mesaj yazıp yanıtın sonuna `[SHOW_BOOKING_FORM]` ekleyin.
- Kesinlikle herhangi bir JSON kod bloğu üretmeyin.{res_rules_tr}
"""
    
    # Add RAG context
    if context:
        if language == "en":
            system += f"""
Answer the user's question using the following knowledge base contents.
For topics not found in the knowledge base, respond based on your general knowledge and the information in the system prompt.

--- KNOWLEDGE BASE ---
{context}
--- END OF KNOWLEDGE BASE ---
"""
        else:
            system += f"""
Aşağıdaki bilgi tabanı içeriklerini kullanarak kullanıcının sorusunu yanıtla.
Bilgi tabanında bulunmayan konularda genel bilgin ve sistem promptundaki bilgilere dayanarak yanıt ver.

--- BİLGİ TABANI ---
{context}
--- BİLGİ TABANI SONU ---
"""
    else:
        fallback = (agent.personality or {}).get(
            "fallback_message",
            ""
        )
        if language == "en":
            system += f"""
No documents are available in the knowledge base yet. Respond according to the following rules:
1. Help the user based on the information in the system prompt and your general knowledge.
2. Try to understand the user's question and provide a helpful response as much as possible.
3. If you have no knowledge about the question or it's a very specific topic, state this politely.
"""
            if fallback:
                system += f"4. In situations where you truly cannot respond, suggest: '{fallback}'\n"
        else:
            system += f"""
Bilgi tabanında henüz doküman bulunmuyor. Aşağıdaki kurallara göre yanıt ver:
1. Sistem promptundaki bilgilere ve genel bilgine dayanarak kullanıcıya yardımcı ol.
2. Kullanıcının sorusunu anlamaya çalış ve mümkün olduğunca faydalı bir yanıt ver.
3. Eğer soru hakkında hiçbir bilgin yoksa veya çok spesifik bir konuysa, bunu nazikçe belirt.
"""
            if fallback:
                system += f"4. Gerçekten yanıt veremediğin durumlarda şunu öner: '{fallback}'\n"
    
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


# ============================================================================
# Appointment Extraction from LLM Response
# ============================================================================

import re
from datetime import timedelta

async def _process_appointment_from_response(
    response_text: str,
    agent: Agent,
    conversation: PublicConversation,
    db: Session,
    widget_id: Optional[str] = None
) -> str:
    """
    Detect APPOINTMENT_JSON block in LLM response.
    If found, create a real Appointment in DB and remove the JSON block from response.
    Returns cleaned response text.
    """
    # Check if this agent uses templates or has appointment module enabled
    personality = agent.personality or {}
    
    # Resolve widget override
    appointment_module_enabled = personality.get("appointment_module_enabled", False)
    if widget_id and isinstance(agent.appearance, dict) and "widgets" in agent.appearance:
        for w in agent.appearance.get("widgets", []):
            if w.get("id") == widget_id:
                appointment_module_enabled = w.get("appointment_module_enabled", appointment_module_enabled)
                break

    if not personality.get("template_slug") and not appointment_module_enabled:
        return response_text
    
    # Look for APPOINTMENT_JSON block
    pattern = r'```APPOINTMENT_JSON\s*\n?(.*?)\n?\s*```'
    match = re.search(pattern, response_text, re.DOTALL)
    
    if not match:
        return response_text
    
    json_str = match.group(1).strip()
    
    try:
        apt_data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse appointment JSON: {e}")
        # Remove the malformed JSON block from response
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned
    
    # Validate required fields
    required = ["customer_name", "customer_phone", "appointment_date", "service_type"]
    missing = [f for f in required if not apt_data.get(f)]
    if missing:
        logger.warning(f"Appointment JSON missing fields: {missing}")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned
    
    # Parse appointment date
    try:
        apt_date_str = apt_data["appointment_date"]
        # Handle various formats
        apt_date = None
        for fmt in [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
        ]:
            try:
                apt_date = datetime.strptime(apt_date_str, fmt)
                break
            except ValueError:
                continue
        
        if not apt_date:
            raise ValueError(f"Cannot parse date: {apt_date_str}")
        
        # Make timezone aware (assume Turkey timezone +03:00)
        if apt_date.tzinfo is None:
            from datetime import timezone as tz
            apt_date = apt_date.replace(tzinfo=tz(timedelta(hours=3)))
        
    except (ValueError, KeyError) as e:
        logger.warning(f"Invalid appointment date: {e}")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned
    
    # Check if it's in the future
    now = datetime.now(timezone.utc)
    if apt_date <= now:
        logger.warning(f"Appointment date is in the past: {apt_date}")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned
    
    duration = apt_data.get("duration_minutes", 60)
    apt_end = apt_date + timedelta(minutes=duration)
    
    is_reservation = personality.get("reservation_module_enabled", False)
    resource_management_enabled = personality.get("res_resource_management_enabled")
    if resource_management_enabled is None:
        resource_management_enabled = personality.get("resource_management_enabled", False)
        
    selected_resource = apt_data.get("resource") if resource_management_enabled else None

    # Check resource capacities
    if selected_resource and is_reservation:
        resources = personality.get("res_resources") or []
        matched_res = None
        for r in resources:
            if isinstance(r, dict) and r.get("name") == selected_resource:
                matched_res = r
                break
        if matched_res:
            try:
                party_size = int(apt_data.get("party_size") or 1)
            except (ValueError, TypeError):
                party_size = 1
            min_cap = int(matched_res.get("min_capacity") or 1)
            max_cap = int(matched_res.get("max_capacity") or 999)
            if not (min_cap <= party_size <= max_cap):
                logger.warning(f"Resource capacity mismatch for resource {selected_resource}: party_size={party_size}, capacity={min_cap}-{max_cap}")
                cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
                cleaned += f"\n\n⚠️ *Not: Seçilen masa/alan ({selected_resource}) {party_size} kişilik grup için uygun değildir. Bu masa {min_cap}-{max_cap} kişi kabul etmektedir.*"
                return cleaned

    # Base query for overlapping appointments
    conflict_query = db.query(Appointment).filter(
        Appointment.organization_id == agent.organization_id,
        Appointment.status.in_(["pending", "confirmed"]),
        Appointment.appointment_date < apt_end,
        Appointment.appointment_end > apt_date
    )

    if resource_management_enabled and selected_resource:
        from sqlalchemy import cast, String
        # Check conflicts only for the SAME resource
        conflict_query = conflict_query.filter(
            cast(Appointment.extra_data['resource'].astext, String) == selected_resource
        )
    
    conflicts = conflict_query.count()
    
    if conflicts > 0:
        logger.info(f"Appointment conflict detected for {apt_date} (Resource: {selected_resource})")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        cleaned += "\n\n⚠️ *Not: Bu zaman diliminde başka bir randevu/rezervasyon mevcut. Lütfen farklı bir saat deneyin.*"
        return cleaned
    
    # Create appointment
    try:
        apt_extra_data = {}
        if apt_data.get("meeting_type"):
            apt_extra_data["meeting_type"] = apt_data["meeting_type"]
        if selected_resource:
            apt_extra_data["resource"] = selected_resource
        if apt_data.get("party_size"):
            try:
                apt_extra_data["party_size"] = int(apt_data["party_size"])
            except (ValueError, TypeError):
                pass
        if apt_data.get("guest_details"):
            apt_extra_data["guest_details"] = apt_data["guest_details"]

        appointment = Appointment(
            organization_id=agent.organization_id,
            agent_id=agent.id,
            conversation_id=conversation.id,
            customer_name=apt_data["customer_name"],
            customer_phone=apt_data.get("customer_phone"),
            customer_email=apt_data.get("customer_email"),
            customer_notes=apt_data.get("customer_notes"),
            service_type=apt_data["service_type"],
            service_details={"services": [apt_data["service_type"]]},
            appointment_date=apt_date,
            appointment_end=apt_end,
            duration_minutes=duration,
            status="pending",
            extra_data=apt_extra_data
        )
        db.add(appointment)
        db.flush()
        
        logger.info(
            f"📅 Appointment created from chat: {appointment.public_id} "
            f"customer={apt_data['customer_name']} date={apt_date} "
            f"service={apt_data['service_type']} agent={agent.name} extra={apt_extra_data}"
        )
        
        # Remove JSON block and add confirmation badge
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        cleaned += f"\n\n✅ *Randevu talebiniz başarıyla alındı! (Referans: {appointment.public_id})*"
        
        return cleaned
        
    except Exception as e:
        logger.error(f"Failed to create appointment from chat: {e}")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned


async def _process_sponsorship_from_response(
    response_text: str,
    agent: Agent,
    conversation: PublicConversation,
    db: Session
) -> str:
    """
    Detect SPONSORSHIP_JSON block in LLM response.
    If found, create a real SponsorshipDeal in DB and remove the JSON block.
    Returns cleaned response text with a confirmation reference.
    """
    # Look for SPONSORSHIP_JSON block
    pattern = r'```SPONSORSHIP_JSON\s*\n?(.*?)\n?\s*```'
    match = re.search(pattern, response_text, re.DOTALL)
    
    if not match:
        return response_text
        
    json_str = match.group(1).strip()
    
    try:
        deal_data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse sponsorship JSON: {e}")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned
        
    # Validate required fields
    required = ["sponsor_name", "product_name", "price"]
    missing = [f for f in required if not deal_data.get(f)]
    if missing:
        logger.warning(f"Sponsorship JSON missing fields: {missing}")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned
        
    try:
        from backend.database.models_platform import SponsorshipDeal
        
        deal = SponsorshipDeal(
            organization_id=agent.organization_id,
            agent_id=agent.id,
            conversation_id=conversation.id,
            sponsor_name=deal_data["sponsor_name"],
            sponsor_email=deal_data.get("sponsor_email"),
            product_name=deal_data["product_name"],
            product_category=deal_data.get("product_category"),
            proposed_platforms=deal_data.get("proposed_platforms", []),
            price=deal_data["price"],
            status="pending"
        )
        db.add(deal)
        db.flush()
        
        logger.info(
            f"🔮 Sponsorship deal proposed: {deal.public_id} "
            f"sponsor={deal.sponsor_name} product={deal.product_name} price={deal.price}"
        )
        
        # Remove JSON block and append confirmation
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        cleaned += f"\n\n✅ *Sponsorluk teklifiniz başarıyla oluşturuldu! (Teklif Ref: {deal.public_id})*"
        
        return cleaned
    except Exception as e:
        logger.error(f"Failed to create sponsorship deal from chat: {e}")
        cleaned = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        return cleaned
