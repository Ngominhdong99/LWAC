"""
Coach Router — student management, view results, answer questions.
"""
from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from .. import models
from ..database import get_db
from ..services.email import send_assignment_email, send_question_reply_email

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
    lesson_chapter: str = ""
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
            lesson_chapter=lesson.chapter if lesson else "",
            lesson_type=lesson.type if lesson else "", status=a.status,
            created_at=a.created_at, completed_at=a.completed_at, score=score, result_id=a.result_id,
            allow_retake=a.allow_retake or False
        ))
    return out

@router.post("/students/{student_id}/assignments", response_model=AssignmentOut)
def assign_test(student_id: int, req: AssignRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Find the first coach user dynamically
    coach = db.query(models.User).filter(models.User.role == "coach").first()
    coach_id = coach.id if coach else 1
    a = models.Assignment(
        coach_id=coach_id,
        student_id=student_id,
        lesson_id=req.lesson_id,
        status="pending"
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    lesson = db.query(models.Lesson).filter(models.Lesson.id == a.lesson_id).first()
    student = db.query(models.User).filter(models.User.id == student_id).first()
    
    if student and student.email:
        bg_tasks.add_task(
            send_assignment_email,
            student.email,
            student.full_name or student.username,
            lesson.title if lesson else "Unknown",
            lesson.type if lesson else "Unknown"
        )
        
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
def answer_question(question_id: int, req: AnswerRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    tq = db.query(models.TeacherQuestion).filter(models.TeacherQuestion.id == question_id).first()
    if not tq:
        raise HTTPException(status_code=404, detail="Question not found")
    tq.answer = req.answer
    tq.status = "answered"
    tq.answered_at = datetime.utcnow()
    db.commit()
    
    if tq.student and tq.student.email:
        bg_tasks.add_task(
            send_question_reply_email,
            tq.student.email,
            tq.student.full_name or tq.student.username,
            tq.question_text
        )
        
    return {"message": "Question answered", "id": tq.id}


# ── AI Explanation for Coach ─────────────────────────────────────
class AIExplainRequest(BaseModel):
    passage: str
    question_text: str
    options: Optional[dict] = None
    correct_answer: str


@router.post("/ai-explain")
def ai_explain_question(req: AIExplainRequest):
    """Use Gemini to explain why the correct answer is correct for a reading question."""
    import os
    try:
        from google import genai
    except ImportError:
        return {"explanation": "AI service not available (google-genai not installed)"}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"explanation": "Gemini API key not configured."}

    options_text = ""
    if req.options:
        options_text = "\n".join([f"{k}: {v}" for k, v in req.options.items()])

    options_section = f"Options:\n{options_text}" if options_text else ""

    prompt = f"""You are an expert IELTS Reading instructor helping a coach understand a question.

Reading Passage:
{req.passage[:3000]}

Question: {req.question_text}
{options_section}
Correct Answer: {req.correct_answer}

Please explain in a clear, concise way:
1. WHY the correct answer is "{req.correct_answer}" — reference the specific part of the passage that supports this.
2. If there are options, briefly explain why each wrong option is incorrect.
3. Provide a teaching tip for how to explain this to a student.

Write in English with a friendly, professional tone. Keep it under 300 words."""

    models_to_try = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]

    client = genai.Client(api_key=api_key)
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=genai.types.GenerateContentConfig(
                    temperature=0.4,
                    max_output_tokens=600,
                ),
            )
            return {"explanation": response.text}
        except Exception as e:
            last_error = e
            print(f"[AI Explain] {model_name} failed: {e}")
            continue

    return {"explanation": f"AI explanation failed after trying all models: {str(last_error)[:200]}"}


# ── AI Generate Passage ──────────────────────────────────────────
class AIGeneratePassageRequest(BaseModel):
    description: str
    lesson_type: str = "reading"  # reading or listening
    level: str = "intermediate"   # beginner, intermediate, advanced


@router.post("/ai-generate-passage")
def ai_generate_passage(req: AIGeneratePassageRequest):
    """Use Gemini to generate a reading/listening passage from a coach's description."""
    import os
    try:
        from google import genai
    except ImportError:
        return {"passage": "", "error": "AI service not available (google-genai not installed)"}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"passage": "", "error": "Gemini API key not configured."}

    level_hint = ""
    if req.level:
        level_guide = {
            "beginner": "A1-A2 CEFR level, simple vocabulary, short sentences",
            "intermediate": "B1-B2 level, mix of simple and complex sentences",
            "advanced": "C1-C2 level, complex structures, academic tone",
        }
        level_hint = f"\n- If writing English content, target {level_guide.get(req.level, level_guide['intermediate'])}."

    prompt = f"""You are a helpful AI assistant for an English language coach. Follow the coach's instructions below exactly.

Coach's instructions:
{req.description}

Guidelines:
- Do exactly what the coach asks. If they ask for a passage, write a passage. If they ask for exercises, write exercises. If they ask for a list, write a list.
- Do NOT add meta-commentary like "Here is..." or "Sure, here's..." — just output the content directly.{level_hint}
- Output clean, well-formatted text."""

    models_to_try = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]

    client = genai.Client(api_key=api_key)
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=genai.types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=2000,
                ),
            )
            return {"passage": response.text}
        except Exception as e:
            last_error = e
            print(f"[AI Generate] {model_name} failed: {e}")
            continue

    return {"passage": "", "error": f"AI generation failed: {str(last_error)[:200]}"}


# ── AI Parse Questions ──────────────────────────────────────────
class AIParseQuestionsRequest(BaseModel):
    raw_text: str

@router.post("/ai-parse-questions")
def ai_parse_questions(req: AIParseQuestionsRequest):
    """Use Gemini to parse raw text into structured JSON questions."""
    import os
    import json
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"questions": [], "error": "AI service not available"}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"questions": [], "error": "Gemini API key not configured."}

    prompt = f"""You are a helpful AI assistant that extracts quiz questions from raw text and outputs strictly valid JSON.
    
Raw text:
\"\"\"
{req.raw_text}
\"\"\"

Guidelines:
1. Identify all questions in the text.
2. For each question, decide if it is "multiple_choice" or "fill_blank". 
   - If it has options (like A, B, C, D), it is "multiple_choice". 
   - If it expects a typed answer without given options (e.g. fill in the blanks), it is "fill_blank".
3. Extract the `question_text`. Provide the question text strictly.
4. If it's "multiple_choice", extract the options into a dictionary with keys "A", "B", "C", "D" (or however many there are). Ensure keys are single uppercase letters.
5. Extract the correct answer:
   - For "multiple_choice", this should be the option key (e.g. "A").
   - For "fill_blank", this should be the exact text answer. If there are multiple blanks in a single question, separate the answers by semi-colons like `;;` (e.g. "answer1;;answer2").
6. The output must be a JSON array of objects. Each object must have exactly these keys:
   - `type` (string: "multiple_choice" or "fill_blank")
   - `question_text` (string)
   - `options` (dictionary of string to string, empty dict if fill_blank)
   - `correct_answer` (string)

Return ONLY the JSON array. Do not wrap it in markdown code blocks like ```json.
"""

    models_to_try = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]

    client = genai.Client(api_key=api_key)
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            
            try:
                questions = json.loads(response.text)
                if not isinstance(questions, list):
                     questions = [questions]
                return {"questions": questions}
            except json.JSONDecodeError:
                return {"questions": [], "error": "Failed to parse JSON from AI response."}
                
        except Exception as e:
            last_error = e
            print(f"[AI Parse Questions] {model_name} failed: {e}")
            continue

    return {"questions": [], "error": f"AI generation failed: {str(last_error)[:200]}"}

# ── AI Parse Exercises (Bulk) ──────────────────────────────────────
class AIParseExercisesRequest(BaseModel):
    raw_text: str
    lesson_type: str = "reading"  # "reading" or "listening"

@router.post("/ai-parse-exercises")
def ai_parse_exercises(req: AIParseExercisesRequest):
    """Use Gemini to parse raw text into multiple exercises, each with its own questions."""
    import os
    import json
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"exercises": [], "error": "AI service not available"}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"exercises": [], "error": "Gemini API key not configured."}

    prompt = f"""You are an expert IELTS exam parser. Your task is to parse raw test content into MULTIPLE exercises (sections/parts). Each exercise contains its own passage/context and set of questions.

Raw text:
\"\"\"
{req.raw_text}
\"\"\"

Guidelines:
1. Split the content into logical sections/exercises. In IELTS tests, each "section" or "part" or "passage" should be a separate exercise.
2. For each exercise, extract:
   - `title`: A descriptive title (e.g. "Section 1", "Part 1", "Passage 1", or the actual section title if given)
   - `context`: The reading passage or listening context text for that exercise. If no passage is found for a section, set to empty string.
   - `questions`: An array of question objects
3. For each question object:
   - `type`: "multiple_choice" if it has options (A/B/C/D), or "fill_blank" if typed answer
   - `question_text`: The question text
   - `options`: Dictionary with keys "A", "B", "C", "D" etc. Empty dict for fill_blank
   - `correct_answer`: The option key for MC, or the text answer for fill_blank. If multiple blanks in one question, separate by ` ; ` (space-semicolon-space). If multiple accepted answers for one blank, separate by `|`.

4. The output must be a JSON array of exercise objects:
[
  {{
    "title": "Section 1",
    "context": "passage text here...",
    "questions": [
      {{
        "type": "multiple_choice",
        "question_text": "What is...?",
        "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
        "correct_answer": "B"
      }}
    ]
  }},
  ...
]

5. If you cannot clearly separate into multiple exercises, put EVERYTHING in a single exercise.
6. Return ONLY the JSON array. Do not wrap it in markdown code blocks.
"""

    models_to_try = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]

    client = genai.Client(api_key=api_key)
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            
            try:
                exercises = json.loads(response.text)
                if not isinstance(exercises, list):
                    exercises = [exercises]
                return {"exercises": exercises}
            except json.JSONDecodeError:
                return {"exercises": [], "error": "Failed to parse JSON from AI response."}
                
        except Exception as e:
            last_error = e
            print(f"[AI Parse Exercises] {model_name} failed: {e}")
            continue

    return {"exercises": [], "error": f"AI generation failed: {str(last_error)[:200]}"}
