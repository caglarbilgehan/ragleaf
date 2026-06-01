# backend/api/rag_evaluation.py
"""
RAG Evaluation API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import logging

from ..database.connection import get_db
from ..auth.dependencies import get_current_admin_user
from ..services.rag_evaluation_service import RAGEvaluationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/evaluation", tags=["RAG Evaluation"])


# ==================== Request/Response Models ====================

class QuestionCreate(BaseModel):
    question: str
    expected_answer: Optional[str] = None
    reference_doc_ids: Optional[List[int]] = []


class TestSetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    questions: Optional[List[QuestionCreate]] = []


class TestSetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class RunEvaluationRequest(BaseModel):
    test_set_id: int
    language: Optional[str] = "tr"


# ==================== Test Set Endpoints ====================

@router.get("/test-sets")
async def get_test_sets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get all test sets"""
    service = RAGEvaluationService(db)
    test_sets = service.get_test_sets()
    
    return [
        {
            "id": ts.id,
            "name": ts.name,
            "description": ts.description,
            "category": ts.category,
            "question_count": len(ts.questions),
            "run_count": len(ts.runs),
            "created_at": ts.created_at.isoformat() if ts.created_at else None,
        }
        for ts in test_sets
    ]


@router.post("/test-sets")
async def create_test_set(
    request: TestSetCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Create a new test set"""
    service = RAGEvaluationService(db)
    
    questions = [q.model_dump() for q in request.questions] if request.questions else []
    
    test_set = service.create_test_set(
        name=request.name,
        description=request.description,
        category=request.category,
        questions=questions,
    )
    
    return {
        "id": test_set.id,
        "name": test_set.name,
        "description": test_set.description,
        "category": test_set.category,
        "question_count": len(test_set.questions),
    }


@router.get("/test-sets/{test_set_id}")
async def get_test_set(
    test_set_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get a specific test set with questions"""
    service = RAGEvaluationService(db)
    test_set = service.get_test_set(test_set_id)
    
    if not test_set:
        raise HTTPException(status_code=404, detail="Test set not found")
    
    return {
        "id": test_set.id,
        "name": test_set.name,
        "description": test_set.description,
        "category": test_set.category,
        "questions": [
            {
                "id": q.id,
                "question": q.question,
                "expected_answer": q.expected_answer,
                "reference_doc_ids": q.reference_doc_ids,
            }
            for q in test_set.questions
        ],
        "created_at": test_set.created_at.isoformat() if test_set.created_at else None,
    }


@router.put("/test-sets/{test_set_id}")
async def update_test_set(
    test_set_id: int,
    request: TestSetUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Update a test set"""
    service = RAGEvaluationService(db)
    test_set = service.update_test_set(
        test_set_id=test_set_id,
        name=request.name,
        description=request.description,
        category=request.category,
    )
    
    if not test_set:
        raise HTTPException(status_code=404, detail="Test set not found")
    
    return {"success": True, "id": test_set.id}


@router.delete("/test-sets/{test_set_id}")
async def delete_test_set(
    test_set_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Delete a test set"""
    service = RAGEvaluationService(db)
    success = service.delete_test_set(test_set_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Test set not found")
    
    return {"success": True}


# ==================== Question Endpoints ====================

@router.post("/test-sets/{test_set_id}/questions")
async def add_question(
    test_set_id: int,
    request: QuestionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Add a question to a test set"""
    service = RAGEvaluationService(db)
    
    # Verify test set exists
    test_set = service.get_test_set(test_set_id)
    if not test_set:
        raise HTTPException(status_code=404, detail="Test set not found")
    
    question = service.add_question(
        test_set_id=test_set_id,
        question=request.question,
        expected_answer=request.expected_answer,
        reference_doc_ids=request.reference_doc_ids,
    )
    
    return {
        "id": question.id,
        "question": question.question,
        "expected_answer": question.expected_answer,
    }


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Delete a question"""
    service = RAGEvaluationService(db)
    success = service.delete_question(question_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"success": True}


# ==================== Evaluation Run Endpoints ====================

@router.post("/run")
async def run_evaluation(
    request: RunEvaluationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Start an evaluation run"""
    service = RAGEvaluationService(db)
    
    # Verify test set exists
    test_set = service.get_test_set(request.test_set_id)
    if not test_set:
        raise HTTPException(status_code=404, detail="Test set not found")
    
    if not test_set.questions:
        raise HTTPException(status_code=400, detail="Test set has no questions")
    
    # Run evaluation (this can take a while)
    try:
        run = await service.run_evaluation(
            test_set_id=request.test_set_id,
            language=request.language,
        )
        
        return {
            "run_id": run.id,
            "status": run.status,
            "total_questions": run.total_questions,
            "overall_score": run.overall_score,
        }
    except Exception as e:
        logger.error(f"❌ Evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs")
async def get_runs(
    test_set_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get evaluation runs"""
    service = RAGEvaluationService(db)
    runs = service.get_runs(test_set_id=test_set_id)
    
    return [
        {
            "id": r.id,
            "test_set_id": r.test_set_id,
            "test_set_name": r.test_set.name if r.test_set else None,
            "status": r.status,
            "overall_score": r.overall_score,
            "avg_faithfulness": r.avg_faithfulness,
            "avg_relevancy": r.avg_relevancy,
            "avg_precision": r.avg_precision,
            "avg_recall": r.avg_recall,
            "total_questions": r.total_questions,
            "completed_questions": r.completed_questions,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]


@router.get("/runs/{run_id}")
async def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Get a specific run with results"""
    service = RAGEvaluationService(db)
    run = service.get_run(run_id)
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    results = service.get_run_results(run_id)
    
    return {
        "id": run.id,
        "test_set_id": run.test_set_id,
        "test_set_name": run.test_set.name if run.test_set else None,
        "status": run.status,
        "scores": {
            "overall": run.overall_score,
            "faithfulness": run.avg_faithfulness,
            "relevancy": run.avg_relevancy,
            "precision": run.avg_precision,
            "recall": run.avg_recall,
        },
        "total_questions": run.total_questions,
        "completed_questions": run.completed_questions,
        "model_name": run.model_name,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "results": [
            {
                "question_id": r.question_id,
                "question": r.question.question if r.question else None,
                "expected_answer": r.question.expected_answer if r.question else None,
                "rag_answer": r.rag_answer,
                "faithfulness": r.faithfulness,
                "answer_relevancy": r.answer_relevancy,
                "context_precision": r.context_precision,
                "context_recall": r.context_recall,
                "duration_ms": r.duration_ms,
            }
            for r in results
        ],
    }


@router.get("/compare")
async def compare_runs(
    run_id_1: int,
    run_id_2: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Compare two evaluation runs"""
    service = RAGEvaluationService(db)
    comparison = service.compare_runs(run_id_1, run_id_2)
    
    if "error" in comparison:
        raise HTTPException(status_code=404, detail=comparison["error"])
    
    return comparison
