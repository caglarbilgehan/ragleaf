"""
OCR Microservice
Handles PDF processing and OCR text extraction using Tesseract
"""

import os
import io
import logging
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
import pytesseract
from PIL import Image
import fitz  # PyMuPDF
from pdf2image import convert_from_bytes
import redis.asyncio as redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ragleaf OCR Service",
    description="PDF processing and OCR text extraction microservice",
    version="1.0.0"
)

# Redis for caching
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
redis_client: Optional[redis.Redis] = None


@app.on_event("startup")
async def startup():
    global redis_client
    try:
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        await redis_client.ping()
        logger.info("Connected to Redis")
    except Exception as e:
        logger.warning(f"Redis not available: {e}")
        redis_client = None


@app.on_event("shutdown")
async def shutdown():
    global redis_client
    if redis_client:
        await redis_client.close()


@app.get("/health")
async def health():
    """Health check endpoint"""
    tesseract_version = pytesseract.get_tesseract_version()
    return {
        "status": "ok",
        "service": "ocr-service",
        "tesseract_version": str(tesseract_version),
        "redis_connected": redis_client is not None
    }


@app.post("/extract-text")
async def extract_text(
    file: UploadFile = File(...),
    language: str = Query(default="tur+eng", description="OCR languages"),
    use_ocr: bool = Query(default=True, description="Use OCR for scanned pages")
) -> Dict[str, Any]:
    """
    Extract text from PDF file.
    Uses native text extraction first, falls back to OCR for scanned pages.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        content = await file.read()
        
        # Try to get from cache
        if redis_client:
            import hashlib
            file_hash = hashlib.md5(content).hexdigest()
            cache_key = f"ocr:{file_hash}:{language}"
            cached = await redis_client.get(cache_key)
            if cached:
                import json
                logger.info(f"Cache hit for {file.filename}")
                return json.loads(cached)
        
        # Open PDF
        doc = fitz.open(stream=content, filetype="pdf")
        pages_text = []
        total_chars = 0
        ocr_pages = 0
        
        for page_num, page in enumerate(doc):
            # Try native text extraction first
            text = page.get_text()
            
            # If no text found and OCR enabled, use Tesseract
            if len(text.strip()) < 50 and use_ocr:
                logger.info(f"Page {page_num + 1}: Using OCR")
                ocr_pages += 1
                
                # Convert page to image
                pix = page.get_pixmap(dpi=300)
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                
                # Perform OCR
                text = pytesseract.image_to_string(img, lang=language)
            
            pages_text.append({
                "page": page_num + 1,
                "text": text,
                "char_count": len(text)
            })
            total_chars += len(text)
        
        doc.close()
        
        result = {
            "filename": file.filename,
            "total_pages": len(pages_text),
            "total_characters": total_chars,
            "ocr_pages": ocr_pages,
            "pages": pages_text,
            "full_text": "\n\n".join([p["text"] for p in pages_text])
        }
        
        # Cache result
        if redis_client:
            import json
            await redis_client.setex(cache_key, 3600, json.dumps(result))
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract-images")
async def extract_images(
    file: UploadFile = File(...),
    min_size: int = Query(default=100, description="Minimum image size in pixels")
) -> Dict[str, Any]:
    """Extract images from PDF file"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        
        images = []
        for page_num, page in enumerate(doc):
            image_list = page.get_images()
            
            for img_index, img in enumerate(image_list):
                xref = img[0]
                pix = fitz.Pixmap(doc, xref)
                
                if pix.width >= min_size and pix.height >= min_size:
                    import base64
                    if pix.n >= 4:  # RGBA
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    
                    img_bytes = pix.tobytes("png")
                    images.append({
                        "page": page_num + 1,
                        "index": img_index,
                        "width": pix.width,
                        "height": pix.height,
                        "data": base64.b64encode(img_bytes).decode()
                    })
                
                pix = None
        
        doc.close()
        
        return {
            "filename": file.filename,
            "total_images": len(images),
            "images": images
        }
        
    except Exception as e:
        logger.error(f"Error extracting images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ocr-image")
async def ocr_image(
    file: UploadFile = File(...),
    language: str = Query(default="tur+eng", description="OCR languages")
) -> Dict[str, Any]:
    """Perform OCR on an image file"""
    try:
        content = await file.read()
        img = Image.open(io.BytesIO(content))
        
        # Perform OCR
        text = pytesseract.image_to_string(img, lang=language)
        
        # Get confidence data
        data = pytesseract.image_to_data(img, lang=language, output_type=pytesseract.Output.DICT)
        confidences = [c for c in data['conf'] if c != -1]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        return {
            "filename": file.filename,
            "text": text,
            "confidence": round(avg_confidence, 2),
            "word_count": len(text.split())
        }
        
    except Exception as e:
        logger.error(f"Error performing OCR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
