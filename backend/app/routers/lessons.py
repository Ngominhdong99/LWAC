from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/lessons",
    tags=["lessons"]
)

@router.get("/", response_model=List[schemas.LessonResponse])
def read_lessons(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    lessons = db.query(models.Lesson).offset(skip).limit(limit).all()
    return lessons

@router.get("/{lesson_id}", response_model=schemas.LessonResponse)
def read_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson

@router.post("/", response_model=schemas.LessonResponse)
def create_lesson(lesson: schemas.LessonCreate, db: Session = Depends(get_db)):
    db_lesson = models.Lesson(**lesson.dict())
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    return db_lesson

@router.post("/{lesson_id}/questions/bulk", response_model=List[schemas.QuestionResponse])
def create_questions_bulk(
    lesson_id: int, 
    questions: List[schemas.QuestionBase] = Body(...), 
    db: Session = Depends(get_db)
):
    # Verify lesson exists
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    db_questions = []
    for q in questions:
        db_question = models.Question(**q.dict(), lesson_id=lesson_id)
        db.add(db_question)
        db_questions.append(db_question)
        
    db.commit()
    
    for db_q in db_questions:
        db.refresh(db_q)
        
    return db_questions

@router.post("/{lesson_id}/exercises/bulk")
def create_exercises_bulk(
    lesson_id: int, 
    exercises: List[schemas.ExerciseCreate] = Body(...), 
    db: Session = Depends(get_db)
):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    created = []
    for ex_data in exercises:
        db_exercise = models.Exercise(
            lesson_id=lesson_id,
            order=ex_data.order,
            title=ex_data.title,
            context=ex_data.context,
            image_url=ex_data.image_url
        )
        db.add(db_exercise)
        db.flush()
        
        for q_data in ex_data.questions:
            db_q = models.Question(
                lesson_id=lesson_id,
                exercise_id=db_exercise.id,
                type=q_data.type,
                question_text=q_data.question_text,
                options=q_data.options if q_data.type == 'multiple_choice' else None,
                correct_answer=q_data.correct_answer
            )
            db.add(db_q)
        
        created.append(db_exercise)
    
    db.commit()
    for ex in created:
        db.refresh(ex)
    
    return {"message": f"Created {len(created)} exercises", "count": len(created)}

from pydantic import BaseModel
from typing import Dict, Any, Optional

class ExercisePayload(BaseModel):
    order: int = 0
    title: Optional[str] = None
    context: Optional[str] = None
    image_url: Optional[str] = None
    questions: List[schemas.QuestionBase] = []

class LessonUpdate(BaseModel):
    title: str
    chapter: str
    content: Optional[Dict[str, Any]] = None
    media_url: Optional[str] = None
    exercises: Optional[List[ExercisePayload]] = None

@router.put("/{lesson_id}", response_model=schemas.LessonResponse)
def update_lesson(lesson_id: int, lesson_update: LessonUpdate, db: Session = Depends(get_db)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    lesson.title = lesson_update.title
    lesson.chapter = lesson_update.chapter
    if lesson_update.content is not None:
        lesson.content = lesson_update.content
    if lesson_update.media_url is not None:
        lesson.media_url = lesson_update.media_url
    
    # Handle exercises if provided
    if lesson_update.exercises is not None:
        # Delete existing exercises and their questions
        for ex in lesson.exercises:
            db.delete(ex)
        db.flush()
        
        # Also delete any standalone questions (non-exercise) for this lesson
        db.query(models.Question).filter(
            models.Question.lesson_id == lesson_id,
            models.Question.exercise_id == None
        ).delete(synchronize_session=False)
        db.flush()
        
        # Create new exercises with questions
        for ex_data in lesson_update.exercises:
            db_exercise = models.Exercise(
                lesson_id=lesson_id,
                order=ex_data.order,
                title=ex_data.title,
                context=ex_data.context,
                image_url=ex_data.image_url
            )
            db.add(db_exercise)
            db.flush()
            
            for q_data in ex_data.questions:
                db_q = models.Question(
                    lesson_id=lesson_id,
                    exercise_id=db_exercise.id,
                    type=q_data.type,
                    question_text=q_data.question_text,
                    options=q_data.options if q_data.type == 'multiple_choice' else None,
                    correct_answer=q_data.correct_answer
                )
                db.add(db_q)
        
    db.commit()
    db.refresh(lesson)
    return lesson

@router.put("/{lesson_id}/questions", response_model=List[schemas.QuestionResponse])
def update_questions_bulk(
    lesson_id: int,
    questions: List[schemas.QuestionBase] = Body(...),
    db: Session = Depends(get_db)
):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    # Delete all existing questions for this lesson
    db.query(models.Question).filter(models.Question.lesson_id == lesson_id).delete(synchronize_session=False)
    
    # Insert new ones
    db_questions = []
    for q in questions:
        db_question = models.Question(**q.dict(), lesson_id=lesson_id)
        db.add(db_question)
        db_questions.append(db_question)
        
    db.commit()
    for db_q in db_questions:
        db.refresh(db_q)
        
    return db_questions

@router.delete("/{lesson_id}", status_code=204)
def delete_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    # Clean up reward_points referencing this lesson or its results
    result_ids = [r.id for r in db.query(models.Result.id).filter(models.Result.lesson_id == lesson_id).all()]
    if result_ids:
        db.query(models.RewardPoint).filter(models.RewardPoint.result_id.in_(result_ids)).delete(synchronize_session=False)
    db.query(models.RewardPoint).filter(models.RewardPoint.lesson_id == lesson_id).delete(synchronize_session=False)
    
    # Manual cleanup to avoid foreign key errors from SQLite
    db.query(models.Assignment).filter(models.Assignment.lesson_id == lesson_id).delete(synchronize_session=False)
    db.query(models.TeacherQuestion).filter(models.TeacherQuestion.lesson_id == lesson_id).delete(synchronize_session=False)
    db.query(models.VocabVault).filter(models.VocabVault.source_lesson_id == lesson_id).update({"source_lesson_id": None}, synchronize_session=False)
    
    # Delete exercises (cascade will handle their questions)
    db.query(models.Exercise).filter(models.Exercise.lesson_id == lesson_id).delete(synchronize_session=False)
    
    db.delete(lesson)
    db.commit()
    return None
