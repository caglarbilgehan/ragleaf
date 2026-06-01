"""
Web Search Service - DuckDuckGo ile web arama
"""
import aiohttp
import asyncio
from typing import List, Dict, Any, Optional
import logging
from urllib.parse import quote_plus
import json

logger = logging.getLogger(__name__)

class WebSearchService:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.timeout = aiohttp.ClientTimeout(total=10)
        
    async def get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        return self.session
    
    async def search(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        DuckDuckGo ile web arama yap
        """
        try:
            session = await self.get_session()
            
            # DuckDuckGo Instant Answer API kullan
            search_url = f"https://api.duckduckgo.com/?q={quote_plus(query)}&format=json&no_html=1&skip_disambig=1"
            
            async with session.get(search_url) as response:
                if response.status == 200:
                    data = await response.json()
                    results = []
                    
                    # Abstract (özet) varsa ekle
                    if data.get("Abstract"):
                        results.append({
                            "title": data.get("AbstractSource", "DuckDuckGo"),
                            "snippet": data.get("Abstract", ""),
                            "url": data.get("AbstractURL", ""),
                            "source": "abstract"
                        })
                    
                    # Related topics ekle
                    for topic in data.get("RelatedTopics", [])[:max_results-1]:
                        if isinstance(topic, dict) and topic.get("Text"):
                            results.append({
                                "title": topic.get("FirstURL", "").split("/")[-1].replace("_", " "),
                                "snippet": topic.get("Text", ""),
                                "url": topic.get("FirstURL", ""),
                                "source": "related"
                            })
                    
                    # Eğer yeterli sonuç yoksa, alternatif arama yap
                    if len(results) < 2:
                        alternative_results = await self._search_alternative(query, max_results)
                        results.extend(alternative_results)
                    
                    return results[:max_results]
                else:
                    logger.warning(f"DuckDuckGo search failed with status: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Web search error: {str(e)}")
            return []
    
    async def _search_alternative(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """
        Alternatif arama yöntemi (basit web scraping)
        """
        try:
            # Bu kısım daha gelişmiş web scraping için genişletilebilir
            # Şimdilik basit mock data döndür
            return [
                {
                    "title": f"Web Sonucu: {query}",
                    "snippet": f"'{query}' ile ilgili güncel bilgiler web'de bulunabilir.",
                    "url": f"https://www.google.com/search?q={quote_plus(query)}",
                    "source": "fallback"
                }
            ]
        except Exception as e:
            logger.error(f"Alternative search error: {str(e)}")
            return []
    
    async def close(self):
        """
        Session'ı kapat
        """
        if self.session and not self.session.closed:
            await self.session.close()
    
    def __del__(self):
        """
        Destructor - session'ı temizle
        """
        if hasattr(self, 'session') and self.session and not self.session.closed:
            try:
                asyncio.create_task(self.session.close())
            except:
                pass
