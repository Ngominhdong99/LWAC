from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..services.grading import grade_writing_task
from typing import Dict, Any
from datetime import datetime

router = APIRouter(
    prefix="/quiz",
    tags=["Quiz Engine"],
    responses={404: {"description": "Not found"}},
)

class WritingSubmission(schemas.BaseModel):
    user_id: int
    lesson_id: int
    question_text: str
    user_response: str

@router.post("/submit/writing", response_model=Dict[str, Any])
def submit_writing_task(submission: WritingSubmission, db: Session = Depends(get_db)):
    """
    Submits a writing response for auto-grading via OpenAI.
    """
    # 1. Verify user and lesson exist
    user = db.query(models.User).filter(models.User.id == submission.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    lesson = db.query(models.Lesson).filter(models.Lesson.id == submission.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # 2. Call OpenAI grading service
    evaluation_result = grade_writing_task(
        prompt=submission.question_text,
        user_response=submission.user_response
    )
    
    # 3. Save result to database
    band_score = evaluation_result.get("estimated_band", 0)
    normalized_score = int((band_score / 9.0) * 100)
    
    db_result = models.Result(
        user_id=submission.user_id,
        lesson_id=submission.lesson_id,
        score=normalized_score,
        responses={
            "type": "writing_task_auto_grade",
            "prompt": submission.question_text,
            "user_essay": submission.user_response,
            "evaluation": evaluation_result
        }
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)

    # 4. Update assignment status
    assignment = db.query(models.Assignment).filter(
        models.Assignment.student_id == submission.user_id,
        models.Assignment.lesson_id == submission.lesson_id
    ).first()
    if assignment:
        assignment.status = "completed"
        assignment.completed_at = datetime.utcnow()
        assignment.result_id = db_result.id
        assignment.allow_retake = False
        db.commit()

    # 5. Award reward points (+5 for writing submission)
    rp = models.RewardPoint(
        user_id=submission.user_id,
        lesson_id=submission.lesson_id,
        result_id=db_result.id,
        points=5,
        reason="Writing submission"
    )
    db.add(rp)
    db.commit()

    return {
        "result_id": db_result.id,
        "score_normalized": normalized_score,
        "evaluation": evaluation_result
    }
