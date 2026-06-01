# backend/services/image_context_manager.py
"""
Image Context Manager for Multi-Modal RAG.
Handles image preparation, resizing, and selection for LLM context.
"""

import base64
from io import BytesIO
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from PIL import Image
import logging

from .multimodal import ImageInput
from backend.database.models_v2 import DocumentAsset, MultiModalSettings

logger = logging.getLogger(__name__)


class ImageContextManager:
    """
    Manages image context for RAG queries.
    Handles image preparation, resizing, and selection.
    """
    
    def __init__(self, db: Session):
        """
        Initialize Image Context Manager.
        
        Args:
            db: Database session
        """
        self.db = db
        self._settings: Optional[MultiModalSettings] = None
    
    def _load_settings(self) -> MultiModalSettings:
        """Load settings from database"""
        if self._settings is None:
            self._settings = self.db.query(MultiModalSettings).first()
            if self._settings is None:
                # Create default settings
                self._settings = MultiModalSettings(
                    enabled=False,
                    max_images_per_query=3,
                    max_image_size=1024,
                    include_ocr=True,
                    include_caption=True
                )
                self.db.add(self._settings)
                self.db.commit()
        return self._settings
    
    def resize_image(
        self,
        image_path: str,
        max_size: int = None
    ) -> bytes:
        """
        Resize image to optimize token usage.
        
        Args:
            image_path: Path to image file
            max_size: Maximum dimension (width or height)
            
        Returns:
            Resized image as bytes
        """
        if max_size is None:
            settings = self._load_settings()
            max_size = settings.max_image_size
        
        try:
            with Image.open(image_path) as img:
                # Get original dimensions
                width, height = img.size
                
                # Check if resize is needed
                if width <= max_size and height <= max_size:
                    # No resize needed, return original
                    with open(image_path, "rb") as f:
                        return f.read()
                
                # Calculate new dimensions maintaining aspect ratio
                if width > height:
                    new_width = max_size
                    new_height = int(height * (max_size / width))
                else:
                    new_height = max_size
                    new_width = int(width * (max_size / height))
                
                # Resize
                resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Convert to bytes
                buffer = BytesIO()
                
                # Determine format
                format_map = {
                    ".jpg": "JPEG",
                    ".jpeg": "JPEG",
                    ".png": "PNG",
                    ".gif": "GIF",
                    ".webp": "WEBP",
                }
                suffix = Path(image_path).suffix.lower()
                img_format = format_map.get(suffix, "JPEG")
                
                # Handle RGBA for JPEG
                if img_format == "JPEG" and resized.mode == "RGBA":
                    resized = resized.convert("RGB")
                
                resized.save(buffer, format=img_format, quality=85)
                
                logger.info(f"🖼️ Resized image from {width}x{height} to {new_width}x{new_height}")
                
                return buffer.getvalue()
                
        except Exception as e:
            logger.error(f"❌ Failed to resize image {image_path}: {e}")
            # Return original on error
            with open(image_path, "rb") as f:
                return f.read()
    
    def prepare_images(
        self,
        image_paths: List[str],
        resize: bool = True
    ) -> List[ImageInput]:
        """
        Prepare images for LLM context.
        
        Args:
            image_paths: List of image file paths
            resize: Whether to resize images
            
        Returns:
            List of prepared ImageInput objects
        """
        settings = self._load_settings()
        prepared = []
        
        for path in image_paths[:settings.max_images_per_query]:
            try:
                # Get asset metadata from database
                asset = self.db.query(DocumentAsset).filter(
                    DocumentAsset.file_path.contains(Path(path).name)
                ).first()
                
                # Resize if needed
                if resize:
                    image_bytes = self.resize_image(path, settings.max_image_size)
                    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
                else:
                    with open(path, "rb") as f:
                        image_base64 = base64.b64encode(f.read()).decode("utf-8")
                
                # Get image dimensions
                try:
                    with Image.open(path) as img:
                        width, height = img.size
                except:
                    width, height = None, None
                
                # Build ImageInput
                image_input = ImageInput(
                    image_path=path,
                    image_base64=image_base64,
                    caption=asset.caption if asset and settings.include_caption else None,
                    ocr_text=asset.ocr_text if asset and settings.include_ocr else None,
                    asset_id=asset.id if asset else None,
                    width=width,
                    height=height,
                    file_size=len(image_base64),
                    mime_type=self._get_mime_type(path),
                )
                
                prepared.append(image_input)
                
            except Exception as e:
                logger.error(f"❌ Failed to prepare image {path}: {e}")
                continue
        
        logger.info(f"✅ Prepared {len(prepared)} images for LLM context")
        return prepared
    
    def prepare_images_from_assets(
        self,
        asset_ids: List[int],
        resize: bool = True
    ) -> List[ImageInput]:
        """
        Prepare images from asset IDs.
        
        Args:
            asset_ids: List of DocumentAsset IDs
            resize: Whether to resize images
            
        Returns:
            List of prepared ImageInput objects
        """
        settings = self._load_settings()
        prepared = []
        
        # Fetch assets
        assets = self.db.query(DocumentAsset).filter(
            DocumentAsset.id.in_(asset_ids[:settings.max_images_per_query])
        ).all()
        
        for asset in assets:
            try:
                path = asset.file_path
                
                # Check if file exists
                if not Path(path).exists():
                    logger.warning(f"⚠️ Image not found: {path}")
                    continue
                
                # Resize if needed
                if resize:
                    image_bytes = self.resize_image(path, settings.max_image_size)
                    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
                else:
                    with open(path, "rb") as f:
                        image_base64 = base64.b64encode(f.read()).decode("utf-8")
                
                # Get image dimensions
                try:
                    with Image.open(path) as img:
                        width, height = img.size
                except:
                    width, height = None, None
                
                # Build ImageInput
                image_input = ImageInput(
                    image_path=path,
                    image_base64=image_base64,
                    caption=asset.caption if settings.include_caption else None,
                    ocr_text=asset.ocr_text if settings.include_ocr else None,
                    asset_id=asset.id,
                    width=width,
                    height=height,
                    file_size=len(image_base64),
                    mime_type=self._get_mime_type(path),
                )
                
                prepared.append(image_input)
                
            except Exception as e:
                logger.error(f"❌ Failed to prepare asset {asset.id}: {e}")
                continue
        
        logger.info(f"✅ Prepared {len(prepared)} images from assets")
        return prepared
    
    def select_relevant_images(
        self,
        query: str,
        document_id: int,
        max_count: int = None
    ) -> List[int]:
        """
        Select most relevant images for the query.
        Uses CLIP embeddings if available, otherwise returns all images.
        
        Args:
            query: User's query
            document_id: Document to search in
            max_count: Maximum number of images to return
            
        Returns:
            List of asset IDs
        """
        settings = self._load_settings()
        if max_count is None:
            max_count = settings.max_images_per_query
        
        # Get all assets for document
        assets = self.db.query(DocumentAsset).filter(
            DocumentAsset.document_id == document_id,
            DocumentAsset.asset_type == "image"
        ).all()
        
        if not assets:
            return []
        
        # Check if CLIP embeddings are available
        assets_with_clip = [a for a in assets if a.clip_embedding is not None]
        
        if assets_with_clip:
            # Use CLIP-based semantic search
            try:
                from backend.services.clip_service import get_clip_service
                from backend.services.semantic_search_service import SemanticSearchService
                
                clip_service = get_clip_service()
                if clip_service.is_available():
                    search_service = SemanticSearchService(clip_service)
                    results = search_service.search(
                        query=query,
                        document_id=document_id,
                        db=self.db,
                        top_k=max_count,
                        threshold=0.15  # Lower threshold for image selection
                    )
                    
                    return [r["asset_id"] for r in results]
            except Exception as e:
                logger.warning(f"⚠️ CLIP search failed, using fallback: {e}")
        
        # Fallback: Return first N images
        return [a.id for a in assets[:max_count]]
    
    def get_images_for_chunks(
        self,
        chunk_ids: List[int],
        max_count: int = None
    ) -> List[int]:
        """
        Get images related to specific chunks.
        
        Args:
            chunk_ids: List of chunk IDs
            max_count: Maximum number of images to return
            
        Returns:
            List of asset IDs
        """
        settings = self._load_settings()
        if max_count is None:
            max_count = settings.max_images_per_query
        
        from backend.database.models_v2 import DocumentChunk
        
        # Get chunks with image relations
        chunks = self.db.query(DocumentChunk).filter(
            DocumentChunk.id.in_(chunk_ids)
        ).all()
        
        # Collect unique asset IDs from image_relations
        asset_ids = set()
        for chunk in chunks:
            if chunk.image_relations:
                for relation in chunk.image_relations:
                    if isinstance(relation, dict) and "asset_id" in relation:
                        asset_ids.add(relation["asset_id"])
                    elif isinstance(relation, int):
                        asset_ids.add(relation)
        
        return list(asset_ids)[:max_count]
    
    def _get_mime_type(self, image_path: str) -> str:
        """Get MIME type for image"""
        suffix = Path(image_path).suffix.lower()
        mime_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        return mime_types.get(suffix, "image/jpeg")
    
    def get_max_images(self) -> int:
        """Get maximum images per query setting"""
        settings = self._load_settings()
        return settings.max_images_per_query
    
    def get_max_image_size(self) -> int:
        """Get maximum image size setting"""
        settings = self._load_settings()
        return settings.max_image_size
