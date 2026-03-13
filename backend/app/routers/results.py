from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/results",
    tags=["results"]
)

@router.get("/{user_id}", response_model=List[schemas.ResultResponse])
def read_results(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    results = db.query(models.Result).filter(models.Result.user_id == user_id).offset(skip).limit(limit).all()
    return results

@router.post("/{user_id}", response_model=schemas.ResultResponse)
def create_result(user_id: int, result: schemas.ResultCreate, db: Session = Depends(get_db)):
    # Verify user exists
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db_result = models.Result(**result.dict(), user_id=user_id)
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    
    # Update assignment for this lesson (pending or completed for retakes)
    from datetime import datetime
    assignment = db.query(models.Assignment).filter(
        models.Assignment.student_id == user_id,
        models.Assignment.lesson_id == result.lesson_id
    ).first()
    
    if assignment:
        assignment.status = "completed"
        assignment.completed_at = datetime.utcnow()
        assignment.result_id = db_result.id
        assignment.allow_retake = False
        db.commit()
    
    # Award reward points
    lesson = db.query(models.Lesson).filter(models.Lesson.id == result.lesson_id).first()
    if lesson:
        points = 0
        reason = ""
        if lesson.type in ("reading", "listening"):
            # +2 per correct answer
            questions = db.query(models.Question).filter(models.Question.lesson_id == lesson.id).all()
            correct_count = 0
            responses = result.responses if isinstance(result.responses, dict) else {}
            for q in questions:
                student_ans = responses.get(str(q.id))
                if student_ans and student_ans.strip().lower() == (q.correct_answer or "").strip().lower():
                    correct_count += 1
            points = correct_count * 2
            reason = f"{correct_count} correct answer(s) in {lesson.type.capitalize()}"
        elif lesson.type in ("writing", "speaking"):
            points = 5
            reason = f"{lesson.type.capitalize()} submission"
        
        if points > 0:
            rp = models.RewardPoint(
                user_id=user_id,
                lesson_id=lesson.id,
                result_id=db_result.id,
                points=points,
                reason=reason
            )
            db.add(rp)
            db.commit()
        
    return db_result

@router.put("/{result_id}", response_model=schemas.ResultResponse)
def update_result(result_id: int, result_update: schemas.ResultUpdate, db: Session = Depends(get_db)):
    db_result = db.query(models.Result).filter(models.Result.id == result_id).first()
    if not db_result:
        raise HTTPException(status_code=404, detail="Result not found")
        
    db_result.responses = result_update.responses
    
    # Optionally recalculate score or just rely on responses update
    # In writing/speaking, the score might be set via responses["score"] eventually.
    
    db.commit()
    db.refresh(db_result)
    
    return db_result
