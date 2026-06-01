"""
Query Processing Service for Enhanced RAG Performance
Gelişmiş RAG performansı için sorgu işleme servisi
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ConfidenceLevel(Enum):
    """RAG yanıt güven seviyeleri"""
    HIGH = "high"        # Embedding yüksek + keyword yüksek -> Normal RAG yanıtı
    MEDIUM = "medium"    # Embedding orta + keyword orta -> Uyarılı yanıt
    LOW = "low"          # Embedding yüksek + keyword düşük -> Halüinasyon riski
    NONE = "none"        # Embedding düşük -> Fallback to chat


@dataclass
class RelevanceScore:
    """Chunk-query ilişki skoru"""
    embedding_score: float      # Semantic benzerlik (0-1)
    keyword_overlap: float      # Keyword eşleşme oranı (0-1)
    hybrid_score: float         # Kombine skor (0-1)
    confidence_level: ConfidenceLevel
    matched_keywords: List[str]  # Eşleşen kelimeler
    warning_message: Optional[str] = None

@dataclass
class QueryAnalysis:
    """Query analiz sonuçları"""
    original_query: str
    processed_query: str
    query_type: str  # question, keyword, phrase, command
    keywords: List[str]
    entities: List[str]
    intent: str
    confidence: float
    should_expand: bool

class QueryProcessor:
    """Gelişmiş sorgu işleme servisi"""
    
    def __init__(self):
        self.min_query_length = 3
        self.max_query_length = 1000
        
        # Türkçe stop words
        self.turkish_stop_words = {
            'bir', 'bu', 'da', 'de', 'den', 'dır', 'dir', 'için', 'ile', 'mi', 'mu', 'mü',
            've', 'veya', 'ya', 'ama', 'fakat', 'ancak', 'lakin', 'çünkü', 'zira',
            'ne', 'nedir', 'nasıl', 'neden', 'niçin', 'kim', 'kime', 'kimin', 'hangi',
            'şu', 'o', 'ben', 'sen', 'biz', 'siz', 'onlar'
        }
        
        # Query türü patterns
        self.question_patterns = [
            r'\b(ne|nedir|nasıl|neden|niçin|kim|hangi|kaç|ne zaman|nerede)\b',
            r'\?$',
            r'\b(açıkla|anlat|söyle|göster|bul)\b'
        ]
        
        # Entity patterns (basit NER)
        self.entity_patterns = {
            'date': r'\b(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4})\b',
            'number': r'\b\d+(?:[.,]\d+)?\b',
            'percentage': r'\b\d+(?:[.,]\d+)?%\b',
            'currency': r'\b\d+(?:[.,]\d+)?\s*(?:TL|₺|USD|\$|EUR|€)\b'
        }
    
    def analyze_query(self, query: str) -> QueryAnalysis:
        """Sorguyu kapsamlı analiz et"""
        if not query or not query.strip():
            return QueryAnalysis(
                original_query=query,
                processed_query="",
                query_type="empty",
                keywords=[],
                entities=[],
                intent="unknown",
                confidence=0.0,
                should_expand=False
            )
        
        original_query = query.strip()
        
        # Temel temizlik
        processed_query = self._clean_query(original_query)
        
        # Query türünü belirle
        query_type = self._detect_query_type(processed_query)
        
        # Anahtar kelimeleri çıkar
        keywords = self._extract_keywords(processed_query)
        
        # Entity'leri bul
        entities = self._extract_entities(processed_query)
        
        # Intent'i belirle
        intent = self._detect_intent(processed_query, query_type)
        
        # Confidence hesapla
        confidence = self._calculate_confidence(processed_query, keywords, entities)
        
        # Expansion gerekli mi?
        should_expand = self._should_expand_query(processed_query, keywords)
        
        return QueryAnalysis(
            original_query=original_query,
            processed_query=processed_query,
            query_type=query_type,
            keywords=keywords,
            entities=entities,
            intent=intent,
            confidence=confidence,
            should_expand=should_expand
        )
    
    def _clean_query(self, query: str) -> str:
        """Query'yi temizle ve normalize et"""
        # Fazla boşlukları temizle
        query = re.sub(r'\s+', ' ', query)
        
        # Özel karakterleri temizle ama soru işareti kalsın
        query = re.sub(r'[^\w\s\?.,!-]', '', query)
        
        # Türkçe karakterleri koru
        query = query.strip()
        
        return query
    
    def _detect_query_type(self, query: str) -> str:
        """Query türünü belirle"""
        query_lower = query.lower()
        
        # Soru mu?
        for pattern in self.question_patterns:
            if re.search(pattern, query_lower):
                return "question"
        
        # Komut mu?
        command_words = ['göster', 'bul', 'ara', 'listele', 'hesapla', 'çıkar']
        if any(word in query_lower for word in command_words):
            return "command"
        
        # Kelime sayısına göre
        word_count = len(query.split())
        if word_count <= 3:
            return "keyword"
        else:
            return "phrase"
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Anahtar kelimeleri çıkar"""
        words = re.findall(r'\b\w+\b', query.lower())
        
        # Stop words'leri filtrele
        keywords = [word for word in words 
                   if word not in self.turkish_stop_words 
                   and len(word) > 2]
        
        return keywords
    
    def _extract_entities(self, query: str) -> List[str]:
        """Named entity'leri çıkar"""
        entities = []
        
        for entity_type, pattern in self.entity_patterns.items():
            matches = re.findall(pattern, query, re.IGNORECASE)
            for match in matches:
                entities.append(f"{entity_type}:{match}")
        
        return entities
    
    def _detect_intent(self, query: str, query_type: str) -> str:
        """Query intent'ini belirle"""
        query_lower = query.lower()
        
        # Bilgi arama
        if any(word in query_lower for word in ['nedir', 'ne', 'açıkla', 'anlat']):
            return "information_seeking"
        
        # Prosedür/nasıl yapılır
        if any(word in query_lower for word in ['nasıl', 'adım', 'süreç', 'yöntem']):
            return "procedural"
        
        # Karşılaştırma
        if any(word in query_lower for word in ['fark', 'karşılaştır', 'hangisi', 'arasında']):
            return "comparison"
        
        # Hesaplama
        if any(word in query_lower for word in ['hesapla', 'toplam', 'miktar', 'kaç']):
            return "calculation"
        
        return "general"
    
    def _calculate_confidence(self, query: str, keywords: List[str], entities: List[str]) -> float:
        """Query confidence'ını hesapla"""
        confidence = 0.5  # Base confidence
        
        # Uzunluk bonusu
        if len(query) >= 10:
            confidence += 0.2
        
        # Keyword bonusu
        if len(keywords) >= 2:
            confidence += 0.2
        
        # Entity bonusu
        if entities:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _should_expand_query(self, query: str, keywords: List[str]) -> bool:
        """Query expansion gerekli mi?"""
        # Çok kısa query'ler expand edilmeli
        if len(keywords) <= 1:
            return True
        
        # Çok genel terimler varsa expand et
        general_terms = ['bilgi', 'veri', 'sistem', 'uygulama', 'program']
        if any(term in keywords for term in general_terms):
            return True
        
        return False
    
    def expand_query(self, analysis: QueryAnalysis) -> List[str]:
        """Query'yi genişlet - alternatif arama terimleri üret"""
        if not analysis.should_expand:
            return [analysis.processed_query]
        
        expanded_queries = [analysis.processed_query]
        
        # Synonym expansion (basit)
        synonyms = {
            'bilgi': ['veri', 'enformasyon', 'detay'],
            'sistem': ['uygulama', 'platform', 'yazılım'],
            'hesap': ['hesaplama', 'işlem', 'matematik'],
            'rapor': ['döküman', 'belge', 'analiz']
        }
        
        for keyword in analysis.keywords:
            if keyword in synonyms:
                for synonym in synonyms[keyword]:
                    new_query = analysis.processed_query.replace(keyword, synonym)
                    if new_query != analysis.processed_query:
                        expanded_queries.append(new_query)
        
        return expanded_queries[:3]  # En fazla 3 alternatif
    
    def prepare_for_embedding(self, analysis: QueryAnalysis) -> str:
        """Embedding için query'yi hazırla"""
        # Eğer query çok kısa ise, context ekle
        if len(analysis.processed_query) < self.min_query_length:
            return f"Kullanıcı sorusu: {analysis.processed_query}"
        
        # Intent'e göre context ekle
        if analysis.intent == "information_seeking":
            return f"Bilgi arama: {analysis.processed_query}"
        elif analysis.intent == "procedural":
            return f"Nasıl yapılır: {analysis.processed_query}"
        elif analysis.intent == "comparison":
            return f"Karşılaştırma: {analysis.processed_query}"
        
        return analysis.processed_query

    def calculate_keyword_overlap(
        self, 
        query_keywords: List[str], 
        chunk_text: str
    ) -> tuple[float, List[str]]:
        """
        Sorgu kelimelerinin chunk içinde geçip geçmediğini hesapla
        
        Returns:
            (overlap_ratio, matched_keywords)
        """
        if not query_keywords:
            return 0.0, []
        
        chunk_lower = chunk_text.lower()
        matched = []
        
        for keyword in query_keywords:
            keyword_lower = keyword.lower()
            # Tam kelime eşleşmesi veya kısmi eşleşme
            if keyword_lower in chunk_lower:
                matched.append(keyword)
            # Türkçe kök eşleşmesi (basit)
            elif len(keyword_lower) > 4:
                # Kelimenin ilk 4+ karakteri ile ara
                stem = keyword_lower[:min(len(keyword_lower)-1, 5)]
                if stem in chunk_lower:
                    matched.append(keyword)
        
        overlap_ratio = len(matched) / len(query_keywords) if query_keywords else 0.0
        return overlap_ratio, matched
    
    def calculate_hybrid_score(
        self,
        embedding_score: float,
        keyword_overlap: float,
        embedding_weight: float = 0.6,
        keyword_weight: float = 0.4
    ) -> float:
        """
        Embedding ve keyword skorlarını birleştir
        """
        return (embedding_score * embedding_weight) + (keyword_overlap * keyword_weight)
    
    def determine_confidence_level(
        self,
        embedding_score: float,
        keyword_overlap: float,
        min_threshold: float = 0.65
    ) -> tuple[ConfidenceLevel, Optional[str]]:
        """
        Embedding ve keyword skorlarına göre güven seviyesi belirle
        
        Returns:
            (confidence_level, warning_message)
        """
        # Yüksek Güven: Threshold'un belirgin şekilde üzerinde
        high_threshold = min_threshold + 0.1
        if embedding_score >= high_threshold and keyword_overlap >= 0.3:
            return ConfidenceLevel.HIGH, None
        
        # Orta Güven: Threshold'un üzerinde
        if embedding_score >= min_threshold and keyword_overlap >= 0.2:
            return ConfidenceLevel.MEDIUM, "Bu bilgi tam olarak sorgunuzla eşleşmeyebilir."
        
        # Düşük Güven: Threshold'un üzerinde ama keyword düşük
        if embedding_score >= min_threshold and keyword_overlap < 0.2:
            return ConfidenceLevel.LOW, "Dikkat: Doğrudan ilgili bilgi bulunamadı. Aşağıdaki sonuçlar en yakın eşleşmelerdir."
        
        # Güven Yok: Threshold'un altında
        return ConfidenceLevel.NONE, "Bu konuda dokümanlarda bilgi bulunamadı."
    
    def evaluate_chunk_relevance(
        self,
        query: str,
        chunk_text: str,
        embedding_score: float,
        min_threshold: float = 0.65
    ) -> RelevanceScore:
        """
        Bir chunk'ın sorguyla ne kadar ilgili olduğunu değerlendir
        
        Args:
            query: Kullanıcı sorgusu
            chunk_text: Doküman chunk içeriği
            embedding_score: Semantic benzerlik skoru (0-1)
        
        Returns:
            RelevanceScore objesi
        """
        # Query'den keyword'leri çıkar
        query_analysis = self.analyze_query(query)
        query_keywords = query_analysis.keywords
        
        # Keyword overlap hesapla
        keyword_overlap, matched_keywords = self.calculate_keyword_overlap(
            query_keywords, chunk_text
        )
        
        # Hybrid skor hesapla
        hybrid_score = self.calculate_hybrid_score(embedding_score, keyword_overlap)
        
        # Güven seviyesi belirle
        confidence_level, warning_message = self.determine_confidence_level(
            embedding_score, keyword_overlap, min_threshold
        )
        
        return RelevanceScore(
            embedding_score=embedding_score,
            keyword_overlap=keyword_overlap,
            hybrid_score=hybrid_score,
            confidence_level=confidence_level,
            matched_keywords=matched_keywords,
            warning_message=warning_message
        )
    
    def evaluate_search_results(
        self,
        query: str,
        results: List[tuple],  # [(chunk_text, embedding_score), ...]
        min_threshold: float = 0.65
    ) -> tuple[List[dict], ConfidenceLevel, Optional[str]]:
        """
        Tüm arama sonuçlarını değerlendir ve genel güven seviyesi belirle
        
        Args:
            query: Kullanıcı sorgusu
            results: [(chunk_text, embedding_score), ...] listesi
        
        Returns:
            (evaluated_results, overall_confidence, warning_message)
        """
        if not results:
            return [], ConfidenceLevel.NONE, "Dokümanlarda ilgili bilgi bulunamadı."
        
        evaluated = []
        confidence_levels = []
        
        for chunk_text, embedding_score in results:
            relevance = self.evaluate_chunk_relevance(query, chunk_text, embedding_score, min_threshold)
            evaluated.append({
                'chunk_text': chunk_text,
                'relevance': relevance
            })
            confidence_levels.append(relevance.confidence_level)
        
        # En iyi güven seviyesini bul
        level_priority = {
            ConfidenceLevel.HIGH: 4,
            ConfidenceLevel.MEDIUM: 3,
            ConfidenceLevel.LOW: 2,
            ConfidenceLevel.NONE: 1
        }
        
        best_level = max(confidence_levels, key=lambda x: level_priority[x])
        
        # Genel uyarı mesajı
        warning = None
        if best_level == ConfidenceLevel.LOW:
            warning = "Dikkat: Sorgulanan konu ile dokümanlar arasında doğrudan eşleşme bulunamadı. Aşağıdaki bilgiler en yakın sonuçlardır ve tam olarak doğru olmayabilir."
        elif best_level == ConfidenceLevel.MEDIUM:
            warning = "Not: Bu bilgiler sorgunuzla kısmen eşleşmektedir."
        elif best_level == ConfidenceLevel.NONE:
            warning = "Bu konuda dokümanlarda bilgi bulunamadı."
        
        return evaluated, best_level, warning


# Global instance
query_processor = QueryProcessor()
