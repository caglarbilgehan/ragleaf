# backend/api/writer.py
"""
Ragleaf AI Writer API.
Handles autonomous and semi-autonomous blog article generation, approval workflows, and retrieval.
"""

import json
import logging
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models_platform import Organization, Agent, WriterArticle
from backend.auth.dependencies import get_current_active_user
from backend.auth.org_dependencies import get_current_org
from backend.services.llm_router import LLMRouter

logger = logging.getLogger(__name__)

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
    publishing_platform: str = Field(default="nextjs", pattern="^(nextjs|wordpress|ghost)$")


class ArticleUpdateRequest(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    keywords: Optional[List[str]] = None
    outline: Optional[List[str]] = None
    status: Optional[str] = Field(None, pattern="^(draft|pending_review|approved|published)$")
    mode: Optional[str] = Field(None, pattern="^(autonomous|semi-autonomous)$")
    publishing_platform: Optional[str] = Field(None, pattern="^(nextjs|wordpress|ghost)$")
    language: Optional[str] = Field(None, min_length=2, max_length=10)
    scheduled_at: Optional[datetime] = None


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
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

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
    org: Organization = Depends(get_current_org)
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
        published_at=datetime.now(timezone.utc) if request.mode == "autonomous" else None,
        extra_data={
            "model": model.model_name,
            "tokens_metadata": metadata
        }
    )

    db.add(article)
    db.commit()
    db.refresh(article)

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
    org: Organization = Depends(get_current_org)
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
    org: Organization = Depends(get_current_org)
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
    org: Organization = Depends(get_current_org)
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
    org: Organization = Depends(get_current_org)
):
    """Immediately publish the article, updating status to published."""
    article = db.query(WriterArticle).filter(
        WriterArticle.public_id == public_id,
        WriterArticle.organization_id == org.id
    ).first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")

    article.status = "published"
    article.published_at = datetime.now(timezone.utc)

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
    org: Organization = Depends(get_current_org)
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
