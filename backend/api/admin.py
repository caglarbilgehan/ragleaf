# backend/api/admin.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Header, Query
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
import json
from pathlib import Path
import mimetypes

from ..database.connection import get_db
from backend.database.models import User, Document, ModelConfig, Settings
from backend.auth.dependencies import get_current_admin_user
from backend.auth.org_dependencies import get_current_org_optional
from backend.services.document_processor import document_processor
from backend.services.async_document_processor import async_document_processor
from backend.services.resource_manager import resource_manager
from backend.services.document_storage import document_storage
from backend.services.huggingface_service import huggingface_service
from backend.services.reset import reset_service
from decouple import config
import logging

logger = logging.getLogger(__name__)

admin_router = APIRouter()

@admin_router.get("/metadata/suggestions")
async def get_metadata_suggestions():
    """Return metadata field suggestions for document upload/edit"""
    return {
        "departments": [],
        "categories": [],
        "tags": [],
        "languages": ["tr", "en", "de", "fr", "es", "ar"]
    }

# Configuration
MAX_FILE_SIZE_MB = config("MAX_FILE_SIZE_MB", default=100, cast=int)
# Multi-tenant storage service
from backend.services.storage_service import get_storage as _get_storage
_storage = _get_storage()

# Legacy alias for backward compatibility
DOCUMENTS_DIR = _storage.get_document_root(os.getenv("DEFAULT_TENANT_SLUG", "default"))
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

# Pydantic models
class DocumentResponse(BaseModel):
    id: int
    name: str
    original_filename: str
    file_size: int
    file_type: str
    status: str
    total_pages: Optional[int] = None
    total_chunks: Optional[int] = None
    ocr_completed: bool
    vector_indexed: bool
    language: Optional[str] = "tr"
    doc_metadata: Optional[dict] = None
    created_at: str
    processed_at: Optional[str] = None
    
    @classmethod
    def from_orm(cls, obj):
        from datetime import datetime
        return cls(
            id=obj.id,
            name=obj.name,
            original_filename=obj.original_filename,
            file_size=obj.file_size,
            file_type=obj.file_type,
            status=obj.status,
            total_pages=obj.total_pages,
            total_chunks=obj.total_chunks,
            ocr_completed=obj.ocr_completed,
            vector_indexed=obj.vector_indexed,
            language=obj.language or "tr",
            doc_metadata=obj.doc_metadata or {},
            created_at=obj.created_at.isoformat() if obj.created_at else datetime.now().isoformat(),
            processed_at=obj.processed_at.isoformat() if obj.processed_at else None
        )

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int

class ModelConfigResponse(BaseModel):
    id: int
    name: str
    provider: str
    model_name: str
    description: Optional[str] = None
    
    # LLM Parameters
    num_ctx: Optional[int] = 2048
    num_predict: Optional[int] = 512
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    top_k: Optional[int] = 40
    repeat_penalty: Optional[float] = 1.1
    
    # RAG Parameters
    max_context_chars: Optional[int] = 1500
    rag_top_k: Optional[int] = 3
    chunk_size: Optional[int] = 500
    chunk_overlap: Optional[int] = 100
    
    # System Parameters
    timeout_seconds: Optional[int] = 120
    
    is_active: bool
    is_default: bool
    created_at: str
    updated_at: Optional[str] = None
    
    class Config:
        protected_namespaces = ()  # Disable Pydantic warning for model_name
    
    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            provider=obj.provider,
            model_name=obj.model_name,
            description=obj.description,
            num_ctx=obj.num_ctx,
            num_predict=obj.num_predict,
            temperature=obj.temperature,
            top_p=obj.top_p,
            top_k=obj.top_k,
            repeat_penalty=obj.repeat_penalty,
            max_context_chars=obj.max_context_chars,
            rag_top_k=obj.rag_top_k,
            chunk_size=obj.chunk_size,
            chunk_overlap=obj.chunk_overlap,
            timeout_seconds=obj.timeout_seconds,
            is_active=obj.is_active,
            is_default=obj.is_default,
            created_at=obj.created_at.isoformat() if obj.created_at else "",
            updated_at=obj.updated_at.isoformat() if obj.updated_at else None
        )

class ModelConfigCreate(BaseModel):
    name: str
    provider: str  # huggingface (remote only)
    model_name: str
    description: Optional[str] = None
    
    # LLM Parameters
    num_ctx: Optional[int] = 2048
    num_predict: Optional[int] = 512
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    top_k: Optional[int] = 40
    repeat_penalty: Optional[float] = 1.1
    
    # RAG Parameters
    max_context_chars: Optional[int] = 1500
    rag_top_k: Optional[int] = 3
    chunk_size: Optional[int] = 500
    chunk_overlap: Optional[int] = 100
    
    # System Parameters
    timeout_seconds: Optional[int] = 120
    
    is_default: bool = False
    
    class Config:
        protected_namespaces = ()  # Disable Pydantic warning for model_name

class ModelConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    description: Optional[str] = None
    
    # LLM Parameters
    num_ctx: Optional[int] = None
    num_predict: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    repeat_penalty: Optional[float] = None
    
    # RAG Parameters
    max_context_chars: Optional[int] = None
    rag_top_k: Optional[int] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    
    # System Parameters
    timeout_seconds: Optional[int] = None
    
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    
    class Config:
        protected_namespaces = ()  # Disable Pydantic warning for model_name

# Reset and Reprocess Models
class ResetOptions(BaseModel):
    """Granular reset options for 'processing' level"""
    chunks: bool = True
    chunk_enrichments: bool = True
    doc_enrichments: bool = True
    images: bool = False
    ocr_texts: bool = False

class ReprocessOptionsModel(BaseModel):
    """Options for reprocessing after reset"""
    extract_text: bool = False
    extract_images: bool = False
    run_ocr: bool = False
    chunking_strategy: Optional[str] = None  # 'paragraph', 'fixed_size', 'semantic'
    chunk_size: Optional[int] = 512
    chunk_overlap: Optional[int] = 100
    ocr_languages: Optional[str] = "tur+eng"

class ResetAndReprocessRequest(BaseModel):
    """Request body for reset and reprocess endpoint"""
    reset_level: str  # 'indexing', 'processing', 'all'
    reset_options: Optional[ResetOptions] = None
    reprocess_options: Optional[ReprocessOptionsModel] = None
    auto_process: bool = True
    auto_index: bool = True

class ResetAndReprocessResponse(BaseModel):
    """Response for reset and reprocess endpoint"""
    success: bool
    operation_id: str
    document_id: int
    estimated_time_seconds: int
    message: str
    steps: List[str]

class BulkResetAndReprocessRequest(BaseModel):
    """Request body for bulk reset and reprocess"""
    document_ids: List[int]
    reset_level: str
    reset_options: Optional[ResetOptions] = None
    reprocess_options: Optional[ReprocessOptionsModel] = None
    auto_process: bool = True
    auto_index: bool = True

class ProgressUpdate(BaseModel):
    """Progress update for SSE streaming"""
    operation_id: str
    document_id: int
    stage: str  # 'resetting', 'processing', 'indexing', 'completed', 'error'
    progress: int  # 0-100
    details: str
    elapsed_seconds: int
    estimated_remaining_seconds: int

# Document Management Endpoints
@admin_router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 1000,
    status: Optional[str] = None,
    sort_by: str = "created_at",  # created_at, name
    order: str = "desc",          # asc, desc
    category: Optional[str] = None,
    department: Optional[str] = None,
    product_info: Optional[str] = None,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all documents with pagination, filtering, and sorting"""
    # Expire cached data to ensure fresh read
    db.expire_all()
    
    query = db.query(Document)
    
    # Text Status Filtering
    if status:
        query = query.filter(Document.status == status)
    
    # Metadata Filtering (JSONB)
    if category:
        query = query.filter(Document.doc_metadata['category'].astext == category)
    
    if department:
        query = query.filter(Document.doc_metadata['department'].astext == department)
        
    if product_info:
        query = query.filter(Document.doc_metadata['product_info'].astext == product_info)
    
    # Sorting
    if sort_by == "name":
        sort_column = Document.name
    else:
        sort_column = Document.created_at
        
    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    
    total = query.count()
    documents = query.offset(skip).limit(limit).all()
    
    return DocumentListResponse(
        documents=[DocumentResponse.from_orm(doc) for doc in documents],
        total=total
    )

@admin_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Upload a new document - simplified version"""
    import re
    
    # Turkish character mapping
    TURKISH_CHAR_MAP = {
        'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C', 'ı': 'i', 'İ': 'I'
    }
    
    def format_display_name(filename: str) -> str:
        """
        Format filename for display:
        - Remove file extension
        - Replace underscores, dashes, multiple spaces with single space
        - Clean up extra whitespace
        Example: "53115___PROGRAMMING_TOOL_DPT_3000_OPERATING_INSTRUCTIONS___V619"
              -> "53115 PROGRAMMING TOOL DPT 3000 OPERATING INSTRUCTIONS V619"
        """
        # Remove extension
        name_without_ext = Path(filename).stem
        # Replace underscores and dashes with spaces
        formatted = re.sub(r'[_\-]+', ' ', name_without_ext)
        # Replace multiple spaces with single space
        formatted = re.sub(r'\s+', ' ', formatted)
        # Strip leading/trailing whitespace
        return formatted.strip()
    
    def clean_turkish(text):
        for tr_char, ascii_char in TURKISH_CHAR_MAP.items():
            text = text.replace(tr_char, ascii_char)
        return text
    
    try:
        # Validate file size
        if file.size and file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {MAX_FILE_SIZE_MB}MB limit"
            )
        
        # Validate file type
        allowed_types = ['.pdf', '.docx', '.txt', '.md']
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_ext} not supported. Allowed: {allowed_types}"
            )
        
        # Read file content first
        content = await file.read()
        
        # Clean filename - remove Turkish characters
        original_filename = clean_turkish(file.filename)
        
        # Only remove our old doc_XXX_XXX_ format (keep other prefixes like 53115___)
        old_format_pattern = re.compile(r'^doc_\d+_\d+_(.+)$')
        match = old_format_pattern.match(original_filename)
        if match:
            original_filename = match.group(1)
        
        # Get next doc_number (max + 1)
        from sqlalchemy import func as sql_func
        max_doc_number = db.query(sql_func.max(Document.doc_number)).scalar() or 0
        next_doc_number = max_doc_number + 1
        
        # Format document name with 4-digit prefix
        # Use format_display_name to clean up underscores, dashes etc.
        clean_name = name or Path(original_filename).stem
        clean_name = clean_turkish(clean_name)
        name_match = old_format_pattern.match(clean_name)
        if name_match:
            clean_name = name_match.group(1)
        # Apply display formatting (underscores/dashes -> spaces)
        display_name = format_display_name(clean_name)
        formatted_name = f"{next_doc_number:04d}_{display_name}"
        
        # Create document with doc_number
        # Determine organization_id: explicit param > user's default org > None
        org_id = organization_id
        if not org_id and hasattr(current_user, 'default_org_id'):
            org_id = current_user.default_org_id
        
        temp_doc = Document(
            name=formatted_name,
            original_filename=original_filename,
            folder_name="temp",  # Temporary placeholder
            file_size=len(content),
            file_type=file_ext[1:],
            status="uploading",
            doc_number=next_doc_number,
            organization_id=org_id
        )
        db.add(temp_doc)
        db.flush()  # Get ID without committing
        
        # Create document structure with doc_number (new format: 0001_filename)
        structure = document_storage.create_document_structure(next_doc_number, original_filename)
        folder_name = structure['root'].name
        
        # Update with real folder_name before commit
        temp_doc.folder_name = folder_name
        
        # Write file directly to the original folder
        original_file_path = structure['original'] / original_filename
        with open(original_file_path, "wb") as buffer:
            buffer.write(content)
        
        # Calculate file hash for metadata
        import hashlib
        from datetime import datetime
        file_hash = hashlib.sha256(content).hexdigest()
        
        # Create metadata
        metadata = {
            "document_info": {
                "id": temp_doc.id,
                "doc_number": next_doc_number,
                "folder_name": folder_name,
                "display_name": Path(original_filename).stem,
                "original_filename": original_filename,
                "file_type": file_ext[1:],
                "file_size": len(content),
                "file_hash": file_hash,
                "upload_date": datetime.now().isoformat(),
                "processed_date": None
            },
            "processing_info": {
                "status": "uploaded",
                "total_pages": None,
                "total_chunks": None,
                "total_images": None,
                "ocr_completed": False,
                "vector_indexed": False,
                "processing_time_seconds": None
            },
            "paths": {
                "root": str(structure['root']),
                "original_file": str(original_file_path),
                "metadata_file": str(structure['root'] / 'metadata.json')
            }
        }
        
        # Save metadata
        document_storage.save_metadata(structure['root'], metadata)
        
        # Final update and commit
        temp_doc.status = "uploaded"
        db.commit()
        db.refresh(temp_doc)
        
        return {
            "message": "File uploaded successfully",
            "document_id": temp_doc.id,
            "filename": file.filename,
            "folder_name": temp_doc.folder_name,
            "structure_created": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

@admin_router.post("/documents/batch-upload")
async def batch_upload_documents(
    files: List[UploadFile] = File(...),
    metadata: Optional[str] = Form(None),
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Upload multiple documents at once with optional metadata"""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    if len(files) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 50 files can be uploaded at once"
        )
    
    # Parse metadata if provided
    custom_metadata = {}
    if metadata:
        try:
            custom_metadata = json.loads(metadata)
        except json.JSONDecodeError:
            logger.warning(f"Invalid metadata JSON: {metadata}")
    
    results = []
    successful = 0
    failed = 0
    
    for file in files:
        try:
            # Validate file
            if not file.filename:
                results.append({
                    "filename": "unknown",
                    "success": False,
                    "error": "No filename provided"
                })
                failed += 1
                continue
            
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ['.pdf', '.txt', '.md', '.docx']:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": f"Unsupported file type: {file_ext}"
                })
                failed += 1
                continue
            
            # Read file content
            content = await file.read()
            file_size_mb = len(content) / (1024 * 1024)
            
            if file_size_mb > MAX_FILE_SIZE_MB:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": f"File too large: {file_size_mb:.1f}MB (max {MAX_FILE_SIZE_MB}MB)"
                })
                failed += 1
                continue
            
            # Create temporary document to get ID
            # Determine organization_id from user's default org
            org_id = getattr(current_user, 'default_org_id', None)
            
            document = Document(
                name=Path(file.filename).stem,
                original_filename=file.filename,
                folder_name="temp",  # Temporary placeholder
                file_size=len(content),
                file_type=file_ext[1:],
                status="uploading",
                doc_metadata=custom_metadata, # Save custom metadata
                organization_id=org_id
            )
            
            db.add(document)
            db.flush()  # Get ID without committing
            
            # Create document structure with real ID
            structure = document_storage.create_document_structure(document.id, file.filename)
            folder_name = structure['root'].name
            
            # Update with real folder_name
            document.folder_name = folder_name
            
            # Write file
            original_file_path = structure['original'] / file.filename
            with open(original_file_path, "wb") as buffer:
                buffer.write(content)
            
            # Create metadata (file system version)
            import hashlib
            from datetime import datetime
            file_hash = hashlib.sha256(content).hexdigest()
            
            file_metadata = {
                "document_info": {
                    "id": document.id,
                    "folder_name": folder_name,
                    "display_name": Path(file.filename).stem,
                    "original_filename": file.filename,
                    "file_type": Path(file.filename).suffix.lower().lstrip('.'),
                    "file_size": len(content),
                    "file_hash": file_hash,
                    "upload_date": datetime.now().isoformat(),
                    "processed_date": None,
                    "custom_metadata": custom_metadata  # Also save to file system metadata
                },
                "processing_info": {
                    "status": "uploaded",
                    "total_pages": None,
                    "total_chunks": None,
                    "total_images": None,
                    "ocr_completed": False,
                    "vector_indexed": False,
                    "processing_time_seconds": None
                },
                "paths": {
                    "root": str(structure['root']),
                    "original_file": str(original_file_path),
                    "metadata_file": str(structure['root'] / 'metadata.json')
                }
            }
            
            document_storage.save_metadata(structure['root'], file_metadata)
            
            # Final update and commit
            document.status = "uploaded"
            db.commit()
            
            results.append({
                "filename": file.filename,
                "success": True,
                "document_id": document.id,
                "folder_name": folder_name
            })
            successful += 1
            
        except Exception as e:
            logger.error(f"Error uploading {file.filename}: {str(e)}")
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
            failed += 1
    
    return {
        "message": f"Batch upload completed: {successful} successful, {failed} failed",
        "total": len(files),
        "successful": successful,
        "failed": failed,
        "results": results
    }

@admin_router.post("/documents/{document_id}/process")
async def process_document(
    document_id: int,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Start processing a document asynchronously (OCR, text extraction, etc.)"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.status not in ["uploaded", "error"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is already {document.status}"
        )
    
    # Start asynchronous processing
    result = await async_document_processor.process_document_async(document_id, db)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return {
        "message": "Document processing started",
        "document_id": document_id,
        "status": "processing"
    }

@admin_router.get("/documents/{document_id}/progress")
async def get_document_progress(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Get document processing progress - real-time updates"""
    import json
    
    try:
        # Use PostgreSQL with SQLAlchemy - expire to get fresh data
        db.expire_all()
        
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Parse logs
        logs = []
        if document.processing_logs:
            try:
                logs = json.loads(document.processing_logs) if isinstance(document.processing_logs, str) else (document.processing_logs or [])
            except:
                logs = []
        
        # Check if actively processing
        is_processing = document_id in async_document_processor.processing_tasks
        
        return {
            "document_id": document_id,
            "status": document.status or "unknown",
            "processing_stage": document.processing_stage,
            "processing_progress": document.processing_progress or 0,
            "processing_details": document.processing_details,
            "processing_logs": logs,
            "is_processing": is_processing,
            "system_stats": resource_manager.get_system_stats(),
            "updated_at": document.updated_at.isoformat() if document.updated_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Progress check error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

class ReprocessOptions(BaseModel):
    """Options for document reprocessing"""
    reextract_images: bool = False  # Re-extract images from PDF
    rerun_image_ocr: bool = False   # Re-run OCR on images
    preserve_enrichments: bool = True  # Preserve chunk/asset enrichments


@admin_router.post("/documents/{document_id}/reprocess")
async def reprocess_document(
    document_id: int,
    options: Optional[ReprocessOptions] = None,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Reprocess a document with options to control what gets reprocessed"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Default options if not provided
    if options is None:
        options = ReprocessOptions()
    
    # Check if document has been processed before (has extracted text)
    # Use StorageService for multi-tenant path resolution
    org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
    possible_paths = _storage.get_full_text_paths(org_slug, document.folder_name)
    
    actual_text_path = None
    for path in possible_paths:
        logger.info(f"[Reprocess] Checking: {path.absolute()} - Exists: {path.exists()}")
        if path.exists():
            actual_text_path = path
            logger.info(f"[Reprocess] ✅ Found text file at: {actual_text_path}")
            break
    
    if not actual_text_path:
        logger.error(f"[Reprocess] Text file not found for document {document_id} in any location")
        logger.error(f"[Reprocess] Tried paths: {[str(p) for p in possible_paths]}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document has no cached text. Please process it first."
        )
    
    # If preserving enrichments, backup current enrichment data
    enrichment_backup = None
    if options.preserve_enrichments:
        from backend.database.models_v2 import DocumentChunk, DocumentAsset
        from backend.database.connection_v2 import SessionLocal as SessionLocalV2
        
        db_v2 = SessionLocalV2()
        try:
            # Backup chunk enrichments with content hash for matching
            chunks = db_v2.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).all()
            
            chunk_enrichments = {}
            for chunk in chunks:
                if chunk.enrichment_data or chunk.image_relations:
                    # Create content hash for matching after reprocess
                    import hashlib
                    content_hash = hashlib.md5(chunk.content.encode()).hexdigest()
                    chunk_enrichments[content_hash] = {
                        'enrichment_data': chunk.enrichment_data,
                        'image_relations': chunk.image_relations,
                        'chunk_index': chunk.chunk_index
                    }
            
            # Backup asset enrichments
            assets = db_v2.query(DocumentAsset).filter(
                DocumentAsset.document_id == document_id
            ).all()
            
            asset_enrichments = {}
            for asset in assets:
                if asset.caption or asset.ocr_text or (asset.asset_metadata and asset.asset_metadata.get('tags')):
                    # Use file path as key
                    asset_enrichments[asset.file_path] = {
                        'caption': asset.caption,
                        'ocr_text': asset.ocr_text,
                        'tags': asset.asset_metadata.get('tags', []) if asset.asset_metadata else []
                    }
            
            enrichment_backup = {
                'chunks': chunk_enrichments,
                'assets': asset_enrichments
            }
            
            logger.info(f"[Reprocess] Backed up {len(chunk_enrichments)} chunk enrichments and {len(asset_enrichments)} asset enrichments")
        finally:
            db_v2.close()
    
    # Start asynchronous reprocessing with options
    result = await async_document_processor.reprocess_document_async(
        document_id, 
        db,
        reextract_images=options.reextract_images,
        rerun_image_ocr=options.rerun_image_ocr,
        enrichment_backup=enrichment_backup
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return {
        "message": "Document reprocessing started",
        "document_id": document_id,
        "status": "processing",
        "mode": "reprocess",
        "options": {
            "reextract_images": options.reextract_images,
            "rerun_image_ocr": options.rerun_image_ocr,
            "preserve_enrichments": options.preserve_enrichments
        }
    }

@admin_router.post("/documents/{document_id}/cancel")
async def cancel_document_processing(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Cancel document processing"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.status not in ["processing", "pending"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is not being processed (current status: {document.status})"
        )
    
    # Cancel processing
    cancelled = await async_document_processor.cancel_processing(document_id)
    
    if cancelled:
        document.status = "uploaded"
        document.processing_stage = None
        document.processing_progress = 0
        document.processing_details = "İşleme iptal edildi"
        db.commit()
        
        return {"message": "Processing cancelled successfully"}
    else:
        return {"message": "Processing was not running or already completed"}

@admin_router.post("/documents/{document_id}/pause")
async def pause_document_processing(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Pause document processing"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.status not in ["processing", "pending"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is not being processed (current status: {document.status})"
        )
    
    # Pause processing
    paused = await async_document_processor.pause_processing(document_id)
    
    if paused:
        document.processing_details = "İşlem duraklatıldı"
        db.commit()
        return {"message": "Processing paused successfully"}
    else:
        return {"message": "Could not pause processing"}

@admin_router.post("/documents/{document_id}/resume")
async def resume_document_processing(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Resume document processing"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.status not in ["processing", "pending", "paused"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document cannot be resumed (current status: {document.status})"
        )
    
    # Resume processing
    resumed = await async_document_processor.resume_processing(document_id)
    
    if resumed:
        document.processing_details = "İşlem devam ediyor..."
        db.commit()
        return {"message": "Processing resumed successfully"}
    else:
        return {"message": "Could not resume processing"}

@admin_router.get("/system/resources")
async def get_system_resources(
    current_user: User = Depends(get_current_admin_user)
):
    """Get current system resource usage"""
    try:
        stats = resource_manager.get_system_stats()
        limits = {
            "max_memory_percent": resource_manager.limits.max_memory_percent,
            "max_cpu_percent": resource_manager.limits.max_cpu_percent,
            "max_concurrent_tasks": resource_manager.limits.max_concurrent_tasks
        }
        
        return {
            "success": True,
            "stats": stats,
            "limits": limits,
            "active_tasks": resource_manager.active_tasks
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@admin_router.post("/system/resources/limits")
async def update_resource_limits(
    limits: dict,
    current_user: User = Depends(get_current_admin_user)
):
    """Update system resource limits"""
    try:
        resource_manager.set_limits(**limits)
        return {
            "success": True,
            "message": "Resource limits updated successfully",
            "new_limits": {
                "max_memory_percent": resource_manager.limits.max_memory_percent,
                "max_cpu_percent": resource_manager.limits.max_cpu_percent,
                "max_concurrent_tasks": resource_manager.limits.max_concurrent_tasks
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@admin_router.post("/documents/{document_id}/reset")
async def reset_document(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Reset a processed document - removes all processing data and resets to uploaded state"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Allow reset for processed, error, uploaded documents with partial processing, processing, or indexed documents
    if document.status not in ["processed", "error", "uploaded", "processing", "indexed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reset document with status: {document.status}"
        )
    
    # If document is processing, cancel it first
    if document.status == "processing":
        try:
            await async_document_processor.cancel_processing(document_id)
            logger.info(f"Cancelled processing for document {document_id} before reset")
        except Exception as e:
            logger.warning(f"Could not cancel processing for document {document_id}: {e}")
    
    # If uploaded status, check if there's actually something to reset
    if document.status == "uploaded":
        has_processing_data = (
            document.ocr_completed or 
            document.vector_indexed or 
            document.total_chunks is not None or
            document.total_pages is not None
        )
        if not has_processing_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document has no processing data to reset"
            )

    
    reset_items = []
    
    try:
        # 1. Delete from ChromaDB using vector_store_manager
        try:
            from ..services.vectorstore.vector_store_manager import vector_store_manager
            deleted = vector_store_manager.delete_document(document_id)
            if deleted.get("chroma", 0) > 0:
                reset_items.append(f"ChromaDB chunks deleted")
        except Exception as e:
            logger.warning(f"Could not delete from ChromaDB: {e}")
        
        # 2. Delete processing folders but keep original
        if document.folder_name:
            doc_folder = DOCUMENTS_DIR / document.folder_name
            if doc_folder.exists():
                folders_to_delete = ['processed', 'images', 'vectors', 'analysis']
                for folder_name in folders_to_delete:
                    folder_path = doc_folder / folder_name
                    if folder_path.exists():
                        import shutil
                        shutil.rmtree(folder_path)
                        reset_items.append(f"Deleted folder: {folder_name}")
        
        # 3. Reset document status in database
        document.status = "uploaded"
        document.processing_stage = None
        document.processing_progress = 0
        document.processing_details = None
        document.total_pages = None
        document.total_chunks = None
        document.ocr_completed = False
        document.vector_indexed = False
        document.processed_at = None
        db.commit()
        reset_items.append(f"Reset document status to uploaded")
        
        return {
            "message": "Document reset successfully - ready for reprocessing",
            "document_id": document_id,
            "reset_items": reset_items
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting document: {str(e)}"
        )

@admin_router.post("/documents/bulk-reset")
async def bulk_reset_documents(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Reset all processed documents - removes all processing data and resets to uploaded state"""
    # Include uploaded documents with partial processing data, processing documents, and indexed documents
    all_docs = db.query(Document).filter(
        Document.status.in_(["processed", "error", "uploaded", "processing", "indexed"])
    ).all()
    
    # Filter to only documents that have processing data or are processing/indexed
    processed_docs = []
    for doc in all_docs:
        if doc.status in ["processed", "error", "processing", "indexed"]:
            processed_docs.append(doc)
        elif doc.status == "uploaded":
            # Check if uploaded document has partial processing data
            has_processing_data = (
                doc.ocr_completed or 
                doc.vector_indexed or 
                doc.total_chunks is not None or
                doc.total_pages is not None
            )
            if has_processing_data:
                processed_docs.append(doc)

    
    if not processed_docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No documents with processing data found to reset"
        )
    
    total_reset = 0
    failed_reset = 0
    reset_details = []
    
    for document in processed_docs:
        try:
            reset_items = []
            
            # 0. If document is processing, cancel it first
            if document.status == "processing":
                try:
                    await async_document_processor.cancel_processing(document.id)
                    reset_items.append("Cancelled processing")
                    logger.info(f"Cancelled processing for document {document.id} before bulk reset")
                except Exception as e:
                    logger.warning(f"Could not cancel processing for document {document.id}: {e}")
            
            # 1. Delete from ChromaDB using vector_store_manager
            try:
                from ..services.vectorstore.vector_store_manager import vector_store_manager
                deleted = vector_store_manager.delete_document(document.id)
                if deleted.get("chroma", 0) > 0:
                    reset_items.append(f"ChromaDB chunks deleted")
            except Exception as e:
                logger.warning(f"Could not delete from ChromaDB for doc {document.id}: {e}")
            
            # 2. Delete processing folders but keep original
            if document.folder_name:
                doc_folder = DOCUMENTS_DIR / document.folder_name
                if doc_folder.exists():
                    folders_to_delete = ['processed', 'images', 'vectors', 'analysis']
                    for folder_name in folders_to_delete:
                        folder_path = doc_folder / folder_name
                        if folder_path.exists():
                            import shutil
                            shutil.rmtree(folder_path)
                            reset_items.append(folder_name)
            
            # 3. Reset document status
            document.status = "uploaded"
            document.processing_stage = None
            document.processing_progress = 0
            document.processing_details = None
            document.total_pages = None
            document.total_chunks = None
            document.ocr_completed = False
            document.vector_indexed = False
            document.processed_at = None
            
            total_reset += 1
            reset_details.append({
                "document_id": document.id,
                "name": document.name,
                "success": True,
                "items_reset": reset_items
            })
            
        except Exception as e:
            failed_reset += 1
            logger.error(f"Error resetting document {document.id}: {str(e)}")
            reset_details.append({
                "document_id": document.id,
                "name": document.name,
                "success": False,
                "error": str(e)
            })
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error committing bulk reset: {str(e)}"
        )
    
    return {
        "message": f"Bulk reset completed: {total_reset} successful, {failed_reset} failed",
        "total_documents": len(processed_docs),
        "successful": total_reset,
        "failed": failed_reset,
        "details": reset_details
    }

# Advanced Reset and Reprocess Endpoints

@admin_router.post("/documents/{document_id}/reset-and-reprocess", response_model=ResetAndReprocessResponse)
async def reset_and_reprocess_document(
    document_id: int,
    request: ResetAndReprocessRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Advanced reset and reprocess endpoint with 3 levels and granular control
    
    Reset Levels:
    - indexing: Only delete embeddings (Hafif)
    - processing: Delete chunks with granular options (Orta)
    - all: Delete everything except original file (Tam)
    """
    logger.info(f"🔄 Reset and reprocess request for document {document_id}: level={request.reset_level}")
    
    # Validate document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Validate reset level
    if request.reset_level not in ['indexing', 'processing', 'all']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reset_level: {request.reset_level}. Must be 'indexing', 'processing', or 'all'"
        )
    
    # Convert Pydantic models to dicts
    reset_options = request.reset_options.dict() if request.reset_options else {}
    reprocess_options = request.reprocess_options.dict() if request.reprocess_options else {}
    
    try:
        # Call ResetService
        result = await reset_service.reset_and_reprocess(
            document_id=document_id,
            reset_level=request.reset_level,
            reset_options=reset_options,
            reprocess_options=reprocess_options,
            auto_process=request.auto_process,
            auto_index=request.auto_index,
            db=db
        )
        
        logger.info(f"✅ Reset and reprocess started: operation_id={result['operation_id']}")
        
        return ResetAndReprocessResponse(**result)
        
    except Exception as e:
        logger.error(f"❌ Reset and reprocess failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset and reprocess failed: {str(e)}"
        )

@admin_router.post("/documents/bulk-reset-and-reprocess")
async def bulk_reset_and_reprocess_documents(
    request: BulkResetAndReprocessRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Bulk reset and reprocess multiple documents
    """
    logger.info(f"🔄 Bulk reset and reprocess request for {len(request.document_ids)} documents")
    
    if not request.document_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No document IDs provided"
        )
    
    if len(request.document_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 100 documents can be processed at once"
        )
    
    # Validate reset level
    if request.reset_level not in ['indexing', 'processing', 'all']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reset_level: {request.reset_level}"
        )
    
    # Convert options to dicts
    reset_options = request.reset_options.dict() if request.reset_options else {}
    reprocess_options = request.reprocess_options.dict() if request.reprocess_options else {}
    
    results = []
    successful = 0
    failed = 0
    
    for document_id in request.document_ids:
        try:
            # Validate document exists
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                results.append({
                    "document_id": document_id,
                    "success": False,
                    "error": "Document not found"
                })
                failed += 1
                continue
            
            # Call ResetService for each document
            result = await reset_service.reset_and_reprocess(
                document_id=document_id,
                reset_level=request.reset_level,
                reset_options=reset_options,
                reprocess_options=reprocess_options,
                auto_process=request.auto_process,
                auto_index=request.auto_index,
                db=db
            )
            
            results.append({
                "document_id": document_id,
                "success": True,
                "operation_id": result["operation_id"],
                "estimated_time_seconds": result["estimated_time_seconds"]
            })
            successful += 1
            
        except Exception as e:
            logger.error(f"❌ Bulk reset failed for document {document_id}: {e}")
            results.append({
                "document_id": document_id,
                "success": False,
                "error": str(e)
            })
            failed += 1
    
    return {
        "message": f"Bulk reset and reprocess completed: {successful} successful, {failed} failed",
        "total": len(request.document_ids),
        "successful": successful,
        "failed": failed,
        "results": results
    }

@admin_router.get("/operations/{operation_id}/progress")
async def get_operation_progress(
    operation_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get operation progress via Server-Sent Events (SSE)
    
    This endpoint streams real-time progress updates for reset/reprocess operations.
    """
    from fastapi.responses import StreamingResponse
    from backend.database.models_v2 import Operation
    from backend.database.connection_v2 import SessionLocal as SessionLocalV2
    import asyncio
    import json
    from datetime import datetime
    
    async def event_stream():
        """Generate SSE events for operation progress"""
        db_v2 = SessionLocalV2()
        try:
            last_progress = -1
            last_stage = None
            
            while True:
                # Query operation from database
                operation = db_v2.query(Operation).filter(
                    Operation.operation_id == operation_id
                ).first()
                
                if not operation:
                    # Operation not found
                    yield f"data: {json.dumps({'error': 'Operation not found'})}\n\n"
                    break
                
                # Calculate elapsed time
                elapsed_seconds = 0
                if operation.started_at:
                    elapsed = datetime.utcnow() - operation.started_at
                    elapsed_seconds = int(elapsed.total_seconds())
                
                # Estimate remaining time (simple calculation)
                estimated_remaining = 0
                if operation.progress > 0 and operation.progress < 100:
                    estimated_total = elapsed_seconds / (operation.progress / 100)
                    estimated_remaining = int(estimated_total - elapsed_seconds)
                
                # Send update if progress changed
                if operation.progress != last_progress or operation.stage != last_stage:
                    progress_data = {
                        "operation_id": operation.operation_id,
                        "document_id": operation.document_id,
                        "stage": operation.stage or "unknown",
                        "progress": operation.progress or 0,
                        "details": operation.details or "",
                        "elapsed_seconds": elapsed_seconds,
                        "estimated_remaining_seconds": estimated_remaining
                    }
                    
                    yield f"data: {json.dumps(progress_data)}\n\n"
                    
                    last_progress = operation.progress
                    last_stage = operation.stage
                
                # Check if completed or error
                if operation.status in ['completed', 'error', 'cancelled']:
                    # Send final update
                    final_data = {
                        "operation_id": operation.operation_id,
                        "document_id": operation.document_id,
                        "stage": operation.status,
                        "progress": 100 if operation.status == 'completed' else operation.progress,
                        "details": operation.details or "",
                        "elapsed_seconds": elapsed_seconds,
                        "estimated_remaining_seconds": 0,
                        "error": operation.error if operation.status == 'error' else None
                    }
                    yield f"data: {json.dumps(final_data)}\n\n"
                    break
                
                # Wait before next check
                await asyncio.sleep(1)
                
                # Refresh database session
                db_v2.expire_all()
                
        except Exception as e:
            logger.error(f"❌ SSE stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            db_v2.close()
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )

@admin_router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a document and all its related files, folders, and database records"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    deleted_items = []
    
    try:
        # 1. Delete from ChromaDB first using vector_store_manager
        try:
            from ..services.vectorstore.vector_store_manager import vector_store_manager
            deleted = vector_store_manager.delete_document(document_id)
            if deleted.get("chroma", 0) > 0:
                deleted_items.append(f"ChromaDB chunks deleted")
        except Exception as e:
            logger.warning(f"Could not delete from ChromaDB: {e}")
        
        # 2. Delete document processing folder (includes FAISS index)
        if document.folder_name:
            documents_folder = DOCUMENTS_DIR / document.folder_name
            if documents_folder.exists():
                import shutil
                shutil.rmtree(documents_folder)
                deleted_items.append(f"Documents folder (with FAISS): {documents_folder}")
        
        # 3. Delete document from database
        db.delete(document)
        db.commit()
        deleted_items.append(f"Document DB record: {document_id}")
        
        return {
            "message": "Document and all related data deleted successfully",
            "deleted_items": deleted_items
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting document: {str(e)}"
        )

# Model Configuration Endpoints (moved to end of file to avoid duplicates)

@admin_router.post("/models", response_model=ModelConfigResponse)
async def create_model_config(
    model_data: ModelConfigCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new model configuration"""
    # Check if name already exists
    existing = db.query(ModelConfig).filter(ModelConfig.name == model_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model configuration with this name already exists"
        )
    
    # If this is set as default, unset other defaults
    if model_data.is_default:
        db.query(ModelConfig).filter(ModelConfig.is_default == True).update(
            {"is_default": False}
        )
    
    model_config = ModelConfig(
        name=model_data.name,
        provider=model_data.provider,
        model_name=model_data.model_name,
        description=model_data.description,
        # LLM Parameters
        num_ctx=model_data.num_ctx,
        num_predict=model_data.num_predict,
        temperature=model_data.temperature,
        top_p=model_data.top_p,
        top_k=model_data.top_k,
        repeat_penalty=model_data.repeat_penalty,
        # RAG Parameters
        max_context_chars=model_data.max_context_chars,
        rag_top_k=model_data.rag_top_k,
        chunk_size=model_data.chunk_size,
        chunk_overlap=model_data.chunk_overlap,
        # System Parameters
        timeout_seconds=model_data.timeout_seconds,
        is_default=model_data.is_default,
        is_active=True
    )
    
    db.add(model_config)
    db.commit()
    db.refresh(model_config)
    
    return ModelConfigResponse.from_orm(model_config)

@admin_router.put("/models/{model_id}", response_model=ModelConfigResponse)
async def update_model_config(
    model_id: int,
    model_data: ModelConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a model configuration"""
    model_config = db.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model configuration not found"
        )
    
    # Track if default model is changing
    default_changed = False
    
    # Update fields
    for field, value in model_data.dict(exclude_unset=True).items():
        if field == "is_default" and value:
            # Unset other defaults
            db.query(ModelConfig).filter(ModelConfig.is_default == True).update(
                {"is_default": False}
            )
            default_changed = True
        setattr(model_config, field, value)
    
    db.commit()
    db.refresh(model_config)
    
    # Invalidate Chat-UI cache if default model changed
    if default_changed:
        from backend.api import chatui_integration as chatui_module
        chatui_module._config_version += 1
        logger.info(f"Default model changed to '{model_config.name}', Chat-UI cache invalidated")
    
    return ModelConfigResponse.from_orm(model_config)

# Note: Model deletion endpoint moved to line ~961 with proper hard delete
# The old soft delete approach was removed in favor of actual deletion

# Hugging Face Integration
@admin_router.get("/huggingface/models")
async def list_huggingface_models(
    current_user: User = Depends(get_current_admin_user)
):
    """List available Hugging Face models"""
    try:
        models_data = await huggingface_service.list_models()
        return {
            "models": models_data.get("models", []),
            "provider": "huggingface",
            "api_available": huggingface_service.api_token is not None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch Hugging Face models: {str(e)}"
        )

@admin_router.get("/huggingface/health")
async def check_huggingface_health(
    current_user: User = Depends(get_current_admin_user)
):
    """Check Hugging Face API health"""
    try:
        is_healthy = await huggingface_service.check_health()
        return {
            "healthy": is_healthy,
            "api_token_configured": huggingface_service.api_token is not None,
            "provider": "huggingface"
        }
    except Exception as e:
        return {
            "healthy": False,
            "error": str(e),
            "api_token_configured": huggingface_service.api_token is not None,
            "provider": "huggingface"
        }


# Vector Database Management
class VectorIndexResponse(BaseModel):
    id: int
    document_id: int
    index_name: str
    index_type: str
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    total_chunks: int
    created_at: str
    
    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            document_id=obj.document_id,
            index_name=obj.index_name,
            index_type=obj.index_type,
            embedding_model=obj.embedding_model,
            chunk_size=obj.chunk_size,
            chunk_overlap=obj.chunk_overlap,
            total_chunks=obj.total_chunks,
            created_at=obj.created_at.isoformat() if obj.created_at else ""
        )

class VectorIndexCreate(BaseModel):
    document_id: int
    index_name: str
    index_type: str = "faiss"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_size: int = 1000
    chunk_overlap: int = 200

@admin_router.get("/vector-indexes", response_model=List[VectorIndexResponse])
async def list_vector_indexes(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all vector indexes"""
    indexes = db.query(VectorIndex).all()
    return [VectorIndexResponse.from_orm(index) for index in indexes]

@admin_router.post("/vector-indexes", response_model=VectorIndexResponse)
async def create_vector_index(
    index_data: VectorIndexCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new vector index for a document"""
    # Check if document exists
    document = db.query(Document).filter(Document.id == index_data.document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document.status != "processed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document must be processed before creating vector index"
        )
    
    # Check if index already exists for this document
    existing = db.query(VectorIndex).filter(
        VectorIndex.document_id == index_data.document_id,
        VectorIndex.index_name == index_data.index_name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vector index with this name already exists for this document"
        )
    
    # Create index path
    index_dir = DOCUMENTS_DIR / "indexes"
    index_dir.mkdir(exist_ok=True)
    index_path = index_dir / f"{index_data.index_name}_{document.id}"
    
    # TODO: Implement actual vector index creation
    # For now, simulate the process
    import time
    time.sleep(1)  # Simulate processing time
    
    vector_index = VectorIndex(
        document_id=index_data.document_id,
        index_name=index_data.index_name,
        index_type=index_data.index_type,
        embedding_model=index_data.embedding_model,
        chunk_size=index_data.chunk_size,
        chunk_overlap=index_data.chunk_overlap,
        total_chunks=50,  # Simulated
        index_path=str(index_path)
    )
    
    db.add(vector_index)
    
    # Update document status
    document.vector_indexed = True
    
    db.commit()
    db.refresh(vector_index)
    
    return VectorIndexResponse.from_orm(vector_index)

@admin_router.post("/vector-indexes/{index_id}/rebuild")
async def rebuild_vector_index(
    index_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Rebuild a vector index"""
    vector_index = db.query(VectorIndex).filter(VectorIndex.id == index_id).first()
    if not vector_index:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector index not found"
        )
    
    # TODO: Implement actual rebuild logic
    # For now, simulate the process
    import time
    from datetime import datetime, timezone
    
    time.sleep(2)  # Simulate rebuild time
    vector_index.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {
        "message": "Vector index rebuilt successfully",
        "index_id": index_id,
        "total_chunks": vector_index.total_chunks
    }

@admin_router.delete("/vector-indexes/{index_id}")
async def delete_vector_index(
    index_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a vector index"""
    vector_index = db.query(VectorIndex).filter(VectorIndex.id == index_id).first()
    if not vector_index:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector index not found"
        )
    
    # Delete index files if they exist
    index_path = Path(vector_index.index_path)
    if index_path.exists():
        if index_path.is_dir():
            shutil.rmtree(index_path)
        else:
            index_path.unlink()
    
    # Update document status
    document = db.query(Document).filter(Document.id == vector_index.document_id).first()
    if document:
        # Check if there are other indexes for this document
        other_indexes = db.query(VectorIndex).filter(
            VectorIndex.document_id == vector_index.document_id,
            VectorIndex.id != index_id
        ).count()
        
        if other_indexes == 0:
            document.vector_indexed = False
    
    # Delete database record
    db.delete(vector_index)
    db.commit()
    
    return {"message": "Vector index deleted successfully"}

# Model Management Endpoints
@admin_router.get("/models", response_model=List[ModelConfigResponse])
async def list_models(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all model configurations"""
    models = db.query(ModelConfig).all()
    return [ModelConfigResponse.from_orm(model) for model in models]

@admin_router.get("/models/{model_id}", response_model=ModelConfigResponse)
async def get_model(
    model_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific model configuration"""
    model = db.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    return ModelConfigResponse.from_orm(model)

@admin_router.post("/models", response_model=ModelConfigResponse)
async def create_model(
    model_data: ModelConfigCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new model configuration"""
    # Check if model name already exists
    existing_model = db.query(ModelConfig).filter(ModelConfig.name == model_data.name).first()
    if existing_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model with name '{model_data.name}' already exists"
        )
    
    # If this is set as default, unset other defaults
    if model_data.is_default:
        db.query(ModelConfig).filter(ModelConfig.is_default == True).update({"is_default": False})
    
    # Create new model
    new_model = ModelConfig(**model_data.dict())
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    
    return ModelConfigResponse.from_orm(new_model)

@admin_router.put("/models/{model_id}", response_model=ModelConfigResponse)
async def update_model(
    model_id: int,
    model_data: ModelConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a model configuration"""
    model = db.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    # If setting as default, unset other defaults
    if model_data.is_default:
        db.query(ModelConfig).filter(
            ModelConfig.is_default == True,
            ModelConfig.id != model_id
        ).update({"is_default": False})
    
    # Update model fields
    update_data = model_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(model, field, value)
    
    db.commit()
    db.refresh(model)
    
    return ModelConfigResponse.from_orm(model)

@admin_router.delete("/models/{model_id}")
async def delete_model(
    model_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a model configuration with proper cleanup"""
    model = db.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    # Check if this is the default model
    if model.is_default:
        # Check if there are other models to set as default
        other_models = db.query(ModelConfig).filter(
            ModelConfig.id != model_id,
            ModelConfig.is_active == True
        ).first()
        
        if other_models:
            # Set the first available model as default
            other_models.is_default = True
            logger.info(f"Setting model '{other_models.name}' as new default after deleting '{model.name}'")
        else:
            logger.warning(f"Deleting the last default model '{model.name}' - no replacement available")
    
    # Log the deletion for audit purposes
    model_name = model.name
    model_id = model.id
    model_provider = model.provider
    logger.info(f"Deleting model: {model_name} (ID: {model_id}, Provider: {model_provider})")
    
    # TODO: In the future, we might want to:
    # - Check for any active chat sessions using this model
    # - Clean up any model-specific cache or temporary files
    # - Update any user preferences that reference this model
    
    # Delete the model
    db.delete(model)
    db.commit()
    
    return {
        "message": f"Model '{model_name}' deleted successfully",
        "deleted_model": {
            "id": model_id,
            "name": model_name,
            "provider": model_provider
        }
    }

@admin_router.get("/documents/asset/file")
async def get_document_asset_file(
    path: str,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get a document asset file (image, etc) from the filesystem.
    Uses token from query string for frontend <img> tag compatibility.
    """
    try:
        # Validate token
        from ..auth.security import verify_token
        payload = verify_token(token)
        if not payload or payload.get("sub") is None:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        # Verify user is admin
        user_email = payload.get("sub")
        user = db.query(User).filter(User.email == user_email).first()
        if not user or not user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Build absolute path from relative path
        base_dir = Path(__file__).parent.parent.parent
        file_path = base_dir / path
        
        # Security check: Ensure file is within documents directory
        documents_root = base_dir / "documents"
        try:
            file_path.resolve().relative_to(documents_root.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        import magic
        mime = magic.Magic(mime=True)
        content_type = mime.from_file(str(file_path))

        return FileResponse(
            path=file_path,
            media_type=content_type,
            filename=file_path.name
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving asset file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# System Status and Statistics
@admin_router.get("/stats")
@admin_router.get("/dashboard/stats")  # Alias for frontend compatibility
async def get_system_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system statistics"""
    # Document statistics
    total_documents = db.query(Document).count()
    processed_documents = db.query(Document).filter(Document.status == "processed").count()
    error_documents = db.query(Document).filter(Document.status == "error").count()
    processing_documents = db.query(Document).filter(Document.status == "processing").count()
    
    # Vector index statistics
    total_indexes = 0
    
    # User statistics
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    admin_users = db.query(User).filter(User.is_admin == True).count()
    
    # Model statistics
    total_models = db.query(ModelConfig).count()
    active_models = db.query(ModelConfig).filter(ModelConfig.is_active == True).count()
    
    # Storage statistics
    total_storage = 0
    if DOCUMENTS_DIR.exists():
        for file_path in DOCUMENTS_DIR.rglob("*"):
            if file_path.is_file():
                total_storage += file_path.stat().st_size
    
    # AI Services statistics from ai_provider and ai_tokens tables
    ai_services_data = {
        "total": 0,
        "active": 0,
        "by_provider": []
    }
    try:
        from ..database.models import AIProvider as AIProviderModel, AIToken as AITokenModel
        from sqlalchemy.orm import joinedload
        
        providers = db.query(AIProviderModel).options(
            joinedload(AIProviderModel.tokens)
        ).filter(AIProviderModel.is_enabled == True).order_by(AIProviderModel.priority).all()
        
        for provider in providers:
            tokens = provider.tokens or []
            active_tokens = [t for t in tokens if t.is_active]
            
            ai_services_data["total"] += len(tokens)
            ai_services_data["active"] += len(active_tokens)
            
            # Add provider with token details
            ai_services_data["by_provider"].append({
                "provider": provider.name,
                "display_name": provider.display_name,  # Use provider's display_name instead of service_type
                "total": len(tokens),
                "active": len(active_tokens),
                "services": [
                    {
                        "name": token.display_name,  # Token display name
                        "is_active": token.is_active and token.is_available
                    }
                    for token in sorted(tokens, key=lambda t: t.priority)
                ]
            })
    except Exception as e:
        logger.warning(f"Could not get AI services stats: {e}")
    
    return {
        "documents": {
            "total": total_documents,
            "processed": processed_documents,
            "failed": error_documents,  # 'error' status in DB, 'failed' key for frontend compatibility
            "processing": processing_documents
        },
        "vector_indexes": {
            "total": total_indexes
        },
        "users": {
            "total": total_users,
            "active": active_users,
            "admins": admin_users
        },
        "models": {
            "total": total_models,
            "active": active_models
        },
        "storage": {
            "total_bytes": total_storage,
            "total_mb": round(total_storage / (1024 * 1024), 2)
        },
        "ai_services": ai_services_data
    }

# User Management Endpoints
@admin_router.get("/users")
async def get_users(
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all users"""
    # Use raw SQL to avoid SQLAlchemy model issues
    result = db.execute(text("SELECT * FROM users ORDER BY created_at DESC"))
    users = result.fetchall()
    
    return [{
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "surname": user.surname,
        "full_name": user.full_name,
        "is_active": bool(user.is_active),
        "is_admin": bool(user.is_admin),
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "last_login": user.last_login
    } for user in users]

# System Endpoints
@admin_router.get("/system/stats")
async def get_system_stats_detailed(
    current_user: User = Depends(get_current_admin_user)
):
    """Get detailed system statistics"""
    import psutil
    
    return {
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory": {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent,
            "used": psutil.virtual_memory().used
        },
        "disk": {
            "total": psutil.disk_usage('/').total,
            "used": psutil.disk_usage('/').used,
            "free": psutil.disk_usage('/').free,
            "percent": psutil.disk_usage('/').percent
        }
    }

@admin_router.get("/system/memory-status")
async def get_memory_status(
    current_user: User = Depends(get_current_admin_user)
):
    """Get memory status"""
    import psutil
    
    mem = psutil.virtual_memory()
    return {
        "total": mem.total,
        "available": mem.available,
        "percent": mem.percent,
        "used": mem.used,
        "free": mem.free
    }

# Indexing Configuration Models
class DocumentProcessorConfig(BaseModel):
    max_memory_mb: int
    batch_size: int
    chunk_size: int
    overlap: int

class EmbeddingServiceConfig(BaseModel):
    max_memory_mb: int
    batch_size: int
    default_model: str
    loaded_models: List[str] = []

class SystemMonitorConfig(BaseModel):
    warning_memory_percent: int
    critical_memory_percent: int
    monitoring_active: bool

class IndexingConfigUpdate(BaseModel):
    document_processor: DocumentProcessorConfig
    embedding_service: EmbeddingServiceConfig
    system_monitor: SystemMonitorConfig

# Indexing Configuration Endpoints
def get_default_indexing_config():
    """Get default indexing configuration"""
    return {
        "document_processor": {
            "max_memory_mb": 512,
            "batch_size": 10,
            "chunk_size": 500,
            "overlap": 100
        },
        "embedding_service": {
            "max_memory_mb": 1024,
            "batch_size": 32,
            "default_model": "sentence-transformers/all-MiniLM-L6-v2",
            "loaded_models": []
        },
        "system_monitor": {
            "warning_memory_percent": 75,
            "critical_memory_percent": 90,
            "monitoring_active": True
        }
    }

@admin_router.get("/indexing/config")
async def get_indexing_config(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get indexing configuration from database"""
    setting = db.query(Settings).filter(Settings.key == "indexing_config").first()
    
    if setting:
        return setting.value
    else:
        # Return default config if not found
        return get_default_indexing_config()

@admin_router.post("/indexing/config")
async def update_indexing_config(
    config_data: IndexingConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update indexing configuration and save to database"""
    print(f"[DEBUG] Received config update: {config_data.dict()}")
    
    # Validate chunk_size and overlap
    if config_data.document_processor.chunk_size < 100 or config_data.document_processor.chunk_size > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="chunk_size must be between 100 and 2000"
        )
    
    if config_data.document_processor.overlap < 0 or config_data.document_processor.overlap >= config_data.document_processor.chunk_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="overlap must be between 0 and chunk_size"
        )
    
    # Validate memory settings
    if config_data.document_processor.max_memory_mb < 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_processor max_memory_mb must be at least 128MB"
        )
    
    if config_data.embedding_service.max_memory_mb < 256:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="embedding_service max_memory_mb must be at least 256MB"
        )
    
    # Save to database
    print("[DEBUG] Saving to database...")
    setting = db.query(Settings).filter(Settings.key == "indexing_config").first()
    
    if setting:
        # Update existing setting
        print("[DEBUG] Updating existing setting")
        setting.value = config_data.dict()
        setting.description = "Indexing configuration for document processing and embedding"
    else:
        # Create new setting
        print("[DEBUG] Creating new setting")
        setting = Settings(
            key="indexing_config",
            value=config_data.dict(),
            description="Indexing configuration for document processing and embedding"
        )
        db.add(setting)
    
    print(f"[DEBUG] About to commit: {setting.value}")
    db.commit()
    db.refresh(setting)
    print(f"[DEBUG] Saved successfully: {setting.id}")
    
    return {
        "success": True,
        "message": "Indexing configuration updated successfully",
        "config": setting.value
    }

@admin_router.get("/indexing/presets")
async def get_indexing_presets(
    current_user: User = Depends(get_current_admin_user)
):
    """Get indexing presets"""
    return {
        "performance": {
            "name": "Performans",
            "description": "Yüksek performans için optimize edilmiş",
            "requirements": "8GB+ RAM, Güçlü CPU",
            "chunk_size": 300,
            "chunk_overlap": 50,
            "batch_size": 100,
            "suitable": True
        },
        "balanced": {
            "name": "Dengeli",
            "description": "Performans ve hassasiyet dengesi",
            "requirements": "4GB+ RAM, Orta CPU",
            "chunk_size": 500,
            "chunk_overlap": 100,
            "batch_size": 50,
            "suitable": True
        },
        "memory_saver": {
            "name": "Bellek Tasarrufu",
            "description": "Düşük bellek kullanımı",
            "requirements": "2GB+ RAM",
            "chunk_size": 400,
            "chunk_overlap": 80,
            "batch_size": 20,
            "suitable": False
        },
        "minimal": {
            "name": "Minimal",
            "description": "En düşük kaynak kullanımı",
            "requirements": "1GB+ RAM",
            "chunk_size": 200,
            "chunk_overlap": 40,
            "batch_size": 10,
            "suitable": False
        }
    }

@admin_router.post("/indexing/apply-preset")
async def apply_indexing_preset(
    preset_data: dict,
    current_user: User = Depends(get_current_admin_user)
):
    """Apply an indexing preset configuration"""
    preset_name = preset_data.get("preset_name")
    
    if not preset_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="preset_name is required"
        )
    
    # Get available presets
    presets = {
        "performance": {
            "chunk_size": 300,
            "chunk_overlap": 50,
            "batch_size": 100,
            "max_memory_mb": 1024
        },
        "balanced": {
            "chunk_size": 500,
            "chunk_overlap": 100,
            "batch_size": 50,
            "max_memory_mb": 512
        },
        "memory_saver": {
            "chunk_size": 400,
            "chunk_overlap": 80,
            "batch_size": 20,
            "max_memory_mb": 256
        },
        "minimal": {
            "chunk_size": 200,
            "chunk_overlap": 40,
            "batch_size": 10,
            "max_memory_mb": 128
        }
    }
    
    if preset_name not in presets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid preset name: {preset_name}"
        )
    
    # In a real implementation, you would save these settings to a configuration file or database
    # For now, we'll just return success with the applied settings
    applied_config = presets[preset_name]
    
    return {
        "success": True,
        "message": f"Preset '{preset_name}' applied successfully",
        "applied_config": applied_config
    }

@admin_router.post("/system/cleanup-memory")
async def cleanup_memory(
    current_user: User = Depends(get_current_admin_user)
):
    """Cleanup memory"""
    import gc
    gc.collect()
    return {
        "success": True,
        "message": "Bellek temizlendi"
    }

# Vector Indexes Endpoints
@admin_router.get("/vector-indexes")
async def get_vector_indexes(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all vector indexes with document information"""
    try:
        # Join vector_indexes with documents table
        query = db.query(VectorIndex, Document).join(
            Document, VectorIndex.document_id == Document.id
        ).offset(skip).limit(limit)
        
        results = query.all()
        
        vector_indexes = []
        for vector_index, document in results:
            vector_indexes.append({
                "id": vector_index.id,
                "document_id": vector_index.document_id,
                "document_name": document.filename,
                "document_status": document.status,
                "index_name": vector_index.index_name,
                "index_path": vector_index.index_path,
                "embedding_model": vector_index.embedding_model,
                "chunk_count": vector_index.chunk_count,
                "dimension": vector_index.dimension,
                "index_type": vector_index.index_type,
                "metric": vector_index.metric,
                "created_at": vector_index.created_at,
                "file_size": document.file_size,
                "total_pages": document.metadata.get("total_pages", 0) if document.metadata else 0,
                "extracted_images": document.metadata.get("extracted_images", 0) if document.metadata else 0
            })
        
        # Get total count
        total_count = db.query(VectorIndex).count()
        
        return {
            "vector_indexes": vector_indexes,
            "total": total_count,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching vector indexes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching vector indexes: {str(e)}"
        )

@admin_router.get("/vector-indexes/{index_id}")
async def get_vector_index_details(
    index_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific vector index"""
    try:
        # Get vector index with document info
        result = db.query(VectorIndex, Document).join(
            Document, VectorIndex.document_id == Document.id
        ).filter(VectorIndex.id == index_id).first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vector index not found"
            )
        
        vector_index, document = result
        
        # Check if index files exist
        index_exists = os.path.exists(vector_index.index_path) if vector_index.index_path else False
        
        # Get file size if exists
        index_file_size = 0
        if index_exists:
            try:
                index_file_size = os.path.getsize(vector_index.index_path)
            except:
                pass
        
        return {
            "id": vector_index.id,
            "document_id": vector_index.document_id,
            "document_name": document.filename,
            "document_status": document.status,
            "document_path": document.file_path,
            "index_name": vector_index.index_name,
            "index_path": vector_index.index_path,
            "index_exists": index_exists,
            "index_file_size": index_file_size,
            "embedding_model": vector_index.embedding_model,
            "chunk_count": vector_index.chunk_count,
            "dimension": vector_index.dimension,
            "index_type": vector_index.index_type,
            "metric": vector_index.metric,
            "created_at": vector_index.created_at,
            "document_metadata": document.metadata,
            "processing_details": {
                "status": document.status,
                "stage": document.processing_stage,
                "progress": document.processing_progress,
                "details": document.processing_details,
                "total_chunks": document.total_chunks,
                "ocr_completed": document.ocr_completed,
                "vector_indexed": document.vector_indexed,
                "processed_at": document.processed_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching vector index details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching vector index details: {str(e)}"
        )

@admin_router.delete("/vector-indexes/{index_id}")
async def delete_vector_index(
    index_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a vector index and its files"""
    try:
        # Get vector index
        vector_index = db.query(VectorIndex).filter(VectorIndex.id == index_id).first()
        
        if not vector_index:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vector index not found"
            )
        
        # Delete index files if they exist
        files_deleted = []
        if vector_index.index_path and os.path.exists(vector_index.index_path):
            try:
                # Delete FAISS index file
                os.remove(vector_index.index_path)
                files_deleted.append(vector_index.index_path)
                
                # Delete related files (data.pkl, meta.json)
                index_dir = os.path.dirname(vector_index.index_path)
                base_name = os.path.splitext(os.path.basename(vector_index.index_path))[0]
                
                for ext in ['_data.pkl', '_meta.json']:
                    related_file = os.path.join(index_dir, base_name + ext)
                    if os.path.exists(related_file):
                        os.remove(related_file)
                        files_deleted.append(related_file)
                        
            except Exception as e:
                logger.warning(f"Error deleting index files: {e}")
        
        # Delete from database
        db.delete(vector_index)
        
        # Update document vector_indexed status
        document = db.query(Document).filter(Document.id == vector_index.document_id).first()
        if document:
            document.vector_indexed = False
            # Clear vector index metadata
            if document.metadata:
                metadata = document.metadata.copy()
                metadata.pop("vector_index_path", None)
                metadata.pop("chunks_count", None)
                metadata.pop("embedding_dim", None)
                metadata.pop("index_type", None)
                document.metadata = metadata
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Vector index deleted successfully",
            "files_deleted": files_deleted
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting vector index: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting vector index: {str(e)}"
        )

@admin_router.post("/vector-indexes/{index_id}/rebuild")
async def rebuild_vector_index(
    index_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Rebuild a vector index for a document"""
    try:
        # Get vector index and document
        result = db.query(VectorIndex, Document).join(
            Document, VectorIndex.document_id == Document.id
        ).filter(VectorIndex.id == index_id).first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vector index not found"
            )
        
        vector_index, document = result
        
        # Check if document is already being processed
        if document.status == "processing":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document is already being processed"
            )
        
        # Start async processing to rebuild index
        from ..services.async_document_processor import AsyncDocumentProcessor
        processor = AsyncDocumentProcessor()
        
        result = await processor.process_document_async(document.id, db)
        
        if result["success"]:
            return {
                "success": True,
                "message": "Vector index rebuild started",
                "document_id": document.id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to start rebuild")
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rebuilding vector index: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error rebuilding vector index: {str(e)}"
        )

# Statistics Endpoints
@admin_router.get("/statistics/ai-services")
async def get_ai_service_statistics(
    service_id: Optional[int] = None,
    days: int = 7,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """AI Service istatistiklerini al"""
    try:
        from backend.services.ai_service_statistics import AIServiceStatisticsService
        from datetime import date, timedelta
        
        start_date = date.today() - timedelta(days=days)
        end_date = date.today()
        
        statistics = AIServiceStatisticsService.get_service_statistics(
            db=db,
            service_id=service_id,
            start_date=start_date,
            end_date=end_date,
            limit=100
        )
        
        summary = AIServiceStatisticsService.get_service_summary(db=db, days=days)
        
        return {
            "success": True,
            "statistics": statistics,
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Error getting AI service statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting AI service statistics: {str(e)}"
        )

@admin_router.get("/statistics/huggingface")
async def get_huggingface_statistics(
    days: int = 7,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """HuggingFace kullanım istatistiklerini al"""
    try:
        from backend.services.ai_service_statistics import AIServiceStatisticsService
        
        usage_summary = AIServiceStatisticsService.get_huggingface_usage_summary(
            db=db, 
            days=days
        )
        
        return {
            "success": True,
            "usage_summary": usage_summary
        }
        
    except Exception as e:
        logger.error(f"Error getting HuggingFace statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting HuggingFace statistics: {str(e)}"
        )

@admin_router.get("/statistics/system")
async def get_system_statistics(
    days: int = 7,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Sistem geneli istatistikleri al"""
    try:
        from backend.services.enhanced_statistics_service import EnhancedStatisticsService
        from datetime import datetime, timedelta
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        system_stats = await EnhancedStatisticsService.get_system_statistics(
            db=db,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "success": True,
            "system_statistics": system_stats
        }
        
    except Exception as e:
        logger.error(f"Error getting system statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting system statistics: {str(e)}"
        )


@admin_router.get("/statistics/summary")
async def get_statistics_summary(
    days: int = 7,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get overall statistics summary for dashboard"""
    from ..database.statistics_model import Statistics, StatCategory
    from datetime import datetime, timedelta
    
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Get request statistics
        request_stats = db.query(Statistics).filter(
            Statistics.category == StatCategory.REQUEST,
            Statistics.timestamp >= start_date
        ).all()
        
        if not request_stats:
            return {
                "total_requests": 0,
                "avg_duration": 0,
                "total_tokens": 0,
                "success_rate": 100,
                "period_days": days,
                "by_mode": {"chat": 0, "rag": 0},
                "by_model": {}
            }
        
        total_requests = len(request_stats)
        total_duration = 0
        total_tokens = 0
        successful = 0
        by_mode = {"chat": 0, "rag": 0}
        by_model = {}
        
        for stat in request_stats:
            try:
                extra = stat.get_data() if hasattr(stat, 'get_data') else {}
                total_duration += float(stat.value or 0)
                total_tokens += extra.get('tokens', 0)
                if extra.get('success', True):
                    successful += 1
                mode = extra.get('mode', 'chat')
                by_mode[mode] = by_mode.get(mode, 0) + 1
                model = extra.get('model', stat.key)
                by_model[model] = by_model.get(model, 0) + 1
            except Exception:
                continue
        
        return {
            "total_requests": total_requests,
            "avg_duration": round(total_duration / total_requests, 2) if total_requests > 0 else 0,
            "total_tokens": total_tokens,
            "success_rate": round((successful / total_requests * 100), 1) if total_requests > 0 else 100,
            "period_days": days,
            "by_mode": by_mode,
            "by_model": by_model
        }
    except Exception as e:
        logger.error(f"Error getting statistics summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/statistics/timeline")
async def get_statistics_timeline(
    days: int = 7,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get statistics timeline for charts"""
    from ..database.statistics_model import Statistics, StatCategory
    from datetime import datetime, timedelta
    
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Get request statistics
        request_stats = db.query(Statistics).filter(
            Statistics.category == StatCategory.REQUEST,
            Statistics.timestamp >= start_date
        ).order_by(Statistics.timestamp).all()
        
        # Group by date
        daily_stats = {}
        for stat in request_stats:
            date_key = stat.timestamp.strftime('%Y-%m-%d') if stat.timestamp else 'unknown'
            if date_key not in daily_stats:
                daily_stats[date_key] = {
                    "date": date_key,
                    "requests": 0,
                    "successful": 0,
                    "failed": 0,
                    "avg_duration": 0,
                    "total_duration": 0
                }
            
            daily_stats[date_key]["requests"] += 1
            try:
                extra = stat.get_data() if hasattr(stat, 'get_data') else {}
                if extra.get('success', True):
                    daily_stats[date_key]["successful"] += 1
                else:
                    daily_stats[date_key]["failed"] += 1
                daily_stats[date_key]["total_duration"] += float(stat.value or 0)
            except Exception:
                pass
        
        # Calculate averages
        timeline = []
        for date_key in sorted(daily_stats.keys()):
            day = daily_stats[date_key]
            day["avg_duration"] = round(day["total_duration"] / day["requests"], 2) if day["requests"] > 0 else 0
            del day["total_duration"]
            timeline.append(day)
        
        return {
            "timeline": timeline,
            "period_days": days
        }
    except Exception as e:
        logger.error(f"Error getting statistics timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/statistics/performance")
async def get_statistics_performance(
    days: int = 7,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get performance statistics"""
    from ..database.statistics_model import Statistics, StatCategory
    from datetime import datetime, timedelta
    
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Get request statistics
        request_stats = db.query(Statistics).filter(
            Statistics.category == StatCategory.REQUEST,
            Statistics.timestamp >= start_date
        ).all()
        
        if not request_stats:
            return {
                "avg_response_time": 0,
                "min_response_time": 0,
                "max_response_time": 0,
                "p95_response_time": 0,
                "total_requests": 0,
                "requests_per_hour": 0,
                "period_days": days
            }
        
        durations = []
        for stat in request_stats:
            try:
                durations.append(float(stat.value or 0))
            except Exception:
                pass
        
        if not durations:
            return {
                "avg_response_time": 0,
                "min_response_time": 0,
                "max_response_time": 0,
                "p95_response_time": 0,
                "total_requests": 0,
                "requests_per_hour": 0,
                "period_days": days
            }
        
        durations.sort()
        p95_index = int(len(durations) * 0.95)
        
        return {
            "avg_response_time": round(sum(durations) / len(durations), 2),
            "min_response_time": round(min(durations), 2),
            "max_response_time": round(max(durations), 2),
            "p95_response_time": round(durations[p95_index] if p95_index < len(durations) else durations[-1], 2),
            "total_requests": len(request_stats),
            "requests_per_hour": round(len(request_stats) / (days * 24), 2),
            "period_days": days
        }
    except Exception as e:
        logger.error(f"Error getting performance statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/statistics/rag-fallbacks")
async def get_rag_fallbacks(
    days: int = 7,
    limit: int = 50,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get RAG fallback and unfound queries - questions that couldn't be answered from documents"""
    from ..database.statistics_model import Statistics, StatCategory
    from datetime import datetime, timedelta
    import json
    
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Get both RAG fallback and unfound statistics
        # rag_fallback = Real fallback (score < threshold, switched to chat)
        # rag_unfound = Chunks found but LLM couldn't extract requested info
        fallback_stats = db.query(Statistics).filter(
            Statistics.category == StatCategory.REQUEST,
            Statistics.key.in_(["rag_fallback_request", "rag_unfound_request"]),
            Statistics.timestamp >= start_date
        ).order_by(Statistics.timestamp.desc()).limit(limit).all()
        
        fallbacks = []
        for stat in fallback_stats:
            try:
                data = stat.get_data() if hasattr(stat, 'get_data') else {}
                
                # Determine type based on key
                query_type = "unfound" if stat.key == "rag_unfound_request" else "fallback"
                
                fallbacks.append({
                    "id": stat.id,
                    "timestamp": stat.timestamp.isoformat() if stat.timestamp else None,
                    "model": data.get("model", "unknown"),
                    "duration": round(float(stat.value or 0), 2),
                    "reason": data.get("error", "").replace("RAG fallback: ", ""),
                    "query": data.get("query", ""),
                    "type": query_type  # "fallback" or "unfound"
                })
            except Exception as e:
                logger.warning(f"Error parsing fallback stat {stat.id}: {e}")
        
        # Get summary stats
        total_fallbacks = db.query(Statistics).filter(
            Statistics.category == StatCategory.REQUEST,
            Statistics.key == "rag_fallback_request",
            Statistics.timestamp >= start_date
        ).count()
        
        total_unfound = db.query(Statistics).filter(
            Statistics.category == StatCategory.REQUEST,
            Statistics.key == "rag_unfound_request",
            Statistics.timestamp >= start_date
        ).count()
        
        total_issues = total_fallbacks + total_unfound
        
        total_rag_requests = db.query(Statistics).filter(
            Statistics.category == StatCategory.REQUEST,
            Statistics.key.in_(["rag_request", "rag_fallback_request", "rag_unfound_request"]),
            Statistics.timestamp >= start_date
        ).count()
        
        issue_rate = round((total_issues / total_rag_requests * 100), 1) if total_rag_requests > 0 else 0
        
        return {
            "fallbacks": fallbacks,
            "summary": {
                "total_fallbacks": total_fallbacks,
                "total_unfound": total_unfound,
                "total_issues": total_issues,
                "total_rag_requests": total_rag_requests,
                "issue_rate": issue_rate,
                "period_days": days
            }
        }
    except Exception as e:
        logger.error(f"Error getting RAG fallbacks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Document Statistics Endpoint
@admin_router.get("/documents/{document_id}/stats")
async def get_document_statistics(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed statistics for a specific document"""
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Calculate statistics
        stats = {
            "total_chunks": document.total_chunks or 0,
            "total_pages": document.total_pages or 0,
            "avg_chunk_size": 0,
            "total_characters": 0,
            "total_words": 0,
            "ocr_images_count": 0,
            "processing_time_seconds": 0,
            "index_file_size": 0
        }
        
        # Calculate average chunk size
        if document.total_chunks and document.total_chunks > 0:
            stats["avg_chunk_size"] = document.file_size // document.total_chunks
        
        # Estimate total pages if not available
        if not document.total_pages:
            # Estimate based on file size (assuming ~50KB per page for PDF)
            estimated_pages = max(1, document.file_size // (50 * 1024))
            stats["total_pages"] = estimated_pages
        
        # Estimate characters and words based on chunks
        if document.total_chunks:
            # Estimate ~500 characters per chunk, ~75 words per chunk
            stats["total_characters"] = document.total_chunks * 500
            stats["total_words"] = document.total_chunks * 75
        
        # Estimate OCR images (roughly 1 image per MB for documents)
        if document.ocr_completed:
            stats["ocr_images_count"] = max(1, document.file_size // (1024 * 1024))
        
        # Calculate processing time
        if document.created_at and document.processed_at:
            start_time = document.created_at
            end_time = document.processed_at
            time_diff = end_time - start_time
            stats["processing_time_seconds"] = int(time_diff.total_seconds())
        
        # Estimate index file size (typically 10-20% of original file)
        if document.vector_indexed:
            stats["index_file_size"] = int(document.file_size * 0.15)
        
        # Try to get more accurate data from file system if available
        try:
            import os
            import json
            
            # Check if metadata file exists
            if document.folder_name:
                org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
                metadata_path = str(_storage.get_metadata_path(org_slug, document.folder_name))
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        
                        # Update stats with actual metadata
                        if 'total_pages' in metadata:
                            stats["total_pages"] = metadata['total_pages']
                        if 'total_characters' in metadata:
                            stats["total_characters"] = metadata['total_characters']
                        if 'total_words' in metadata:
                            stats["total_words"] = metadata['total_words']
                        if 'ocr_images_count' in metadata:
                            stats["ocr_images_count"] = metadata['ocr_images_count']
                        if 'processing_time' in metadata:
                            stats["processing_time_seconds"] = metadata['processing_time']
                
                # Check index file size
                index_path = str(_storage.get_index_path(org_slug, document.folder_name))
                if os.path.exists(index_path):
                    stats["index_file_size"] = os.path.getsize(index_path)
                    
        except Exception as e:
            logger.warning(f"Could not load detailed stats from file system: {e}")
        
        return {
            "success": True,
            "stats": stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting document statistics: {str(e)}"
        )


# Document Processing Logs Endpoint
@admin_router.get("/documents/{document_id}/logs")
async def get_document_processing_logs(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get processing logs for a specific document"""
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Get logs from database
        logs = document.processing_logs or []
        
        # Also try to load logs from file system if available
        try:
            org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
            log_file_path = _storage.get_processing_log_path(org_slug, document.folder_name)
            if log_file_path.exists():
                with open(log_file_path, 'r', encoding='utf-8') as f:
                    file_logs = json.load(f)
                    if isinstance(file_logs, list):
                        # Merge file logs with db logs, avoiding duplicates
                        existing_timestamps = {log.get('timestamp') for log in logs}
                        for log in file_logs:
                            if log.get('timestamp') not in existing_timestamps:
                                logs.append(log)
        except Exception as e:
            logger.warning(f"Could not load logs from file: {e}")
        
        # Sort logs by timestamp
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=False)
        
        # Extract error message from processing_details if status is error
        error_message = None
        if document.status == 'error' and document.processing_details:
            error_message = document.processing_details
        
        return {
            "success": True,
            "document_id": document_id,
            "document_name": document.name,
            "status": document.status,
            "error_message": error_message,
            "processing_stage": document.processing_stage,
            "processing_progress": document.processing_progress,
            "logs": logs,
            "total_logs": len(logs)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting document logs: {str(e)}"
        )


# Document Original File Endpoint
@admin_router.get("/documents/{document_id}/file")
async def get_document_file(
    document_id: int,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Serve the original document file.
    Supports PDF, images, text files, etc.
    Token can be passed as query parameter OR Authorization header.
    """
    from fastapi.responses import FileResponse
    from jose import jwt, JWTError
    import mimetypes
    
    try:
        # Get token from query param or Authorization header
        auth_token = token
        if not auth_token and authorization:
            if authorization.startswith("Bearer "):
                auth_token = authorization.replace("Bearer ", "")
            else:
                auth_token = authorization
        
        if not auth_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token required"
            )
        
        try:
            from backend.auth.security import verify_token
            payload = verify_token(auth_token)
            if payload is None:
                raise HTTPException(status_code=401, detail="Invalid token")
            user_email = payload.get("sub")
            if not user_email:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            # Verify user is admin
            user = db.query(User).filter(User.email == user_email).first()
            if not user or not user.is_admin:
                raise HTTPException(status_code=403, detail="Admin access required")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Base path for documents (multi-tenant)
        org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
        base_path = _storage.get_document_path(org_slug, document.folder_name)
        
        # Try to find the original file with multiple strategies
        file_paths = [
            base_path / "original" / document.original_filename,
            base_path / document.original_filename,
        ]
        
        file_path = None
        for fp in file_paths:
            if fp.exists():
                file_path = fp
                break
        
        # If not found, try to find by scanning the original directory
        # This handles prefix length mismatches (e.g., 001_ vs 0001_)
        if not file_path:
            original_dir = base_path / "original"
            if original_dir.exists():
                # Get the base name without numeric prefix
                import re
                base_name = re.sub(r'^\d+_', '', document.original_filename)
                
                for f in original_dir.iterdir():
                    if f.is_file():
                        # Check if file ends with the same base name
                        f_base = re.sub(r'^\d+_', '', f.name)
                        if f_base == base_name:
                            file_path = f
                            logger.info(f"📄 Found file with different prefix: {f.name}")
                            break
        
        if not file_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Original file not found"
            )
        
        # Determine content type
        content_type, _ = mimetypes.guess_type(str(file_path))
        if not content_type:
            content_type = "application/octet-stream"
        
        # For PDF files, set inline display
        if document.file_type == 'pdf':
            content_type = "application/pdf"
        
        # Handle Turkish characters in filename using RFC 5987 encoding
        from urllib.parse import quote
        
        # ASCII-safe filename (replace Turkish chars)
        ascii_filename = document.original_filename
        turkish_map = {
            'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O',
            'ç': 'c', 'Ç': 'C', 'ı': 'i', 'İ': 'I'
        }
        for tr_char, en_char in turkish_map.items():
            ascii_filename = ascii_filename.replace(tr_char, en_char)
        
        # UTF-8 encoded filename for modern browsers
        utf8_filename = quote(document.original_filename, safe='')
        
        # RFC 5987 compliant Content-Disposition header
        # filename for old browsers, filename* for modern browsers
        content_disposition = f"inline; filename=\"{ascii_filename}\"; filename*=UTF-8''{utf8_filename}"
        
        return FileResponse(
            path=str(file_path),
            media_type=content_type,
            filename=ascii_filename,  # Use ASCII-safe filename
            headers={
                "Content-Disposition": content_disposition
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving document file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error serving file: {str(e)}"
        )


# Document Content Preview Endpoint
@admin_router.get("/documents/{document_id}/preview")
async def get_document_preview(
    document_id: int,
    page: int = 1,
    page_size: int = 5000,  # Characters per page
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get document content preview.
    Returns extracted text content with pagination.
    """
    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        content = ""
        content_source = "none"
        
        # Base path for documents (multi-tenant)
        org_slug = os.getenv("DEFAULT_TENANT_SLUG", "default")
        base_path = _storage.get_document_path(org_slug, document.folder_name)
        
        # Try multiple possible locations for extracted text (prioritize new structure)
        text_paths = [
            base_path / "processed" / "full_text.txt",  # New structure (directly in processed/)
            base_path / "processed" / "ocr_results" / "full_text.txt",  # Old structure (migrated)
            base_path / "processed" / "extracted_text.txt",  # Alternative
            base_path / "extracted_text.txt",  # Legacy
        ]
        
        for text_path in text_paths:
            try:
                if text_path.exists():
                    with open(text_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    content_source = "extracted_text"
                    logger.info(f"Loaded text from: {text_path}")
                    break
            except Exception as e:
                logger.warning(f"Could not load from {text_path}: {e}")
        
        # If no extracted text, try to get from chunks or vector metadata
        if not content:
            # First try vector metadata (most reliable)
            vector_metadata_path = base_path / "vectors" / f"doc_{document.id}_metadata.json"
            if vector_metadata_path.exists():
                try:
                    with open(vector_metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        if "chunks" in metadata and isinstance(metadata["chunks"], list):
                            all_chunks = [c.get('text', c.get('content', '')) for c in metadata["chunks"]]
                            content = "\n\n---\n\n".join(all_chunks)
                            content_source = "vector_metadata"
                            logger.info(f"Loaded {len(all_chunks)} chunks from vector metadata")
                except Exception as e:
                    logger.warning(f"Could not load vector metadata: {e}")
            
            # Fallback to chunk files
            if not content:
                chunk_paths = [
                    base_path / "processed" / "chunks",
                    base_path / "chunks.json",
                ]
                
                for chunk_path in chunk_paths:
                    try:
                        if chunk_path.is_dir():
                            # Load all chunk files from directory
                            chunk_files = sorted(chunk_path.glob("*.json"))
                            all_chunks = []
                            for cf in chunk_files:
                                with open(cf, 'r', encoding='utf-8') as f:
                                    chunk_data = json.load(f)
                                    if isinstance(chunk_data, dict):
                                        all_chunks.append(chunk_data.get('text', chunk_data.get('content', '')))
                                    elif isinstance(chunk_data, list):
                                        all_chunks.extend([c.get('text', c.get('content', '')) for c in chunk_data])
                            if all_chunks:
                                content = "\n\n---\n\n".join(all_chunks)
                                content_source = "chunks"
                                logger.info(f"Loaded {len(all_chunks)} chunks from: {chunk_path}")
                                break
                        elif chunk_path.exists():
                            with open(chunk_path, 'r', encoding='utf-8') as f:
                                chunks_data = json.load(f)
                                if isinstance(chunks_data, list):
                                    content = "\n\n---\n\n".join([
                                        chunk.get('text', chunk.get('content', '')) 
                                        for chunk in chunks_data
                                    ])
                                    content_source = "chunks"
                                    break
                    except Exception as e:
                        logger.warning(f"Could not load chunks from {chunk_path}: {e}")
        
        # If still no content, try original file for text files
        if not content and document.file_type in ['txt', 'md']:
            try:
                original_file_path = base_path / "original" / document.original_filename
                if not original_file_path.exists():
                    original_file_path = base_path / document.original_filename
                if original_file_path.exists():
                    with open(original_file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    content_source = "original_file"
            except Exception as e:
                logger.warning(f"Could not load original file: {e}")
        
        # Calculate pagination
        total_chars = len(content)
        total_pages = max(1, (total_chars + page_size - 1) // page_size)
        
        # Get page content
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_chars)
        page_content = content[start_idx:end_idx] if content else ""
        
        return {
            "success": True,
            "document_id": document_id,
            "document_name": document.name,
            "file_type": document.file_type,
            "content_source": content_source,
            "content": page_content,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "page_size": page_size,
                "total_characters": total_chars,
                "start_char": start_idx,
                "end_char": end_idx
            },
            "has_content": bool(content),
            "preview_available": content_source != "none"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document preview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting document preview: {str(e)}"
        )


# Document Chunks Preview Endpoint (DEPRECATED - Use chunk_enrichment.py instead)
# @admin_router.get("/documents/{document_id}/chunks")
# async def get_document_chunks(
#     document_id: int,
#     skip: int = 0,
#     limit: int = 10,
#     current_user: User = Depends(get_current_admin_user),
#     db: Session = Depends(get_db)
# ):
#     """
#     Get document chunks with pagination.
#     Returns individual chunks that were indexed.
#     """
#     try:
#         # Get document
#         document = db.query(Document).filter(Document.id == document_id).first()
#         
#         if not document:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="Document not found"
#             )
#         
#         chunks = []
#         total_chunks = 0
#         
#         # Base path for documents
#         base_path = Path(__file__).parent.parent.parent / "documents" / document.folder_name
#         
#         # Try to get chunks from multiple locations (priority order)
#         chunk_sources = [
#             # 1. Vector metadata (most reliable - contains indexed chunks)
#             ("vectors", base_path / "vectors" / f"doc_{document.id}_metadata.json"),
#             # 2. Processed chunks directory
#             ("chunks_dir", base_path / "processed" / "chunks"),
#             # 3. Chunks JSON file
#             ("chunks_json", base_path / "chunks.json"),
#             # 4. Root chunks directory
#             ("chunks_root", base_path / "chunks"),
#         ]
#         
#         all_chunks = []
#         source_used = None
#         
#         for source_name, chunk_path in chunk_sources:
#             try:
#                 if source_name == "vectors" and chunk_path.exists():
#                     # Load from vector metadata
#                     with open(chunk_path, 'r', encoding='utf-8') as f:
#                         metadata = json.load(f)
#                         if "chunks" in metadata and isinstance(metadata["chunks"], list):
#                             all_chunks = metadata["chunks"]
#                             source_used = source_name
#                             logger.info(f"Loaded {len(all_chunks)} chunks from vector metadata: {chunk_path}")
#                             break
#                 elif chunk_path.is_dir():
#                     # Load all chunk files from directory
#                     chunk_files = sorted(chunk_path.glob("*.json"))
#                     for cf in chunk_files:
#                         with open(cf, 'r', encoding='utf-8') as f:
#                             chunk_data = json.load(f)
#                             if isinstance(chunk_data, dict):
#                                 all_chunks.append(chunk_data)
#                             elif isinstance(chunk_data, list):
#                                 all_chunks.extend(chunk_data)
#                     if all_chunks:
#                         source_used = source_name
#                         logger.info(f"Loaded {len(all_chunks)} chunks from: {chunk_path}")
#                         break
#                 elif chunk_path.exists():
#                     with open(chunk_path, 'r', encoding='utf-8') as f:
#                         data = json.load(f)
#                         if isinstance(data, list):
#                             all_chunks = data
#                             source_used = source_name
#                             break
#             except Exception as e:
#                 logger.warning(f"Could not load chunks from {chunk_path}: {e}")
#         
#         total_chunks = len(all_chunks)
#         chunks = all_chunks[skip:skip + limit]
#         
#         # Format chunks for response
#         formatted_chunks = []
#         for i, chunk in enumerate(chunks):
#             formatted_chunks.append({
#                 "index": skip + i,
#                 "content": chunk.get('text', chunk.get('content', '')),
#                 "metadata": chunk.get('metadata', {}),
#                 "char_count": len(chunk.get('text', chunk.get('content', '')))
#             })
#         
#         return {
#             "success": True,
#             "document_id": document_id,
#             "document_name": document.name,
#             "chunks": formatted_chunks,
#             "pagination": {
#                 "skip": skip,
#                 "limit": limit,
#                 "total": total_chunks,
#                 "has_more": skip + limit < total_chunks
#             }
#         }
#         
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting document chunks: {str(e)}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Error getting document chunks: {str(e)}"
#         )


# ==================== ERROR LOGS ENDPOINTS ====================

@admin_router.get("/errors")
async def get_error_logs(
    skip: int = 0,
    limit: int = 50,
    error_type: Optional[str] = None,
    include_resolved: bool = False,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get error logs with pagination and filtering"""
    from ..services.error_logger import error_logger
    
    try:
        errors = error_logger.get_recent_errors(
            db, 
            limit=limit, 
            error_type=error_type,
            include_resolved=include_resolved
        )
        
        return {
            "success": True,
            "errors": errors,
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total": len(errors),
                "has_more": len(errors) >= limit
            }
        }
    except Exception as e:
        logger.error(f"Error getting error logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/errors/stats")
async def get_error_statistics(
    days: int = 7,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get error statistics for dashboard"""
    from ..services.error_logger import error_logger
    
    try:
        stats = error_logger.get_error_stats(db, days=days)
        return {
            "success": True,
            **stats
        }
    except Exception as e:
        logger.error(f"Error getting error stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/errors/{error_id}/resolve")
async def resolve_error(
    error_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Mark an error as resolved"""
    from ..services.error_logger import error_logger
    
    try:
        success = error_logger.resolve_error(db, error_id)
        if success:
            return {"success": True, "message": "Error marked as resolved"}
        else:
            raise HTTPException(status_code=404, detail="Error not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.delete("/errors/{error_id}")
async def delete_error_log(
    error_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete an error log entry"""
    from ..database.statistics_model import Statistics, StatCategory
    
    try:
        error = db.query(Statistics).filter(
            Statistics.id == error_id,
            Statistics.category == StatCategory.ERROR
        ).first()
        
        if not error:
            raise HTTPException(status_code=404, detail="Error not found")
        
        db.delete(error)
        db.commit()
        return {"success": True, "message": "Error log deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting error log: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== NOTIFICATIONS ENDPOINTS ====================

@admin_router.get("/notifications")
async def get_notifications(
    limit: int = 20,
    include_read: bool = False,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin notifications (unread errors and alerts)"""
    from ..database.statistics_model import Statistics, StatCategory
    
    try:
        # Get recent unresolved errors as notifications
        query = db.query(Statistics).filter(
            Statistics.category == StatCategory.ERROR
        )
        
        if not include_read:
            query = query.filter(Statistics.is_resolved == False)
        
        errors = query.order_by(Statistics.timestamp.desc()).limit(limit).all()
        
        notifications = []
        for e in errors:
            data = e.get_data()
            notifications.append({
                "id": e.id,
                "type": "error",
                "subtype": e.key,  # llm_request, rag_query, etc.
                "title": f"{'LLM' if e.key == 'llm_request' else 'RAG' if e.key == 'rag_query' else 'Sistem'} Hatası",
                "message": e.value[:200] if e.value else "Bilinmeyen hata",
                "details": {
                    "model": data.get("model"),
                    "provider": data.get("provider"),
                    "token": data.get("token"),
                },
                "is_read": e.is_resolved,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None
            })
        
        # Count unread
        unread_count = db.query(Statistics).filter(
            Statistics.category == StatCategory.ERROR,
            Statistics.is_resolved == False
        ).count()
        
        return {
            "success": True,
            "notifications": notifications,
            "unread_count": unread_count
        }
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    from ..database.statistics_model import Statistics, StatCategory
    
    try:
        notification = db.query(Statistics).filter(
            Statistics.id == notification_id,
            Statistics.category == StatCategory.ERROR
        ).first()
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        notification.is_resolved = True
        db.commit()
        
        return {"success": True, "message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    from ..database.statistics_model import Statistics, StatCategory
    
    try:
        db.query(Statistics).filter(
            Statistics.category == StatCategory.ERROR,
            Statistics.is_resolved == False
        ).update({"is_resolved": True})
        db.commit()
        
        return {"success": True, "message": "All notifications marked as read"}
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 📝 Document Name Formatting & Bulk Update Endpoints
# ============================================================================

def format_display_name_global(filename: str) -> str:
    """
    Format filename for display (global version for use outside upload):
    - Remove file extension
    - Replace underscores, dashes, multiple spaces with single space
    - Clean up extra whitespace
    Example: "53115___PROGRAMMING_TOOL_DPT_3000_OPERATING_INSTRUCTIONS___V619"
          -> "53115 PROGRAMMING TOOL DPT 3000 OPERATING INSTRUCTIONS V619"
    """
    import re
    # Remove extension
    name_without_ext = Path(filename).stem
    # Replace underscores and dashes with spaces
    formatted = re.sub(r'[_\-]+', ' ', name_without_ext)
    # Replace multiple spaces with single space
    formatted = re.sub(r'\s+', ' ', formatted)
    # Strip leading/trailing whitespace
    return formatted.strip()


@admin_router.post("/documents/reformat-names")
async def reformat_all_document_names(
    db: Session = Depends(get_db)
):
    """
    🔄 Reformat all document names to use spaces instead of underscores/dashes.
    Also sets default departments (Uygulama, Teknik Servis) for documents without departments.
    """
    import re
    
    try:
        # Get all documents
        documents = db.query(Document).all()
        updated_count = 0
        department_updated_count = 0
        
        for doc in documents:
            changes_made = False
            
            # 1. Reformat document name
            # Extract the doc_number prefix (e.g., "0001_")
            name_match = re.match(r'^(\d{4})_(.+)$', doc.name)
            if name_match:
                doc_number_prefix = name_match.group(1)
                current_name = name_match.group(2)
                
                # Format the name part (remove underscores, dashes)
                formatted_name = format_display_name_global(current_name)
                new_full_name = f"{doc_number_prefix}_{formatted_name}"
                
                if doc.name != new_full_name:
                    logger.info(f"📝 Reformatting: '{doc.name}' -> '{new_full_name}'")
                    doc.name = new_full_name
                    updated_count += 1
                    changes_made = True
            else:
                # No prefix, just format the whole name
                formatted_name = format_display_name_global(doc.name)
                if doc.name != formatted_name:
                    logger.info(f"📝 Reformatting: '{doc.name}' -> '{formatted_name}'")
                    doc.name = formatted_name
                    updated_count += 1
                    changes_made = True
            
            # 2. Set default departments if not set
            if not doc.doc_metadata:
                doc.doc_metadata = {}
            
            current_dept = doc.doc_metadata.get('department', '')
            if not current_dept or current_dept.strip() == '':
                doc.doc_metadata['department'] = 'Uygulama, Teknik Servis'
                department_updated_count += 1
                changes_made = True
                logger.info(f"📁 Setting default department for doc {doc.id}")
            
            if changes_made:
                db.add(doc)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Reformatted {updated_count} document names, set departments for {department_updated_count} documents",
            "names_updated": updated_count,
            "departments_updated": department_updated_count,
            "total_documents": len(documents)
        }
        
    except Exception as e:
        logger.error(f"❌ Error reformatting document names: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/documents/set-default-departments")
async def set_default_departments(
    departments: str = Form("Uygulama, Teknik Servis"),
    db: Session = Depends(get_db)
):
    """
    📁 Set default departments for all documents that don't have departments set.
    """
    try:
        documents = db.query(Document).all()
        updated_count = 0
        
        for doc in documents:
            if not doc.doc_metadata:
                doc.doc_metadata = {}
            
            current_dept = doc.doc_metadata.get('department', '')
            if not current_dept or current_dept.strip() == '':
                doc.doc_metadata['department'] = departments
                updated_count += 1
                db.add(doc)
                logger.info(f"📁 Setting department '{departments}' for doc {doc.id}: {doc.name}")
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Set departments for {updated_count} documents",
            "updated_count": updated_count,
            "total_documents": len(documents)
        }
        
    except Exception as e:
        logger.error(f"❌ Error setting default departments: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
