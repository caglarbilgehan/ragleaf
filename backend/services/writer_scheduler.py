# backend/services/writer_scheduler.py
"""
Background Scheduler for AI Writer.
Periodically scans for scheduled articles and publishes them.
Also handles autonomous periodic blog draft generation based on organization writer settings.
"""

import asyncio
import logging
import json
import re
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from backend.database.connection import SessionLocal
from backend.database.models_platform import WriterArticle, Organization
from backend.services.llm_router import LLMRouter
from backend.api.writer import slugify, translate_article_content
import uuid

logger = logging.getLogger(__name__)

# Control flag for scheduler loop
_writer_scheduler_running = False

async def check_and_publish_scheduled(db: Session) -> int:
  """Finds approved/draft scheduled articles whose scheduled time has passed, and publishes them."""
  now = datetime.now(timezone.utc)
  
  # Find articles that are scheduled but not yet published
  scheduled_articles = db.query(WriterArticle).filter(
    WriterArticle.status != "published",
    WriterArticle.scheduled_at <= now
  ).all()

  published_count = 0

  for article in scheduled_articles:
    try:
      logger.info(f"⏰ AI Writer: Publishing scheduled article '{article.title}' ({article.public_id})")
      article.status = "published"
      article.published_at = now
      db.commit()
      published_count += 1
    except Exception as e:
      logger.error(f"❌ Failed to publish scheduled article {article.public_id}: {e}")
      db.rollback()

  return published_count


async def run_autonomous_generation(db: Session):
  """
  Checks organizations with autonomous content generation enabled.
  If the scheduled time has passed, generates a new draft article.
  """
  now = datetime.now(timezone.utc)
  
  # Fetch all active organizations
  organizations = db.query(Organization).filter(Organization.is_active == True).all()

  for org in organizations:
    settings = org.settings or {}
    writer_config = settings.get("writer_config", {})
    
    if not writer_config.get("enabled", False):
      continue

    # Determine frequency
    frequency_hours = int(writer_config.get("frequency_hours", 24))
    last_run_str = writer_config.get("last_run_at")
    
    should_run = False
    if not last_run_str:
      should_run = True
    else:
      try:
        last_run = datetime.fromisoformat(last_run_str.replace("Z", "+00:00"))
        if now - last_run >= timedelta(hours=frequency_hours):
          should_run = True
      except Exception as e:
        logger.error(f"Failed to parse last_run_at for org {org.slug}: {e}")
        should_run = True

    if not should_run:
      continue

    logger.info(f"🤖 AI Writer: Generating periodic autonomous article for org '{org.slug}'")

    # Pick topic and keywords
    topics = writer_config.get("topics", [])
    keywords = writer_config.get("keywords", [])
    language = writer_config.get("language", "tr")
    mode = writer_config.get("mode", "semi-autonomous")
    platform = writer_config.get("publishing_platform", "ragleaf")
    agent_id = writer_config.get("agent_id")

    if not topics:
      # General technology and RAG defaults
      topics = ["Retrieval-Augmented Generation (RAG) Mimarileri ve Kullanım Alanları"]
    
    # Pick first topic or rotate based on existing articles
    topic = topics[0]
    
    # Let's trigger LLM generation
    try:
      # Initialize LLM Router
      router = LLMRouter()
      model = router.get_default_model(db)
      if not model:
        logger.warning(f"⚠️ AI Writer: No active LLM model found for periodic gen in org {org.slug}")
        continue

      # Prompt structure
      sys_prompt = (
        "Sen SEO uzmanı ve profesyonel bir blog yazarı yapay zekasın. "
        "Sorulan konu hakkında kapsamlı, zengin ve SEO uyumlu bir makale hazırlamalısın. "
        "Çıktıyı MUTLAKA geçerli bir JSON objesi olarak vermelisin. "
        "Cevabında JSON dışında hiçbir metin, açıklama veya markdown kod bloğu bulunmamalıdır. "
        f"Makale dili: {language}."
        "\nJSON şeması tam olarak şu şekilde olmalıdır:\n"
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
        f"Hedef Anahtar Kelimeler: {', '.join(keywords) if keywords else 'Belirtilmedi'}.\n"
        f"Dil: {language}."
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
        max_tokens=3000
      )

      if not response:
        logger.error(f"❌ AI Writer: Failed to get response from LLM for org {org.slug}")
        continue

      choices = response.get("choices", [])
      if not choices:
        continue

      reply_content = choices[0]["message"]["content"].strip()
      
      # Clean markdown wrapping
      if reply_content.startswith("```json"):
        reply_content = reply_content[7:]
      if reply_content.endswith("```"):
        reply_content = reply_content[:-3]
      reply_content = reply_content.strip()

      parsed_json = json.loads(reply_content)
      
      title = parsed_json.get("title", topic)
      slug = slugify(title)
      
      # Ensure slug uniqueness in org
      base_slug = slug
      counter = 1
      while db.query(WriterArticle).filter(WriterArticle.organization_id == org.id, WriterArticle.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

      group_id = str(uuid.uuid4())

      # Create new WriterArticle (Primary)
      article = WriterArticle(
        organization_id=org.id,
        agent_id=agent_id,
        title=title,
        slug=slug,
        summary=parsed_json.get("summary"),
        content=parsed_json.get("content"),
        keywords=parsed_json.get("keywords", keywords),
        outline=parsed_json.get("outline", []),
        status="published" if mode == "autonomous" else "pending_review",
        mode=mode,
        publishing_platform=platform,
        published_at=now if mode == "autonomous" else None,
        language=language,
        translation_group_id=group_id,
        extra_data={
          "model": model.model_name,
          "autonomous_generation": True,
          "generation_metadata": metadata
        }
      )

      db.add(article)

      # Generate translation for the other language (tr <=> en)
      target_lang = "en" if language == "tr" else "tr"
      try:
        translated_data = await translate_article_content(
          db=db,
          title=title,
          summary=parsed_json.get("summary", ""),
          content=parsed_json.get("content", ""),
          outline=parsed_json.get("outline", []),
          keywords=parsed_json.get("keywords", keywords),
          target_lang=target_lang
        )
        if translated_data:
          trans_title = translated_data.get("title", f"{title} ({target_lang})")
          trans_slug = slugify(trans_title)
          
          base_trans_slug = trans_slug
          counter = 1
          while db.query(WriterArticle).filter(WriterArticle.organization_id == org.id, WriterArticle.slug == trans_slug).first():
            trans_slug = f"{base_trans_slug}-{counter}"
            counter += 1
            
          translated_article = WriterArticle(
            organization_id=org.id,
            agent_id=agent_id,
            title=trans_title,
            slug=trans_slug,
            summary=translated_data.get("summary"),
            content=translated_data.get("content"),
            keywords=translated_data.get("keywords", []),
            outline=translated_data.get("outline", []),
            status=article.status,
            mode=mode,
            publishing_platform=platform,
            language=target_lang,
            translation_group_id=group_id,
            published_at=article.published_at,
            extra_data={
              "model": model.model_name,
              "note": f"Auto-translated from {language} to {target_lang}",
              "autonomous_generation": True
            }
          )
          db.add(translated_article)
          logger.info(f"📰 AI Translated Article successfully generated for org {org.slug}: {translated_article.slug}")
      except Exception as trans_err:
        logger.error(f"Failed to auto-translate article during periodic gen: {trans_err}")
      
      # Update organization settings last run timestamp
      org_settings = dict(org.settings or {})
      writer_config = dict(org_settings.get("writer_config", {}))
      writer_config["last_run_at"] = now.isoformat()
      org_settings["writer_config"] = writer_config
      org.settings = org_settings

      db.commit()
      logger.info(f"✅ AI Writer: Autonomous article successfully created for org {org.slug} -> {title}")

    except Exception as e:
      logger.error(f"❌ AI Writer: Autonomous generation failed for org {org.slug}: {e}")
      db.rollback()


async def start_writer_scheduler():
  """Main background scheduler loop task for AI Writer."""
  global _writer_scheduler_running
  _writer_scheduler_running = True
  logger.info("⏰ Background AI Writer Scheduler task started.")

  while _writer_scheduler_running:
    db = SessionLocal()
    try:
      # 1. Check & publish scheduled posts
      pub_count = await check_and_publish_scheduled(db)
      if pub_count > 0:
        logger.info(f"⏰ AI Writer: Auto-published {pub_count} scheduled articles.")
        
      # 2. Check periodic autonomous generation
      await run_autonomous_generation(db)

    except Exception as e:
      logger.error(f"❌ Error in AI Writer scheduler run: {e}", exc_info=True)
    finally:
      db.close()

    # Sleep for 60 seconds
    await asyncio.sleep(60)


async def stop_writer_scheduler(task: asyncio.Task):
  """Stop the scheduler loop gracefully."""
  global _writer_scheduler_running
  _writer_scheduler_running = False
  logger.info("⏰ Stopping Background AI Writer Scheduler...")
  if task:
    task.cancel()
    try:
      await task
    except asyncio.CancelledError:
      pass
  logger.info("⏰ Background AI Writer Scheduler stopped.")
