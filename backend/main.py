# backend/main.py
import os
import logging
from typing import List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from decouple import config

# Note: Routers are imported inside create_app() to speed up startup

APP_NAME = config("APP_NAME", default="Ragleaf API")
APP_VERSION = config("APP_VERSION", default="0.2.0")

def cleanup_stuck_processing_documents():
    """Clean up documents stuck in 'processing' state on startup"""
    import logging
    from backend.database.connection import SessionLocal
    from backend.database.models import Document
    
    logger = logging.getLogger(__name__)
    
    try:
        db = SessionLocal()
        
        # Find all documents stuck in processing state
        stuck_docs = db.query(Document).filter(Document.status == "processing").all()
        
        if stuck_docs:
            logger.info(f"🧹 Found {len(stuck_docs)} documents stuck in 'processing' state")
            
            for doc in stuck_docs:
                # Reset to uploaded if it was being processed
                doc.status = "uploaded"
                doc.processing_stage = None
                doc.processing_progress = 0
                doc.processing_details = "İşlem sunucu yeniden başlatıldığında kesildi"
                logger.info(f"   ↳ Reset document {doc.id} ({doc.name}) to 'uploaded'")
            
            db.commit()
            logger.info(f"✅ Cleaned up {len(stuck_docs)} stuck documents")
        else:
            logger.info("✅ No stuck documents found")
            
        db.close()
        
    except Exception as e:
        logger.error(f"❌ Failed to cleanup stuck documents: {e}")

def initialize_chromadb():
    """Initialize ChromaDB directory and client on startup"""
    from pathlib import Path
    import logging
    import chromadb # Moved from inside try block
    from chromadb.config import Settings # Moved from inside try block
    
    logger = logging.getLogger(__name__)
    # Use StorageService for multi-tenant ChromaDB path
    from backend.services.storage_service import get_storage
    _storage = get_storage()
    org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
    chroma_db_path = _storage.get_chroma_dir(org_slug)
    
    try:
        # Create directory if it doesn't exist
        chroma_db_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"✅ ChromaDB directory initialized: {chroma_db_path}")
        
        # Test ChromaDB connection
        try:
            
            client = chromadb.PersistentClient(
                path=str(chroma_db_path),
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            
            # Get or create default collection
            collection = client.get_or_create_collection(
                name="documents",
                metadata={"hnsw:space": "cosine"}
            )
            
            # Check if ChromaDB dimension matches current default embedding model
            try:
                from backend.database.connection import SessionLocal
                from backend.database.models import EmbeddingModel
                
                db = SessionLocal()
                try:
                    default_model = db.query(EmbeddingModel).filter(
                        EmbeddingModel.is_default == True,
                        EmbeddingModel.is_active == True
                    ).first()
                    
                    if default_model and collection.count() > 0:
                        # Try to get a sample embedding to check dimension
                        sample = collection.get(limit=1, include=["embeddings"])
                        if sample and sample.get("embeddings") and len(sample["embeddings"]) > 0:
                            existing_dim = len(sample["embeddings"][0])
                            expected_dim = default_model.dimension
                            
                            if existing_dim != expected_dim:
                                logger.warning(f"⚠️ ChromaDB boyut uyumsuzluğu: mevcut={existing_dim}, beklenen={expected_dim}")
                                logger.info(f"🔄 ChromaDB koleksiyonu yeniden oluşturuluyor ({default_model.display_name} için)...")
                                
                                # Delete and recreate collection
                                client.delete_collection("documents")
                                collection = client.create_collection(
                                    name="documents",
                                    metadata={"hnsw:space": "cosine"}
                                )
                                
                                # Reset documents that were indexed
                                from backend.database.models import Document
                                db.query(Document).filter(
                                    Document.vector_indexed == True
                                ).update({
                                    "vector_indexed": False,
                                    "status": "uploaded",
                                    "processing_details": f"ChromaDB boyut değişikliği - yeniden işleme gerekli"
                                })
                                db.commit()
                                
                                logger.info(f"✅ ChromaDB koleksiyonu yeniden oluşturuldu (boyut: {expected_dim})")
                            else:
                                logger.info(f"✅ ChromaDB boyutu uyumlu: {existing_dim}")
                finally:
                    db.close()
            except Exception as dim_check_error:
                logger.debug(f"ChromaDB boyut kontrolü atlandı: {dim_check_error}")
            
            logger.info(f"✅ ChromaDB initialized successfully, documents count: {collection.count()}")
        except ImportError:
            logger.warning("⚠️  ChromaDB not installed, will skip vector storage")
        except Exception as e:
            logger.warning(f"⚠️  ChromaDB initialization warning: {e}")
            
    except Exception as e:
        logger.error(f"❌ Failed to initialize ChromaDB directory: {e}")

def get_cors_origins() -> List[str]:
    """
    CORS origin'lerini ortam değişkeninden al.
    Örn: CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
    Boşsa dev için * bırak.
    """
    # 1. Ortam değişkeninden al
    env_origins = config("CORS_ORIGINS", default="")
    if env_origins:
        # Virgülle ayrılmış listeyi parse et
        origins = [o.strip() for o in env_origins.split(",") if o.strip()]
        if origins:
            return origins

    # 2. Ortam değişkeni yoksa varsayılan listeyi kullan
    # Local development origins (prioritized)
    local_origins = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://localhost:5173",  # ChatUI default port
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",  # ChatUI default port
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        # IP addresses for local network
        "http://192.168.137.1:3001",
        "http://192.168.1.1:3001",
        "http://192.168.1.2:3001",
        "http://172.17.0.1:3001",
        "http://172.18.208.1:3001",
        "http://192.168.137.1:5174",
        "http://192.168.1.1:5174",
        "http://192.168.1.2:5174",
        "http://172.17.0.1:5174",
        "http://172.18.208.1:5174",
    ]
    
    # Production domains (Cloudflare Tunnel)
    production_origins = [
        "https://chat.ragleaf.com",
        "https://app.ragleaf.com", 
        "https://api.ragleaf.com",
    ]
    
    return local_origins + production_origins

def create_app() -> FastAPI:
    # Router imports inside create_app to avoid top-level overhead
    from backend.database.connection import create_tables
    from backend.api.auth import auth_router
    from backend.api.admin import admin_router
    from backend.api.documents import documents_router
    from backend.api.models import models_router
    from backend.api.ai_admin import ai_admin_router
    from backend.api.ai_services_settings import ai_services_router
    from backend.api.chat import chat_router
    from backend.api.chatui_integration import chatui_router
    from backend.api.source_content import source_router
    from backend.api.statistics import statistics_router
    from backend.api.settings import settings_router
    from backend.api.huggingface_admin import huggingface_router
    from backend.api.huggingface_models import huggingface_models_router
    from backend.api.ai_providers import ai_providers_router
    from backend.api.admin_users import admin_users_router
    from backend.api.api_keys import router as api_keys_router
    from backend.api.chatui_auth import chatui_auth_router
    from backend.api.chatui_ai_services import chatui_ai_router
    from backend.api.ai_provider_config import ai_provider_config_router
    from backend.api.notifications import notifications_router
    # Hybrid Vector Store APIs
    from backend.api.ingest import ingest_router
    # from backend.api.query import query_router  # Geçici olarak devre dışı
    from backend.api.vectorstore_admin import vectorstore_admin_router
    from backend.api.vectorstore_settings import vectorstore_settings_router
    # Advanced Embedding Management
    from backend.api.embedding_advanced import router as embedding_advanced_router
    # Embedding Models Management (NEW - Phase 4)
    from backend.api.embedding_models import router as embedding_models_router
    # Chunk Enrichment API
    from backend.api.chunk_enrichment import enrichment_router
    # Document Enrichment API
    from backend.api.document_enrichment import enrichment_router as document_enrichment_router
    # Document Metadata API
    from backend.api.document_metadata import metadata_router
    # Document Summary API
    from backend.api.document_summary import summary_router
    # Document Progress SSE API
    from backend.api.document_progress_sse import progress_sse_router
    # Document Pipeline API (3-stage processing)
    from backend.api.document_pipeline import router as document_pipeline_router

    app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # --- Middlewares ---
    cors_origins = get_cors_origins()

    # JSON yanıtlarını sıkıştır (SSE'yi etkilemez)
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    def _is_origin_allowed(origin: str, allowed_origins: list) -> bool:
        """
        Strict origin validation.
        Prevents subdomain attacks like 'evil-localhost.com'.
        """
        if not origin:
            return False

        # Exact match against configured origins
        if origin in allowed_origins:
            return True

        # Parse origin to validate hostname strictly
        try:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            hostname = parsed.hostname or ""

            # Allow exact localhost/loopback (not 'evil-localhost.com')
            if hostname in ("localhost", "127.0.0.1"):
                return True

            # Allow exact *.ragleaf.com subdomains
            if hostname == "ragleaf.com" or hostname.endswith(".ragleaf.com"):
                return True

        except Exception:
            pass

        return False

    def _is_widget_origin_allowed(origin: str, agent_domains: list) -> bool:
        """
        Check if origin is allowed by agent's allowed_domains list.
        Used for dynamic CORS on widget/public-chat endpoints.
        """
        if not origin or not agent_domains:
            return False  # No domains configured = deny CORS (domain header still checked server-side)
        
        try:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            hostname = parsed.hostname or ""
            
            if hostname in ("localhost", "127.0.0.1"):
                return True
            
            for allowed in agent_domains:
                if allowed.startswith("*."):
                    if hostname.endswith(allowed[2:]):
                        return True
                elif hostname == allowed:
                    return True
        except Exception:
            pass
        
        return False

    # CORS ve SSE için gerekli header'ları ekleyen middleware
    @app.middleware("http")
    async def cors_and_sse_headers(request: Request, call_next):
        origin = request.headers.get("origin")
        path = request.url.path

        # --- Dynamic CORS for widget endpoints (/v1/*) ---
        is_widget_path = path.startswith("/v1/") or path == "/widget.js"
        
        # OPTIONS preflight request'lerini handle et
        if request.method == "OPTIONS":
            # For widget paths, allow any origin in preflight (actual check happens in request)
            if is_widget_path and origin:
                response = Response()
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-API-Key"
                response.headers["Access-Control-Max-Age"] = "3600"
                return response
            elif origin and _is_origin_allowed(origin, cors_origins):
                response = Response()
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With, X-Router-Model, X-Router-Route, x-inference-provider"
                response.headers["Access-Control-Max-Age"] = "3600"
                return response
            else:
                logger.debug(f"OPTIONS Origin not allowed or missing: {origin}")

        try:
            response: Response = await call_next(request)
        except Exception as e:
            logger.error(f"Error in request processing: {e}")
            response = JSONResponse(
                status_code=500,
                content={"detail": "Sunucu içi bir hata oluştu."}
            )

        # CORS headers for responses
        if origin:
            if is_widget_path:
                # Widget paths: allow the origin (domain check is done in get_agent_from_api_key)
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-API-Key"
            elif _is_origin_allowed(origin, cors_origins):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With, X-Router-Model, X-Router-Route, x-inference-provider"
                response.headers["Access-Control-Expose-Headers"] = "x-inference-provider, x-router-model, X-Router-Model, X-Router-Route"

        # StreamingResponse ile dönen SSE'leri tanı: text/event-stream
        if response.headers.get("content-type") == "text/event-stream":
            response.headers.setdefault("Cache-Control", "no-cache")
            response.headers.setdefault("Connection", "keep-alive")
            response.headers.setdefault("X-Accel-Buffering", "no")  # nginx için

        return response

    # --- Database Initialization ---
    create_tables()

    # --- Full-Text Search Index Initialization ---
    try:
        from backend.services.vectorstore.stores.pgvector_store import PgVectorStore
        pg_store = PgVectorStore()
        pg_store.ensure_fulltext_index()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"⚠️ Full-text index creation skipped: {e}")

    # --- Routers ---
    app.include_router(auth_router, prefix="/auth", tags=["authentication"])
    app.include_router(admin_router, prefix="/admin", tags=["admin"])
    app.include_router(ai_admin_router, prefix="/admin/ai", tags=["ai-admin"])
    app.include_router(ai_services_router, prefix="/admin/ai-services", tags=["ai-services"])
    app.include_router(models_router, prefix="/models", tags=["models"])
    app.include_router(documents_router, prefix="/documents", tags=["documents"])
    app.include_router(chat_router, prefix="/chat", tags=["chat"])
    app.include_router(chatui_router, prefix="/chatui", tags=["chatui"])
    app.include_router(chatui_router, prefix="/api/v2", tags=["chatui-v2"])
    app.include_router(chatui_auth_router, prefix="/api/auth", tags=["chatui-auth"])
    app.include_router(chatui_ai_router, prefix="/api/ai", tags=["chatui-ai"])
    app.include_router(ai_provider_config_router, prefix="/admin/ai-provider-config", tags=["ai-provider-config"])
    app.include_router(ai_provider_config_router, prefix="/api/ai-provider-config", tags=["ai-provider-config-public"])
    app.include_router(notifications_router, prefix="/admin/notifications", tags=["notifications"])
    app.include_router(source_router, prefix="/api", tags=["source-content"])
    app.include_router(statistics_router, prefix="/admin/statistics", tags=["statistics"])
    app.include_router(huggingface_models_router, prefix="/admin/huggingface/models", tags=["huggingface-models"])
    app.include_router(ai_providers_router, prefix="/admin/ai-providers", tags=["ai-providers"])
    app.include_router(admin_users_router, prefix="/admin/users", tags=["admin-users"])
    app.include_router(api_keys_router, tags=["api-keys"])
    app.include_router(settings_router, prefix="/api/admin/settings", tags=["settings"])
    # Hybrid Vector Store routers
    app.include_router(ingest_router, prefix="/api/ingest", tags=["hybrid-vectorstore-ingest"])
    # app.include_router(query_router, prefix="/api/query", tags=["hybrid-vectorstore-query"])  # Geçici olarak devre dışı - EnsembleRetriever sorunu
    app.include_router(vectorstore_admin_router, prefix="/api", tags=["hybrid-vectorstore-admin"])
    app.include_router(vectorstore_settings_router, prefix="/api/admin", tags=["hybrid-vectorstore-settings"])
    # Advanced Embedding Management router
    app.include_router(embedding_advanced_router, tags=["advanced-embedding"])
    # Embedding Models Management router (NEW - Phase 4)
    app.include_router(embedding_models_router, tags=["embedding-models"])
    # Chunk Enrichment router
    app.include_router(enrichment_router, tags=["chunk-enrichment"])
    # Document Metadata router
    app.include_router(metadata_router, tags=["document-metadata"])
    # Document Summary router
    app.include_router(summary_router, prefix="/api", tags=["document-summary"])
    # Document Progress SSE router
    app.include_router(progress_sse_router, prefix="/admin", tags=["document-progress-sse"])
    
    # Multi-Modal RAG router
    from backend.api.multimodal_rag import router as multimodal_router
    app.include_router(multimodal_router, tags=["multimodal-rag"])
    
    # RAG Analytics router
    from backend.api.rag_analytics import router as analytics_router, feedback_router
    app.include_router(analytics_router, tags=["rag-analytics"])
    app.include_router(feedback_router, tags=["chat-feedback"])
    
    # RAG Evaluation router
    from backend.api.rag_evaluation import router as evaluation_router
    app.include_router(evaluation_router, tags=["rag-evaluation"])
    
    # Backup router
    from backend.api.backup import backup_router
    app.include_router(backup_router, tags=["backup"])
    
    # Document Enrichment router
    app.include_router(document_enrichment_router, tags=["document-enrichment"])
    
    # Document Pipeline router (3-stage processing)
    app.include_router(document_pipeline_router, tags=["document-pipeline"])

    # ============================================
    # Ragleaf Platform Routers
    # ============================================
    from backend.api.organizations import organizations_router
    from backend.api.agents import agents_router
    
    app.include_router(organizations_router, prefix="/api/organizations", tags=["organizations"])
    app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
    
    # Tenant Dashboard API
    from backend.api.tenant_dashboard import tenant_dashboard_router
    app.include_router(tenant_dashboard_router, prefix="/api/org", tags=["tenant-dashboard"])
    
    # Tenant User Management API
    from backend.api.org_users import org_users_router
    app.include_router(org_users_router, tags=["org-users"])
    
    # Public Chat API (widget and external integrations)
    from backend.api.public_chat import public_chat_router
    app.include_router(public_chat_router, prefix="/v1", tags=["public-chat"])
    
    # Agent Templates API (sektörel şablonlar)
    from backend.api.agent_templates import templates_router
    app.include_router(templates_router, prefix="/api", tags=["templates"])
    
    # Appointments API (randevu yönetimi)
    from backend.api.appointments import appointments_router
    app.include_router(appointments_router, prefix="/api", tags=["appointments"])

    # Calendar Integration API (Google Calendar, iCal)
    from backend.api.calendar_integration import calendar_router
    app.include_router(calendar_router, prefix="/api", tags=["calendar"])

    # Admin Tenant Management API
    from backend.api.admin_tenants import admin_tenants_router
    app.include_router(admin_tenants_router, prefix="/api", tags=["admin-tenants"])

    # --- Widget CDN ---
    import os
    widget_dist_path = os.path.join(os.path.dirname(__file__), "..", "widget", "dist")
    if os.path.exists(widget_dist_path):
        from fastapi.responses import FileResponse
        @app.get("/widget.js")
        async def serve_widget(request: Request):
            return FileResponse(
                os.path.join(widget_dist_path, "widget.js"),
                media_type="application/javascript",
                headers={
                    "Cache-Control": "public, max-age=3600",
                    # CORS handled by middleware — widget.js must be loadable from any site
                    "Access-Control-Allow-Origin": "*",
                }
            )
        logger.info(f"Widget JS served at /widget.js")

    # --- Static Files ---
    app.mount("/chatui", StaticFiles(directory="backend/static"), name="chatui-static")
    
    # Admin Panel (Production Build)
    import os
    admin_panel_path = os.path.join(os.path.dirname(__file__), "..", "admin-panel", "dist")
    if os.path.exists(admin_panel_path):
        app.mount("/admin", StaticFiles(directory=admin_panel_path, html=True), name="admin-panel")

    # --- Health & Info ---
    @app.get("/", tags=["root"])
    async def root():
        return {
            "app": APP_NAME,
            "version": APP_VERSION,
            "docs": "/docs",
            "endpoints": ["/auth", "/admin", "/models", "/documents", "/chat", "/admin/statistics", "/admin/settings", "/healthz", "/readyz"],
        }

    @app.get("/health", tags=["health"])
    async def health():
        return {"status": "healthy", "version": APP_VERSION}

    @app.get("/healthz", tags=["health"])
    async def healthz():
        return {"status": "ok"}

    @app.get("/readyz", tags=["health"])
    async def readyz():
        # Basit readiness: ileride buraya model/indeks kontrolleri ekleyebilirsin
        return {"ready": True}


    return app

app = create_app()
