"""
Image Embedding Service for CLIP Semantic Search
Manages CLIP embedding generation and storage for document images.
"""

import logging
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime, timezone
import asyncio
from pathlib import Path

from sqlalchemy.orm import Session

from .clip_service import get_clip_service, CLIPService, CLIPEncodingError, CLIPModelLoadError

logger = logging.getLogger(__name__)


class ImageEmbeddingService:
    """
    Service for managing image embeddings in pgvector.
    Handles embedding generation, storage, and status tracking.
    """
    
    def __init__(self, clip_service: Optional[CLIPService] = None):
        """
        Initialize with CLIP service dependency.
        
        Args:
            clip_service: Optional CLIPService instance (uses singleton if not provided)
        """
        self._clip_service = clip_service
    
    @property
    def clip_service(self) -> CLIPService:
        """Get CLIP service (lazy initialization)."""
        if self._clip_service is None:
            self._clip_service = get_clip_service()
        return self._clip_service
    
    async def generate_embedding(
        self,
        asset_id: int,
        image_path: str,
        db: Session
    ) -> bool:
        """
        Generate and store embedding for a single image.
        
        Args:
            asset_id: DocumentAsset ID
            image_path: Path to image file
            db: Database session
            
        Returns:
            Success status
        """
        from ..database.models_v2 import DocumentAsset
        
        try:
            # Check if CLIP is available
            if not self.clip_service.is_available():
                logger.warning(f"⚠️ CLIP service not available, skipping embedding for asset {asset_id}")
                return False
            
            # Verify image exists
            if not Path(image_path).exists():
                logger.warning(f"⚠️ Image not found: {image_path}")
                return False
            
            # Generate embedding
            logger.info(f"🖼️ Generating CLIP embedding for asset {asset_id}")
            embedding = self.clip_service.encode_image(image_path)
            
            # Get asset and update
            asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
            if not asset:
                logger.error(f"❌ Asset not found: {asset_id}")
                return False
            
            # Store embedding
            asset.clip_embedding = embedding.tolist()
            asset.clip_embedding_generated_at = datetime.now(timezone.utc)
            asset.clip_model_version = self.clip_service.model_name
            
            db.commit()
            logger.info(f"✅ CLIP embedding stored for asset {asset_id}")
            return True
            
        except CLIPEncodingError as e:
            logger.error(f"❌ CLIP encoding error for asset {asset_id}: {e}")
            db.rollback()
            return False
        except Exception as e:
            logger.error(f"❌ Error generating embedding for asset {asset_id}: {e}")
            db.rollback()
            return False

    async def generate_embeddings_for_document(
        self,
        document_id: int,
        db: Session,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Generate embeddings for all images in a document.
        
        Args:
            document_id: Document ID
            db: Database session
            progress_callback: Optional callback(current, total, message)
            
        Returns:
            Result with success count and errors
        """
        from ..database.models_v2 import DocumentAsset
        
        result = {
            "document_id": document_id,
            "total": 0,
            "success": 0,
            "failed": 0,
            "skipped": 0,
            "errors": []
        }
        
        try:
            # Check CLIP availability
            if not self.clip_service.is_available():
                logger.warning(f"⚠️ CLIP service not available")
                result["errors"].append("CLIP service not available")
                return result
            
            # Get all image assets for document
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id,
                DocumentAsset.asset_type == "image"
            ).all()
            
            result["total"] = len(assets)
            
            if not assets:
                logger.info(f"📄 No images found for document {document_id}")
                return result
            
            logger.info(f"🖼️ Generating CLIP embeddings for {len(assets)} images in document {document_id}")
            
            # Process each asset
            for i, asset in enumerate(assets):
                try:
                    if progress_callback:
                        progress_callback(i + 1, len(assets), f"Processing image {i + 1}/{len(assets)}")
                    
                    # Skip if already has embedding
                    if asset.clip_embedding is not None:
                        logger.debug(f"⏭️ Asset {asset.id} already has embedding, skipping")
                        result["skipped"] += 1
                        continue
                    
                    # Check file exists
                    if not asset.file_path or not Path(asset.file_path).exists():
                        logger.warning(f"⚠️ Image file not found for asset {asset.id}: {asset.file_path}")
                        result["failed"] += 1
                        result["errors"].append(f"Asset {asset.id}: File not found")
                        continue
                    
                    # Generate embedding
                    embedding = self.clip_service.encode_image(asset.file_path)
                    
                    # Store embedding
                    asset.clip_embedding = embedding.tolist()
                    asset.clip_embedding_generated_at = datetime.now(timezone.utc)
                    asset.clip_model_version = self.clip_service.model_name
                    
                    result["success"] += 1
                    
                except CLIPEncodingError as e:
                    logger.warning(f"⚠️ Failed to encode asset {asset.id}: {e}")
                    result["failed"] += 1
                    result["errors"].append(f"Asset {asset.id}: {str(e)}")
                except Exception as e:
                    logger.error(f"❌ Error processing asset {asset.id}: {e}")
                    result["failed"] += 1
                    result["errors"].append(f"Asset {asset.id}: {str(e)}")
            
            # Commit all changes
            db.commit()
            
            logger.info(f"✅ CLIP embeddings generated: {result['success']} success, {result['failed']} failed, {result['skipped']} skipped")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error generating embeddings for document {document_id}: {e}")
            db.rollback()
            result["errors"].append(str(e))
            return result
    
    async def regenerate_embedding(
        self,
        asset_id: int,
        db: Session
    ) -> bool:
        """
        Regenerate embedding for an updated image.
        Uses atomic update to ensure consistency.
        
        Args:
            asset_id: DocumentAsset ID
            db: Database session
            
        Returns:
            Success status
        """
        from ..database.models_v2 import DocumentAsset
        
        try:
            # Get asset
            asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
            if not asset:
                logger.error(f"❌ Asset not found: {asset_id}")
                return False
            
            # Check CLIP availability
            if not self.clip_service.is_available():
                logger.warning(f"⚠️ CLIP service not available")
                return False
            
            # Check file exists
            if not asset.file_path or not Path(asset.file_path).exists():
                logger.warning(f"⚠️ Image file not found: {asset.file_path}")
                return False
            
            logger.info(f"🔄 Regenerating CLIP embedding for asset {asset_id}")
            
            # Generate new embedding
            embedding = self.clip_service.encode_image(asset.file_path)
            
            # Atomic update
            asset.clip_embedding = embedding.tolist()
            asset.clip_embedding_generated_at = datetime.now(timezone.utc)
            asset.clip_model_version = self.clip_service.model_name
            
            db.commit()
            logger.info(f"✅ CLIP embedding regenerated for asset {asset_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error regenerating embedding for asset {asset_id}: {e}")
            db.rollback()
            return False
    
    def get_embedding_status(
        self,
        document_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Get embedding generation status for a document.
        
        Args:
            document_id: Document ID
            db: Database session
            
        Returns:
            Status dictionary with counts and details
        """
        from ..database.models_v2 import DocumentAsset
        
        try:
            # Get all image assets
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id,
                DocumentAsset.asset_type == "image"
            ).all()
            
            total = len(assets)
            with_embedding = sum(1 for a in assets if a.clip_embedding is not None)
            without_embedding = total - with_embedding
            
            # Get latest generation timestamp
            latest_timestamp = None
            model_versions = set()
            
            for asset in assets:
                if asset.clip_embedding_generated_at:
                    if latest_timestamp is None or asset.clip_embedding_generated_at > latest_timestamp:
                        latest_timestamp = asset.clip_embedding_generated_at
                if asset.clip_model_version:
                    model_versions.add(asset.clip_model_version)
            
            return {
                "document_id": document_id,
                "total_images": total,
                "with_embedding": with_embedding,
                "without_embedding": without_embedding,
                "completion_percentage": round((with_embedding / total * 100) if total > 0 else 0, 1),
                "latest_generation": latest_timestamp.isoformat() if latest_timestamp else None,
                "model_versions": list(model_versions),
                "clip_available": self.clip_service.is_available()
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting embedding status for document {document_id}: {e}")
            return {
                "document_id": document_id,
                "error": str(e)
            }
    
    async def regenerate_all_embeddings(
        self,
        document_id: int,
        db: Session,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Regenerate all embeddings for a document (force regeneration).
        
        Args:
            document_id: Document ID
            db: Database session
            progress_callback: Optional callback(current, total, message)
            
        Returns:
            Result with success count and errors
        """
        from ..database.models_v2 import DocumentAsset
        
        result = {
            "document_id": document_id,
            "total": 0,
            "success": 0,
            "failed": 0,
            "errors": []
        }
        
        try:
            # Check CLIP availability
            if not self.clip_service.is_available():
                logger.warning(f"⚠️ CLIP service not available")
                result["errors"].append("CLIP service not available")
                return result
            
            # Get all image assets
            assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id,
                DocumentAsset.asset_type == "image"
            ).all()
            
            result["total"] = len(assets)
            
            if not assets:
                logger.info(f"📄 No images found for document {document_id}")
                return result
            
            logger.info(f"🔄 Regenerating CLIP embeddings for {len(assets)} images in document {document_id}")
            
            # Process each asset
            for i, asset in enumerate(assets):
                try:
                    if progress_callback:
                        progress_callback(i + 1, len(assets), f"Regenerating image {i + 1}/{len(assets)}")
                    
                    # Check file exists
                    if not asset.file_path or not Path(asset.file_path).exists():
                        logger.warning(f"⚠️ Image file not found for asset {asset.id}: {asset.file_path}")
                        result["failed"] += 1
                        result["errors"].append(f"Asset {asset.id}: File not found")
                        continue
                    
                    # Generate embedding
                    embedding = self.clip_service.encode_image(asset.file_path)
                    
                    # Store embedding
                    asset.clip_embedding = embedding.tolist()
                    asset.clip_embedding_generated_at = datetime.now(timezone.utc)
                    asset.clip_model_version = self.clip_service.model_name
                    
                    result["success"] += 1
                    
                except CLIPEncodingError as e:
                    logger.warning(f"⚠️ Failed to encode asset {asset.id}: {e}")
                    result["failed"] += 1
                    result["errors"].append(f"Asset {asset.id}: {str(e)}")
                except Exception as e:
                    logger.error(f"❌ Error processing asset {asset.id}: {e}")
                    result["failed"] += 1
                    result["errors"].append(f"Asset {asset.id}: {str(e)}")
            
            # Commit all changes
            db.commit()
            
            logger.info(f"✅ CLIP embeddings regenerated: {result['success']} success, {result['failed']} failed")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error regenerating embeddings for document {document_id}: {e}")
            db.rollback()
            result["errors"].append(str(e))
            return result


# Singleton instance
_image_embedding_service: Optional[ImageEmbeddingService] = None


def get_image_embedding_service() -> ImageEmbeddingService:
    """Get singleton instance of ImageEmbeddingService."""
    global _image_embedding_service
    
    if _image_embedding_service is None:
        _image_embedding_service = ImageEmbeddingService()
    
    return _image_embedding_service
