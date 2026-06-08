# backend/api/writer.py
"""
Ragleaf AI Writer API.
Handles autonomous and semi-autonomous blog article generation, approval workflows, and retrieval.
"""

import json
import logging
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import Organization, Agent, WriterArticle
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org
from backend.services.llm_router import LLMRouter

logger = logging.getLogger(__name__)

def check_ai_writer_permission(org: Organization = Depends(get_current_org)):
    if not org.has_ai_writer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Writer özelliği bu paket kapsamında aktif değildir. Lütfen paketinizi yükseltin."
        )
    return org

writer_router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class ArticleCreateRequest(BaseModel):
    topic: str = Field(..., min_length=5, max_length=500)
    keywords: List[str] = Field(default=[])
    language: str = Field(default="tr", min_length=2, max_length=10)
    agent_id: Optional[int] = None
    mode: str = Field(default="semi-autonomous", pattern="^(autonomous|semi-autonomous)$")
    publishing_platform: str = Field(default="ragleaf", pattern="^(ragleaf|wordpress|ghost)$")


class ArticleUpdateRequest(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    keywords: Optional[List[str]] = None
    outline: Optional[List[str]] = None
    status: Optional[str] = Field(None, pattern="^(draft|pending_review|approved|published)$")
    mode: Optional[str] = Field(None, pattern="^(autonomous|semi-autonomous)$")
    publishing_platform: Optional[str] = Field(None, pattern="^(ragleaf|wordpress|ghost)$")
    language: Optional[str] = Field(None, min_length=2, max_length=10)
    scheduled_at: Optional[datetime] = None
    translation_group_id: Optional[str] = None


class ArticleResponse(BaseModel):
    id: int
    public_id: str
    organization_id: int
    agent_id: Optional[int] = None
    title: str
    slug: str
    summary: Optional[str] = None
    content: Optional[str] = None
    keywords: List[str] = []
    outline: List[str] = []
    status: str
    mode: str
    publishing_platform: str
    language: str
    translation_group_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AutomationCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    interval_days: int = Field(7, ge=1, le=365)
    keywords: List[str] = Field(default=[])
    mode: str = Field(default="autonomous", pattern="^(autonomous|semi-autonomous)$")
    publishing_platform: str = Field(default="ragleaf", pattern="^(ragleaf|wordpress|ghost)$")
    agent_id: Optional[int] = None
    is_active: bool = True


class AutomationUpdateRequest(BaseModel):
    title: Optional[str] = None
    interval_days: Optional[int] = Field(None, ge=1, le=365)
    keywords: Optional[List[str]] = None
    mode: Optional[str] = Field(None, pattern="^(autonomous|semi-autonomous)$")
    publishing_platform: Optional[str] = Field(None, pattern="^(ragleaf|wordpress|ghost)$")
    agent_id: Optional[int] = None
    is_active: Optional[bool] = None


class AutomationResponse(BaseModel):
    id: int
    organization_id: int
    agent_id: Optional[int] = None
    title: str
    interval_days: int
    keywords: List[str] = []
    mode: str
    publishing_platform: str
    is_active: bool
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Helper Functions
# ============================================================================

def slugify(text: str) -> str:
    """Simple slugify function for URL paths."""
    text = text.lower().strip()
    # Replace Turkish chars
    turkish_map = {
        'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
        'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u'
    }
    for char, replacement in turkish_map.items():
        text = text.replace(char, replacement)
    
    # Replace non-alphanumeric characters with hyphens
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text)
    return text.strip('-')


# ============================================================================
# Endpoints
async def translate_article_content(db: Session, title: str, summary: str, content: str, outline: List[str], keywords: List[str], target_lang: str) -> dict:
    """Translates article components to the target language using LLM."""
    from backend.services.llm_router import LLMRouter
    router = LLMRouter()
    model = router.get_default_model(db)
    if not model:
        return {}

    sys_prompt = (
        "Sen profesyonel bir çevirmen ve blog editörüsün. "
        "Sana verilen makale bileşenlerini (başlık, özet, ana gövde, outline, anahtar kelimeler) "
        "anlam bütünlüğünü bozmadan, profesyonel bir şekilde hedef dile çevirmelisin. "
        "Çıktıyı MUTLAKA geçerli bir JSON objesi olarak vermelisin. "
        "Cevabında JSON dışında hiçbir metin, açıklama veya markdown kod bloğu (örn. ```json) bulunmamalıdır. "
        "JSON şeması tam olarak şu şekilde olmalıdır:\n"
        "{\n"
        "  \"title\": \"Translated Article Title\",\n"
        "  \"summary\": \"Translated SEO meta description\",\n"
        "  \"content\": \"Markdown format in target language\",\n"
        "  \"keywords\": [\"translated_keyword1\", \"translated_keyword2\"],\n"
        "  \"outline\": [\"Translated Outline Heading 1\", \"Translated Outline Heading 2\"]\n"
        "}"
    )

    user_prompt = (
        f"Lütfen aşağıdaki makaleyi şu dile çevir: {target_lang}\n\n"
        f"Başlık: {title}\n"
        f"Özet: {summary}\n"
        f"Outline: {json.dumps(outline)}\n"
        f"Anahtar Kelimeler: {json.dumps(keywords)}\n"
        f"Makale Gövdesi:\n{content}"
    )

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt}
    ]

    response, _ = await router.make_request_with_failover(
        db=db,
        model=model,
        messages=messages,
        temperature=0.3,
        max_tokens=3000
    )

    if not response:
        return {}

    try:
        reply_content = response["choices"][0]["message"]["content"].strip()
        if reply_content.startswith("```json"):
            reply_content = reply_content[7:]
        if reply_content.endswith("```"):
            reply_content = reply_content[:-3]
        reply_content = reply_content.strip()
        return json.loads(reply_content, strict=False)
    except Exception as e:
        logger.error(f"Failed to parse translation LLM output: {e}")
        return {}


# ============================================================================
# Endpoints
# ============================================================================

@writer_router.post(
    "/writer/generate",
    response_model=ArticleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate article outline and content using AI"
)
async def generate_article(
    request: ArticleCreateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(check_ai_writer_permission)
):
    """
    Triggers AI model to generate a full blog article.
    Saves in DB as "draft" or "pending_review".
    """
    # Initialize LLM Router
    router = LLMRouter()
    model = router.get_default_model(db)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aktif bir LLM modeli bulunamadı. Lütfen sağlayıcı ayarlarından bir model seçin."
        )

    # Build prompt
    sys_prompt = (
        "Sen SEO uzmanı ve profesyonel bir blog yazarı yapay zekasın. "
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
        f"Lütfen şu konu hakkında blog makalesi yaz: {request.topic}.\n"
        f"Hedef Anahtar Kelimeler: {', '.join(request.keywords) if request.keywords else 'Belirtilmedi'}.\n"
        f"Dil: {request.language}."
    )

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt}
    ]

    logger.info(f"✍️ Triggering AI Writer with model {model.name} for topic: {request.topic}")

    response, metadata = await router.make_request_with_failover(
        db=db,
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=3000
    )

    if not response:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Yapay zeka modelinden yanıt alınamadı: {metadata.get('error', 'Bilinmeyen hata')}"
        )

    # Extract choices
    try:
        choices = response.get("choices", [])
        if not choices:
            raise ValueError("Empty choices in LLM response")
        
        reply_content = choices[0]["message"]["content"].strip()
        
        # Clean potential markdown wrapping
        if reply_content.startswith("```json"):
            reply_content = reply_content[7:]
        if reply_content.endswith("```"):
            reply_content = reply_content[:-3]
        reply_content = reply_content.strip()

        # Parse JSON
        parsed_json = json.loads(reply_content)
    except Exception as e:
        logger.error(f"Failed to parse LLM JSON output. Error: {e}. Raw reply: {reply_content[:500] if 'reply_content' in locals() else 'None'}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Yapay zeka format hatası: Üretilen içerik geçerli bir JSON şemasına dönüştürülemedi."
        )

    title = parsed_json.get("title", request.topic)
    slug = slugify(title)
    
    # Ensure slug unique in organization
    base_slug = slug
    counter = 1
    while db.query(WriterArticle).filter(WriterArticle.organization_id == org.id, WriterArticle.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Save to database
    import uuid
    group_id = str(uuid.uuid4())
    
    article = WriterArticle(
        organization_id=org.id,
        agent_id=request.agent_id,
        title=title,
        slug=slug,
        summary=parsed_json.get("summary"),
        content=parsed_json.get("content"),
        keywords=parsed_json.get("keywords", request.keywords),
        outline=parsed_json.get("outline", []),
        status="pending_review" if request.mode == "semi-autonomous" else "published",
        mode=request.mode,
        publishing_platform=request.publishing_platform,
        language=request.language,
        translation_group_id=group_id,
        published_at=datetime.now(timezone.utc) if request.mode == "autonomous" else None,
        extra_data={
            "model": model.model_name,
            "tokens_metadata": metadata
        }
    )

    db.add(article)
    db.commit()
    db.refresh(article)

    # Generate translation for the other language (tr <=> en)
    target_lang = "en" if request.language == "tr" else "tr"
    try:
        translated_data = await translate_article_content(
            db=db,
            title=title,
            summary=parsed_json.get("summary", ""),
            content=parsed_json.get("content", ""),
            outline=parsed_json.get("outline", []),
            keywords=parsed_json.get("keywords", request.keywords),
            target_lang=target_lang
        )
        if translated_data:
            trans_title = translated_data.get("title", f"{title} ({target_lang})")
            trans_slug = slugify(trans_title)
            
            # Ensure unique slug
            base_trans_slug = trans_slug
            counter = 1
            while db.query(WriterArticle).filter(WriterArticle.organization_id == org.id, WriterArticle.slug == trans_slug).first():
                trans_slug = f"{base_trans_slug}-{counter}"
                counter += 1
                
            translated_article = WriterArticle(
                organization_id=org.id,
                agent_id=request.agent_id,
                title=trans_title,
                slug=trans_slug,
                summary=translated_data.get("summary"),
                content=translated_data.get("content"),
                keywords=translated_data.get("keywords", []),
                outline=translated_data.get("outline", []),
                status=article.status,
                mode=request.mode,
                publishing_platform=request.publishing_platform,
                language=target_lang,
                translation_group_id=group_id,
                published_at=article.published_at,
                extra_data={
                    "model": model.model_name,
                    "note": f"Auto-translated from {request.language} to {target_lang}"
                }
            )
            db.add(translated_article)
            db.commit()
            logger.info(f"📰 AI Translated Article successfully generated: {translated_article.public_id} - Title: {translated_article.title}")
    except Exception as trans_err:
        logger.error(f"Failed to auto-translate article: {trans_err}")

    logger.info(f"📰 AI Article successfully generated & saved: {article.public_id} - Title: {article.title}")
    return article


@writer_router.get(
    "/writer/articles",
    response_model=List[ArticleResponse],
    summary="List generated articles for organization"
)
async def list_articles(
    status_filter: Optional[str] = Query(None, alias="status"),
    agent_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(check_ai_writer_permission)
):
    """Lists blog articles generated within the current organization."""
    query = db.query(WriterArticle).filter(WriterArticle.organization_id == org.id)
    
    if status_filter:
        query = query.filter(WriterArticle.status == status_filter)
    if agent_id:
        query = query.filter(WriterArticle.agent_id == agent_id)
        
    articles = query.order_by(WriterArticle.created_at.desc()).offset(offset).limit(limit).all()
    return articles


@writer_router.get(
    "/writer/articles/{public_id}",
    response_model=ArticleResponse,
    summary="Get single article details"
)
async def get_article(
    public_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(check_ai_writer_permission)
):
    """Retrieve details of a single article by public_id."""
    article = db.query(WriterArticle).filter(
        WriterArticle.public_id == public_id,
        WriterArticle.organization_id == org.id
    ).first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")
    return article


@writer_router.put(
    "/writer/articles/{public_id}",
    response_model=ArticleResponse,
    summary="Update article details"
)
async def update_article(
    public_id: str,
    request: ArticleUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(check_ai_writer_permission)
):
    """Allows manual editing of title, slug, content, metadata, or status change."""
    article = db.query(WriterArticle).filter(
        WriterArticle.public_id == public_id,
        WriterArticle.organization_id == org.id
    ).first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")

    update_data = request.model_dump(exclude_unset=True)
    
    # Handle slug updates
    if "slug" in update_data and update_data["slug"] != article.slug:
        slug = slugify(update_data["slug"])
        # Check uniqueness
        exists = db.query(WriterArticle).filter(
            WriterArticle.organization_id == org.id,
            WriterArticle.slug == slug,
            WriterArticle.id != article.id
        ).first()
        if exists:
            raise HTTPException(status_code=409, detail="Bu URL uzantısı (slug) başka bir makale tarafından kullanılıyor")
        article.slug = slug

    # Apply all other fields
    for field, value in update_data.items():
        if field == "slug":
            continue
        setattr(article, field, value)
        
    # Handle transitions to published
    if update_data.get("status") == "published" and not article.published_at:
        article.published_at = datetime.now(timezone.utc)

    # Synchronize shared fields across the translation group
    if article.translation_group_id:
        shared_updates = {}
        if "status" in update_data:
            shared_updates["status"] = update_data["status"]
            if update_data["status"] == "published":
                shared_updates["published_at"] = article.published_at or datetime.now(timezone.utc)
        if "scheduled_at" in update_data:
            shared_updates["scheduled_at"] = update_data["scheduled_at"]
        if "mode" in update_data:
            shared_updates["mode"] = update_data["mode"]
        if "publishing_platform" in update_data:
            shared_updates["publishing_platform"] = update_data["publishing_platform"]
        if "agent_id" in update_data:
            shared_updates["agent_id"] = update_data["agent_id"]
            
        if shared_updates:
            db.query(WriterArticle).filter(
                WriterArticle.organization_id == org.id,
                WriterArticle.translation_group_id == article.translation_group_id,
                WriterArticle.id != article.id
            ).update(shared_updates)

    db.commit()
    db.refresh(article)
    return article


@writer_router.post(
    "/writer/articles/{public_id}/publish",
    response_model=ArticleResponse,
    summary="Publish article immediately"
)
async def publish_article(
    public_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(check_ai_writer_permission)
):
    """Immediately publish the article, updating status to published."""
    article = db.query(WriterArticle).filter(
        WriterArticle.public_id == public_id,
        WriterArticle.organization_id == org.id
    ).first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")

    now_utc = datetime.now(timezone.utc)

    if article.translation_group_id:
        db.query(WriterArticle).filter(
            WriterArticle.organization_id == org.id,
            WriterArticle.translation_group_id == article.translation_group_id
        ).update({
            "status": "published",
            "published_at": now_utc
        })
    else:
        article.status = "published"
        article.published_at = now_utc

    db.commit()
    db.refresh(article)
    
    # In a full production build, this would trigger revalidation of Next.js frontend pages
    logger.info(f"📢 Article published: {article.title} ({article.slug})")
    return article


@writer_router.delete(
    "/writer/articles/{public_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete article"
)
async def delete_article(
    public_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    org: Organization = Depends(check_ai_writer_permission)
):
    """Permanently delete a generated article."""
    article = db.query(WriterArticle).filter(
        WriterArticle.public_id == public_id,
        WriterArticle.organization_id == org.id
    ).first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")

    db.delete(article)
    db.commit()
    
    logger.info(f"🗑️ Article {public_id} deleted")


# ============================================================================
# Public Endpoints (No Auth Required) - Used by Next.js Blog
# ============================================================================

@writer_router.get(
    "/public/blog/{org_slug}",
    summary="Get published articles for public website"
)
async def get_public_blog(
    org_slug: str,
    lang: str = Query("tr", description="Language filter"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns only published blog articles for a specific organization slug and language.
    No authentication required. Used by Next.js blog static/SSR generation.
    """
    org = db.query(Organization).filter(Organization.slug == org_slug).first()
    if not org:
        raise HTTPException(status_code=404, detail="Firma bulunamadı")
        
    articles = db.query(WriterArticle).filter(
        WriterArticle.organization_id == org.id,
        WriterArticle.status == "published",
        WriterArticle.language == lang
    ).order_by(
        WriterArticle.published_at.desc()
    ).offset(offset).limit(limit).all()

    return [
        {
            "public_id": art.public_id,
            "title": art.title,
            "slug": art.slug,
            "summary": art.summary,
            "content": art.content,
            "keywords": art.keywords,
            "outline": art.outline,
            "language": art.language,
            "published_at": art.published_at
        }
        for art in articles
    ]


# ============================================================================
# Writer Automations (Periodic generation schedules)
# ============================================================================

@writer_router.get(
    "/automations",
    response_model=List[AutomationResponse],
    summary="List content generation automations for current organization"
)
async def list_automations(
    db: Session = Depends(get_db),
    org: Organization = Depends(check_ai_writer_permission),
    current_user = Depends(get_current_active_user)
):
    from backend.database.models_platform import WriterAutomation
    return db.query(WriterAutomation).filter(WriterAutomation.organization_id == org.id).all()


@writer_router.post(
    "/automations",
    response_model=AutomationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new content generation automation"
)
async def create_automation(
    request: AutomationCreateRequest,
    db: Session = Depends(get_db),
    org: Organization = Depends(check_ai_writer_permission),
    current_user = Depends(get_current_active_user)
):
    from backend.database.models_platform import WriterAutomation
    
    # Check agent if provided
    if request.agent_id:
        agent = db.query(Agent).filter(Agent.id == request.agent_id, Agent.organization_id == org.id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent bulunamadı")
            
    # Calculate next run time
    next_run = datetime.now(timezone.utc) + timedelta(days=request.interval_days)
    
    auto = WriterAutomation(
        organization_id=org.id,
        agent_id=request.agent_id,
        title=request.title,
        interval_days=request.interval_days,
        keywords=request.keywords,
        mode=request.mode,
        publishing_platform=request.publishing_platform,
        is_active=request.is_active,
        next_run_at=next_run
    )
    
    db.add(auto)
    db.commit()
    db.refresh(auto)
    return auto


@writer_router.put(
    "/automations/{automation_id}",
    response_model=AutomationResponse,
    summary="Update content generation automation"
)
async def update_automation(
    automation_id: int,
    request: AutomationUpdateRequest,
    db: Session = Depends(get_db),
    org: Organization = Depends(check_ai_writer_permission),
    current_user = Depends(get_current_active_user)
):
    from backend.database.models_platform import WriterAutomation
    auto = db.query(WriterAutomation).filter(
        WriterAutomation.id == automation_id,
        WriterAutomation.organization_id == org.id
    ).first()
    
    if not auto:
        raise HTTPException(status_code=404, detail="Otomasyon bulunamadı")
        
    if request.agent_id is not None:
        if request.agent_id == 0 or request.agent_id is None:
            auto.agent_id = None
        else:
            agent = db.query(Agent).filter(Agent.id == request.agent_id, Agent.organization_id == org.id).first()
            if not agent:
                raise HTTPException(status_code=404, detail="Agent bulunamadı")
            auto.agent_id = request.agent_id

    if request.title is not None:
        auto.title = request.title
    if request.interval_days is not None:
        auto.interval_days = request.interval_days
        # Update next run if it hasn't run yet or adjust it
        auto.next_run_at = datetime.now(timezone.utc) + timedelta(days=request.interval_days)
    if request.keywords is not None:
        auto.keywords = request.keywords
    if request.mode is not None:
        auto.mode = request.mode
    if request.publishing_platform is not None:
        auto.publishing_platform = request.publishing_platform
    if request.is_active is not None:
        auto.is_active = request.is_active
        if request.is_active and not auto.next_run_at:
            auto.next_run_at = datetime.now(timezone.utc) + timedelta(days=auto.interval_days)
            
    db.commit()
    db.refresh(auto)
    return auto


@writer_router.delete(
    "/automations/{automation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete content generation automation"
)
async def delete_automation(
    automation_id: int,
    db: Session = Depends(get_db),
    org: Organization = Depends(check_ai_writer_permission),
    current_user = Depends(get_current_active_user)
):
    from backend.database.models_platform import WriterAutomation
    auto = db.query(WriterAutomation).filter(
        WriterAutomation.id == automation_id,
        WriterAutomation.organization_id == org.id
    ).first()
    
    if not auto:
        raise HTTPException(status_code=404, detail="Otomasyon bulunamadı")
        
    db.delete(auto)
    db.commit()
