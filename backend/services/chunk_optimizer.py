"""
Chunk Optimization Service
Döküman türüne göre optimal chunk boyutu ve overlap belirleme
"""

import logging
from typing import Dict, Any, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

class ChunkOptimizer:
    """Chunk boyutu ve overlap optimizasyonu"""
    
    def __init__(self):
        # Default settings
        self.default_chunk_size = 512
        self.default_overlap = 100
        
        # Document type specific settings
        self.document_type_settings = {
            'pdf': {
                'chunk_size': 600,
                'overlap': 120,
                'min_chunk_length': 50,
                'reason': 'PDF documents often have complex formatting'
            },
            'docx': {
                'chunk_size': 500,
                'overlap': 100,
                'min_chunk_length': 30,
                'reason': 'Word documents have structured content'
            },
            'txt': {
                'chunk_size': 400,
                'overlap': 80,
                'min_chunk_length': 20,
                'reason': 'Plain text is simpler to chunk'
            },
            'md': {
                'chunk_size': 450,
                'overlap': 90,
                'min_chunk_length': 25,
                'reason': 'Markdown has natural section breaks'
            }
        }
        
        # Content type specific settings
        self.content_type_settings = {
            'technical': {
                'chunk_size': 700,
                'overlap': 150,
                'reason': 'Technical content needs more context'
            },
            'legal': {
                'chunk_size': 800,
                'overlap': 200,
                'reason': 'Legal documents need precise context'
            },
            'academic': {
                'chunk_size': 650,
                'overlap': 130,
                'reason': 'Academic papers have complex references'
            },
            'general': {
                'chunk_size': 500,
                'overlap': 100,
                'reason': 'General content standard chunking'
            }
        }
    
    def optimize_chunk_settings(
        self, 
        document_path: str, 
        content: str,
        file_type: str = None
    ) -> Dict[str, Any]:
        """Döküman için optimal chunk ayarlarını belirle"""
        
        # File type detection
        if not file_type:
            file_type = Path(document_path).suffix.lower().lstrip('.')
        
        # Content analysis
        content_analysis = self._analyze_content(content)
        
        # Base settings from file type
        base_settings = self.document_type_settings.get(
            file_type, 
            {
                'chunk_size': self.default_chunk_size,
                'overlap': self.default_overlap,
                'min_chunk_length': 20,
                'reason': 'Default settings for unknown file type'
            }
        )
        
        # Adjust based on content analysis
        optimized_settings = self._adjust_for_content(base_settings, content_analysis)
        
        # Document length adjustments
        optimized_settings = self._adjust_for_length(optimized_settings, len(content))
        
        # Add metadata
        optimized_settings.update({
            'file_type': file_type,
            'content_analysis': content_analysis,
            'optimization_applied': True
        })
        
        logger.info(f"Optimized chunk settings for {file_type}: {optimized_settings}")
        return optimized_settings
    
    def _analyze_content(self, content: str) -> Dict[str, Any]:
        """İçerik analizi yap"""
        if not content:
            return {'type': 'empty', 'complexity': 'low'}
        
        content_lower = content.lower()
        
        # Technical content indicators
        technical_keywords = [
            'api', 'algorithm', 'function', 'class', 'method', 'variable',
            'database', 'server', 'client', 'protocol', 'framework',
            'implementation', 'configuration', 'deployment'
        ]
        
        # Legal content indicators
        legal_keywords = [
            'madde', 'fıkra', 'bent', 'kanun', 'yönetmelik', 'tüzük',
            'sözleşme', 'anlaşma', 'protokol', 'hukuk', 'yasal'
        ]
        
        # Academic content indicators
        academic_keywords = [
            'araştırma', 'analiz', 'hipotez', 'metodoloji', 'sonuç',
            'kaynakça', 'referans', 'çalışma', 'inceleme', 'değerlendirme'
        ]
        
        # Count indicators
        technical_count = sum(1 for kw in technical_keywords if kw in content_lower)
        legal_count = sum(1 for kw in legal_keywords if kw in content_lower)
        academic_count = sum(1 for kw in academic_keywords if kw in content_lower)
        
        # Determine content type
        max_count = max(technical_count, legal_count, academic_count)
        
        if max_count == 0:
            content_type = 'general'
        elif technical_count == max_count:
            content_type = 'technical'
        elif legal_count == max_count:
            content_type = 'legal'
        else:
            content_type = 'academic'
        
        # Complexity analysis
        sentences = content.split('.')
        avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 0
        
        if avg_sentence_length > 25:
            complexity = 'high'
        elif avg_sentence_length > 15:
            complexity = 'medium'
        else:
            complexity = 'low'
        
        return {
            'type': content_type,
            'complexity': complexity,
            'avg_sentence_length': avg_sentence_length,
            'technical_score': technical_count,
            'legal_score': legal_count,
            'academic_score': academic_count
        }
    
    def _adjust_for_content(
        self, 
        base_settings: Dict[str, Any], 
        content_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """İçerik analizine göre ayarları düzenle"""
        
        settings = base_settings.copy()
        content_type = content_analysis['type']
        complexity = content_analysis['complexity']
        
        # Content type adjustments
        if content_type in self.content_type_settings:
            content_settings = self.content_type_settings[content_type]
            settings['chunk_size'] = content_settings['chunk_size']
            settings['overlap'] = content_settings['overlap']
            settings['reason'] += f" + {content_settings['reason']}"
        
        # Complexity adjustments
        if complexity == 'high':
            settings['chunk_size'] = int(settings['chunk_size'] * 1.2)
            settings['overlap'] = int(settings['overlap'] * 1.3)
            settings['reason'] += " + High complexity content"
        elif complexity == 'low':
            settings['chunk_size'] = int(settings['chunk_size'] * 0.8)
            settings['overlap'] = int(settings['overlap'] * 0.7)
            settings['reason'] += " + Low complexity content"
        
        return settings
    
    def _adjust_for_length(
        self, 
        settings: Dict[str, Any], 
        content_length: int
    ) -> Dict[str, Any]:
        """Döküman uzunluğuna göre ayarları düzenle"""
        
        # Very short documents
        if content_length < 1000:
            settings['chunk_size'] = min(settings['chunk_size'], content_length // 2)
            settings['overlap'] = min(settings['overlap'], settings['chunk_size'] // 4)
            settings['reason'] += " + Adjusted for short document"
        
        # Very long documents
        elif content_length > 100000:
            settings['chunk_size'] = int(settings['chunk_size'] * 1.1)
            settings['overlap'] = int(settings['overlap'] * 1.1)
            settings['reason'] += " + Adjusted for long document"
        
        # Ensure minimum values
        settings['chunk_size'] = max(settings['chunk_size'], 100)
        settings['overlap'] = max(settings['overlap'], 20)
        settings['overlap'] = min(settings['overlap'], settings['chunk_size'] // 2)
        
        return settings
    
    def get_query_chunk_settings(self, query: str) -> Dict[str, Any]:
        """Query için optimal chunk ayarları"""
        query_length = len(query)
        
        if query_length < 20:
            return {
                'chunk_size': 200,
                'overlap': 50,
                'min_chunk_length': 5,
                'reason': 'Short query - small chunks'
            }
        elif query_length < 100:
            return {
                'chunk_size': 300,
                'overlap': 75,
                'min_chunk_length': 10,
                'reason': 'Medium query - standard chunks'
            }
        else:
            return {
                'chunk_size': 500,
                'overlap': 100,
                'min_chunk_length': 20,
                'reason': 'Long query - larger chunks'
            }

# Global instance
chunk_optimizer = ChunkOptimizer()
