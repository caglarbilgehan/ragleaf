# backend/services/storage_service.py
"""
Multi-Tenant Storage Service
============================
Centralized file storage abstraction for multi-tenant architecture.
Supports both local filesystem and MinIO (S3-compatible) backends.

Directory Structure (per tenant):
    storage/
    ├── {org_slug}/
    │   ├── documents/
    │   │   └── {folder_name}/
    │   │       ├── original/        # Uploaded raw files
    │   │       ├── processed/       # OCR results, extracted text
    │   │       ├── images/          # Extracted/uploaded images
    │   │       │   ├── extracted/   # Auto-extracted images
    │   │       │   └── external/    # Manually uploaded images
    │   │       ├── text/            # Legacy text location
    │   │       ├── metadata.json
    │   │       ├── processing_log.json
    │   │       └── index.faiss
    │   ├── backups/                 # Tenant-specific backups
    │   └── indexes/                 # FAISS/vector indexes
    └── _system/
        ├── backups/                 # System-wide backups
        └── indexes/                 # Shared indexes

Usage:
    from backend.services.storage_service import storage
    
    # Get document path for a tenant
    path = storage.get_document_path("acme-corp", "doc_001_manual")
    
    # Get upload directory
    upload_dir = storage.get_upload_dir("acme-corp", "doc_001_manual")
    
    # Ensure tenant directory structure exists
    storage.ensure_tenant_dirs("acme-corp")
"""

import os
import logging
import shutil
from pathlib import Path
from typing import Optional, List

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Base storage root — mapped as Docker volume: ./storage:/app/storage
STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "./storage"))

# System-level directory name (not a tenant)
SYSTEM_DIR = "_system"

# Default tenant slug used for backward compatibility / single-tenant mode
DEFAULT_TENANT = os.getenv("DEFAULT_TENANT_SLUG", "default")


class StorageService:
    """
    Multi-tenant storage service.
    
    All file I/O across the application should go through this service
    to ensure proper tenant isolation and consistent path resolution.
    """
    
    def __init__(self, root: Optional[Path] = None):
        self._root = root or STORAGE_ROOT
        self._ensure_root()
    
    # ======================================================================
    # Properties
    # ======================================================================
    
    @property
    def root(self) -> Path:
        """Storage root directory."""
        return self._root
    
    # ======================================================================
    # Tenant Directory Management
    # ======================================================================
    
    def get_tenant_root(self, org_slug: str) -> Path:
        """
        Get the root directory for a tenant.
        
        Args:
            org_slug: Organization slug (e.g., "acme-corp")
            
        Returns:
            Path to tenant root: storage/{org_slug}/
        """
        return self._root / self._sanitize_slug(org_slug)
    
    def ensure_tenant_dirs(self, org_slug: str) -> Path:
        """
        Create the full directory structure for a tenant.
        Called when a new Organization is created.
        
        Args:
            org_slug: Organization slug
            
        Returns:
            Path to tenant root
        """
        slug = self._sanitize_slug(org_slug)
        tenant_root = self._root / slug
        
        # Create standard directories
        dirs = [
            tenant_root / "documents",
            tenant_root / "backups",
            tenant_root / "indexes",
        ]
        
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"📁 Tenant storage initialized: {tenant_root}")
        return tenant_root
    
    def delete_tenant_storage(self, org_slug: str) -> bool:
        """
        Delete all storage for a tenant (dangerous!).
        Called when an Organization is permanently deleted.
        
        Args:
            org_slug: Organization slug
            
        Returns:
            True if deleted successfully
        """
        slug = self._sanitize_slug(org_slug)
        tenant_root = self._root / slug
        
        if not tenant_root.exists():
            logger.warning(f"⚠️ Tenant storage not found: {slug}")
            return False
        
        # Safety check: never delete system dir
        if slug == SYSTEM_DIR:
            logger.error("🚫 Cannot delete system storage directory!")
            return False
        
        shutil.rmtree(tenant_root)
        logger.info(f"🗑️ Tenant storage deleted: {slug}")
        return True
    
    def list_tenants(self) -> List[str]:
        """List all tenant slugs that have storage directories."""
        if not self._root.exists():
            return []
        return [
            d.name for d in self._root.iterdir()
            if d.is_dir() and d.name != SYSTEM_DIR and not d.name.startswith(".")
        ]
    
    def get_tenant_size(self, org_slug: str) -> int:
        """Get total storage size in bytes for a tenant."""
        tenant_root = self.get_tenant_root(org_slug)
        if not tenant_root.exists():
            return 0
        total = 0
        for f in tenant_root.rglob("*"):
            if f.is_file():
                total += f.stat().st_size
        return total
    
    # ======================================================================
    # Document Paths
    # ======================================================================
    
    def get_document_root(self, org_slug: str) -> Path:
        """
        Get the documents directory for a tenant.
        
        Returns:
            storage/{org_slug}/documents/
        """
        return self.get_tenant_root(org_slug) / "documents"
    
    def get_document_path(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the directory for a specific document.
        
        Args:
            org_slug: Organization slug
            folder_name: Document folder name (e.g., "doc_001_manual_dc3500")
            
        Returns:
            storage/{org_slug}/documents/{folder_name}/
        """
        return self.get_document_root(org_slug) / folder_name
    
    def get_original_file_path(self, org_slug: str, folder_name: str, filename: str) -> Path:
        """
        Get path to the original uploaded file.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/original/{filename}
        """
        return self.get_document_path(org_slug, folder_name) / "original" / filename
    
    def get_upload_dir(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the upload directory for a document and ensure it exists.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/original/
        """
        upload_dir = self.get_document_path(org_slug, folder_name) / "original"
        upload_dir.mkdir(parents=True, exist_ok=True)
        return upload_dir
    
    def get_processed_dir(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the processed files directory for a document.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/processed/
        """
        processed_dir = self.get_document_path(org_slug, folder_name) / "processed"
        processed_dir.mkdir(parents=True, exist_ok=True)
        return processed_dir
    
    def get_images_dir(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the images directory for a document.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/images/
        """
        images_dir = self.get_document_path(org_slug, folder_name) / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        return images_dir
    
    def get_external_images_dir(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the external (manually uploaded) images directory.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/images/external/
        """
        ext_dir = self.get_images_dir(org_slug, folder_name) / "external"
        ext_dir.mkdir(parents=True, exist_ok=True)
        return ext_dir
    
    def get_metadata_path(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the metadata.json path for a document.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/metadata.json
        """
        return self.get_document_path(org_slug, folder_name) / "metadata.json"
    
    def get_processing_log_path(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the processing log path for a document.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/processing_log.json
        """
        return self.get_document_path(org_slug, folder_name) / "processing_log.json"
    
    def get_full_text_paths(self, org_slug: str, folder_name: str) -> List[Path]:
        """
        Get all possible full_text.txt paths (for backward compatibility).
        Returns paths in priority order (check each until one exists).
        
        Returns:
            List of possible paths for full text file
        """
        doc_path = self.get_document_path(org_slug, folder_name)
        return [
            doc_path / "processed" / "full_text.txt",
            doc_path / "processed" / "ocr_results" / "full_text.txt",
            doc_path / "processed" / "extracted_text.txt",
            doc_path / "text" / "extracted_text.txt",
        ]
    
    def get_index_path(self, org_slug: str, folder_name: str) -> Path:
        """
        Get the FAISS index path for a document.
        
        Returns:
            storage/{org_slug}/documents/{folder_name}/index.faiss
        """
        return self.get_document_path(org_slug, folder_name) / "index.faiss"
    
    def ensure_document_dirs(self, org_slug: str, folder_name: str) -> Path:
        """
        Create the full directory structure for a document.
        
        Returns:
            Path to document root
        """
        doc_path = self.get_document_path(org_slug, folder_name)
        subdirs = ["original", "processed", "images", "text"]
        for sub in subdirs:
            (doc_path / sub).mkdir(parents=True, exist_ok=True)
        return doc_path
    
    def delete_document_storage(self, org_slug: str, folder_name: str) -> bool:
        """
        Delete all files for a specific document.
        
        Args:
            org_slug: Organization slug
            folder_name: Document folder name
            
        Returns:
            True if deleted
        """
        doc_path = self.get_document_path(org_slug, folder_name)
        if not doc_path.exists():
            return False
        shutil.rmtree(doc_path)
        logger.info(f"🗑️ Document storage deleted: {org_slug}/{folder_name}")
        return True
    
    # ======================================================================
    # Index Paths
    # ======================================================================
    
    def get_tenant_indexes_dir(self, org_slug: str) -> Path:
        """
        Get the indexes directory for a tenant.
        
        Returns:
            storage/{org_slug}/indexes/
        """
        idx_dir = self.get_tenant_root(org_slug) / "indexes"
        idx_dir.mkdir(parents=True, exist_ok=True)
        return idx_dir
    
    def get_shared_index_path(self, index_name: str) -> Path:
        """
        Get path for a shared/system-level index.
        
        Returns:
            storage/_system/indexes/{index_name}
        """
        idx_dir = self._root / SYSTEM_DIR / "indexes"
        idx_dir.mkdir(parents=True, exist_ok=True)
        return idx_dir / index_name
    
    # ======================================================================
    # Backup Paths
    # ======================================================================
    
    def get_backup_dir(self, org_slug: Optional[str] = None) -> Path:
        """
        Get the backup directory.
        
        Args:
            org_slug: If provided, returns tenant-specific backup dir.
                      If None, returns system backup dir.
                      
        Returns:
            storage/{org_slug}/backups/ or storage/_system/backups/
        """
        if org_slug:
            backup_dir = self.get_tenant_root(org_slug) / "backups"
        else:
            backup_dir = self._root / SYSTEM_DIR / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        return backup_dir
    
    def get_backup_log_path(self, org_slug: Optional[str] = None) -> Path:
        """
        Get the backup log file path.
        
        Returns:
            Path to backup_logs.json
        """
        return self.get_backup_dir(org_slug) / "backup_logs.json"
    
    # ======================================================================
    # Vector Store Paths
    # ======================================================================
    
    def get_chroma_dir(self, org_slug: str) -> Path:
        """
        Get ChromaDB directory for a tenant.
        
        Returns:
            storage/{org_slug}/indexes/chroma_db/
        """
        chroma_dir = self.get_tenant_indexes_dir(org_slug) / "chroma_db"
        chroma_dir.mkdir(parents=True, exist_ok=True)
        return chroma_dir
    
    # ======================================================================
    # Asset / Image Serving
    # ======================================================================
    
    def get_asset_search_paths(self, org_slug: str, folder_name: str) -> List[str]:
        """
        Get all possible paths where document assets (images) might exist.
        Used for scanning/syncing assets.
        
        Returns:
            List of directory paths to search
        """
        doc_path = self.get_document_path(org_slug, folder_name)
        return [
            str(doc_path / "images"),
            str(doc_path / "images" / "extracted"),
            str(doc_path),
        ]
    
    def get_asset_sync_paths(self, org_slug: str, folder_name: str) -> tuple:
        """
        Get new and legacy asset paths for sync operations.
        
        Returns:
            (new_path, old_path) tuple
        """
        doc_path = self.get_document_path(org_slug, folder_name)
        return (
            str(doc_path / "images"),
            str(doc_path / "images" / "extracted"),
        )
    
    # ======================================================================
    # Backward Compatibility
    # ======================================================================
    
    def resolve_legacy_path(self, legacy_path: str, org_slug: Optional[str] = None) -> Path:
        """
        Convert a legacy path like './documents/{folder}/...' to the new
        multi-tenant path structure.
        
        Args:
            legacy_path: Old-style path (e.g., "./documents/doc_001/original/file.pdf")
            org_slug: Organization slug (uses DEFAULT_TENANT if not provided)
            
        Returns:
            New multi-tenant path
        """
        slug = org_slug or DEFAULT_TENANT
        
        # Strip leading ./
        clean_path = legacy_path.lstrip("./")
        
        # Replace 'documents/' prefix with tenant-scoped path
        if clean_path.startswith("documents/"):
            relative = clean_path[len("documents/"):]
            return self.get_document_root(slug) / relative
        
        # Replace 'backups/' prefix
        if clean_path.startswith("backups/"):
            relative = clean_path[len("backups/"):]
            return self.get_backup_dir(slug) / relative
        
        # Fallback: just put it under tenant root
        return self.get_tenant_root(slug) / clean_path
    
    # ======================================================================
    # Internal Helpers
    # ======================================================================
    
    def _ensure_root(self):
        """Create storage root and system directories."""
        self._root.mkdir(parents=True, exist_ok=True)
        (self._root / SYSTEM_DIR / "backups").mkdir(parents=True, exist_ok=True)
        (self._root / SYSTEM_DIR / "indexes").mkdir(parents=True, exist_ok=True)
    
    @staticmethod
    def _sanitize_slug(slug: str) -> str:
        """
        Sanitize organization slug for safe filesystem use.
        Prevents path traversal attacks.
        """
        # Remove any path separators and dangerous characters
        sanitized = slug.replace("/", "").replace("\\", "").replace("..", "").strip(".")
        if not sanitized:
            raise ValueError(f"Invalid organization slug: '{slug}'")
        return sanitized.lower()


# ---------------------------------------------------------------------------
# Singleton instance
# ---------------------------------------------------------------------------

_storage_instance: Optional[StorageService] = None


def get_storage() -> StorageService:
    """Get or create the global StorageService singleton."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = StorageService()
    return _storage_instance


# Convenience alias for direct import
storage = get_storage()
