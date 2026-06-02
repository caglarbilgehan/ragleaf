"""
Source Content API
Kaynak içeriklerini modal'da göstermek için API endpoint'leri
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import json
from pathlib import Path

from ..database.connection import get_db
from ..database.models import Document

source_router = APIRouter()

# Use absolute path to root documents folder
from backend.services.storage_service import get_storage as _get_storage
_storage = _get_storage()
import os
DOCUMENTS_DIR = _storage.get_document_root(os.getenv("DEFAULT_TENANT_SLUG", "default"))

@source_router.get("/source/{document_id}/chunk/{chunk_id}")
async def get_chunk_content(
    document_id: int,
    chunk_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get detailed chunk content for modal display"""
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Load chunk metadata
        doc_folder = DOCUMENTS_DIR / document.folder_name
        metadata_file = doc_folder / "vectors" / f"doc_{document_id}_metadata.json"
        
        if not metadata_file.exists():
            raise HTTPException(status_code=404, detail="Metadata not found")
        
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        chunks = metadata.get('chunks', [])
        
        # Find the specific chunk
        target_chunk = None
        for chunk in chunks:
            if chunk.get('id') == chunk_id:
                target_chunk = chunk
                break
        
        if not target_chunk:
            raise HTTPException(status_code=404, detail="Chunk not found")
        
        # Extract page information
        content = target_chunk.get('text', '')
        page_number = None
        
        if "--- Sayfa" in content:
            try:
                page_match = content.split("--- Sayfa")[1].split("---")[0].strip()
                page_number = int(page_match)
            except:
                pass
        
        # Extract image references
        image_references = []
        if "Görsel" in content and "metni:" in content:
            lines = content.split('\n')
            for line in lines:
                if "Görsel" in line and "metni:" in line:
                    try:
                        img_num = line.split("Görsel")[1].split("metni:")[0].strip()
                        img_text = line.split("metni:")[1].strip()
                        
                        # Build image path
                        img_filename = f"page_{page_number}_img_{img_num}.png" if page_number else None
                        img_path = doc_folder / "images" / "extracted" / img_filename if img_filename else None
                        
                        image_references.append({
                            'image_number': img_num,
                            'ocr_text': img_text,
                            'image_filename': img_filename,
                            'image_exists': img_path.exists() if img_path else False,
                            'image_url': f"/api/images/{document_id}/{img_filename}" if img_filename else None
                        })
                    except:
                        continue
        
        # Clean content for display (remove page markers)
        display_content = content
        if "--- Sayfa" in display_content:
            # Remove page markers but keep content
            lines = display_content.split('\n')
            cleaned_lines = []
            for line in lines:
                if not line.strip().startswith("--- Sayfa") or not line.strip().endswith("---"):
                    cleaned_lines.append(line)
            display_content = '\n'.join(cleaned_lines)
        
        return {
            "success": True,
            "document_id": document_id,
            "document_name": document.name,
            "file_name": document.original_filename,
            "chunk_id": chunk_id,
            "page_number": page_number,
            "content": display_content,
            "raw_content": content,
            "word_count": target_chunk.get('word_count', 0),
            "char_count": target_chunk.get('char_count', 0),
            "has_images": len(image_references) > 0,
            "image_references": image_references,
            "metadata": {
                "length": target_chunk.get('length', 0),
                "paragraph_index": target_chunk.get('paragraph_index', 0)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@source_router.get("/images/{document_id}/{filename}")
async def get_document_image(
    document_id: int,
    filename: str,
    db: Session = Depends(get_db)
):
    """Serve document images for modal display"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"🖼️ Image request: document_id={document_id}, filename={filename}")
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            logger.warning(f"🖼️ Document not found: {document_id}")
            raise HTTPException(status_code=404, detail="Document not found")
        
        logger.info(f"🖼️ Document found: folder_name={document.folder_name}")
        
        # Build image path - check multiple possible locations
        doc_folder = DOCUMENTS_DIR / document.folder_name
        
        # Try different image locations (images/ is the primary location)
        possible_paths = [
            doc_folder / "images" / filename,           # Primary: images/
            doc_folder / "images" / "extracted" / filename,  # Legacy: images/extracted/
        ]
        
        logger.info(f"🖼️ Checking paths: {[str(p) for p in possible_paths]}")
        
        img_path = None
        for path in possible_paths:
            logger.info(f"🖼️ Checking: {path} (exists: {path.exists()})")
            if path.exists():
                img_path = path
                break
        
        if not img_path:
            logger.warning(f"🖼️ Image not found: {filename} for document {document_id}")
            logger.warning(f"   Searched paths: {[str(p) for p in possible_paths]}")
            # List available files in images folder
            images_folder = doc_folder / "images"
            if images_folder.exists():
                available_files = list(images_folder.glob("*"))[:10]
                logger.warning(f"   Available files in {images_folder}: {[f.name for f in available_files]}")
            raise HTTPException(status_code=404, detail="Image not found")
        
        logger.info(f"✅ Serving image: {img_path}")
        
        # Return image file
        from fastapi.responses import FileResponse
        return FileResponse(
            path=str(img_path),
            media_type="image/png",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@source_router.get("/documents/{document_id}/info")
async def get_document_info(
    document_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get document information for UI"""
    
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get processing summary if available
        doc_folder = DOCUMENTS_DIR / document.folder_name
        summary_file = doc_folder / "analysis" / "processing_summary.json"
        
        processing_info = {}
        if summary_file.exists():
            with open(summary_file, 'r', encoding='utf-8') as f:
                processing_info = json.load(f)
        
        return {
            "success": True,
            "document_id": document_id,
            "name": document.name,
            "original_filename": document.original_filename,
            "file_type": document.file_type,
            "file_size": document.file_size,
            "status": document.status,
            "total_chunks": document.total_chunks,
            "ocr_completed": document.ocr_completed,
            "vector_indexed": document.vector_indexed,
            "created_at": document.created_at.isoformat() if document.created_at else None,
            "processed_at": document.processed_at.isoformat() if document.processed_at else None,
            "processing_info": processing_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
