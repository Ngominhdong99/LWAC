import re as _re

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db
from ..services.email import send_feedback_email

router = APIRouter(
    prefix="/results",
    tags=["results"]
)

@router.get("/{user_id}", response_model=List[schemas.ResultResponse])
def read_results(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    results = db.query(models.Result).filter(models.Result.user_id == user_id).offset(skip).limit(limit).all()
    return results


# Common English contractions mapped to their expanded forms
_CONTRACTIONS = {
    "don't": "do not", "doesn't": "does not", "didn't": "did not",
    "can't": "cannot", "couldn't": "could not", "won't": "will not",
    "wouldn't": "would not", "shouldn't": "should not", "mustn't": "must not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "hasn't": "has not", "haven't": "have not", "hadn't": "had not",
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
    "there's": "there is", "here's": "here is", "what's": "what is", "who's": "who is",
    "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
    "i'll": "i will", "you'll": "you will", "we'll": "we will", "they'll": "they will",
    "he'll": "he will", "she'll": "she will", "it'll": "it will",
    "i'd": "i would", "you'd": "you would", "we'd": "we would", "they'd": "they would",
    "he'd": "he would", "she'd": "she would",
    "let's": "let us",
}

def __normalize_answer(text: str) -> str:
    """Normalize an answer for flexible comparison:
    1. Lowercase + strip
    2. Replace smart quotes with standard apostrophes
    3. Remove trailing punctuation (. , ! ? ;)
    4. Expand contractions (don't -> do not)
    5. Collapse multiple spaces
    """
    s = (text or "").strip().lower()
    # Replace smart quotes with standard apostrophes
    s = s.replace('\u2019', "'").replace('‘', "'")
    # Remove trailing punctuation
    s = _re.sub(r'[.,!?;:]+$', '', s).strip()
    # Expand contractions
    for contraction, expanded in _CONTRACTIONS.items():
        s = _re.sub(r'\b' + _re.escape(contraction) + r'\b', expanded, s)
    # Collapse multiple spaces
    s = _re.sub(r'\s+', ' ', s).strip()
    return s

def __check_single_blank(user_answer: str, correct_answer: str) -> bool:
    normalized_user = __normalize_answer(user_answer)
    if not normalized_user:
        return False
    accepted = [__normalize_answer(a) for a in (correct_answer or "").split("|")]
    return normalized_user in accepted

def __check_written_answer(user_answer: str, correct_answer: str) -> bool:
    parts = (correct_answer or "").split(";")
    if len(parts) == 1:
        return __check_single_blank(user_answer, correct_answer)
        
    user_parts = (user_answer or "").split(";;")
    if len(user_parts) != len(parts):
        return False
        
    for u_ans, c_ans in zip(user_parts, parts):
        if not __check_single_blank(u_ans, c_ans):
            return False
            
    return True

@router.post("/{user_id}", response_model=schemas.ResultResponse)
def create_result(user_id: int, result: schemas.ResultCreate, db: Session = Depends(get_db)):
    # Verify user exists
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    from datetime import datetime, UTC
    
    assignment = db.query(models.Assignment).filter(
        models.Assignment.student_id == user_id,
        models.Assignment.lesson_id == result.lesson_id
    ).first()
    
    if assignment:
        if assignment.status == "completed" and not assignment.allow_retake:
            raise HTTPException(status_code=400, detail="Assignment already completed. Retake not allowed.")
            
        assignment.status = "completed"
        assignment.completed_at = datetime.now(UTC)
        assignment.allow_retake = False
        # result_id is set below after creating the result
    else:
        # If no assignment, still check if they already submitted this lesson to prevent spamming
        existing_result = db.query(models.Result).filter(
            models.Result.user_id == user_id,
            models.Result.lesson_id == result.lesson_id
        ).first()
        if existing_result:
             # Just an extra protection since they have no assignment allowing a retake
             raise HTTPException(status_code=400, detail="Lesson already completed. Retake not allowed without coach permission.")

    db_result = models.Result(**result.dict(), user_id=user_id)
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    
    if assignment:
        assignment.result_id = db_result.id
        db.commit()
    
    # Award reward points
    lesson = db.query(models.Lesson).filter(models.Lesson.id == result.lesson_id).first()
    if lesson:
        points = 0
        reason = ""
        if lesson.type in ("reading", "listening"):
            questions = db.query(models.Question).filter(models.Question.lesson_id == lesson.id).all()
            correct_count = 0
            responses = result.responses if isinstance(result.responses, dict) else {}
            for q in questions:
                student_ans = responses.get(str(q.id))
                if not student_ans:
                    continue
                if q.type == "multiple_choice":
                    if student_ans.strip().lower() == (q.correct_answer or "").strip().lower():
                        correct_count += 1
                elif q.type in ("fill_blank", "written_answer"):
                    if __check_written_answer(student_ans, q.correct_answer):
                        correct_count += 1
            if lesson.type == "reading":
                points = correct_count * 1
            else:
                points = correct_count * 2
            reason = f"{correct_count} correct answer(s) in {lesson.type.capitalize()}"
        elif lesson.type in ("writing", "speaking"):
            points = 0
            reason = ""
        
        if points > 0:
            # Prevent Point Farming: Check if user already got points for this lesson
            already_rewarded = db.query(models.RewardPoint).filter(
                models.RewardPoint.user_id == user_id,
                models.RewardPoint.lesson_id == lesson.id
            ).first()
            
            if not already_rewarded:
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
def update_result(result_id: int, result_update: schemas.ResultUpdate, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_result = db.query(models.Result).filter(models.Result.id == result_id).first()
    if not db_result:
        raise HTTPException(status_code=404, detail="Result not found")
        
    db_result.responses = result_update.responses
    
    # Recalculate points for writing and speaking on grading
    lesson = db.query(models.Lesson).filter(models.Lesson.id == db_result.lesson_id).first()
    if lesson and lesson.type in ("writing", "speaking") and isinstance(db_result.responses, dict):
        score_val = db_result.responses.get("score")
        if score_val is not None:
            try:
                score = float(score_val)
                points = 0
                reason = ""
                if lesson.type == "writing" and score > 5:
                    points = 5
                    reason = f"Writing score ({score}) > 5"
                elif lesson.type == "speaking" and score > 0:
                    points = int(score)  # e.g., 7.5 gets 7 points, 8.0 gets 8 points
                    reason = f"Speaking score: {score}"
                    
                if points > 0:
                    rp = db.query(models.RewardPoint).filter(models.RewardPoint.result_id == db_result.id).first()
                    if rp:
                        rp.points = points
                        rp.reason = reason
                    else:
                        rp = models.RewardPoint(
                            user_id=db_result.user_id,
                            lesson_id=lesson.id,
                            result_id=db_result.id,
                            points=points,
                            reason=reason
                        )
                        db.add(rp)
            except ValueError:
                pass
    
    db.commit()
    db.refresh(db_result)
    
    # Send email notification to user if this is a writing/speaking grading update and they have an email
    if lesson and lesson.type in ("writing", "speaking"):
        student = db.query(models.User).filter(models.User.id == db_result.user_id).first()
        if student and student.email:
            bg_tasks.add_task(
                send_feedback_email,
                student.email,
                student.full_name or student.username,
                lesson.title
            )

    return db_result
