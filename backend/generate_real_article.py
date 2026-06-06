"""
Ragleaf AI Writer Real Article Generation Script
Generates a real blog post using the active LLM Router and saves it as published for 'ragleaf-platform'.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

# Import all models to register them in SQLAlchemy before mapper initialization
from backend.database import models
from backend.models import api_key  # Registers APIKey model
from backend.database.connection import get_db
from backend.database.models_platform import WriterArticle, Organization
from backend.services.llm_router import LLMRouter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("✍️ Starting real article generation...")
    
    db = next(get_db())
    
    try:
        # Find Ragleaf Platform org
        org = db.query(Organization).filter(Organization.slug == "ragleaf-platform").first()
        if not org:
            logger.error("❌ Organization 'ragleaf-platform' not found!")
            return

        # Initialize LLM Router
        router = LLMRouter()
        model = router.get_default_model(db)
        if not model:
            logger.error("❌ No active LLM model found in settings!")
            return

        logger.info(f"Using model: {model.name} (provider: {model.provider})")

        # Define prompts
        topic = "Retrieval-Augmented Generation (RAG) Teknolojileri ve Kurumsal Bilgi Yönetimi"
        keywords = ["RAG", "Retrieval-Augmented Generation", "Kurumsal Yapay Zeka", "Vektör Veritabanı", "LLM Entegrasyonu"]
        
        sys_prompt = (
            "Sen SEO uzmanı ve profesyonel bir teknoloji blogu yazarı yapay zekasın. "
            "Sorulan konu hakkında kapsamlı, zengin ve SEO uyumlu Türkçe bir makale hazırlamalısın. "
            "Çıktıyı MUTLAKA geçerli bir JSON objesi olarak vermelisin. "
            "Cevabında JSON dışında hiçbir metin, açıklama veya markdown kod bloğu (örn. ```json) bulunmamalıdır. "
            "JSON şeması tam olarak şu şekilde olmalıdır:\n"
            "{\n"
            "  \"title\": \"Makale Başlığı\",\n"
            "  \"summary\": \"SEO için kısa meta açıklaması (en fazla 160 karakter)\",\n"
            "  \"content\": \"Markdown formatında yazılmış detaylı makale gövdesi (en az 1000 kelime, başlık etiketleri ##, ### içermelidir)\",\n"
            "  \"keywords\": [\"anahtar_kelime1\", \"anahtar_kelime2\"],\n"
            "  \"outline\": [\"Giriş\", \"Alt Başlık 1\", \"Alt Başlık 2\", \"Sonuç\"]\n"
            "}"
        )

        user_prompt = (
            f"Lütfen şu konu hakkında blog makalesi yaz: {topic}.\n"
            f"Hedef Anahtar Kelimeler: {', '.join(keywords)}.\n"
            f"Dil: tr."
        )

        messages = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt}
        ]

        logger.info("🚀 Requesting LLM router failover chain...")
        response, metadata = await router.make_request_with_failover(
            db=db,
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=3500
        )

        if not response:
            logger.error(f"❌ Failed to get response from LLM: {metadata.get('error')}")
            return

        # Extract reply
        choices = response.get("choices", [])
        if not choices:
            logger.error("❌ Empty choices in response")
            return
            
        reply_content = choices[0]["message"]["content"].strip()
        
        # Clean markdown wrappers
        if reply_content.startswith("```json"):
            reply_content = reply_content[7:]
        if reply_content.endswith("```"):
            reply_content = reply_content[:-3]
        reply_content = reply_content.strip()

        # Parse JSON
        parsed_json = json.loads(reply_content)
        
        # Helper slugify
        import re
        def slugify(text):
            text = text.lower().strip()
            turkish_map = {
                'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
                'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u'
            }
            for char, replacement in turkish_map.items():
                text = text.replace(char, replacement)
            text = re.sub(r'[^a-z0-9\s-]', '', text)
            text = re.sub(r'[\s-]+', '-', text)
            return text.strip('-')

        title = parsed_json.get("title", topic)
        slug = slugify(title)

        # Check slug unique
        base_slug = slug
        counter = 1
        while db.query(WriterArticle).filter(WriterArticle.organization_id == org.id, WriterArticle.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Create Article
        article = WriterArticle(
            organization_id=org.id,
            title=title,
            slug=slug,
            summary=parsed_json.get("summary"),
            content=parsed_json.get("content"),
            keywords=parsed_json.get("keywords", keywords),
            outline=parsed_json.get("outline", []),
            status="published",
            mode="autonomous",
            publishing_platform="nextjs",
            published_at=datetime.now(timezone.utc),
            extra_data={
                "model": model.model_name,
                "generation_metadata": {
                    "duration": metadata.get("duration"),
                    "token_used": metadata.get("token_used")
                }
            }
        )

        db.add(article)
        db.commit()
        db.refresh(article)

        logger.info(f"✅ Success! Created & Published Article: {article.title} (slug: {article.slug})")

    except Exception as e:
        logger.error(f"❌ Error during generation: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
