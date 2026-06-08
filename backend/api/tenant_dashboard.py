# backend/api/tenant_dashboard.py
"""
Tenant Dashboard API for Ragleaf platform.
Provides org-level statistics, usage data, and conversation history.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date

from backend.database.connection import get_db
from backend.database.models_platform import (
    Organization, Agent, AgentKnowledgeBase, AgentAPIKey,
    PublicConversation, PublicMessage, UsageLog
)
from backend.database.models_v2 import Document
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org

logger = logging.getLogger(__name__)

tenant_dashboard_router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class DashboardStats(BaseModel):
    agent_count: int = 0
    active_agent_count: int = 0
    document_count: int = 0
    total_conversations: int = 0
    total_messages: int = 0
    total_queries_this_month: int = 0
    total_tokens_this_month: int = 0
    # Plan limits
    max_agents: int = 3
    max_documents: int = 50
    max_queries_per_month: int = 1000
    plan: str = "free"
    ragleaf_leaves: int = 0


class DailyUsage(BaseModel):
    date: str
    queries: int = 0
    tokens: int = 0


class AgentSummary(BaseModel):
    id: int
    name: str
    public_id: str
    is_active: bool
    total_conversations: int = 0
    total_messages: int = 0
    document_count: int = 0
    api_key_count: int = 0
    appearance: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class ConversationSummary(BaseModel):
    id: str
    agent_name: str
    agent_id: int
    session_id: str
    message_count: int = 0
    status: str = "active"
    started_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    first_message_preview: Optional[str] = None


# ============================================================================
# Dashboard Endpoints
# ============================================================================

@tenant_dashboard_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Get organization dashboard statistics."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Agent counts
    agent_count = db.query(Agent).filter(Agent.organization_id == org.id).count()
    active_agent_count = db.query(Agent).filter(
        Agent.organization_id == org.id,
        Agent.is_active == True
    ).count()
    
    # Document count (org-scoped)
    document_count = db.query(Document).filter(
        Document.organization_id == org.id
    ).count()
    
    # Conversation & message counts
    agent_ids = [a.id for a in db.query(Agent.id).filter(Agent.organization_id == org.id).all()]
    
    total_conversations = 0
    total_messages = 0
    if agent_ids:
        total_conversations = db.query(PublicConversation).filter(
            PublicConversation.agent_id.in_(agent_ids)
        ).count()
        
        total_messages = db.query(PublicMessage).join(PublicConversation).filter(
            PublicConversation.agent_id.in_(agent_ids)
        ).count()
    
    # This month's usage
    monthly_usage = db.query(
        func.count(UsageLog.id),
        func.coalesce(func.sum(UsageLog.tokens_used), 0)
    ).filter(
        UsageLog.organization_id == org.id,
        UsageLog.event_type == "chat_query",
        UsageLog.created_at >= month_start
    ).first()
    
    queries_this_month = monthly_usage[0] if monthly_usage else 0
    tokens_this_month = int(monthly_usage[1]) if monthly_usage else 0
    
    return DashboardStats(
        agent_count=agent_count,
        active_agent_count=active_agent_count,
        document_count=document_count,
        total_conversations=total_conversations,
        total_messages=total_messages,
        total_queries_this_month=queries_this_month,
        total_tokens_this_month=tokens_this_month,
        max_agents=org.max_agents,
        max_documents=org.max_documents,
        max_queries_per_month=org.max_queries_per_month,
        plan=org.plan,
        ragleaf_leaves=org.ragleaf_leaves
    )


@tenant_dashboard_router.get("/usage", response_model=List[DailyUsage])
async def get_usage_history(
    days: int = Query(default=30, ge=1, le=90),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Get daily usage history for the organization."""
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # Query daily aggregation
    daily_stats = db.query(
        cast(UsageLog.created_at, Date).label("date"),
        func.count(UsageLog.id).label("queries"),
        func.coalesce(func.sum(UsageLog.tokens_used), 0).label("tokens")
    ).filter(
        UsageLog.organization_id == org.id,
        UsageLog.event_type == "chat_query",
        UsageLog.created_at >= start_date
    ).group_by(
        cast(UsageLog.created_at, Date)
    ).order_by(
        cast(UsageLog.created_at, Date)
    ).all()
    
    # Build date map
    stats_map = {str(row.date): {"queries": row.queries, "tokens": int(row.tokens)} for row in daily_stats}
    
    # Fill in missing dates with zeros
    result = []
    for i in range(days):
        date = (start_date + timedelta(days=i)).date()
        date_str = str(date)
        stats = stats_map.get(date_str, {"queries": 0, "tokens": 0})
        result.append(DailyUsage(date=date_str, **stats))
    
    return result


@tenant_dashboard_router.get("/agents", response_model=List[AgentSummary])
async def get_agent_summaries(
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Get summary of all agents in the organization."""
    agents = db.query(Agent).filter(
        Agent.organization_id == org.id
    ).order_by(Agent.created_at.desc()).all()
    
    result = []
    for agent in agents:
        doc_count = db.query(AgentKnowledgeBase).filter(
            AgentKnowledgeBase.agent_id == agent.id
        ).count()
        
        key_count = db.query(AgentAPIKey).filter(
            AgentAPIKey.agent_id == agent.id,
            AgentAPIKey.is_active == True
        ).count()
        
        result.append(AgentSummary(
            id=agent.id,
            name=agent.name,
            public_id=agent.public_id,
            is_active=agent.is_active,
            total_conversations=agent.total_conversations or 0,
            total_messages=agent.total_messages or 0,
            document_count=doc_count,
            api_key_count=key_count,
            appearance=agent.appearance,
            created_at=agent.created_at
        ))
    
    return result


@tenant_dashboard_router.get("/conversations", response_model=List[ConversationSummary])
async def get_conversations(
    agent_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Get conversations for the organization, optionally filtered by agent."""
    # Get org's agent IDs
    agent_ids_query = db.query(Agent.id).filter(Agent.organization_id == org.id)
    
    if agent_id:
        # Verify agent belongs to org
        agent_ids_query = agent_ids_query.filter(Agent.id == agent_id)
    
    agent_ids = [a.id for a in agent_ids_query.all()]
    
    if not agent_ids:
        return []
    
    # Build conversation query
    query = db.query(PublicConversation).filter(
        PublicConversation.agent_id.in_(agent_ids)
    )
    
    if status_filter:
        query = query.filter(PublicConversation.status == status_filter)
    
    conversations = query.order_by(
        PublicConversation.last_message_at.desc().nullslast()
    ).offset(offset).limit(limit).all()
    
    # Build response with agent names
    agent_name_map = {}
    for agent in db.query(Agent).filter(Agent.id.in_(agent_ids)).all():
        agent_name_map[agent.id] = agent.name
    
    result = []
    for conv in conversations:
        # Get first user message as preview
        first_msg = db.query(PublicMessage).filter(
            PublicMessage.conversation_id == conv.id,
            PublicMessage.role == "user"
        ).order_by(PublicMessage.created_at).first()
        
        preview = None
        if first_msg:
            preview = first_msg.content[:150] + "..." if len(first_msg.content) > 150 else first_msg.content
        
        result.append(ConversationSummary(
            id=str(conv.id),
            agent_name=agent_name_map.get(conv.agent_id, "Unknown"),
            agent_id=conv.agent_id,
            session_id=conv.session_id,
            message_count=conv.message_count or 0,
            status=conv.status or "active",
            started_at=conv.started_at,
            last_message_at=conv.last_message_at,
            first_message_preview=preview
        ))
    
    return result


@tenant_dashboard_router.get("/conversations/{session_id}/messages")
async def get_conversation_messages(
    session_id: str,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    """Get all messages in a conversation (for tenant review)."""
    # Get org's agent IDs
    agent_ids = [a.id for a in db.query(Agent.id).filter(Agent.organization_id == org.id).all()]
    
    if not agent_ids:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı")
    
    import uuid
    from sqlalchemy import or_
    
    is_uuid = False
    uuid_obj = None
    try:
        uuid_obj = uuid.UUID(session_id)
        is_uuid = True
    except ValueError:
        pass

    if is_uuid:
        conversation = db.query(PublicConversation).filter(
            PublicConversation.agent_id.in_(agent_ids),
            or_(
                PublicConversation.session_id == session_id,
                PublicConversation.id == uuid_obj
            )
        ).first()
    else:
        conversation = db.query(PublicConversation).filter(
            PublicConversation.session_id == session_id,
            PublicConversation.agent_id.in_(agent_ids)
        ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı")
    
    messages = db.query(PublicMessage).filter(
        PublicMessage.conversation_id == conversation.id
    ).order_by(PublicMessage.created_at).all()
    
    return {
        "session_id": session_id,
        "agent_id": conversation.agent_id,
        "status": conversation.status,
        "started_at": conversation.started_at.isoformat() if conversation.started_at else None,
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "sources": msg.rag_sources,
                "model": msg.model_used,
                "tokens": msg.tokens_used,
                "response_time_ms": msg.response_time_ms,
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            }
            for msg in messages
        ],
        "total": len(messages)
    }
