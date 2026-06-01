"""
Multilingual Chunking Service
Handles multilingual chunk creation with translation support.
"""

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from ..database.models_v2 import Settings, EmbeddingModel

logger = logging.getLogger(__name__)

# Valid language codes
VALID_LANGUAGES = {"tr", "en", "de", "fr", "es"}

# Default settings when not configured
DEFAULT_SETTINGS = {
    "active_languages": ["tr"],
    "default_source_language": "tr",
    "auto_translate": False,
    "translation_provider": "huggingface"
}


class MultilingualChunkingService:
    """
    Service for processing chunks in multiple languages.
    Integrates with translation service for automatic translation.
    """
    
    def __init__(self):
        self.batch_size = 10  # Chunks per translation batch
    
    def _get_multilingual_settings(self, db: Session) -> Dict[str, Any]:
        """
        Read multilingual settings from database.
        
        Args:
            db: Database session
            
        Returns:
            Dict with multilingual settings
        """
        try:
            setting = db.query(Settings).filter(
                Settings.key == "multilingual_settings"
            ).first()
            
            if setting and setting.value:
                return {
                    "active_languages": setting.value.get("active_languages", ["tr"]),
                    "default_source_language": setting.value.get("default_source_language", "tr"),
                    "auto_translate": setting.value.get("auto_translate", False),
                    "translation_provider": setting.value.get("translation_provider", "huggingface")
                }
            
            logger.info("📋 Multilingual settings not found, using defaults")
            return DEFAULT_SETTINGS.copy()
            
        except Exception as e:
            logger.error(f"❌ Error reading multilingual settings: {e}")
            return DEFAULT_SETTINGS.copy()
    
    def _is_multilingual_model(self, db: Session) -> bool:
        """
        Check if active embedding model is multilingual.
        
        Args:
            db: Database session
            
        Returns:
            True if active model is multilingual
        """
        try:
            model = db.query(EmbeddingModel).filter(
                EmbeddingModel.is_active == True,
                EmbeddingModel.is_default == True
            ).first()
            
            if model:
                is_multilingual = model.multilingual or False
                logger.info(f"🧠 Active model: {model.model_id}, multilingual: {is_multilingual}")
                return is_multilingual
            
            logger.warning("⚠️ No active embedding model found")
            return False
            
        except Exception as e:
            logger.error(f"❌ Error checking embedding model: {e}")
            return False
    
    def _validate_language(self, lang: str) -> str:
        """
        Validate language code.
        
        Args:
            lang: Language code to validate
            
        Returns:
            Valid language code (defaults to 'tr' if invalid)
        """
        if not lang:
            return "tr"
        
        lang_lower = lang.lower().strip()
        
        if lang_lower in VALID_LANGUAGES:
            return lang_lower
        
        logger.warning(f"⚠️ Invalid language code: {lang}, defaulting to 'tr'")
        return "tr"

    async def process_chunks_multilingual(
        self,
        document_id: int,
        source_chunks: List[Dict],
        source_language: str,
        db: Session,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Process chunks for multiple languages.
        
        Args:
            document_id: Document ID
            source_chunks: Original chunks in source language
            source_language: Source language code (e.g., "tr", "en")
            db: Database session
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict with all chunks (source + translated) and statistics
        """
        try:
            # Validate source language
            source_lang = self._validate_language(source_language)
            logger.info(f"🌍 Processing multilingual chunks for document {document_id}, source: {source_lang}")
            
            # Get settings
            settings = self._get_multilingual_settings(db)
            active_languages = settings.get("active_languages", ["tr"])
            auto_translate = settings.get("auto_translate", False)
            
            logger.info(f"📋 Settings: active_languages={active_languages}, auto_translate={auto_translate}")
            
            # Check if multilingual model
            is_multilingual = self._is_multilingual_model(db)
            
            # Prepare source chunks with language metadata
            all_chunks = []
            source_chunk_map = {}  # chunk_index -> chunk for translation reference
            
            for i, chunk in enumerate(source_chunks):
                chunk_with_lang = chunk.copy()
                chunk_with_lang['language'] = source_lang
                chunk_with_lang['original_chunk_id'] = None  # Source chunks have no original
                chunk_with_lang['chunk_index'] = chunk.get('chunk_index', i)
                all_chunks.append(chunk_with_lang)
                source_chunk_map[chunk_with_lang['chunk_index']] = chunk_with_lang
            
            logger.info(f"✅ Prepared {len(all_chunks)} source chunks in {source_lang}")
            
            # Skip translation if multilingual model
            if is_multilingual:
                logger.info("🧠 Multilingual model detected, skipping translation")
                return {
                    "success": True,
                    "all_chunks": all_chunks,
                    "source_chunks_count": len(source_chunks),
                    "translated_chunks_count": 0,
                    "languages_processed": [source_lang],
                    "skipped_translation": True,
                    "reason": "Multilingual embedding model active"
                }
            
            # Skip translation if auto_translate is off
            if not auto_translate:
                logger.info("🔇 Auto-translate is disabled, using source language only")
                return {
                    "success": True,
                    "all_chunks": all_chunks,
                    "source_chunks_count": len(source_chunks),
                    "translated_chunks_count": 0,
                    "languages_processed": [source_lang],
                    "skipped_translation": True,
                    "reason": "Auto-translate disabled"
                }
            
            # Determine target languages (active languages except source)
            target_languages = [lang for lang in active_languages if lang != source_lang]
            
            if not target_languages:
                logger.info(f"📋 No target languages to translate (source {source_lang} is the only active language)")
                return {
                    "success": True,
                    "all_chunks": all_chunks,
                    "source_chunks_count": len(source_chunks),
                    "translated_chunks_count": 0,
                    "languages_processed": [source_lang],
                    "skipped_translation": True,
                    "reason": "No target languages configured"
                }
            
            # Translate to each target language
            from .translation_service import translation_service
            
            translated_count = 0
            languages_processed = [source_lang]
            
            for target_lang in target_languages:
                try:
                    logger.info(f"🔄 Translating {len(source_chunks)} chunks from {source_lang} to {target_lang}")
                    
                    if progress_callback:
                        progress_callback(f"Çeviri yapılıyor: {source_lang} → {target_lang}")
                    
                    # Translate in batches
                    translated_chunks = await self._translate_chunks_batch(
                        source_chunks=source_chunks,
                        source_lang=source_lang,
                        target_lang=target_lang,
                        source_chunk_map=source_chunk_map,
                        db=db
                    )
                    
                    all_chunks.extend(translated_chunks)
                    translated_count += len(translated_chunks)
                    languages_processed.append(target_lang)
                    
                    logger.info(f"✅ Translated {len(translated_chunks)} chunks to {target_lang}")
                    
                except Exception as e:
                    logger.error(f"❌ Translation to {target_lang} failed: {e}")
                    # Continue with other languages
                    continue
            
            return {
                "success": True,
                "all_chunks": all_chunks,
                "source_chunks_count": len(source_chunks),
                "translated_chunks_count": translated_count,
                "languages_processed": languages_processed,
                "skipped_translation": False
            }
            
        except Exception as e:
            logger.error(f"❌ Multilingual processing failed: {e}")
            # Return source chunks only on failure
            return {
                "success": False,
                "error": str(e),
                "all_chunks": source_chunks,
                "source_chunks_count": len(source_chunks),
                "translated_chunks_count": 0,
                "languages_processed": [source_language]
            }
    
    async def _translate_chunks_batch(
        self,
        source_chunks: List[Dict],
        source_lang: str,
        target_lang: str,
        source_chunk_map: Dict[int, Dict],
        db: Session
    ) -> List[Dict]:
        """
        Translate chunks in batches.
        
        Args:
            source_chunks: Source language chunks
            source_lang: Source language code
            target_lang: Target language code
            source_chunk_map: Map of chunk_index to source chunk
            db: Database session
            
        Returns:
            List of translated chunks with metadata
        """
        from .translation_service import translation_service
        import asyncio
        
        translated_chunks = []
        total = len(source_chunks)
        
        for i in range(0, total, self.batch_size):
            batch = source_chunks[i:i + self.batch_size]
            batch_texts = [chunk.get('text', '') for chunk in batch]
            
            try:
                # Translate batch
                translated_texts = await translation_service.translate_batch(
                    texts=batch_texts,
                    source_language=source_lang,
                    target_language=target_lang,
                    db=db
                )
                
                # Create translated chunk objects
                for j, (original_chunk, translated_text) in enumerate(zip(batch, translated_texts)):
                    chunk_index = original_chunk.get('chunk_index', i + j)
                    
                    translated_chunk = {
                        'text': translated_text,
                        'language': target_lang,
                        'original_chunk_id': None,  # Will be set after source chunks are saved
                        'chunk_index': chunk_index,
                        'metadata': original_chunk.get('metadata', {}).copy(),
                        'word_count': len(translated_text.split()) if translated_text else 0,
                        'char_count': len(translated_text) if translated_text else 0
                    }
                    
                    # Mark as translated in metadata
                    translated_chunk['metadata']['translated_from'] = source_lang
                    translated_chunk['metadata']['translation_target'] = target_lang
                    
                    translated_chunks.append(translated_chunk)
                
                # Small delay between batches to avoid rate limiting
                if i + self.batch_size < total:
                    await asyncio.sleep(0.5)
                    
            except Exception as e:
                logger.error(f"❌ Batch translation failed at index {i}: {e}")
                # Continue with next batch
                continue
        
        return translated_chunks


# Global instance
multilingual_chunking_service = MultilingualChunkingService()
