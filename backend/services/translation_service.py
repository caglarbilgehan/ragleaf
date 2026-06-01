"""
Translation Service
Handles text translation using HuggingFace Inference API or fallback providers.
"""

import logging
import json
import asyncio
from typing import List, Dict, Optional
from sqlalchemy.orm import Session

from ..database.models_v2 import LLMModel, AIProvider, AIToken

logger = logging.getLogger(__name__)

# Language name mapping for prompts
LANGUAGE_NAMES = {
    "tr": "Turkish",
    "en": "English",
    "de": "German",
    "fr": "French",
    "es": "Spanish"
}


class TranslationService:
    """
    Service for translating text using LLM APIs.
    Supports HuggingFace Inference API with fallback to mock translations.
    """
    
    def __init__(self):
        self.batch_size = 10
        self.rate_limit_delay = 0.5  # seconds between API calls
    
    def _get_hf_token(self, db: Session) -> Optional[str]:
        """
        Get active HuggingFace token from ai_tokens table.
        
        Args:
            db: Database session
            
        Returns:
            HuggingFace API token or None
        """
        try:
            if not db:
                logger.warning("⚠️ No database session provided for token lookup")
                return None
            
            # Find HuggingFace provider
            hf_provider = db.query(AIProvider).filter(
                AIProvider.name == "huggingface",
                AIProvider.is_enabled == True
            ).first()
            
            if not hf_provider:
                logger.warning("⚠️ HuggingFace provider not found or disabled")
                return None
            
            # Get active token for this provider
            token = db.query(AIToken).filter(
                AIToken.provider_id == hf_provider.id,
                AIToken.is_active == True
            ).order_by(AIToken.priority.asc()).first()
            
            if token and token.api_key:
                logger.info(f"✅ Found HuggingFace token: {token.display_name}")
                return token.api_key_plain
            
            logger.warning("⚠️ No active HuggingFace token found")
            return None
            
        except Exception as e:
            logger.error(f"❌ Error getting HuggingFace token: {e}")
            return None
    
    async def _call_hf_inference(self, prompt: str, token: str, model: str = "mistralai/Mixtral-8x7B-Instruct-v0.1") -> str:
        """
        Call HuggingFace Inference API for text generation.
        
        Args:
            prompt: The prompt to send
            token: HuggingFace API token
            model: Model to use (default: Mixtral-8x7B)
            
        Returns:
            Generated text response
        """
        import aiohttp
        
        url = f"https://api-inference.huggingface.co/models/{model}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 4096,
                "temperature": 0.1,
                "return_full_text": False
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload, timeout=60) as response:
                    if response.status == 200:
                        result = await response.json()
                        if isinstance(result, list) and len(result) > 0:
                            return result[0].get("generated_text", "")
                        return str(result)
                    elif response.status == 503:
                        # Model loading, wait and retry
                        logger.warning(f"⏳ Model {model} is loading, waiting...")
                        await asyncio.sleep(20)
                        return await self._call_hf_inference(prompt, token, model)
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ HuggingFace API error {response.status}: {error_text[:200]}")
                        raise Exception(f"HuggingFace API error: {response.status}")
                        
        except asyncio.TimeoutError:
            logger.error("❌ HuggingFace API timeout")
            raise Exception("HuggingFace API timeout")
        except Exception as e:
            logger.error(f"❌ HuggingFace API call failed: {e}")
            raise
    
    def _build_translation_prompt(self, texts: List[str], source_lang: str, target_lang: str) -> str:
        """
        Create a prompt for the LLM to translate a list of strings.
        
        Args:
            texts: List of texts to translate
            source_lang: Source language code
            target_lang: Target language code
            
        Returns:
            Formatted prompt string
        """
        source_name = LANGUAGE_NAMES.get(source_lang, source_lang)
        target_name = LANGUAGE_NAMES.get(target_lang, target_lang)
        
        return f"""You are a professional translator. Translate the following list of texts from {source_name} to {target_name}.
Maintain the original meaning, tone, and formatting.
Return ONLY a raw JSON list of strings, with no extra text or markdown.

Input texts:
{json.dumps(texts, ensure_ascii=False)}

Output JSON:"""
    
    def _mock_translation(self, texts: List[str], target_lang: str) -> List[str]:
        """
        Generate mock translations for testing.
        
        Args:
            texts: List of texts to "translate"
            target_lang: Target language code
            
        Returns:
            List of mock translated texts
        """
        lang_upper = target_lang.upper()
        return [f"[{lang_upper}] {text}" for text in texts]
    
    async def translate_batch(
        self, 
        texts: List[str], 
        target_language: str, 
        source_language: str = "auto", 
        db: Session = None
    ) -> List[str]:
        """
        Translate a batch of texts using the configured LLM.
        
        Args:
            texts: List of texts to translate
            target_language: Target language code
            source_language: Source language code (default: auto)
            db: Database session for token lookup
            
        Returns:
            List of translated texts
        """
        if not texts:
            return []
        
        # Same language, no translation needed
        if source_language == target_language:
            logger.info(f"📋 Source and target language are the same ({source_language}), skipping translation")
            return texts
        
        logger.info(f"🔄 Translating {len(texts)} texts from {source_language} to {target_language}")
        
        # Build prompt
        prompt = self._build_translation_prompt(texts, source_language, target_language)
        
        try:
            # Try HuggingFace first
            hf_token = self._get_hf_token(db)
            
            if hf_token:
                logger.info("🤗 Using HuggingFace Inference API for translation")
                response = await self._call_hf_inference(prompt, hf_token)
                
                # Parse response
                translations = self._parse_translation_response(response, texts)
                if translations:
                    return translations
            
            # Fallback to OpenAI if available
            import os
            openai_key = os.getenv("OPENAI_API_KEY")
            
            if openai_key:
                logger.info("🔑 Using OpenAI API for translation")
                translations = await self._call_openai(prompt, openai_key)
                if translations:
                    return translations
            
            # Final fallback: mock translation
            logger.warning("⚠️ No LLM available, using mock translations")
            return self._mock_translation(texts, target_language)
            
        except Exception as e:
            logger.error(f"❌ Translation failed: {e}")
            # Return original texts on failure
            return texts
    
    def _parse_translation_response(self, response: str, original_texts: List[str]) -> Optional[List[str]]:
        """
        Parse LLM response to extract translated texts.
        
        Args:
            response: Raw LLM response
            original_texts: Original texts for fallback
            
        Returns:
            List of translated texts or None if parsing fails
        """
        try:
            # Clean response
            clean_text = response.strip()
            
            # Remove markdown code blocks if present
            if "```json" in clean_text:
                clean_text = clean_text.split("```json")[-1].split("```")[0].strip()
            elif "```" in clean_text:
                clean_text = clean_text.split("```")[1].split("```")[0].strip()
            
            # Try to find JSON array
            start_idx = clean_text.find("[")
            end_idx = clean_text.rfind("]") + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_str = clean_text[start_idx:end_idx]
                translations = json.loads(json_str)
                
                if isinstance(translations, list) and len(translations) == len(original_texts):
                    logger.info(f"✅ Successfully parsed {len(translations)} translations")
                    return translations
                else:
                    logger.warning(f"⚠️ Translation count mismatch: expected {len(original_texts)}, got {len(translations) if isinstance(translations, list) else 'invalid'}")
            
            return None
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Response parsing error: {e}")
            return None
    
    async def _call_openai(self, prompt: str, api_key: str) -> Optional[List[str]]:
        """
        Call OpenAI API for translation.
        
        Args:
            prompt: Translation prompt
            api_key: OpenAI API key
            
        Returns:
            List of translated texts or None
        """
        try:
            import openai
            
            client = openai.AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
            
            content = response.choices[0].message.content
            return self._parse_translation_response(content, [])
            
        except Exception as e:
            logger.error(f"❌ OpenAI API error: {e}")
            return None


# Global instance
translation_service = TranslationService()
