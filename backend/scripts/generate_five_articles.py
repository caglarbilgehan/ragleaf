#!/usr/bin/env python3
"""
Ragleaf AI Writer - Generate 5 SEO-optimized Articles
Generates 5 blog posts using the active LLM Router and saves them for 'ragleaf-platform' in both Turkish and English.
"""

import sys
import os
import asyncio
import json
import logging
import uuid
import re
from datetime import datetime, timezone

# Add root directory to path so we can import backend packages
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.database.connection_v2 import Base
from backend.database.models_v2 import Document  # Required to register Document on Base registry
from backend.database import models
from backend.models import api_key
from backend.database.connection import get_db
from backend.database.models_platform import WriterArticle, Organization
from backend.services.llm_router import LLMRouter
from backend.api.writer import translate_article_content

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Helper slugify
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

# 5 Topics with SEO target keywords
topics = [
    {
        "topic": "Müşteri İlişkilerinde Yapay Zeka Asistanları: Geleceğin Müşteri Deneyimi",
        "keywords": ["Müşteri Hizmetleri Yapay Zeka", "Yapay Zeka Asistanı", "Müşteri Deneyimi", "Müşteri Sadakati", "Canlı Sohbet Otomasyonu"]
    },
    {
        "topic": "E-Ticarette Sohbet İçi Güvenli Ödeme: Satış Dönüşümlerini Nasıl Artırır?",
        "keywords": ["Sohbet İçi Ödeme", "Güvenli Ödeme", "E-Ticaret Dönüşüm Oranı", "Müşteri Sohbetleri", "Mobil Ödeme Entegrasyonu"]
    },
    {
        "topic": "Yapay Zeka Destekli Otomatik İçerik Üretimi (AI Writer) ve SEO Stratejileri",
        "keywords": ["Yapay Zeka İçerik Üretimi", "SEO Stratejileri", "AI Writer", "İçerik Pazarlaması", "Otomatik Makale Yazma"]
    },
    {
        "topic": "Sanal Asistanlarda Rezervasyon ve Sipariş Otomasyonu ile Operasyonel Verimlilik",
        "keywords": ["Rezervasyon Otomasyonu", "Sipariş Otomasyonu", "Operasyonel Verimlilik", "Yapay Zeka Entegrasyonu", "Zaman Yönetimi"]
    },
    {
        "topic": "Kurumsal Süreçlerde Yapay Zeka İş Akışları (AI Automation) ve Tetikleyici (Trigger) Senaryoları",
        "keywords": ["Yapay Zeka İş Akışları", "İş Otomasyonu", "Tetikleyici Senaryolar", "Kurumsal Verimlilik", "Süreç Otomasyonu"]
    }
]

async def generate_article(db, org, router, model, topic_data):
    topic = topic_data["topic"]
    keywords = topic_data["keywords"]
    
    logger.info(f"Generating article for topic: {topic}")
    
    sys_prompt = (
        "Sen SEO uzmanı ve profesyonel bir teknoloji blogu yazarı yapay zekasın. "
        "Sorulan konu hakkında kapsamlı, zengin ve SEO uyumlu Türkçe bir makale hazırlamalısın. "
        "Makale mutlaka zengin içerikli, detaylı, profesyonel bir üslupla yazılmış olmalıdır. "
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

    response, metadata = await router.make_request_with_failover(
        db=db,
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=3500
    )

    if not response:
        logger.error(f"Failed to generate article: {topic}")
        return None

    choices = response.get("choices", [])
    if not choices:
        logger.error(f"Empty choices in response for topic: {topic}")
        return None
        
    reply_content = choices[0]["message"]["content"].strip()
    
    # Clean markdown wrappers
    if reply_content.startswith("```json"):
        reply_content = reply_content[7:]
    if reply_content.endswith("```"):
        reply_content = reply_content[:-3]
    reply_content = reply_content.strip()

    # Parse JSON
    parsed_json = json.loads(reply_content, strict=False)
    
    title = parsed_json.get("title", topic)
    slug = slugify(title)

    # Check slug uniqueness
    base_slug = slug
    counter = 1
    while db.query(WriterArticle).filter(WriterArticle.organization_id == org.id, WriterArticle.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    group_id = str(uuid.uuid4())

    # Create Turkish Article
    article_tr = WriterArticle(
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
        language="tr",
        translation_group_id=group_id,
        published_at=datetime.now(timezone.utc),
        extra_data={
            "model": model.model_name,
            "generation_metadata": {
                "duration": metadata.get("duration"),
                "token_used": metadata.get("token_used")
            }
        }
    )

    db.add(article_tr)
    db.commit()
    db.refresh(article_tr)
    logger.info(f"✅ Created Turkish Article: {article_tr.title} (slug: {article_tr.slug})")

    # Translate to English
    logger.info(f"Translating to English: {article_tr.title}")
    try:
        translated_data = await translate_article_content(
            db=db,
            title=article_tr.title,
            summary=article_tr.summary,
            content=article_tr.content,
            outline=article_tr.outline,
            keywords=article_tr.keywords,
            target_lang="en"
        )
        if translated_data:
            trans_title = translated_data.get("title", f"{article_tr.title} (EN)")
            trans_slug = slugify(trans_title)
            
            # Ensure unique slug
            base_trans_slug = trans_slug
            counter = 1
            while db.query(WriterArticle).filter(WriterArticle.organization_id == org.id, WriterArticle.slug == trans_slug).first():
                trans_slug = f"{base_trans_slug}-{counter}"
                counter += 1
                
            article_en = WriterArticle(
                organization_id=org.id,
                title=trans_title,
                slug=trans_slug,
                summary=translated_data.get("summary"),
                content=translated_data.get("content"),
                keywords=translated_data.get("keywords", []),
                outline=translated_data.get("outline", []),
                status="published",
                mode="autonomous",
                publishing_platform="nextjs",
                language="en",
                translation_group_id=group_id,
                published_at=article_tr.published_at,
                extra_data={
                    "model": model.model_name,
                    "note": "Auto-translated from tr to en"
                }
            )
            db.add(article_en)
            db.commit()
            logger.info(f"✅ Created English translation: {article_en.title} (slug: {article_en.slug})")
    except Exception as e:
        logger.error(f"❌ Failed to translate article {article_tr.title}: {e}")

async def main():
    logger.info("✍️ Starting batch blog generation...")
    db = next(get_db())
    
    try:
        org = db.query(Organization).filter(Organization.slug == "ragleaf-platform").first()
        if not org:
            logger.error("❌ Organization 'ragleaf-platform' not found!")
            return

        router = LLMRouter()
        model = router.get_default_model(db)
        if not model:
            logger.error("❌ No active LLM model found in settings!")
            return

        logger.info(f"Using model: {model.name} for content generation.")

        for idx, topic_data in enumerate(topics):
            logger.info(f"Processing topic {idx+1}/{len(topics)}")
            await generate_article(db, org, router, model, topic_data)
            
        logger.info("🎉 Batch generation completed!")

    except Exception as e:
        logger.error(f"❌ Error in main execution: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
