# backend/services/mongodb_integration_service.py
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import requests
from decouple import config

logger = logging.getLogger(__name__)

class MongoDBIntegrationService:
    """MongoDB (ChatUI) ile SQLite (Statistics) entegrasyonu"""
    
    def __init__(self):
        # ChatUI MongoDB connection bilgileri
        self.chatui_api_base = config("CHATUI_API_BASE", default="http://localhost:3001/api/v2")
        
    async def get_conversation_data(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """MongoDB'den conversation verilerini al"""
        try:
            # ChatUI API'sinden conversation bilgilerini al
            response = requests.get(
                f"{self.chatui_api_base}/conversations/{conversation_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Conversation {conversation_id} not found in MongoDB")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching conversation {conversation_id}: {e}")
            return None
    
    async def get_user_conversations(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Kullanıcının tüm sohbetlerini al"""
        try:
            response = requests.get(
                f"{self.chatui_api_base}/conversations",
                params={"user_id": user_id, "limit": limit},
                timeout=15
            )
            
            if response.status_code == 200:
                return response.json().get("conversations", [])
            else:
                logger.warning(f"No conversations found for user {user_id}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching user conversations {user_id}: {e}")
            return []
    
    async def get_conversation_messages(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Sohbetin tüm mesajlarını al"""
        try:
            response = requests.get(
                f"{self.chatui_api_base}/conversations/{conversation_id}/messages",
                timeout=15
            )
            
            if response.status_code == 200:
                return response.json().get("messages", [])
            else:
                logger.warning(f"No messages found for conversation {conversation_id}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching messages for conversation {conversation_id}: {e}")
            return []
    
    async def sync_conversation_statistics(self, conversation_id: str) -> Dict[str, Any]:
        """MongoDB'deki conversation'ı SQLite istatistiklerine sync et"""
        try:
            # MongoDB'den conversation verilerini al
            conversation_data = await self.get_conversation_data(conversation_id)
            if not conversation_data:
                return {"success": False, "error": "Conversation not found"}
            
            # Messages'ları al
            messages = await self.get_conversation_messages(conversation_id)
            
            # İstatistikleri hesapla
            stats = self._calculate_conversation_statistics(conversation_data, messages)
            
            # SQLite'a kaydet (StatisticsService kullanarak)
            from .enhanced_statistics_service import EnhancedStatisticsService
            await EnhancedStatisticsService.sync_conversation_from_mongodb(
                conversation_id=conversation_id,
                conversation_data=conversation_data,
                messages=messages,
                calculated_stats=stats
            )
            
            return {"success": True, "stats": stats}
            
        except Exception as e:
            logger.error(f"Error syncing conversation {conversation_id}: {e}")
            return {"success": False, "error": str(e)}
    
    def _calculate_conversation_statistics(self, conversation_data: Dict, messages: List[Dict]) -> Dict[str, Any]:
        """Conversation istatistiklerini hesapla"""
        stats = {
            "total_messages": len(messages),
            "user_messages": 0,
            "assistant_messages": 0,
            "total_tokens_sent": 0,
            "total_tokens_received": 0,
            "total_response_time": 0.0,
            "avg_response_time": 0.0,
            "rag_sources_used": 0,
            "avg_context_chars": 0.0
        }
        
        response_times = []
        context_chars = []
        
        for message in messages:
            role = message.get("role", "")
            content = message.get("content", "")
            
            if role == "user":
                stats["user_messages"] += 1
                # Basit token tahmini (kelime sayısı)
                stats["total_tokens_sent"] += len(content.split())
            elif role == "assistant":
                stats["assistant_messages"] += 1
                stats["total_tokens_received"] += len(content.split())
                
                # Response time (eğer timestamp'ler varsa)
                if "response_time" in message:
                    response_times.append(message["response_time"])
                
                # RAG context bilgileri
                if "rag_context" in message:
                    rag_context = message["rag_context"]
                    if isinstance(rag_context, str):
                        context_chars.append(len(rag_context))
                    stats["rag_sources_used"] += message.get("rag_sources_count", 0)
        
        # Ortalama hesaplamaları
        if response_times:
            stats["avg_response_time"] = sum(response_times) / len(response_times)
            stats["total_response_time"] = sum(response_times)
        
        if context_chars:
            stats["avg_context_chars"] = sum(context_chars) / len(context_chars)
        
        return stats
    
    async def sync_user_statistics(self, user_id: str, date_range_days: int = 30) -> Dict[str, Any]:
        """Kullanıcının istatistiklerini MongoDB'den sync et"""
        try:
            # Son X gündeki conversations'ları al
            conversations = await self.get_user_conversations(user_id, limit=1000)
            
            # Tarih filtresi uygula
            cutoff_date = datetime.utcnow() - timedelta(days=date_range_days)
            recent_conversations = []
            
            for conv in conversations:
                conv_date = self._parse_date(conv.get("created_at") or conv.get("updatedAt"))
                if conv_date and conv_date >= cutoff_date:
                    recent_conversations.append(conv)
            
            # Her conversation için istatistikleri sync et
            total_synced = 0
            for conv in recent_conversations:
                conv_id = conv.get("_id") or conv.get("id")
                if conv_id:
                    result = await self.sync_conversation_statistics(conv_id)
                    if result.get("success"):
                        total_synced += 1
            
            return {
                "success": True,
                "user_id": user_id,
                "total_conversations": len(conversations),
                "recent_conversations": len(recent_conversations),
                "synced_conversations": total_synced
            }
            
        except Exception as e:
            logger.error(f"Error syncing user statistics {user_id}: {e}")
            return {"success": False, "error": str(e)}
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Tarih string'ini datetime'a çevir"""
        if not date_str:
            return None
        
        try:
            # MongoDB date formatları
            formats = [
                "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d"
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            
            logger.warning(f"Could not parse date: {date_str}")
            return None
            
        except Exception as e:
            logger.error(f"Error parsing date {date_str}: {e}")
            return None
