"""
Coach Router — student management, view results, answer questions.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from .. import models
from ..database import get_db

router = APIRouter(prefix="/coach", tags=["Coach"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Schemas ──────────────────────────────────────────────────────
class StudentCreate(BaseModel):
    username: str
    password: str
    email: str = ""
    full_name: str = ""

class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

class StudentOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    avatar_color: str
    created_at: datetime
    tests_completed: int = 0
    avg_score: float = 0.0
    class Config:
        orm_mode = True

class ResultOut(BaseModel):
    id: int
    lesson_id: int
    lesson_title: str = ""
    lesson_type: str = ""
    score: int
    submitted_at: datetime
    class Config:
        orm_mode = True

class TeacherQuestionOut(BaseModel):
    id: int
    student_id: int
    student_name: str = ""
    question_text: str
    context: Optional[str] = None
    lesson_id: Optional[int] = None
    status: str
    answer: Optional[str] = None
    created_at: datetime
    answered_at: Optional[datetime] = None
    class Config:
        orm_mode = True

class AnswerRequest(BaseModel):
    answer: str

class AssignmentOut(BaseModel):
    id: int
    lesson_id: int
    lesson_title: str = ""
    lesson_type: str = ""
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    score: Optional[int] = None
    result_id: Optional[int] = None
    allow_retake: bool = False
    class Config:
        orm_mode = True

class AssignRequest(BaseModel):
    lesson_id: int


# ── Student CRUD ─────────────────────────────────────────────────
@router.get("/students", response_model=List[StudentOut])
def list_students(db: Session = Depends(get_db)):
    students = db.query(models.User).filter(models.User.role == "student").all()
    result = []
    for s in students:
        tests = db.query(models.Result).filter(models.Result.user_id == s.id).count()
        avg = 0.0
        if tests > 0:
            from sqlalchemy import func
            avg = db.query(func.avg(models.Result.score)).filter(models.Result.user_id == s.id).scalar() or 0.0
        result.append(StudentOut(
            id=s.id, username=s.username, email=s.email or "",
            full_name=s.full_name or s.username, avatar_color=s.avatar_color or "#0d9488",
            created_at=s.created_at, tests_completed=tests, avg_score=round(float(avg), 1)
        ))
    return result


@router.post("/students", response_model=StudentOut)
def create_student(req: StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    colors = ["#0d9488", "#7c3aed", "#dc2626", "#2563eb", "#d97706", "#059669", "#e11d48"]
    import random
    user = models.User(
        username=req.username,
        email=req.email,
        full_name=req.full_name or req.username,
        hashed_password=pwd_context.hash(req.password),
        role="student",
        avatar_color=random.choice(colors)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return StudentOut(
        id=user.id, username=user.username, email=user.email or "",
        full_name=user.full_name or user.username, avatar_color=user.avatar_color,
        created_at=user.created_at, tests_completed=0, avg_score=0.0
    )


@router.put("/students/{student_id}", response_model=StudentOut)
def update_student(student_id: int, req: StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == student_id, models.User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if req.full_name is not None:
        student.full_name = req.full_name
    if req.email is not None:
        student.email = req.email
    if req.password is not None:
        student.hashed_password = pwd_context.hash(req.password)
    
    db.commit()
    db.refresh(student)
    tests = db.query(models.Result).filter(models.Result.user_id == student.id).count()
    return StudentOut(
        id=student.id, username=student.username, email=student.email or "",
        full_name=student.full_name or student.username, avatar_color=student.avatar_color or "#0d9488",
        created_at=student.created_at, tests_completed=tests, avg_score=0.0
    )


@router.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == student_id, models.User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"message": "Student deleted"}


# ── Assignments ──────────────────────────────────────────────────
@router.get("/library")
def get_library(db: Session = Depends(get_db)):
    lessons = db.query(models.Lesson).all()
    out = []
    for l in lessons:
        # Assuming questions are eager loaded or can be queried
        q_count = db.query(models.Question).filter(models.Question.lesson_id == l.id).count()
        out.append({
            "id": l.id,
            "title": l.title,
            "chapter": l.chapter,
            "type": l.type,
            "question_count": q_count
        })
    return out

@router.get("/students/{student_id}/assignments", response_model=List[AssignmentOut])
def get_assignments(student_id: int, db: Session = Depends(get_db)):
    assignments = db.query(models.Assignment).filter(models.Assignment.student_id == student_id).order_by(models.Assignment.created_at.desc()).all()
    out = []
    for a in assignments:
        lesson = db.query(models.Lesson).filter(models.Lesson.id == a.lesson_id).first()
        score = None
        # Always fetch the latest result for this user+lesson (not just the linked result_id)
        latest_result = db.query(models.Result).filter(
            models.Result.user_id == student_id,
            models.Result.lesson_id == a.lesson_id
        ).order_by(models.Result.submitted_at.desc()).first()
        if latest_result:
            score = latest_result.score
            # Also fix the assignment's result_id if it's stale
            if a.result_id != latest_result.id:
                a.result_id = latest_result.id
                if a.status == "pending":
                    a.status = "completed"
                    a.completed_at = latest_result.submitted_at
                db.commit()
        out.append(AssignmentOut(
            id=a.id, lesson_id=a.lesson_id, lesson_title=lesson.title if lesson else "Unknown",
            lesson_type=lesson.type if lesson else "", status=a.status,
            created_at=a.created_at, completed_at=a.completed_at, score=score, result_id=a.result_id,
            allow_retake=a.allow_retake or False
        ))
    return out

@router.post("/students/{student_id}/assignments", response_model=AssignmentOut)
def assign_test(student_id: int, req: AssignRequest, db: Session = Depends(get_db)):
    # Assuming coach id is 1 for now (to be updated with proper auth)
    a = models.Assignment(
        coach_id=1,
        student_id=student_id,
        lesson_id=req.lesson_id,
        status="pending"
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    lesson = db.query(models.Lesson).filter(models.Lesson.id == a.lesson_id).first()
    return AssignmentOut(
        id=a.id, lesson_id=a.lesson_id, lesson_title=lesson.title if lesson else "Unknown",
        lesson_type=lesson.type if lesson else "", status=a.status,
        created_at=a.created_at, completed_at=None, score=None
    )

@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"message": "Assignment deleted"}


@router.put("/assignments/{assignment_id}/toggle-retake")
def toggle_retake(assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.allow_retake = not (a.allow_retake or False)
    db.commit()
    return {"message": f"Retake {'allowed' if a.allow_retake else 'denied'}", "allow_retake": a.allow_retake}


# ── Student Results ──────────────────────────────────────────────
@router.get("/students/{student_id}/results", response_model=List[ResultOut])
def get_student_results(student_id: int, db: Session = Depends(get_db)):
    results = db.query(models.Result).filter(models.Result.user_id == student_id).order_by(models.Result.submitted_at.desc()).all()
    out = []
    for r in results:
        lesson = db.query(models.Lesson).filter(models.Lesson.id == r.lesson_id).first()
        out.append(ResultOut(
            id=r.id, lesson_id=r.lesson_id,
            lesson_title=lesson.title if lesson else "Unknown",
            lesson_type=lesson.type if lesson else "",
            score=r.score, submitted_at=r.submitted_at
        ))
    return out

@router.get("/results/{result_id}")
def get_detailed_result(result_id: int, db: Session = Depends(get_db)):
    res = db.query(models.Result).filter(models.Result.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Result not found")
    # Return exactly what Result model stores
    return res


# ── Teacher Questions ────────────────────────────────────────────
@router.get("/questions", response_model=List[TeacherQuestionOut])
def list_questions(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.TeacherQuestion).order_by(models.TeacherQuestion.created_at.desc())
    if status:
        q = q.filter(models.TeacherQuestion.status == status)
    questions = q.all()
    out = []
    for tq in questions:
        student = db.query(models.User).filter(models.User.id == tq.student_id).first()
        out.append(TeacherQuestionOut(
            id=tq.id, student_id=tq.student_id,
            student_name=student.full_name if student else "Unknown",
            question_text=tq.question_text, context=tq.context,
            lesson_id=tq.lesson_id, status=tq.status, answer=tq.answer,
            created_at=tq.created_at, answered_at=tq.answered_at
        ))
    return out


@router.put("/questions/{question_id}/answer")
def answer_question(question_id: int, req: AnswerRequest, db: Session = Depends(get_db)):
    tq = db.query(models.TeacherQuestion).filter(models.TeacherQuestion.id == question_id).first()
    if not tq:
        raise HTTPException(status_code=404, detail="Question not found")
    tq.answer = req.answer
    tq.status = "answered"
    tq.answered_at = datetime.utcnow()
    db.commit()
    return {"message": "Question answered", "id": tq.id}
