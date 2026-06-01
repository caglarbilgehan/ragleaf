# backend/services/rag_analytics_service.py
"""
RAG Analytics Service.
Tracks and analyzes RAG query performance and usage.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, distinct
from datetime import datetime, timedelta
import logging

from backend.database.models_v2 import RAGQueryLog, RAGFeedback, RAGDailyMetrics, Document

logger = logging.getLogger(__name__)


class RAGAnalyticsService:
    """Service for RAG analytics and tracking"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def log_query(
        self,
        query_id: str,
        query_text: str,
        user_id: int = None,
        language: str = "tr",
        chunks_retrieved: int = 0,
        best_score: float = None,
        confidence_level: str = None,
        documents_used: List[Dict] = None,
        rag_duration_ms: int = None,
        llm_duration_ms: int = None,
        total_duration_ms: int = None,
        success: bool = True,
        fallback_reason: str = None,
    ) -> RAGQueryLog:
        """Log a RAG query for analytics"""
        try:
            log_entry = RAGQueryLog(
                query_id=query_id,
                user_id=user_id,
                query_text=query_text,
                language=language,
                chunks_retrieved=chunks_retrieved,
                best_score=best_score,
                confidence_level=confidence_level,
                documents_used=documents_used or [],
                rag_duration_ms=rag_duration_ms,
                llm_duration_ms=llm_duration_ms,
                total_duration_ms=total_duration_ms,
                success=success,
                fallback_reason=fallback_reason,
            )
            self.db.add(log_entry)
            self.db.commit()
            logger.info(f"📊 RAG query logged: {query_id}")
            return log_entry
        except Exception as e:
            logger.error(f"❌ Failed to log RAG query: {e}")
            self.db.rollback()
            return None
    
    async def log_feedback(
        self,
        query_id: str,
        rating: int,
        user_id: int = None,
        comment: str = None,
    ) -> RAGFeedback:
        """Log user feedback for a RAG response"""
        try:
            # Check if query exists
            query = self.db.query(RAGQueryLog).filter(
                RAGQueryLog.query_id == query_id
            ).first()
            
            if not query:
                logger.warning(f"⚠️ Query not found for feedback: {query_id}")
                return None
            
            # Check if feedback already exists
            existing = self.db.query(RAGFeedback).filter(
                RAGFeedback.query_id == query_id
            ).first()
            
            if existing:
                # Update existing feedback
                existing.rating = rating
                existing.comment = comment
                self.db.commit()
                logger.info(f"📊 RAG feedback updated: {query_id}")
                return existing
            
            # Create new feedback
            feedback = RAGFeedback(
                query_id=query_id,
                user_id=user_id,
                rating=rating,
                comment=comment,
            )
            self.db.add(feedback)
            self.db.commit()
            logger.info(f"📊 RAG feedback logged: {query_id}, rating={rating}")
            return feedback
        except Exception as e:
            logger.error(f"❌ Failed to log RAG feedback: {e}")
            self.db.rollback()
            return None
    
    def get_overview_stats(self) -> Dict[str, Any]:
        """Get overview statistics for dashboard"""
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        
        # Today's stats
        today_queries = self.db.query(RAGQueryLog).filter(
            RAGQueryLog.created_at >= today_start
        ).all()
        
        today_total = len(today_queries)
        today_success = sum(1 for q in today_queries if q.success)
        today_avg_duration = sum(q.total_duration_ms or 0 for q in today_queries) / max(today_total, 1)
        today_users = len(set(q.user_id for q in today_queries if q.user_id))
        
        # Week's stats
        week_queries = self.db.query(RAGQueryLog).filter(
            RAGQueryLog.created_at >= week_start
        ).all()
        
        week_total = len(week_queries)
        week_success = sum(1 for q in week_queries if q.success)
        
        # Previous week for trend
        prev_week_start = week_start - timedelta(days=7)
        prev_week_queries = self.db.query(RAGQueryLog).filter(
            and_(
                RAGQueryLog.created_at >= prev_week_start,
                RAGQueryLog.created_at < week_start
            )
        ).count()
        
        trend = ((week_total - prev_week_queries) / max(prev_week_queries, 1)) * 100
        
        # Feedback stats
        feedback_stats = self.db.query(
            func.sum(func.case((RAGFeedback.rating == 1, 1), else_=0)).label('likes'),
            func.sum(func.case((RAGFeedback.rating == -1, 1), else_=0)).label('dislikes'),
        ).first()
        
        likes = feedback_stats.likes or 0
        dislikes = feedback_stats.dislikes or 0
        total_feedback = likes + dislikes
        satisfaction_rate = likes / max(total_feedback, 1)
        
        return {
            "today": {
                "total_queries": today_total,
                "success_rate": today_success / max(today_total, 1),
                "avg_duration_ms": int(today_avg_duration),
                "unique_users": today_users,
            },
            "week": {
                "total_queries": week_total,
                "success_rate": week_success / max(week_total, 1),
                "trend": f"{'+' if trend >= 0 else ''}{trend:.0f}%",
            },
            "feedback": {
                "likes": likes,
                "dislikes": dislikes,
                "satisfaction_rate": satisfaction_rate,
            }
        }
    
    def get_document_stats(self, period_days: int = 30) -> Dict[str, Any]:
        """Get document usage statistics"""
        start_date = datetime.utcnow() - timedelta(days=period_days)
        
        # Get all queries in period
        queries = self.db.query(RAGQueryLog).filter(
            RAGQueryLog.created_at >= start_date,
            RAGQueryLog.success == True
        ).all()
        
        # Aggregate document usage
        doc_usage = {}
        for query in queries:
            for doc in (query.documents_used or []):
                doc_id = doc.get("doc_id")
                if doc_id:
                    if doc_id not in doc_usage:
                        doc_usage[doc_id] = {
                            "document_id": doc_id,
                            "document_name": doc.get("doc_name", "Unknown"),
                            "query_count": 0,
                            "total_score": 0,
                            "last_used": None,
                        }
                    doc_usage[doc_id]["query_count"] += 1
                    doc_usage[doc_id]["total_score"] += doc.get("score", 0)
                    query_time = query.created_at
                    if not doc_usage[doc_id]["last_used"] or query_time > doc_usage[doc_id]["last_used"]:
                        doc_usage[doc_id]["last_used"] = query_time
        
        # Calculate averages and sort
        top_documents = []
        for doc_id, data in doc_usage.items():
            data["avg_score"] = data["total_score"] / max(data["query_count"], 1)
            del data["total_score"]
            if data["last_used"]:
                data["last_used"] = data["last_used"].isoformat()
            top_documents.append(data)
        
        top_documents.sort(key=lambda x: x["query_count"], reverse=True)
        
        # Usage trend by day
        usage_trend = []
        for i in range(period_days):
            day = datetime.utcnow() - timedelta(days=period_days - i - 1)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            count = self.db.query(RAGQueryLog).filter(
                and_(
                    RAGQueryLog.created_at >= day_start,
                    RAGQueryLog.created_at < day_end
                )
            ).count()
            
            usage_trend.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "count": count
            })
        
        return {
            "top_documents": top_documents[:10],
            "usage_trend": usage_trend,
        }
    
    def get_unfound_queries(self, limit: int = 20) -> Dict[str, Any]:
        """Get queries that didn't find relevant results"""
        # Get failed queries or low confidence queries
        unfound = self.db.query(RAGQueryLog).filter(
            or_(
                RAGQueryLog.success == False,
                RAGQueryLog.confidence_level == "none",
                RAGQueryLog.confidence_level == "low",
                RAGQueryLog.fallback_reason.isnot(None)
            )
        ).order_by(desc(RAGQueryLog.created_at)).limit(100).all()
        
        # Group by similar queries
        query_groups = {}
        for q in unfound:
            # Simple grouping by first 50 chars
            key = q.query_text[:50].lower().strip()
            if key not in query_groups:
                query_groups[key] = {
                    "query_text": q.query_text,
                    "count": 0,
                    "last_asked": None,
                    "reasons": set(),
                }
            query_groups[key]["count"] += 1
            if not query_groups[key]["last_asked"] or q.created_at > query_groups[key]["last_asked"]:
                query_groups[key]["last_asked"] = q.created_at
            if q.fallback_reason:
                query_groups[key]["reasons"].add(q.fallback_reason)
        
        # Convert to list and sort
        unfound_queries = []
        for key, data in query_groups.items():
            data["reasons"] = list(data["reasons"])
            if data["last_asked"]:
                data["last_asked"] = data["last_asked"].isoformat()
            # Generate suggested action
            if "benzerlik" in str(data["reasons"]).lower():
                data["suggested_action"] = "İlgili döküman ekleyin veya mevcut dökümanları güncelleyin"
            elif "boş" in str(data["reasons"]).lower():
                data["suggested_action"] = "Dökümanları indeksleyin"
            else:
                data["suggested_action"] = "Sorguyu analiz edin ve içerik ekleyin"
            unfound_queries.append(data)
        
        unfound_queries.sort(key=lambda x: x["count"], reverse=True)
        
        # Calculate unfound rate
        total_queries = self.db.query(RAGQueryLog).count()
        unfound_count = len(unfound)
        
        return {
            "unfound_queries": unfound_queries[:limit],
            "total_unfound": unfound_count,
            "unfound_rate": unfound_count / max(total_queries, 1),
        }
    
    def get_performance_metrics(self, period_days: int = 7) -> Dict[str, Any]:
        """Get performance metrics"""
        start_date = datetime.utcnow() - timedelta(days=period_days)
        
        queries = self.db.query(RAGQueryLog).filter(
            RAGQueryLog.created_at >= start_date
        ).all()
        
        if not queries:
            return {
                "avg_total_duration_ms": 0,
                "avg_rag_duration_ms": 0,
                "avg_llm_duration_ms": 0,
                "avg_chunks_retrieved": 0,
                "score_distribution": {},
                "success_rate": 0,
            }
        
        # Calculate averages
        total_durations = [q.total_duration_ms for q in queries if q.total_duration_ms]
        rag_durations = [q.rag_duration_ms for q in queries if q.rag_duration_ms]
        llm_durations = [q.llm_duration_ms for q in queries if q.llm_duration_ms]
        chunks = [q.chunks_retrieved for q in queries if q.chunks_retrieved]
        scores = [q.best_score for q in queries if q.best_score]
        
        # Score distribution
        score_dist = {"0-0.3": 0, "0.3-0.5": 0, "0.5-0.7": 0, "0.7-0.9": 0, "0.9-1.0": 0}
        for score in scores:
            if score < 0.3:
                score_dist["0-0.3"] += 1
            elif score < 0.5:
                score_dist["0.3-0.5"] += 1
            elif score < 0.7:
                score_dist["0.5-0.7"] += 1
            elif score < 0.9:
                score_dist["0.7-0.9"] += 1
            else:
                score_dist["0.9-1.0"] += 1
        
        success_count = sum(1 for q in queries if q.success)
        
        return {
            "avg_total_duration_ms": int(sum(total_durations) / max(len(total_durations), 1)),
            "avg_rag_duration_ms": int(sum(rag_durations) / max(len(rag_durations), 1)),
            "avg_llm_duration_ms": int(sum(llm_durations) / max(len(llm_durations), 1)),
            "avg_chunks_retrieved": sum(chunks) / max(len(chunks), 1),
            "avg_best_score": sum(scores) / max(len(scores), 1),
            "score_distribution": score_dist,
            "success_rate": success_count / len(queries),
            "total_queries": len(queries),
        }
    
    def get_feedback_stats(self, period_days: int = 30) -> Dict[str, Any]:
        """Get feedback statistics"""
        start_date = datetime.utcnow() - timedelta(days=period_days)
        
        feedback = self.db.query(RAGFeedback).filter(
            RAGFeedback.created_at >= start_date
        ).all()
        
        likes = sum(1 for f in feedback if f.rating == 1)
        dislikes = sum(1 for f in feedback if f.rating == -1)
        
        # Get negative feedback with comments
        negative_feedback = []
        for f in feedback:
            if f.rating == -1:
                query = self.db.query(RAGQueryLog).filter(
                    RAGQueryLog.query_id == f.query_id
                ).first()
                negative_feedback.append({
                    "query_id": f.query_id,
                    "query_text": query.query_text if query else "Unknown",
                    "comment": f.comment,
                    "created_at": f.created_at.isoformat() if f.created_at else None,
                })
        
        # Trend by day
        trend = []
        for i in range(min(period_days, 14)):
            day = datetime.utcnow() - timedelta(days=period_days - i - 1)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            day_feedback = [f for f in feedback if day_start <= f.created_at < day_end]
            day_likes = sum(1 for f in day_feedback if f.rating == 1)
            day_dislikes = sum(1 for f in day_feedback if f.rating == -1)
            
            trend.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "likes": day_likes,
                "dislikes": day_dislikes,
            })
        
        return {
            "total_feedback": len(feedback),
            "likes": likes,
            "dislikes": dislikes,
            "satisfaction_rate": likes / max(len(feedback), 1),
            "negative_feedback": negative_feedback[:10],
            "trend": trend,
        }


# Import for or_ usage
from sqlalchemy import or_
