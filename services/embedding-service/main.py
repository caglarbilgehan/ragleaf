"""
Embedding Microservice
Handles text embedding generation with GPU/CPU support
"""

import os
import logging
import hashlib
from typing import List, Dict, Any, Optional

import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import redis.asyncio as redis
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ragleaf Embedding Service",
    description="Text embedding generation microservice with GPU/CPU support",
    version="1.0.0"
)

# Configuration
DEVICE_SETTING = os.getenv("DEVICE", "auto")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/1")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
CACHE_TTL = int(os.getenv("CACHE_TTL", 86400))  # 24 hours

# Global state
model: Optional[SentenceTransformer] = None
device: str = "cpu"
redis_client: Optional[redis.Redis] = None


def detect_device() -> str:
    """Detect available device (GPU or CPU)"""
    if DEVICE_SETTING == "cuda":
        if torch.cuda.is_available():
            return "cuda"
        raise RuntimeError("CUDA requested but not available")
    elif DEVICE_SETTING == "cpu":
        return "cpu"
    else:  # auto
        return "cuda" if torch.cuda.is_available() else "cpu"


@app.on_event("startup")
async def startup():
    global model, device, redis_client
    
    # Detect device
    device = detect_device()
    logger.info(f"Using device: {device}")
    
    if device == "cuda":
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    
    # Load model
    logger.info(f"Loading model: {DEFAULT_MODEL}")
    model = SentenceTransformer(DEFAULT_MODEL, device=device)
    logger.info(f"Model loaded. Dimensions: {model.get_sentence_embedding_dimension()}")
    
    # Connect to Redis
    try:
        redis_client = redis.from_url(REDIS_URL, decode_responses=False)
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
    return {
        "status": "ok",
        "service": "embedding-service",
        "device": device,
        "model": DEFAULT_MODEL,
        "dimensions": model.get_sentence_embedding_dimension() if model else None,
        "cuda_available": torch.cuda.is_available(),
        "redis_connected": redis_client is not None
    }


@app.get("/models")
async def list_models():
    """List available embedding models"""
    return {
        "current_model": DEFAULT_MODEL,
        "dimensions": model.get_sentence_embedding_dimension() if model else None,
        "device": device,
        "available_models": [
            {
                "id": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                "dimensions": 384,
                "languages": ["tr", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru"],
                "recommended": True
            },
            {
                "id": "sentence-transformers/all-MiniLM-L6-v2",
                "dimensions": 384,
                "languages": ["en"],
                "recommended": False
            },
            {
                "id": "sentence-transformers/all-mpnet-base-v2",
                "dimensions": 768,
                "languages": ["en"],
                "recommended": False
            }
        ]
    }


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to embed", min_items=1, max_items=1000)
    use_cache: bool = Field(default=True, description="Use Redis cache")


class EmbedBatchRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to embed")
    batch_size: int = Field(default=32, description="Batch size for processing", ge=1, le=128)
    use_cache: bool = Field(default=True, description="Use Redis cache")


def get_cache_key(text: str) -> str:
    """Generate cache key for text"""
    return f"emb:{DEFAULT_MODEL}:{hashlib.md5(text.encode()).hexdigest()}"


@app.post("/embed")
async def embed_texts(request: EmbedRequest) -> Dict[str, Any]:
    """
    Generate embeddings for a list of texts.
    Returns cached embeddings if available.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    texts = request.texts
    embeddings = []
    cache_hits = 0
    
    for text in texts:
        # Try cache first
        if request.use_cache and redis_client:
            cache_key = get_cache_key(text)
            cached = await redis_client.get(cache_key)
            if cached:
                embeddings.append(np.frombuffer(cached, dtype=np.float32).tolist())
                cache_hits += 1
                continue
        
        # Generate embedding
        embedding = model.encode(text, convert_to_numpy=True, show_progress_bar=False)
        embeddings.append(embedding.tolist())
        
        # Cache result
        if request.use_cache and redis_client:
            cache_key = get_cache_key(text)
            await redis_client.setex(cache_key, CACHE_TTL, embedding.tobytes())
    
    return {
        "embeddings": embeddings,
        "dimensions": len(embeddings[0]) if embeddings else 0,
        "count": len(embeddings),
        "cache_hits": cache_hits,
        "device": device
    }


@app.post("/embed/batch")
async def embed_batch(request: EmbedBatchRequest) -> Dict[str, Any]:
    """
    Generate embeddings for a large batch of texts.
    Uses batch processing for better GPU utilization.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    texts = request.texts
    batch_size = request.batch_size
    all_embeddings = []
    cache_hits = 0
    texts_to_embed = []
    text_indices = []
    
    # Check cache for all texts
    for i, text in enumerate(texts):
        if request.use_cache and redis_client:
            cache_key = get_cache_key(text)
            cached = await redis_client.get(cache_key)
            if cached:
                all_embeddings.append((i, np.frombuffer(cached, dtype=np.float32).tolist()))
                cache_hits += 1
                continue
        
        texts_to_embed.append(text)
        text_indices.append(i)
    
    # Batch encode remaining texts
    if texts_to_embed:
        logger.info(f"Encoding {len(texts_to_embed)} texts in batches of {batch_size}")
        embeddings = model.encode(
            texts_to_embed,
            batch_size=batch_size,
            convert_to_numpy=True,
            show_progress_bar=False
        )
        
        # Cache and store results
        for i, (text, embedding) in enumerate(zip(texts_to_embed, embeddings)):
            idx = text_indices[i]
            all_embeddings.append((idx, embedding.tolist()))
            
            if request.use_cache and redis_client:
                cache_key = get_cache_key(text)
                await redis_client.setex(cache_key, CACHE_TTL, embedding.tobytes())
    
    # Sort by original index
    all_embeddings.sort(key=lambda x: x[0])
    embeddings = [e[1] for e in all_embeddings]
    
    return {
        "embeddings": embeddings,
        "dimensions": len(embeddings[0]) if embeddings else 0,
        "count": len(embeddings),
        "cache_hits": cache_hits,
        "batch_size": batch_size,
        "device": device
    }


@app.post("/similarity")
async def compute_similarity(
    text1: str,
    text2: str
) -> Dict[str, Any]:
    """Compute cosine similarity between two texts"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    embeddings = model.encode([text1, text2], convert_to_numpy=True)
    
    # Cosine similarity
    similarity = float(np.dot(embeddings[0], embeddings[1]) / 
                      (np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])))
    
    return {
        "similarity": round(similarity, 4),
        "text1_length": len(text1),
        "text2_length": len(text2)
    }
