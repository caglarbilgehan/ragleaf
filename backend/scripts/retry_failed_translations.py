#!/usr/bin/env python3
"""
Ragleaf AI Writer - Retry Failed Translations
Finds Turkish articles for 'ragleaf-platform' that lack an English translation and retries translating them.
"""

import sys
import os
import asyncio
import logging

# Add root directory to path so we can import backend packages
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.database.connection_v2 import Base
from backend.database.models_v2 import Document  # Required to register Document on Base registry
from backend.database import models
from backend.models import api_key
from backend.database.connection import get_db
from backend.database.models_platform import WriterArticle, Organization
from backend.api.writer import translate_article_content, slugify

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("🔄 Checking for articles requiring translation...")
    db = next(get_db())
    
    try:
        org = db.query(Organization).filter(Organization.slug == "ragleaf-platform").first()
        if not org:
            logger.error("❌ Organization 'ragleaf-platform' not found!")
            return

        # Fetch all Turkish articles for this org
        tr_articles = db.query(WriterArticle).filter(
            WriterArticle.organization_id == org.id,
            WriterArticle.language == "tr"
        ).all()
        
        logger.info(f"Found {len(tr_articles)} Turkish articles in total.")
        
        for article_tr in tr_articles:
            if not article_tr.translation_group_id:
                logger.warning(f"Article '{article_tr.title}' has no translation_group_id, skipping.")
                continue
                
            # Check if English version exists
            has_en = db.query(WriterArticle).filter(
                WriterArticle.organization_id == org.id,
                WriterArticle.translation_group_id == article_tr.translation_group_id,
                WriterArticle.language == "en"
            ).first()
            
            if has_en:
                logger.info(f"✅ Article '{article_tr.title}' already has an English translation.")
                continue
                
            logger.info(f"⏳ Translating '{article_tr.title}' to English...")
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
                        mode=article_tr.mode,
                        publishing_platform=article_tr.publishing_platform,
                        language="en",
                        translation_group_id=article_tr.translation_group_id,
                        published_at=article_tr.published_at,
                        extra_data={
                            "model": "retry-translation-script",
                            "note": "Re-translated using strict=False parser support"
                        }
                    )
                    db.add(article_en)
                    db.commit()
                    logger.info(f"🎉 Successfully created English translation: {article_en.title} (slug: {article_en.slug})")
                else:
                    logger.error(f"❌ LLM translation returned empty result for '{article_tr.title}'")
            except Exception as e:
                logger.error(f"❌ Failed to translate article '{article_tr.title}': {e}")
                db.rollback()

    except Exception as e:
        logger.error(f"❌ Error in script: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
