"""
Chunk Enrichment API endpoints for Admin Panel
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import os

from ..database.connection_v2 import get_db
from ..database.models_v2 import DocumentChunk, Document, DocumentAsset
from ..auth.dependencies import get_current_admin_user
from ..database.models import User

logger = logging.getLogger(__name__)

enrichment_router = APIRouter(prefix="/admin", tags=["chunk-enrichment"])


class EnrichmentData(BaseModel):
    suggested_questions: Optional[List[str]] = []
    visual_reference: Optional[int] = None
    special_instructions: Optional[str] = ""
    tags: Optional[List[str]] = []
    image_relations: Optional[List[Dict[str, Any]]] = []


class ChunkResponse(BaseModel):
    index: int
    id: int
    chunk_index: int
    content: str
    language: Optional[str] = "tr"
    word_count: Optional[int] = 0
    enrichment_data: Optional[Dict[str, Any]] = {}
    image_relations: Optional[List[Dict[str, Any]]] = []


class AssetResponse(BaseModel):
    id: int
    asset_type: str
    file_path: str
    caption: Optional[str] = None
    ocr_text: Optional[str] = None
    page: Optional[int] = None
    index: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    tags: Optional[List[str]] = None
    linked_chunks: Optional[List[int]] = None
    asset_metadata: Dict[str, Any]


class AssetUpdateRequest(BaseModel):
    """Request model for updating asset details"""
    ocr_text: Optional[str] = None
    caption: Optional[str] = None
    tags: Optional[List[str]] = None


class ChunkRelationsRequest(BaseModel):
    """Request model for updating chunk-asset relations"""
    chunk_ids: List[int]


@enrichment_router.get("/documents/{document_id}/chunks", response_model=Dict[str, Any])
async def get_document_chunks(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all chunks for a document"""
    try:
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()
        
        return {
            "success": True,
            "chunks": [
                ChunkResponse(
                    index=chunk.chunk_index,
                    id=chunk.id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    language=chunk.language or "tr",
                    word_count=chunk.word_count or 0,
                    enrichment_data=chunk.enrichment_data or {},
                    image_relations=chunk.image_relations or []
                )
                for chunk in chunks
            ]
        }
        
    except Exception as e:
        logger.error(f"Error fetching chunks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/documents/{document_id}/assets", response_model=List[AssetResponse])
async def get_document_assets(
    document_id: int,
    page: Optional[int] = Query(None, description="Filter by page number"),
    search: Optional[str] = Query(None, description="Search in OCR text (case-insensitive)"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all assets (images) for a document, sorted by page and index, with optional filtering"""
    try:
        # Base query
        query = db.query(DocumentAsset).filter(
            DocumentAsset.document_id == document_id
        )
        
        assets = query.all()
        
        # Filter by page if specified
        if page is not None:
            assets = [a for a in assets if (a.asset_metadata or {}).get('page') == page]
        
        # Filter by OCR text search if specified
        if search:
            search_lower = search.lower()
            assets = [a for a in assets if a.ocr_text and search_lower in a.ocr_text.lower()]
        
        # Sort by page number and index from metadata
        def sort_key(asset):
            metadata = asset.asset_metadata or {}
            return (metadata.get('page', 0), metadata.get('index', 0))
        
        sorted_assets = sorted(assets, key=sort_key)
        
        # Get linked chunks for each asset
        all_chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).all()
        
        def get_linked_chunks(asset_id: int) -> List[int]:
            linked = []
            for chunk in all_chunks:
                if chunk.image_relations and asset_id in chunk.image_relations:
                    linked.append(chunk.id)
            return linked
        
        return [
            AssetResponse(
                id=asset.id,
                asset_type=asset.asset_type,
                file_path=asset.file_path,
                caption=asset.caption,
                ocr_text=asset.ocr_text,
                page=(asset.asset_metadata or {}).get('page'),
                index=(asset.asset_metadata or {}).get('index'),
                width=(asset.asset_metadata or {}).get('width'),
                height=(asset.asset_metadata or {}).get('height'),
                tags=(asset.asset_metadata or {}).get('tags', []),
                linked_chunks=get_linked_chunks(asset.id),
                asset_metadata=asset.asset_metadata or {}
            )
            for asset in sorted_assets
        ]
        
    except Exception as e:
        logger.error(f"❌ Error fetching assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/chunks/{chunk_id}/enrichment")
async def update_chunk_enrichment(
    chunk_id: int,
    enrichment: EnrichmentData,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update enrichment data and image relations for a chunk"""
    try:
        chunk = db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
        
        if not chunk:
            raise HTTPException(status_code=404, detail="Chunk not found")
        
        # Update enrichment_data JSONB field
        enrichment_dict = enrichment.dict()
        image_relations = enrichment_dict.pop("image_relations", [])
        
        chunk.enrichment_data = enrichment_dict
        chunk.image_relations = image_relations
        
        # Update document status to 'enriched' if currently 'processed'
        document = db.query(Document).filter(Document.id == chunk.document_id).first()
        if document and document.status == 'processed':
            document.status = 'enriched'
            logger.info(f"📝 Document {document.id} status updated to 'enriched'")
        
        db.commit()
        db.refresh(chunk)
        
        logger.info(f"Updated enrichment for chunk {chunk_id}")
        
        return {
            "success": True,
            "chunk_id": chunk_id,
            "enrichment_data": chunk.enrichment_data,
            "image_relations": chunk.image_relations,
            "document_status": document.status if document else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/chunks/{chunk_id}/enrichment")
async def get_chunk_enrichment(
    chunk_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get enrichment data for a specific chunk"""
    try:
        chunk = db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
        
        if not chunk:
            raise HTTPException(status_code=404, detail="Chunk not found")
        
        return {
            "chunk_id": chunk.id,
            "enrichment_data": chunk.enrichment_data or {},
            "image_relations": chunk.image_relations or []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@enrichment_router.put("/assets/{asset_id}")
async def update_asset(
    asset_id: int,
    update_data: AssetUpdateRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update asset OCR text, caption, and tags"""
    try:
        asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Track if OCR text changed significantly
        ocr_changed = False
        
        # Update fields if provided
        if update_data.ocr_text is not None:
            old_ocr = asset.ocr_text or ""
            if update_data.ocr_text != old_ocr:
                ocr_changed = True
            asset.ocr_text = update_data.ocr_text
            
        if update_data.caption is not None:
            asset.caption = update_data.caption
            
        if update_data.tags is not None:
            # Update tags in asset_metadata
            metadata = asset.asset_metadata or {}
            metadata['tags'] = update_data.tags
            asset.asset_metadata = metadata
        
        db.commit()
        db.refresh(asset)
        
        logger.info(f"✅ Updated asset {asset_id}")
        
        # Get linked chunks
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == asset.document_id
        ).all()
        
        linked_chunks = []
        for chunk in chunks:
            if chunk.image_relations and asset_id in chunk.image_relations:
                linked_chunks.append(chunk.id)
        
        return {
            "success": True,
            "ocr_changed": ocr_changed,
            "asset": AssetResponse(
                id=asset.id,
                asset_type=asset.asset_type,
                file_path=asset.file_path,
                caption=asset.caption,
                ocr_text=asset.ocr_text,
                page=(asset.asset_metadata or {}).get('page'),
                index=(asset.asset_metadata or {}).get('index'),
                width=(asset.asset_metadata or {}).get('width'),
                height=(asset.asset_metadata or {}).get('height'),
                tags=(asset.asset_metadata or {}).get('tags', []),
                linked_chunks=linked_chunks,
                asset_metadata=asset.asset_metadata or {}
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error updating asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.put("/assets/{asset_id}/chunk-relations")
async def update_asset_chunk_relations(
    asset_id: int,
    relations: ChunkRelationsRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update chunk relations for an asset (bidirectional update)"""
    try:
        asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Get all chunks for this document
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == asset.document_id
        ).all()
        
        updated_count = 0
        
        for chunk in chunks:
            current_relations = chunk.image_relations or []
            
            if chunk.id in relations.chunk_ids:
                # Add asset to chunk's image_relations if not already there
                if asset_id not in current_relations:
                    chunk.image_relations = current_relations + [asset_id]
                    updated_count += 1
            else:
                # Remove asset from chunk's image_relations if present
                if asset_id in current_relations:
                    chunk.image_relations = [r for r in current_relations if r != asset_id]
                    updated_count += 1
        
        db.commit()
        
        logger.info(f"✅ Updated chunk relations for asset {asset_id}, {updated_count} chunks modified")
        
        return {
            "success": True,
            "asset_id": asset_id,
            "updated_chunks": updated_count,
            "related_chunk_ids": relations.chunk_ids
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error updating chunk relations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/assets/{asset_id}/chunk-relations")
async def get_asset_chunk_relations(
    asset_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all chunks that are related to this asset"""
    try:
        asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Find all chunks that have this asset in their image_relations
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == asset.document_id
        ).all()
        
        related_chunk_ids = []
        for chunk in chunks:
            if chunk.image_relations and asset_id in chunk.image_relations:
                related_chunk_ids.append(chunk.id)
        
        return {
            "asset_id": asset_id,
            "related_chunk_ids": related_chunk_ids
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching chunk relations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/documents/{document_id}/sync-assets")
async def sync_document_assets(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Sync filesystem images to database for a document.
    Scans the document's images folder and creates DocumentAsset records for any missing images.
    """
    import os
    import re
    from PIL import Image as PILImage
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        logger.info(f"🔍 Syncing assets for document {document_id}, folder: {document.folder_name}")
        
        # Build images path - try multiple path structures (prioritize new path)
        possible_paths = [
            os.path.join("documents", document.folder_name, "images"),  # Primary: new path
            os.path.join("documents", document.folder_name, "images", "extracted"),  # Legacy: old path
            os.path.join("documents", document.folder_name),
        ]
        
        base_path = None
        checked_paths = []
        for path in possible_paths:
            checked_paths.append(path)
            if os.path.exists(path):
                # Check if this path has image files
                try:
                    files = os.listdir(path)
                    image_files = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))]
                    if image_files:
                        base_path = path
                        logger.info(f"✅ Found {len(image_files)} images in: {path}")
                        break
                except Exception as e:
                    logger.warning(f"⚠️ Could not list directory {path}: {e}")
        
        if not base_path:
            logger.warning(f"❌ No images found. Checked paths: {checked_paths}")
            return {
                "success": False,
                "message": f"No images found. Checked: {', '.join(checked_paths)}",
                "synced": 0,
                "skipped": 0,
                "checked_paths": checked_paths
            }
        
        # Get existing assets
        existing_assets = db.query(DocumentAsset).filter(
            DocumentAsset.document_id == document_id
        ).all()
        existing_paths = {a.file_path for a in existing_assets}
        
        synced = 0
        skipped = 0
        
        # Scan images folder
        for filename in os.listdir(base_path):
            if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                continue
            file_path = os.path.join(base_path, filename)
            
            # Skip if already exists
            if file_path in existing_paths:
                skipped += 1
                continue
            
            # Parse page and index from filename (e.g., page_1_img_2.png)
            match = re.match(r'page_(\d+)_img_(\d+)', filename)
            page_num = int(match.group(1)) if match else 0
            img_index = int(match.group(2)) if match else 0
            
            # Get image dimensions
            try:
                with PILImage.open(file_path) as img:
                    width, height = img.size
            except Exception:
                width, height = 0, 0
            
            # Create asset record
            asset = DocumentAsset(
                document_id=document_id,
                asset_type="image",
                file_path=file_path,
                caption=None,
                ocr_text=None,
                asset_metadata={
                    "page": page_num,
                    "index": img_index,
                    "width": width,
                    "height": height,
                    "filename": filename,
                    "tags": []
                }
            )
            db.add(asset)
            synced += 1
        
        db.commit()
        
        logger.info(f"✅ Synced {synced} assets for document {document_id}, skipped {skipped} existing")
        
        return {
            "success": True,
            "message": f"Synced {synced} images, skipped {skipped} existing",
            "synced": synced,
            "skipped": skipped
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error syncing assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/documents/sync-all-assets")
async def sync_all_document_assets(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Sync filesystem images to database for ALL documents.
    Useful for migrating existing documents that have images but no asset records.
    """
    import os
    import re
    from PIL import Image as PILImage
    
    try:
        # Get all documents
        documents = db.query(Document).all()
        
        total_synced = 0
        total_skipped = 0
        processed_docs = 0
        
        for document in documents:
            # Try both new and old path structures (prioritize new path)
            new_path = os.path.join("documents", document.folder_name, "images")
            old_path = os.path.join("documents", document.folder_name, "images", "extracted")
            
            # Use new path if it exists, otherwise fallback to old path
            base_path = new_path if os.path.exists(new_path) else old_path
            
            if not os.path.exists(base_path):
                continue
            
            # Get existing assets for this document
            existing_assets = db.query(DocumentAsset).filter(
                DocumentAsset.document_id == document.id
            ).all()
            existing_paths = {a.file_path for a in existing_assets}
            
            doc_synced = 0
            
            # Scan images folder
            for filename in os.listdir(base_path):
                if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                    continue
                
                file_path = os.path.join(base_path, filename)
                
                if file_path in existing_paths:
                    total_skipped += 1
                    continue
                
                # Parse page and index
                match = re.match(r'page_(\d+)_img_(\d+)', filename)
                page_num = int(match.group(1)) if match else 0
                img_index = int(match.group(2)) if match else 0
                
                # Get dimensions
                try:
                    with PILImage.open(file_path) as img:
                        width, height = img.size
                except Exception:
                    width, height = 0, 0
                
                asset = DocumentAsset(
                    document_id=document.id,
                    asset_type="image",
                    file_path=file_path,
                    caption=None,
                    ocr_text=None,
                    asset_metadata={
                        "page": page_num,
                        "index": img_index,
                        "width": width,
                        "height": height,
                        "filename": filename,
                        "tags": []
                    }
                )
                db.add(asset)
                doc_synced += 1
            
            if doc_synced > 0:
                processed_docs += 1
                total_synced += doc_synced
        
        db.commit()
        
        logger.info(f"✅ Bulk sync complete: {total_synced} assets from {processed_docs} documents")
        
        return {
            "success": True,
            "message": f"Synced {total_synced} images from {processed_docs} documents",
            "total_synced": total_synced,
            "total_skipped": total_skipped,
            "documents_processed": processed_docs
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in bulk sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/documents/{document_id}/assets/upload")
async def upload_external_asset(
    document_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated tags
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Upload an external image (not from the document) and create a DocumentAsset record.
    The image will be saved to documents/{folder}/images/external/
    """
    import os
    import uuid
    from PIL import Image as PILImage
    import io
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Validate file type
        allowed_types = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
            )
        
        # Create external images folder
        external_folder = os.path.join("documents", document.folder_name, "images", "external")
        os.makedirs(external_folder, exist_ok=True)
        
        # Generate unique filename
        file_ext = os.path.splitext(file.filename)[1] or '.png'
        unique_filename = f"external_{uuid.uuid4().hex[:8]}{file_ext}"
        file_path = os.path.join(external_folder, unique_filename)
        
        # Read file content
        content = await file.read()
        
        # Get image dimensions
        try:
            img = PILImage.open(io.BytesIO(content))
            width, height = img.size
            img.close()
        except Exception:
            width, height = 0, 0
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(content)
        
        # Parse tags
        tag_list = []
        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
        
        # Create asset record
        asset = DocumentAsset(
            document_id=document_id,
            asset_type="image",
            file_path=file_path,
            caption=caption,
            ocr_text=None,  # Can be filled later via OCR
            asset_metadata={
                "page": None,  # External images don't have page numbers
                "index": None,
                "width": width,
                "height": height,
                "filename": unique_filename,
                "original_filename": file.filename,
                "tags": tag_list,
                "is_external": True  # Flag to identify external uploads
            }
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        
        logger.info(f"✅ Uploaded external asset {asset.id} for document {document_id}")
        
        return {
            "success": True,
            "asset_id": asset.id,
            "file_path": file_path,
            "width": width,
            "height": height
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error uploading external asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/assets/{asset_id}/ocr")
async def run_ocr_on_asset(
    asset_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Run OCR on an asset image and update its ocr_text field.
    Useful for external images that weren't processed during document ingestion.
    """
    import pytesseract
    from PIL import Image as PILImage
    
    try:
        asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        if not os.path.exists(asset.file_path):
            raise HTTPException(status_code=404, detail="Asset file not found on disk")
        
        # Run OCR
        try:
            img = PILImage.open(asset.file_path)
            ocr_text = pytesseract.image_to_string(img, lang='tur+eng', config='--psm 6')
            img.close()
            ocr_text = ocr_text.strip()
        except Exception as e:
            logger.error(f"❌ OCR failed for asset {asset_id}: {e}")
            raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
        
        # Update asset
        asset.ocr_text = ocr_text if ocr_text else None
        db.commit()
        
        logger.info(f"✅ OCR completed for asset {asset_id}: {len(ocr_text)} chars")
        
        return {
            "success": True,
            "asset_id": asset_id,
            "ocr_text": ocr_text,
            "text_length": len(ocr_text) if ocr_text else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error running OCR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/documents/{document_id}/bulk-enrich")
async def bulk_enrich_chunks(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Use LLM to automatically generate enrichment data for all chunks in a document.
    Generates: suggested questions, tags, and summary for each chunk.
    """
    from ..services.llm_service import llm_service
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get all chunks
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()
        
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks found for this document")
        
        enriched_count = 0
        errors = []
        
        for chunk in chunks:
            try:
                # Skip if already enriched
                if chunk.enrichment_data and chunk.enrichment_data.get('suggested_questions'):
                    continue
                
                # Generate enrichment using LLM
                prompt = f"""Aşağıdaki metin parçası için:
1. Bu metinle ilgili sorulabilecek 3 soru öner (Türkçe)
2. Bu metin için 3-5 anahtar kelime/etiket öner (Türkçe)

Metin:
{chunk.content[:2000]}

JSON formatında yanıt ver:
{{"suggested_questions": ["soru1", "soru2", "soru3"], "tags": ["etiket1", "etiket2", "etiket3"]}}"""

                response = await llm_service.generate(prompt, max_tokens=500)
                
                # Parse JSON response
                import json
                import re
                
                # Extract JSON from response
                json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
                if json_match:
                    enrichment = json.loads(json_match.group())
                    
                    # Update chunk
                    current_data = chunk.enrichment_data or {}
                    current_data['suggested_questions'] = enrichment.get('suggested_questions', [])
                    current_data['tags'] = enrichment.get('tags', [])
                    current_data['ai_generated'] = True
                    chunk.enrichment_data = current_data
                    
                    enriched_count += 1
                    
            except Exception as e:
                errors.append(f"Chunk {chunk.chunk_index}: {str(e)}")
                continue
        
        db.commit()
        
        logger.info(f"✅ Bulk enrichment completed for document {document_id}: {enriched_count} chunks enriched")
        
        return {
            "success": True,
            "document_id": document_id,
            "total_chunks": len(chunks),
            "enriched_count": enriched_count,
            "errors": errors[:10] if errors else []  # Return first 10 errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error in bulk enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/documents/{document_id}/search-images")
async def search_images_by_text(
    document_id: int,
    query: str = Query(..., description="Search query text"),
    limit: int = Query(10, ge=1, le=50),
    search_type: str = Query("text", description="Search type: text, semantic, or hybrid"),
    semantic_threshold: float = Query(0.2, ge=0.0, le=1.0, description="Minimum similarity threshold for semantic search"),
    text_weight: float = Query(0.3, ge=0.0, le=1.0, description="Text weight for hybrid search"),
    semantic_weight: float = Query(0.7, ge=0.0, le=1.0, description="Semantic weight for hybrid search"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Search images in a document by text query.
    
    Supports three search modes:
    - text: Traditional text-based search in OCR text, captions, and tags
    - semantic: CLIP-based semantic similarity search
    - hybrid: Combined text and semantic search with configurable weights
    """
    import time
    start_time = time.time()
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Validate search_type
        if search_type not in ["text", "semantic", "hybrid"]:
            raise HTTPException(status_code=400, detail="Invalid search_type. Use: text, semantic, or hybrid")
        
        results = []
        actual_search_type = search_type
        
        # Semantic or Hybrid search
        if search_type in ["semantic", "hybrid"]:
            from ..services.semantic_search_service import get_semantic_search_service
            from ..services.hybrid_search_service import get_hybrid_search_service
            
            if search_type == "semantic":
                semantic_service = get_semantic_search_service()
                if not semantic_service.is_available():
                    logger.warning("⚠️ CLIP not available, falling back to text search")
                    actual_search_type = "text"
                else:
                    results = semantic_service.search(
                        query=query,
                        document_id=document_id,
                        db=db,
                        top_k=limit,
                        threshold=semantic_threshold
                    )
            else:  # hybrid
                hybrid_service = get_hybrid_search_service()
                if not hybrid_service.is_available():
                    logger.warning("⚠️ CLIP not available, falling back to text search")
                    actual_search_type = "text"
                else:
                    results = hybrid_service.search(
                        query=query,
                        document_id=document_id,
                        db=db,
                        top_k=limit,
                        text_weight=text_weight,
                        semantic_weight=semantic_weight,
                        semantic_threshold=semantic_threshold
                    )
        
        # Text search (or fallback)
        if actual_search_type == "text":
            results = _text_search_images(query, document_id, db, limit)
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "results": results,
            "total": len(results),
            "query": query,
            "search_type": actual_search_type,
            "processing_time_ms": round(processing_time, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error searching images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _text_search_images(query: str, document_id: int, db: Session, limit: int) -> List[Dict]:
    """Internal text-based image search."""
    assets = db.query(DocumentAsset).filter(
        DocumentAsset.document_id == document_id,
        DocumentAsset.asset_type == "image"
    ).all()
    
    if not assets:
        return []
    
    query_lower = query.lower()
    results = []
    
    for asset in assets:
        score = 0
        matches = []
        
        # Search in OCR text
        if asset.ocr_text:
            ocr_lower = asset.ocr_text.lower()
            if query_lower in ocr_lower:
                score += 2
                matches.append("ocr_text")
                if f" {query_lower} " in f" {ocr_lower} ":
                    score += 1
        
        # Search in caption
        if asset.caption:
            caption_lower = asset.caption.lower()
            if query_lower in caption_lower:
                score += 3
                matches.append("caption")
        
        # Search in tags
        tags = asset.asset_metadata.get("tags", []) if asset.asset_metadata else []
        for tag in tags:
            if query_lower in tag.lower():
                score += 2
                matches.append("tags")
                break
        
        if score > 0:
            results.append({
                "asset_id": asset.id,
                "file_path": asset.file_path,
                "caption": asset.caption,
                "ocr_text": asset.ocr_text[:200] if asset.ocr_text else None,
                "page": asset.asset_metadata.get("page") if asset.asset_metadata else None,
                "text_score": score,
                "matches": matches,
                "search_type": "text"
            })
    
    results.sort(key=lambda x: x["text_score"], reverse=True)
    return results[:limit]


# ============================================================================
# CLIP Embedding Management Endpoints
# ============================================================================

@enrichment_router.post("/documents/{document_id}/generate-clip-embeddings")
async def generate_clip_embeddings(
    document_id: int,
    force: bool = Query(False, description="Force regenerate all embeddings"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Generate CLIP embeddings for all images in a document.
    
    Args:
        document_id: Document ID
        force: If True, regenerate all embeddings (even existing ones)
    """
    try:
        # Verify document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        from ..services.image_embedding_service import get_image_embedding_service
        
        embedding_service = get_image_embedding_service()
        
        if force:
            result = await embedding_service.regenerate_all_embeddings(document_id, db)
        else:
            result = await embedding_service.generate_embeddings_for_document(document_id, db)
        
        return {
            "success": True,
            "document_id": document_id,
            "total": result["total"],
            "generated": result["success"],
            "failed": result["failed"],
            "skipped": result.get("skipped", 0),
            "errors": result["errors"][:5] if result["errors"] else []  # Limit error messages
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating CLIP embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/documents/{document_id}/clip-embedding-status")
async def get_clip_embedding_status(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get CLIP embedding generation status for a document.
    
    Returns counts of images with/without embeddings and completion percentage.
    """
    try:
        # Verify document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        from ..services.image_embedding_service import get_image_embedding_service
        
        embedding_service = get_image_embedding_service()
        status = embedding_service.get_embedding_status(document_id, db)
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting embedding status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/documents/{document_id}/regenerate-clip-embeddings")
async def regenerate_clip_embeddings(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate all CLIP embeddings for a document (force regeneration).
    """
    try:
        # Verify document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        from ..services.image_embedding_service import get_image_embedding_service
        
        embedding_service = get_image_embedding_service()
        result = await embedding_service.regenerate_all_embeddings(document_id, db)
        
        return {
            "success": True,
            "document_id": document_id,
            "total": result["total"],
            "regenerated": result["success"],
            "failed": result["failed"],
            "errors": result["errors"][:5] if result["errors"] else []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error regenerating CLIP embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.post("/assets/{asset_id}/regenerate-clip-embedding")
async def regenerate_asset_clip_embedding(
    asset_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate CLIP embedding for a single asset.
    """
    try:
        # Verify asset exists
        asset = db.query(DocumentAsset).filter(DocumentAsset.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        from ..services.image_embedding_service import get_image_embedding_service
        
        embedding_service = get_image_embedding_service()
        success = await embedding_service.regenerate_embedding(asset_id, db)
        
        return {
            "success": success,
            "asset_id": asset_id,
            "message": "Embedding regenerated" if success else "Failed to regenerate embedding"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error regenerating asset embedding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@enrichment_router.get("/clip-service-status")
async def get_clip_service_status(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get CLIP service status and model information.
    """
    try:
        from ..services.clip_service import get_clip_service
        
        clip_service = get_clip_service()
        return clip_service.get_model_info()
        
    except Exception as e:
        logger.error(f"❌ Error getting CLIP service status: {e}")
        return {
            "is_available": False,
            "error": str(e)
        }


@enrichment_router.post("/documents/{document_id}/cleanup-image-relations")
async def cleanup_invalid_image_relations(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Clean up invalid image_relations from chunks.
    Removes references to assets that don't exist in DocumentAsset table.
    """
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get all valid asset IDs for this document
        valid_asset_ids = set(
            a.id for a in db.query(DocumentAsset.id).filter(
                DocumentAsset.document_id == document_id
            ).all()
        )
        
        logger.info(f"🔍 Found {len(valid_asset_ids)} valid assets for document {document_id}")
        
        # Get all chunks with image_relations
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.image_relations != None,
            DocumentChunk.image_relations != []
        ).all()
        
        cleaned_count = 0
        removed_refs = 0
        
        for chunk in chunks:
            if not chunk.image_relations:
                continue
            
            # Filter out invalid asset IDs
            original_count = len(chunk.image_relations)
            valid_relations = [
                r for r in chunk.image_relations 
                if (isinstance(r, int) and r in valid_asset_ids) or 
                   (isinstance(r, dict) and r.get('asset_id') in valid_asset_ids)
            ]
            
            if len(valid_relations) != original_count:
                removed = original_count - len(valid_relations)
                removed_refs += removed
                chunk.image_relations = valid_relations if valid_relations else []
                cleaned_count += 1
                logger.info(f"  Chunk {chunk.id}: removed {removed} invalid refs")
        
        db.commit()
        
        logger.info(f"✅ Cleanup complete: {cleaned_count} chunks cleaned, {removed_refs} invalid refs removed")
        
        return {
            "success": True,
            "document_id": document_id,
            "valid_assets": len(valid_asset_ids),
            "chunks_cleaned": cleaned_count,
            "invalid_refs_removed": removed_refs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error cleaning up image relations: {e}")
        raise HTTPException(status_code=500, detail=str(e))
