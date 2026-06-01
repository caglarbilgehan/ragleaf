"""
Vector Store Admin API
Admin endpoints for managing and monitoring vector stores

MIGRATED: Now uses new unified services:
- vector_store_manager for vector operations
- embedding_service for model info
"""

import logging
from typing import Dict, Any
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends

from ..auth.dependencies import get_current_active_user
from ..services.vectorstore.vector_store_manager import vector_store_manager
from ..services.embedding.embedding_service import embedding_service

logger = logging.getLogger(__name__)

vectorstore_admin_router = APIRouter()


@vectorstore_admin_router.get("/admin/vectorstore/status")
async def get_vectorstore_status(
    current_user = Depends(get_current_active_user)
):
    """
    Get comprehensive status of vector stores.

    Returns:
        - ChromaDB document count
        - Embedding model info
        - Storage paths
    """
    try:
        # Use new vector_store_manager
        stats = vector_store_manager.get_stats()
        chroma_stats = stats.get("chroma", {})

        status = {
            "chroma": {
                "exists": True,
                "document_count": chroma_stats.get("total_documents", 0),
                "directory": str(vector_store_manager.base_dir / "database" / "chroma_db"),
                "collection_name": "documents"
            },
            "embedding_model": embedding_service.active_model_id or "not loaded",
            "vector_dim": embedding_service.active_dimension or stats.get("dimension"),
            "chunk_size": 512,  # Default from chunking_service
            "chunk_overlap": 100,
            "timestamp": datetime.now().isoformat()
        }

        return {
            "success": True,
            "status": status
        }

    except Exception as e:
        logger.error(f"Status retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@vectorstore_admin_router.get("/admin/vectorstore/health")
async def check_vectorstore_health(
    current_user = Depends(get_current_active_user)
):
    """
    Health check for vector stores.

    Returns:
        - Overall health status
        - Individual component health
        - Warnings/issues
    """
    try:
        health = {
            "overall_status": "healthy",
            "components": {},
            "warnings": [],
            "timestamp": datetime.now().isoformat()
        }

        # Check ChromaDB using vector_store_manager
        try:
            stats = vector_store_manager.get_stats()
            chroma_stats = stats.get("chroma", {})
            doc_count = chroma_stats.get("total_documents", 0)

            health["components"]["chroma"] = {
                "status": "healthy" if doc_count > 0 else "empty",
                "document_count": doc_count,
                "directory": str(vector_store_manager.base_dir / "database" / "chroma_db")
            }

            if doc_count == 0:
                health["warnings"].append("ChromaDB has no documents")
                health["overall_status"] = "warning"
        except Exception as e:
            health["components"]["chroma"] = {
                "status": "error",
                "error": str(e)
            }
            health["overall_status"] = "unhealthy"
            health["warnings"].append(f"ChromaDB error: {str(e)}")

        return health

    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@vectorstore_admin_router.post("/admin/vectorstore/rebuild-faiss")
async def trigger_faiss_rebuild(
    current_user = Depends(get_current_active_user)
):
    """
    FAISS rebuild - deprecated, ChromaDB is the primary store now.
    """
    return {
        "success": True,
        "message": "FAISS is deprecated. ChromaDB is the primary vector store.",
        "result": {"note": "No action needed"}
    }


@vectorstore_admin_router.get("/admin/vectorstore/stats")
async def get_vectorstore_stats(
    current_user = Depends(get_current_active_user)
):
    """
    Get detailed statistics about vector stores.

    Returns:
        - Document/vector counts
        - Storage sizes
        - Configuration info
    """
    try:
        stats = vector_store_manager.get_stats()
        chroma_stats = stats.get("chroma", {})
        chroma_dir = vector_store_manager.base_dir / "database" / "chroma_db"

        result_stats = {
            "configuration": {
                "embedding_model": embedding_service.active_model_id or "not loaded",
                "vector_dim": embedding_service.active_dimension or stats.get("dimension"),
                "chunk_size": 512,
                "chunk_overlap": 100,
                "collection_name": "documents"
            },
            "chroma": {
                "document_count": chroma_stats.get("total_documents", 0),
                "storage_path": str(chroma_dir),
                "storage_size_mb": _get_directory_size(chroma_dir)
            }
        }

        return {
            "success": True,
            "stats": result_stats
        }

    except Exception as e:
        logger.error(f"Stats retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _get_directory_size(directory: Path) -> float:
    """
    Get total size of directory in MB.

    Args:
        directory: Directory path

    Returns:
        float: Size in MB
    """
    if not directory.exists():
        return 0.0

    total_size = 0
    for file in directory.rglob('*'):
        if file.is_file():
            total_size += file.stat().st_size

    return round(total_size / (1024 * 1024), 2)
