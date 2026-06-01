"""
Hybrid RAG Query API
Retrieval using EnsembleRetriever (Chroma + FAISS) with optional reranking
"""

import os
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from langchain_core.documents import Document

# EnsembleRetriever için try-except (eski/yeni langchain versiyonları için)
try:
    from langchain.retrievers import EnsembleRetriever
except ImportError:
    from langchain_community.retrievers import EnsembleRetriever

from ..services.vectorstore_manager import get_vectorstore_manager
from ..services.embeddings import get_embedding_service
from ..auth.dependencies import get_current_active_user

logger = logging.getLogger(__name__)

query_router = APIRouter()


class QueryRequest(BaseModel):
    """Request model for RAG queries"""
    question: str = Field(..., description="User question")
    top_k: int = Field(5, ge=1, le=20, description="Number of chunks to retrieve")
    chroma_weight: float = Field(0.3, ge=0.0, le=1.0, description="Weight for Chroma retriever")
    faiss_weight: float = Field(0.7, ge=0.0, le=1.0, description="Weight for FAISS retriever")
    enable_reranking: bool = Field(False, description="Enable BGE reranking")
    reranker_top_k: int = Field(3, ge=1, le=10, description="Top-k after reranking")


class ChunkResult(BaseModel):
    """Single chunk result"""
    content: str
    source: str
    chunk_index: int
    score: float
    metadata: Dict[str, Any]


class QueryResponse(BaseModel):
    """Response model for RAG queries"""
    question: str
    chunks: List[ChunkResult]
    retrieval_method: str
    total_retrieved: int
    reranking_applied: bool


@query_router.post("/query/rag", response_model=QueryResponse)
async def query_rag(
    request: QueryRequest,
    current_user = Depends(get_current_active_user)
):
    """
    Hybrid RAG query using Chroma + FAISS ensemble retriever.

    Process:
    1. Retrieve from Chroma (weighted)
    2. Retrieve from FAISS (weighted)
    3. Merge results (EnsembleRetriever)
    4. Optional: Rerank with BGE reranker
    5. Return top-k results

    Example:
        POST /query/rag
        {
            "question": "3D yazıcı hataları nelerdir?",
            "top_k": 5,
            "chroma_weight": 0.3,
            "faiss_weight": 0.7,
            "enable_reranking": true
        }
    """
    try:
        logger.info(f"RAG query from user {current_user.username}: '{request.question}'")

        # Get vector store manager
        manager = get_vectorstore_manager()

        # Get retrievers
        chroma = manager.get_chroma()
        faiss = manager.get_faiss()

        if faiss is None:
            raise HTTPException(
                status_code=404,
                detail="FAISS index not found. Please ingest documents first."
            )

        # Create individual retrievers
        chroma_retriever = chroma.as_retriever(
            search_type="similarity",
            search_kwargs={"k": request.top_k}
        )

        faiss_retriever = faiss.as_retriever(
            search_type="similarity",
            search_kwargs={"k": request.top_k}
        )

        # Create ensemble retriever
        ensemble_retriever = EnsembleRetriever(
            retrievers=[chroma_retriever, faiss_retriever],
            weights=[request.chroma_weight, request.faiss_weight]
        )

        logger.info(f"Ensemble retriever created with weights: Chroma={request.chroma_weight}, FAISS={request.faiss_weight}")

        # Retrieve documents
        documents = ensemble_retriever.get_relevant_documents(request.question)

        logger.info(f"Retrieved {len(documents)} documents from ensemble retriever")

        # Apply reranking if enabled
        reranking_applied = False
        if request.enable_reranking and len(documents) > 0:
            documents = _rerank_documents(
                request.question,
                documents,
                top_k=request.reranker_top_k
            )
            reranking_applied = True
            logger.info(f"Reranking applied, reduced to top {len(documents)} documents")

        # Format results
        chunks = []
        for i, doc in enumerate(documents[:request.top_k]):
            chunks.append(ChunkResult(
                content=doc.page_content,
                source=doc.metadata.get("source", "unknown"),
                chunk_index=doc.metadata.get("chunk_index", i),
                score=doc.metadata.get("score", 0.0),
                metadata=doc.metadata
            ))

        return QueryResponse(
            question=request.question,
            chunks=chunks,
            retrieval_method="ensemble_chroma_faiss",
            total_retrieved=len(documents),
            reranking_applied=reranking_applied
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _rerank_documents(
    query: str,
    documents: List[Document],
    top_k: int = 3
) -> List[Document]:
    """
    Rerank documents using BGE reranker.

    Args:
        query: Query string
        documents: List of documents to rerank
        top_k: Number of top documents to return

    Returns:
        List[Document]: Reranked documents
    """
    try:
        # Check if reranker is available
        reranker_model = os.getenv('RERANKER_MODEL', 'BAAI/bge-reranker-large')

        from sentence_transformers import CrossEncoder

        logger.info(f"Loading reranker model: {reranker_model}")
        model = CrossEncoder(reranker_model)

        # Prepare pairs for reranking
        pairs = [[query, doc.page_content] for doc in documents]

        # Get scores
        scores = model.predict(pairs)

        # Sort documents by score
        doc_score_pairs = list(zip(documents, scores))
        doc_score_pairs.sort(key=lambda x: x[1], reverse=True)

        # Add scores to metadata and return top-k
        reranked_docs = []
        for doc, score in doc_score_pairs[:top_k]:
            doc.metadata["rerank_score"] = float(score)
            doc.metadata["score"] = float(score)
            reranked_docs.append(doc)

        logger.info(f"✅ Reranked {len(documents)} docs to top {len(reranked_docs)}")
        return reranked_docs

    except Exception as e:
        logger.warning(f"Reranking failed, returning original documents: {e}")
        return documents[:top_k]


@query_router.get("/query/status")
async def get_query_status(
    current_user = Depends(get_current_active_user)
):
    """
    Get status of vector stores for querying.

    Returns:
        dict: Status information
    """
    try:
        manager = get_vectorstore_manager()
        status = manager.get_status()

        return {
            "success": True,
            "status": status
        }

    except Exception as e:
        logger.error(f"Status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
