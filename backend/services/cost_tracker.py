# backend/services/cost_tracker.py
"""
Cost Tracker Service for Multi-Modal RAG.
Tracks API usage and enforces budget limits.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging

from backend.database.models_v2 import MultiModalUsage, MultiModalSettings
from .multimodal import BudgetExceededError

logger = logging.getLogger(__name__)


class CostTracker:
    """
    Tracks multi-modal API costs and enforces budget limits.
    """
    
    def __init__(self, db: Session):
        """
        Initialize Cost Tracker.
        
        Args:
            db: Database session
        """
        self.db = db
        self._settings: Optional[MultiModalSettings] = None
    
    def _load_settings(self) -> MultiModalSettings:
        """Load settings from database"""
        if self._settings is None:
            self._settings = self.db.query(MultiModalSettings).first()
            if self._settings is None:
                # Create default settings
                self._settings = MultiModalSettings(
                    enabled=False,
                    daily_budget_usd=10.0,
                    monthly_budget_usd=100.0
                )
                self.db.add(self._settings)
                self.db.commit()
        return self._settings
    
    async def log_usage(
        self,
        provider: str,
        model: str,
        tokens_used: int,
        cost_usd: float,
        image_count: int,
        query_id: str = None,
        user_id: int = None
    ) -> None:
        """
        Log API usage.
        
        Args:
            provider: Provider name (openai, anthropic, google)
            model: Model name
            tokens_used: Total tokens used
            cost_usd: Cost in USD
            image_count: Number of images processed
            query_id: Optional query identifier
            user_id: Optional user ID
        """
        usage = MultiModalUsage(
            provider=provider,
            model=model,
            tokens_used=tokens_used,
            cost_usd=cost_usd,
            image_count=image_count,
            query_id=query_id,
            user_id=user_id
        )
        
        self.db.add(usage)
        self.db.commit()
        
        logger.info(
            f"📊 Logged usage: {provider}/{model} - "
            f"{tokens_used} tokens, ${cost_usd:.6f}, {image_count} images"
        )
    
    async def get_daily_usage(self, date: datetime = None) -> Dict[str, Any]:
        """
        Get usage statistics for a specific day.
        
        Args:
            date: Date to query (default: today)
            
        Returns:
            Usage statistics
        """
        if date is None:
            date = datetime.now(timezone.utc)
        
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        # Query usage
        result = self.db.query(
            func.count(MultiModalUsage.id).label("total_requests"),
            func.sum(MultiModalUsage.tokens_used).label("total_tokens"),
            func.sum(MultiModalUsage.cost_usd).label("total_cost"),
            func.sum(MultiModalUsage.image_count).label("total_images")
        ).filter(
            MultiModalUsage.created_at >= start_of_day,
            MultiModalUsage.created_at < end_of_day
        ).first()
        
        return {
            "period": "daily",
            "date": start_of_day.isoformat(),
            "total_requests": result.total_requests or 0,
            "total_tokens": result.total_tokens or 0,
            "total_cost_usd": float(result.total_cost or 0),
            "total_images": result.total_images or 0,
        }
    
    async def get_monthly_usage(self, year: int = None, month: int = None) -> Dict[str, Any]:
        """
        Get usage statistics for a specific month.
        
        Args:
            year: Year (default: current year)
            month: Month (default: current month)
            
        Returns:
            Usage statistics
        """
        now = datetime.now(timezone.utc)
        if year is None:
            year = now.year
        if month is None:
            month = now.month
        
        start_of_month = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        # Query usage
        result = self.db.query(
            func.count(MultiModalUsage.id).label("total_requests"),
            func.sum(MultiModalUsage.tokens_used).label("total_tokens"),
            func.sum(MultiModalUsage.cost_usd).label("total_cost"),
            func.sum(MultiModalUsage.image_count).label("total_images")
        ).filter(
            MultiModalUsage.created_at >= start_of_month,
            MultiModalUsage.created_at < end_of_month
        ).first()
        
        return {
            "period": "monthly",
            "year": year,
            "month": month,
            "total_requests": result.total_requests or 0,
            "total_tokens": result.total_tokens or 0,
            "total_cost_usd": float(result.total_cost or 0),
            "total_images": result.total_images or 0,
        }
    
    async def get_usage_by_provider(self, days: int = 30) -> Dict[str, Any]:
        """
        Get usage breakdown by provider.
        
        Args:
            days: Number of days to look back
            
        Returns:
            Usage breakdown by provider
        """
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        results = self.db.query(
            MultiModalUsage.provider,
            func.count(MultiModalUsage.id).label("total_requests"),
            func.sum(MultiModalUsage.tokens_used).label("total_tokens"),
            func.sum(MultiModalUsage.cost_usd).label("total_cost"),
            func.sum(MultiModalUsage.image_count).label("total_images")
        ).filter(
            MultiModalUsage.created_at >= start_date
        ).group_by(
            MultiModalUsage.provider
        ).all()
        
        breakdown = {}
        for row in results:
            breakdown[row.provider] = {
                "total_requests": row.total_requests or 0,
                "total_tokens": row.total_tokens or 0,
                "total_cost_usd": float(row.total_cost or 0),
                "total_images": row.total_images or 0,
            }
        
        return {
            "period_days": days,
            "breakdown": breakdown,
        }
    
    async def check_budget(self, estimated_cost: float) -> bool:
        """
        Check if estimated cost is within budget.
        
        Args:
            estimated_cost: Estimated cost in USD
            
        Returns:
            True if within budget
            
        Raises:
            BudgetExceededError: If budget would be exceeded
        """
        settings = self._load_settings()
        
        # Get current usage
        daily_usage = await self.get_daily_usage()
        monthly_usage = await self.get_monthly_usage()
        
        # Check daily budget
        daily_remaining = settings.daily_budget_usd - daily_usage["total_cost_usd"]
        if estimated_cost > daily_remaining:
            raise BudgetExceededError(
                f"Daily budget exceeded. Remaining: ${daily_remaining:.4f}, "
                f"Estimated: ${estimated_cost:.4f}"
            )
        
        # Check monthly budget
        monthly_remaining = settings.monthly_budget_usd - monthly_usage["total_cost_usd"]
        if estimated_cost > monthly_remaining:
            raise BudgetExceededError(
                f"Monthly budget exceeded. Remaining: ${monthly_remaining:.4f}, "
                f"Estimated: ${estimated_cost:.4f}"
            )
        
        return True
    
    async def get_remaining_budget(self) -> Dict[str, float]:
        """
        Get remaining budget for daily and monthly limits.
        
        Returns:
            Remaining budget amounts
        """
        settings = self._load_settings()
        
        daily_usage = await self.get_daily_usage()
        monthly_usage = await self.get_monthly_usage()
        
        return {
            "daily_budget_usd": settings.daily_budget_usd,
            "daily_used_usd": daily_usage["total_cost_usd"],
            "daily_remaining_usd": max(0, settings.daily_budget_usd - daily_usage["total_cost_usd"]),
            "monthly_budget_usd": settings.monthly_budget_usd,
            "monthly_used_usd": monthly_usage["total_cost_usd"],
            "monthly_remaining_usd": max(0, settings.monthly_budget_usd - monthly_usage["total_cost_usd"]),
        }
    
    async def get_recent_usage(self, limit: int = 50) -> list:
        """
        Get recent usage records.
        
        Args:
            limit: Maximum number of records
            
        Returns:
            List of recent usage records
        """
        records = self.db.query(MultiModalUsage).order_by(
            MultiModalUsage.created_at.desc()
        ).limit(limit).all()
        
        return [
            {
                "id": r.id,
                "provider": r.provider,
                "model": r.model,
                "tokens_used": r.tokens_used,
                "cost_usd": r.cost_usd,
                "image_count": r.image_count,
                "query_id": r.query_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
