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
    
    # Update pending assignment for this lesson
    assignment = db.query(models.Assignment).filter(
        models.Assignment.student_id == user_id,
        models.Assignment.lesson_id == result.lesson_id,
        models.Assignment.status == "pending"
    ).first()
    
    if assignment:
        assignment.status = "completed"
        from datetime import datetime
        assignment.completed_at = datetime.utcnow()
        assignment.result_id = db_result.id
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
