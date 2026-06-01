"""
Advanced Embedding Management API
Provides endpoints for chunk preview, model cache management, quality validation, and analytics.

MIGRATED: Now uses new unified services:
- vector_store_manager for vector operations
- embedding_service for model info
- chunking_service for text chunking
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import shutil
from pathlib import Path
import psutil
import time
import numpy as np
import logging

logger = logging.getLogger(__name__)

from ..services.vectorstore.vector_store_manager import vector_store_manager
from ..services.embedding.embedding_service import embedding_service
from ..services.chunking.chunking_service import chunking_service
from ..services.embeddings import EmbeddingService
from ..database.connection import get_db
from sqlalchemy.orm import Session
from ..auth.dependencies import get_current_admin_user

router = APIRouter(prefix="/api/admin/embedding", tags=["Advanced Embedding Management"])

# ===== MODELS =====

class ChunkPreviewRequest(BaseModel):
    text: str = Field(..., description="Text to chunk")
    chunk_size: int = Field(default=750, ge=100, le=2000)
    chunk_overlap: int = Field(default=100, ge=0, le=500)

class ChunkInfo(BaseModel):
    text: str
    start_idx: int
    end_idx: int
    length: int
    overlap_start: Optional[int] = None
    overlap_end: Optional[int] = None

class ChunkPreviewResponse(BaseModel):
    chunks: List[ChunkInfo]
    statistics: Dict[str, Any]

class ModelCacheInfo(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    id: int  # Database ID
    model_id: str
    display_name: str
    is_downloaded: bool
    estimated_size_gb: float
    actual_size_gb: Optional[float] = None
    last_used: Optional[datetime] = None

class DiskUsageResponse(BaseModel):
    total_gb: float
    used_gb: float
    free_gb: float
    models: List[ModelCacheInfo]

class QualityTestPair(BaseModel):
    text1: str
    text2: str
    expected_similarity: str  # e.g., ">0.80", "<0.30", "0.60-0.75"

class QualityValidationRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    model_id: str
    test_pairs: Optional[List[QualityTestPair]] = None

class QualityTestResult(BaseModel):
    text1: str
    text2: str
    expected: str
    actual_similarity: float
    passed: bool
    message: str

class QualityValidationResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    model_id: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    overall_score: float
    results: List[QualityTestResult]

class VectorStoreAnalyticsResponse(BaseModel):
    chroma_stats: Dict[str, Any]
    faiss_stats: Dict[str, Any]
    sync_status: Dict[str, Any]

# ===== CHUNK PREVIEW & TESTING =====

@router.post("/chunks/preview", response_model=ChunkPreviewResponse)
async def preview_chunks(
    request: ChunkPreviewRequest,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Preview how text will be chunked with given parameters.
    Shows chunks with overlap regions and statistics.
    """
    try:
        # Use new chunking_service
        from ..services.chunking.chunk_models import ChunkingConfig
        
        config = ChunkingConfig(
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap
        )
        
        result = chunking_service.chunk(request.text, config=config)
        
        # Build detailed chunk information
        chunk_infos = []
        current_pos = 0

        for i, chunk in enumerate(result.chunks):
            # Find the position of this chunk in the original text
            start_idx = request.text.find(chunk.text, current_pos)
            if start_idx == -1:
                start_idx = current_pos

            end_idx = start_idx + len(chunk.text)

            # Determine overlap regions
            overlap_start = None
            overlap_end = None

            if i > 0 and request.chunk_overlap > 0:
                overlap_start = start_idx
                overlap_end = min(start_idx + request.chunk_overlap, end_idx)

            chunk_infos.append(ChunkInfo(
                text=chunk.text,
                start_idx=start_idx,
                end_idx=end_idx,
                length=len(chunk.text),
                overlap_start=overlap_start,
                overlap_end=overlap_end
            ))

            current_pos = start_idx + 1

        # Calculate statistics
        lengths = [chunk.length for chunk in chunk_infos]

        statistics = {
            "total_chunks": len(result.chunks),
            "avg_length": round(sum(lengths) / len(lengths), 2) if lengths else 0,
            "max_length": max(lengths) if lengths else 0,
            "min_length": min(lengths) if lengths else 0,
            "total_characters": len(request.text),
            "overlap_percentage": round((request.chunk_overlap / request.chunk_size) * 100, 2) if request.chunk_size > 0 else 0
        }

        return ChunkPreviewResponse(
            chunks=chunk_infos,
            statistics=statistics
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunk preview failed: {str(e)}")


# ===== MODEL CACHE MANAGEMENT =====

def get_model_cache_dir() -> Path:
    """Get the directory where HuggingFace models are cached"""
    # Default HuggingFace cache location
    cache_dir = os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
    return Path(cache_dir)

def get_directory_size(path: Path) -> float:
    """Calculate directory size in GB"""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                if os.path.exists(filepath):
                    total_size += os.path.getsize(filepath)
    except Exception:
        pass
    return total_size / (1024 ** 3)  # Convert to GB

@router.get("/models/cache/disk-usage", response_model=DiskUsageResponse)
async def get_disk_usage(
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get disk usage information for embedding models.
    Uses database is_downloaded status instead of checking cache.
    """
    try:
        from ..database.models import EmbeddingModel
        
        # Get overall disk usage (Windows için C: drive)
        disk = psutil.disk_usage("C:\\" if os.name == 'nt' else "/")

        # Get all local embedding models from database
        db_models = db.query(EmbeddingModel).filter(
            EmbeddingModel.deployment_type == "local"
        ).all()

        cache_dir = get_model_cache_dir()
        model_cache_list = []

        for db_model in db_models:
            model_id = db_model.model_id
            
            # Use database is_downloaded status
            is_downloaded = bool(db_model.is_downloaded)
            
            # Get actual size and last used from cache if downloaded
            actual_size = None
            last_used = None
            
            if is_downloaded:
                # Convert model ID to cache path format
                model_path = cache_dir / "hub" / f"models--{model_id.replace('/', '--')}"
                
                print(f"[DEBUG] Checking model: {model_id}")
                print(f"[DEBUG] is_downloaded from DB: {is_downloaded}")
                print(f"[DEBUG] Cache path: {model_path}")
                print(f"[DEBUG] Path exists: {model_path.exists()}")
                
                if model_path.exists():
                    actual_size = get_directory_size(model_path)
                    try:
                        stat = model_path.stat()
                        last_used = datetime.fromtimestamp(stat.st_mtime)
                    except:
                        pass

            model_cache_list.append(ModelCacheInfo(
                id=db_model.id,
                model_id=model_id,
                display_name=db_model.display_name,
                is_downloaded=is_downloaded,
                estimated_size_gb=db_model.size_mb / 1000 if db_model.size_mb else 1.0,
                actual_size_gb=round(actual_size, 2) if actual_size else None,
                last_used=last_used
            ))
            
            print(f"[DEBUG] Added to list: ID={db_model.id}, {db_model.display_name}, downloaded={is_downloaded}")

        return DiskUsageResponse(
            total_gb=round(disk.total / (1024 ** 3), 2),
            used_gb=round(disk.used / (1024 ** 3), 2),
            free_gb=round(disk.free / (1024 ** 3), 2),
            models=model_cache_list
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get disk usage: {str(e)}")


@router.delete("/models/cache/{model_db_id}")
async def delete_model_cache(
    model_db_id: int,
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Delete a cached embedding model from disk using database ID.
    """
    try:
        from ..database.models import EmbeddingModel
        
        # Get model from database
        db_model = db.query(EmbeddingModel).filter(
            EmbeddingModel.id == model_db_id
        ).first()
        
        if not db_model:
            raise HTTPException(status_code=404, detail=f"Model ID {model_db_id} not found in database")
        
        model_id = db_model.model_id
        cache_dir = get_model_cache_dir()
        model_path = cache_dir / "hub" / f"models--{model_id.replace('/', '--')}"

        if not model_path.exists():
            raise HTTPException(status_code=404, detail=f"Model {model_id} cache not found")

        # Calculate size before deletion
        size_gb = get_directory_size(model_path)

        # Delete the cache directory
        shutil.rmtree(model_path)

        # UPDATE DATABASE: Mark model as not downloaded
        try:
            db_model
            db_model.is_downloaded = 0  # Use 0 instead of False for SQLite
            db.commit()
            print(f"✅ Updated database: ID={model_db_id}, {model_id} is_downloaded = 0")
        except Exception as db_error:
            print(f"❌ Database update failed: {db_error}")
            import traceback
            traceback.print_exc()

        return {
            "success": True,
            "model_id": model_id,
            "freed_space_gb": round(size_gb, 2),
            "message": f"Successfully deleted {model_id} cache and freed {round(size_gb, 2)} GB"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete model cache: {str(e)}")


# ===== EMBEDDING QUALITY VALIDATOR =====

def parse_expected_similarity(expected: str, actual: float) -> tuple[bool, str]:
    """Parse expected similarity string and check if actual matches"""
    try:
        if expected.startswith(">"):
            threshold = float(expected[1:])
            passed = actual > threshold
            msg = f"Expected >{threshold}, got {actual:.3f}"
        elif expected.startswith("<"):
            threshold = float(expected[1:])
            passed = actual < threshold
            msg = f"Expected <{threshold}, got {actual:.3f}"
        elif "-" in expected:
            low, high = map(float, expected.split("-"))
            passed = low <= actual <= high
            msg = f"Expected {low}-{high}, got {actual:.3f}"
        else:
            threshold = float(expected)
            passed = abs(actual - threshold) < 0.05
            msg = f"Expected ~{threshold}, got {actual:.3f}"

        return passed, msg
    except:
        return False, f"Invalid expected format: {expected}"


@router.post("/validate/quality", response_model=QualityValidationResponse)
async def validate_embedding_quality(
    request: QualityValidationRequest,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Validate embedding quality using predefined test pairs.
    Tests similar/dissimilar text pairs and cross-lingual consistency.
    """
    try:
        # Default test pairs if none provided
        # Ragleaf platform test pairs
        default_tests = [
            # ===== YANGIN ALGILAMA SİSTEMLERİ =====
            QualityTestPair(text1="Yangın algılama sistemi", text2="Fire detection system", expected_similarity=">0.80"),
            QualityTestPair(text1="Duman dedektörü montajı", text2="Smoke detector installation", expected_similarity=">0.75"),
            QualityTestPair(text1="Yangın alarm paneli", text2="Fire alarm control panel", expected_similarity=">0.80"),
            QualityTestPair(text1="Optik duman dedektörü", text2="Fotoelektrik duman sensörü", expected_similarity=">0.70"),
            QualityTestPair(text1="Yangın ihbar butonu", text2="Manuel yangın alarm butonu", expected_similarity=">0.75"),
            QualityTestPair(text1="Adresli yangın algılama sistemi", text2="Addressable fire detection system", expected_similarity=">0.75"),
            
            # ===== GÜVENLİK SİSTEMLERİ =====
            QualityTestPair(text1="CCTV kamera sistemi", text2="Kapalı devre televizyon sistemi", expected_similarity=">0.75"),
            QualityTestPair(text1="IP kamera kurulumu", text2="Network kamera montajı", expected_similarity=">0.70"),
            QualityTestPair(text1="Kartlı geçiş sistemi", text2="Access control system", expected_similarity=">0.80"),
            QualityTestPair(text1="Turnike geçiş kontrolü", text2="Turnstile access control", expected_similarity=">0.75"),
            QualityTestPair(text1="Parmak izi okuyucu", text2="Biometric fingerprint reader", expected_similarity=">0.75"),
            QualityTestPair(text1="Hırsız alarm sistemi", text2="Intrusion detection system", expected_similarity=">0.70"),
            
            # ===== BİNA OTOMASYONU =====
            QualityTestPair(text1="Bina otomasyon sistemi", text2="Building automation system", expected_similarity=">0.80"),
            QualityTestPair(text1="BMS kontrol paneli", text2="Building management system panel", expected_similarity=">0.75"),
            QualityTestPair(text1="HVAC kontrol sistemi", text2="Isıtma havalandırma klima kontrolü", expected_similarity=">0.70"),
            QualityTestPair(text1="Aydınlatma otomasyonu", text2="Lighting control system", expected_similarity=">0.75"),
            QualityTestPair(text1="Enerji yönetim sistemi", text2="Energy management system", expected_similarity=">0.80"),
            QualityTestPair(text1="Akıllı bina çözümleri", text2="Smart building solutions", expected_similarity=">0.80"),
            
            # ===== ZAYIF AKIM TERİMLERİ =====
            QualityTestPair(text1="Zayıf akım tesisatı", text2="Low voltage installation", expected_similarity=">0.70"),
            QualityTestPair(text1="Yapısal kablolama sistemi", text2="Structured cabling system", expected_similarity=">0.75"),
            QualityTestPair(text1="Fiber optik kablo çekimi", text2="Fiber optic cable installation", expected_similarity=">0.75"),
            QualityTestPair(text1="UPS kesintisiz güç kaynağı", text2="Uninterruptible power supply", expected_similarity=">0.75"),
            
            # ===== İLİŞKİLİ AMA FARKLI SİSTEMLER =====
            QualityTestPair(text1="Yangın algılama sistemi", text2="Hırsız alarm sistemi", expected_similarity="0.50-0.80"),
            QualityTestPair(text1="CCTV kamera", text2="Kartlı geçiş sistemi", expected_similarity="0.45-0.75"),
            QualityTestPair(text1="Duman dedektörü", text2="Hareket sensörü", expected_similarity="0.45-0.75"),
            QualityTestPair(text1="Yangın paneli", text2="Güvenlik paneli", expected_similarity="0.50-0.80"),
            QualityTestPair(text1="HVAC sistemi", text2="Aydınlatma sistemi", expected_similarity="0.45-0.75"),
            
            # ===== ALAKASIZ KONULAR =====
            QualityTestPair(text1="Yangın dedektörü bakımı", text2="Restoran menü fiyatları", expected_similarity="<0.35"),
            QualityTestPair(text1="CCTV kamera montajı", text2="Futbol maçı sonuçları", expected_similarity="<0.35"),
            QualityTestPair(text1="Bina otomasyon sistemi", text2="Yemek tarifi hazırlama", expected_similarity="<0.35"),
            QualityTestPair(text1="Kartlı geçiş kurulumu", text2="Müzik enstrümanları", expected_similarity="<0.35"),
            QualityTestPair(text1="Yangın alarm paneli", text2="Tatil rezervasyonu", expected_similarity="<0.35"),
            
            # ===== TEKNİK DÖKÜMAN BENZERLİĞİ =====
            QualityTestPair(
                text1="Yangın algılama sistemi, duman ve ısı dedektörleri kullanarak erken uyarı sağlar",
                text2="Fire detection system provides early warning using smoke and heat detectors",
                expected_similarity=">0.75"
            ),
            QualityTestPair(
                text1="Bina otomasyon sistemi HVAC, aydınlatma ve güvenlik sistemlerini entegre eder",
                text2="BMS integrates HVAC, lighting and security systems for centralized control",
                expected_similarity=">0.70"
            ),
            QualityTestPair(
                text1="Adresli yangın algılama paneli her dedektörün konumunu ayrı ayrı gösterir",
                text2="Addressable fire panel shows individual detector locations on the display",
                expected_similarity=">0.70"
            ),
        ]

        test_pairs = request.test_pairs if request.test_pairs else default_tests

        # Get embedding service
        embedding_service = EmbeddingService()

        # Force load specific model if different from current
        if request.model_id != embedding_service.model_name:
            # Reinitialize with specific model
            os.environ["EMBEDDING_MODEL"] = request.model_id
            embedding_service = EmbeddingService(model_name=request.model_id)
            embedding_service.get_model()  # Force load

        results = []
        passed_count = 0

        for test in test_pairs:
            # Generate embeddings
            emb1 = embedding_service.encode_single(test.text1)
            emb2 = embedding_service.encode_single(test.text2)

            # Calculate cosine similarity
            similarity = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))

            # Check if passes expectation
            passed, message = parse_expected_similarity(test.expected_similarity, similarity)

            if passed:
                passed_count += 1

            results.append(QualityTestResult(
                text1=test.text1,
                text2=test.text2,
                expected=test.expected_similarity,
                actual_similarity=round(similarity, 3),
                passed=passed,
                message=message
            ))

        overall_score = (passed_count / len(test_pairs)) * 100 if test_pairs else 0

        return QualityValidationResponse(
            model_id=request.model_id,
            total_tests=len(test_pairs),
            passed_tests=passed_count,
            failed_tests=len(test_pairs) - passed_count,
            overall_score=round(overall_score, 2),
            results=results
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quality validation failed: {str(e)}")


# ===== VECTOR STORE ANALYTICS =====

@router.get("/vectorstore/analytics", response_model=VectorStoreAnalyticsResponse)
async def get_vectorstore_analytics(
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed analytics for both Chroma and FAISS vector stores.
    Uses vector_store_manager for ChromaDB.
    """
    from ..database.models import Document
    import faiss as faiss_lib
    
    try:
        # Get Chroma stats using vector_store_manager
        chroma_stats = {}
        try:
            stats = vector_store_manager.get_stats()
            chroma_data = stats.get("chroma", {})
            chroma_db_path = vector_store_manager.base_dir / "database" / "chroma_db"
            
            disk_usage = 0
            if chroma_db_path.exists():
                disk_usage = get_directory_size(chroma_db_path) * 1024  # Convert to MB
            
            chroma_stats = {
                "total_chunks": chroma_data.get("total_documents", 0),
                "collection_name": "documents",
                "disk_path": str(chroma_db_path),
                "disk_usage_mb": round(disk_usage, 2),
                "last_persist": datetime.now().isoformat(),
            }
        except Exception as e:
            chroma_stats = {"error": str(e), "total_chunks": 0}

        # Get FAISS stats from document folders
        faiss_stats = {}
        try:
            total_vectors = 0
            dimension = embedding_service.active_dimension or 384  # Use active dimension or default
            index_type = "IndexFlatIP"
            total_memory = 0
            
            # Get all processed documents (indexed, enriched, processed)
            documents = db.query(Document).filter(
                Document.status.in_(["indexed", "enriched", "processed"]),
                Document.vector_indexed == True
            ).all()
            
            base_dir = vector_store_manager.base_dir
            
            import tempfile
            
            for doc in documents:
                faiss_path = base_dir / doc.folder_name / "vectors" / f"doc_{doc.id}.faiss"
                if faiss_path.exists():
                    try:
                        # Try direct read first
                        try:
                            index = faiss_lib.read_index(str(faiss_path))
                        except Exception:
                            # Fallback: copy to temp file for Unicode path issues
                            with tempfile.NamedTemporaryFile(suffix='.faiss', delete=False) as tmp:
                                tmp_path = tmp.name
                            shutil.copy2(str(faiss_path), tmp_path)
                            index = faiss_lib.read_index(tmp_path)
                            os.unlink(tmp_path)
                        
                        total_vectors += index.ntotal
                        dimension = index.d
                        index_type = type(index).__name__
                        # Memory estimate
                        total_memory += (index.ntotal * index.d * 4) / (1024 * 1024)
                    except Exception as e:
                        logger.warning(f"Could not read FAISS index {faiss_path}: {e}")
            
            faiss_stats = {
                "total_vectors": total_vectors,
                "dimension": dimension,
                "index_type": index_type,
                "memory_usage_mb": round(total_memory, 2),
                "disk_path": str(base_dir),
                "is_trained": True,
                "document_count": len(documents)
            }
        except Exception as e:
            faiss_stats = {"error": str(e), "total_vectors": 0}

        # Sync status
        chroma_count = chroma_stats.get("total_chunks", 0)
        faiss_count = faiss_stats.get("total_vectors", 0)
        sync_status = {
            "chroma_count": chroma_count,
            "faiss_count": faiss_count,
            "difference": abs(chroma_count - faiss_count),
            "is_synced": abs(chroma_count - faiss_count) < 10,
        }

        return VectorStoreAnalyticsResponse(
            chroma_stats=chroma_stats,
            faiss_stats=faiss_stats,
            sync_status=sync_status
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


# ===== MODEL DOWNLOAD =====

# Global dictionary to track download progress
download_progress_tracker: Dict[str, Dict[str, Any]] = {}

class ModelDownloadRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    model_id: str = Field(..., description="Model ID to download (e.g., 'sentence-transformers/all-MiniLM-L6-v2')")

class ModelDownloadResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    message: str
    model_id: str
    status: str

class DownloadProgressResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    model_id: str
    progress: float
    status: str
    downloaded_mb: Optional[float] = None
    total_mb: Optional[float] = None
    speed_mbps: Optional[float] = None
    error: Optional[str] = None

@router.get("/models/download/active")
async def get_active_downloads(
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get list of currently downloading models
    """
    active_downloads = {}
    for model_id, progress in download_progress_tracker.items():
        status = progress.get("status", "")
        # Check if download is in progress (not completed or failed)
        is_active = status not in ["completed", "failed", ""] and progress.get("progress", 0) < 100
        
        if is_active:
            active_downloads[model_id] = {
                "model_id": model_id,
                "db_id": progress.get("db_id"),
                "progress": progress.get("progress", 0),
                "status": status,
                "downloaded_mb": progress.get("downloaded_mb"),
                "total_mb": progress.get("total_mb")
            }
    return {"active_downloads": active_downloads}

@router.post("/models/download/{model_db_id}", response_model=ModelDownloadResponse)
async def download_model(
    model_db_id: int,
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Start downloading an embedding model with real progress tracking using database ID
    """
    import threading
    from huggingface_hub import snapshot_download, hf_hub_download
    from huggingface_hub.utils import HfHubHTTPError
    import requests
    
    from ..database.models import EmbeddingModel
    
    # Get model from database
    db_model = db.query(EmbeddingModel).filter(
        EmbeddingModel.id == model_db_id
    ).first()
    
    if not db_model:
        raise HTTPException(status_code=404, detail=f"Model ID {model_db_id} not found in database")
    
    model_id = db_model.model_id
    
    # Check if already downloading
    if model_id in download_progress_tracker:
        if download_progress_tracker[model_id].get("status") == "downloading":
            raise HTTPException(status_code=400, detail="Model is already being downloaded")
    
    # Initialize progress tracker
    download_progress_tracker[model_id] = {
        "db_id": model_db_id,  # Store database ID for frontend reference
        "progress": 0,
        "status": "starting",
        "downloaded_mb": 0,
        "total_mb": 0,
        "speed_mbps": 0,
        "error": None,
        "start_time": time.time()
    }
    
    def download_in_background():
        """Background download function with real progress"""
        try:
            download_progress_tracker[model_id]["status"] = "Bağlantı kuruluyor..."
            download_progress_tracker[model_id]["progress"] = 1
            
            # Get model info to calculate total size
            try:
                from huggingface_hub import model_info
                info = model_info(model_id)
                total_size = sum(sibling.size for sibling in info.siblings if sibling.size)
                download_progress_tracker[model_id]["total_mb"] = total_size / (1024 * 1024)
                download_progress_tracker[model_id]["status"] = f"Model boyutu: {total_size / (1024 * 1024):.1f} MB"
            except:
                download_progress_tracker[model_id]["total_mb"] = 0
            
            download_progress_tracker[model_id]["progress"] = 5
            download_progress_tracker[model_id]["status"] = "Model dosyaları indiriliyor..."
            
            # Download with progress tracking
            downloaded_bytes = 0
            start_time = time.time()
            
            # Use snapshot_download which downloads all model files
            from sentence_transformers import SentenceTransformer
            
            # Update progress periodically by checking cache directory
            def update_progress():
                cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
                model_cache_name = "models--" + model_id.replace("/", "--")
                
                while download_progress_tracker[model_id].get("status") not in ["completed", "failed"]:
                    elapsed = time.time() - start_time
                    
                    # Check actual downloaded size
                    current_size = 0
                    for item in cache_dir.glob(f"{model_cache_name}*"):
                        if item.is_dir():
                            current_size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
                            break
                    
                    downloaded_mb = current_size / (1024 * 1024)
                    download_progress_tracker[model_id]["downloaded_mb"] = downloaded_mb
                    
                    # Calculate speed
                    if elapsed > 0:
                        speed = downloaded_mb / elapsed
                        download_progress_tracker[model_id]["speed_mbps"] = speed
                    
                    # Calculate progress
                    total_mb = download_progress_tracker[model_id].get("total_mb", 0)
                    if total_mb > 0:
                        progress = min(95, (downloaded_mb / total_mb) * 100)
                    else:
                        # Estimate based on time if size unknown
                        progress = min(95, 5 + (elapsed / 10) * 90)
                    
                    download_progress_tracker[model_id]["progress"] = progress
                    time.sleep(1)
            
            # Start progress updater in separate thread
            progress_thread = threading.Thread(target=update_progress, daemon=True)
            progress_thread.start()
            
            # Actually download the model
            model = SentenceTransformer(model_id)
            
            # Download completed
            download_progress_tracker[model_id]["status"] = "completed"
            download_progress_tracker[model_id]["progress"] = 100
            
            # Calculate final size
            cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
            model_cache_dir = None
            for item in cache_dir.glob("models--*"):
                if model_id.replace("/", "--") in item.name:
                    model_cache_dir = item
                    break
            
            if model_cache_dir:
                total_size = sum(f.stat().st_size for f in model_cache_dir.rglob("*") if f.is_file())
                download_progress_tracker[model_id]["downloaded_mb"] = total_size / (1024 * 1024)
                download_progress_tracker[model_id]["total_mb"] = total_size / (1024 * 1024)
            
            # UPDATE DATABASE: Mark model as downloaded
            from ..database.connection import SessionLocal
            db_session = SessionLocal()
            try:
                db_model_update = db_session.query(EmbeddingModel).filter(
                    EmbeddingModel.id == model_db_id
                ).first()
                if db_model_update:
                    db_model_update.is_downloaded = 1  # Use 1 instead of True for SQLite
                    db_session.commit()
                    print(f"✅ Updated database: ID={model_db_id}, {model_id} is_downloaded = 1")
                else:
                    print(f"⚠️ Model ID {model_db_id} not found in database")
            except Exception as db_error:
                print(f"❌ Database update failed: {db_error}")
                import traceback
                traceback.print_exc()
            finally:
                db_session.close()
            
        except Exception as e:
            download_progress_tracker[model_id]["status"] = "failed"
            download_progress_tracker[model_id]["error"] = str(e)
    
    # Start download in background thread
    thread = threading.Thread(target=download_in_background, daemon=True)
    thread.start()
    
    return ModelDownloadResponse(
        message=f"Download started for {model_id}",
        model_id=model_id,
        status="started"
    )

@router.get("/models/download/progress/{model_id}", response_model=DownloadProgressResponse)
async def get_download_progress(
    model_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get download progress for a model
    """
    if model_id not in download_progress_tracker:
        raise HTTPException(status_code=404, detail="No download found for this model")
    
    progress_data = download_progress_tracker[model_id]
    
    return DownloadProgressResponse(
        model_id=model_id,
        progress=progress_data.get("progress", 0),
        status=progress_data.get("status", "unknown"),
        downloaded_mb=progress_data.get("downloaded_mb"),
        total_mb=progress_data.get("total_mb"),
        speed_mbps=progress_data.get("speed_mbps"),
        error=progress_data.get("error")
    )


# ===== EMBEDDING SEARCH TEST =====

class SearchTestRequest(BaseModel):
    query: str = Field(..., description="Search query text")
    search_mode: str = Field("all", description="Search mode: 'all', 'document', 'sample'")
    document_id: Optional[int] = Field(None, description="Document ID for 'document' mode")
    sample_text: Optional[str] = Field(None, description="Sample text for 'sample' mode")
    top_k: int = Field(5, ge=1, le=20, description="Number of results to return")
    chunk_size: int = Field(750, ge=100, le=2000, description="Chunk size for sample mode")
    chunk_overlap: int = Field(100, ge=0, le=500, description="Chunk overlap for sample mode")

class SearchResultItem(BaseModel):
    rank: int
    content: str
    score: float
    source: Optional[str] = None
    chunk_index: Optional[int] = None
    metadata: Dict[str, Any] = {}

class SearchTestResponse(BaseModel):
    query: str
    query_embedding_preview: List[float]  # First 5 values
    search_mode: str
    total_results: int
    search_time_ms: float
    results: List[SearchResultItem]

@router.post("/search/test", response_model=SearchTestResponse)
async def test_embedding_search(
    request: SearchTestRequest,
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Test embedding search with different modes:
    - 'all': Search in all documents in VectorDB
    - 'document': Search in a specific document
    - 'sample': Search in provided sample text (creates temporary embeddings)
    """
    import time
    start_time = time.time()
    
    try:
        # Generate query embedding
        query_embedding = embedding_service.encode_single(request.query, db)
        query_embedding_list = query_embedding.tolist()
        
        results = []
        
        if request.search_mode == "sample":
            # Search in sample text - create temporary chunks and embeddings
            if not request.sample_text:
                raise HTTPException(status_code=400, detail="sample_text is required for 'sample' mode")
            
            # Chunk the sample text
            try:
                from langchain_text_splitters import RecursiveCharacterTextSplitter
            except ImportError:
                try:
                    from langchain.text_splitter import RecursiveCharacterTextSplitter
                except ImportError:
                    from langchain_community.text_splitter import RecursiveCharacterTextSplitter
            
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=request.chunk_size,
                chunk_overlap=request.chunk_overlap,
                length_function=len,
            )
            chunks = text_splitter.split_text(request.sample_text)
            
            # Generate embeddings for chunks
            chunk_embeddings = [embedding_service.encode_single(chunk, db) for chunk in chunks]
            
            # Calculate similarities
            similarities = []
            for i, (chunk, chunk_emb) in enumerate(zip(chunks, chunk_embeddings)):
                # Cosine similarity
                similarity = float(np.dot(query_embedding, chunk_emb) / 
                                 (np.linalg.norm(query_embedding) * np.linalg.norm(chunk_emb)))
                similarities.append((i, chunk, similarity))
            
            # Sort by similarity
            similarities.sort(key=lambda x: x[2], reverse=True)
            
            # Take top_k
            for rank, (idx, chunk, score) in enumerate(similarities[:request.top_k], 1):
                results.append(SearchResultItem(
                    rank=rank,
                    content=chunk,
                    score=round(score, 4),
                    source="Örnek Metin",
                    chunk_index=idx,
                    metadata={"mode": "sample", "total_chunks": len(chunks)}
                ))
        
        elif request.search_mode == "document":
            # Search in specific document using vector_store_manager
            if not request.document_id:
                raise HTTPException(status_code=400, detail="document_id is required for 'document' mode")
            
            try:
                stats = vector_store_manager.get_stats()
                chroma_stats = stats.get("chroma", {})
                
                if chroma_stats.get("total_documents", 0) == 0:
                    raise HTTPException(status_code=404, detail="VectorDB is empty. Please process documents first.")
                
                # Use embedding_service for query
                query_emb = embedding_service.encode_query(request.query, db)
                
                # Search with document filter
                search_results = vector_store_manager.search(
                    query_embedding=query_emb,
                    top_k=request.top_k,
                    document_ids=[request.document_id],
                    use_chroma=True
                )
                
                if search_results:
                    for rank, result in enumerate(search_results, 1):
                        results.append(SearchResultItem(
                            rank=rank,
                            content=result.text,
                            score=round(result.score, 4),
                            source=result.metadata.get("document_name", "Unknown"),
                            chunk_index=result.metadata.get("chunk_index"),
                            metadata=result.metadata
                        ))
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Document search failed: {str(e)}")
        
        else:  # 'all' mode
            # Search in all documents using vector_store_manager
            try:
                stats = vector_store_manager.get_stats()
                chroma_stats = stats.get("chroma", {})
                
                if chroma_stats.get("total_documents", 0) == 0:
                    raise HTTPException(status_code=404, detail="VectorDB is empty. Please upload and process documents first.")
                
                # Use embedding_service for query
                query_emb = embedding_service.encode_query(request.query, db)
                
                # Search all documents
                search_results = vector_store_manager.search(
                    query_embedding=query_emb,
                    top_k=request.top_k,
                    use_chroma=True
                )
                
                if search_results:
                    for rank, result in enumerate(search_results, 1):
                        results.append(SearchResultItem(
                            rank=rank,
                            content=result.text,
                            score=round(result.score, 4),
                            source=result.metadata.get("document_name", "Unknown"),
                            chunk_index=result.metadata.get("chunk_index"),
                            metadata=result.metadata
                        ))
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
        
        elapsed_time = (time.time() - start_time) * 1000
        
        return SearchTestResponse(
            query=request.query,
            query_embedding_preview=query_embedding_list[:5],
            search_mode=request.search_mode,
            total_results=len(results),
            search_time_ms=round(elapsed_time, 2),
            results=results
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search test failed: {str(e)}")


@router.get("/search/documents")
async def get_searchable_documents(
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get list of documents available for search testing
    """
    try:
        from ..database.models import Document
        
        # Support new pipeline statuses: indexed, enriched, processed
        documents = db.query(Document).filter(
            Document.status.in_(["indexed", "enriched", "processed"]),
            Document.vector_indexed == True  # Ensure vectors are indexed
        ).all()
        
        return {
            "total": len(documents),
            "documents": [
                {
                    "id": doc.id,
                    "filename": doc.name,  # Fixed: was doc.filename
                    "chunk_count": doc.total_chunks or 0,  # Fixed: was doc.chunk_count
                    "created_at": doc.created_at.isoformat() if doc.created_at else None
                }
                for doc in documents
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")
