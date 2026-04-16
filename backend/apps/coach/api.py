import json
import random
from datetime import datetime, UTC

from fastapi import BackgroundTasks, Depends
from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from core.config import settings
from core.queries import batch_lessons_by_ids, batch_users_by_ids, count_results_by_user
from database import get_db
from exceptions import ConflictError, NotFoundError
from models import Assignment, Lesson, Result, TeacherQuestion, User
from repositories import LessonRepository, ResultRepository
from services.email import send_assignment_email, send_question_reply_email
from .schemas import (
    AIExplainRequest,
    AIGeneratePassageRequest,
    AIParseQuestionsRequest,
    AnswerRequest,
    AssignmentOut,
    AssignRequest,
    ResultOut,
    StudentCreate,
    StudentOut,
    StudentUpdate,
    TeacherQuestionOut,
)


def _student_out(student: User, db) -> StudentOut:
    stats = count_results_by_user(db, [student.id]).get(student.id, {})
    return StudentOut(
        id=student.id,
        username=student.username,
        email=student.email or "",
        full_name=student.full_name or student.username,
        avatar_color=student.avatar_color or "#0d9488",
        created_at=student.created_at,
        tests_completed=stats.get("count", 0),
        avg_score=stats.get("avg", 0.0),
    )


def list_students(db=Depends(get_db)):
    students = list(
        db.execute(select(User).where(User.role == "student")).scalars().all()
    )
    if not students:
        return []
    stats = count_results_by_user(db, [student.id for student in students])
    return [
        StudentOut(
            id=student.id,
            username=student.username,
            email=student.email or "",
            full_name=student.full_name or student.username,
            avatar_color=student.avatar_color or "#0d9488",
            created_at=student.created_at,
            tests_completed=stats.get(student.id, {}).get("count", 0),
            avg_score=stats.get(student.id, {}).get("avg", 0.0),
        )
        for student in students
    ]


def create_student(req: StudentCreate, db=Depends(get_db)):
    from core.config import pwd_context

    existing = (
        db.execute(select(User).where(User.username == req.username)).scalars().first()
    )
    if existing:
        raise ConflictError("Username already exists")

    colors = [
        "#0d9488",
        "#7c3aed",
        "#dc2626",
        "#2563eb",
        "#d97706",
        "#059669",
        "#e11d48",
    ]
    user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name or req.username,
        hashed_password=pwd_context.hash(req.password),
        role="student",
        avatar_color=random.choice(colors),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _student_out(user, db)


def update_student(student_id: int, req: StudentUpdate, db=Depends(get_db)):
    from core.config import pwd_context

    student = (
        db.execute(select(User).where(User.id == student_id, User.role == "student"))
        .scalars()
        .first()
    )
    if not student:
        raise NotFoundError("Student not found")
    if req.full_name is not None:
        student.full_name = req.full_name
    if req.email is not None:
        student.email = req.email
    if req.password is not None:
        student.hashed_password = pwd_context.hash(req.password)
    db.commit()
    db.refresh(student)
    return _student_out(student, db)


def delete_student(student_id: int, db=Depends(get_db)):
    student = (
        db.execute(select(User).where(User.id == student_id, User.role == "student"))
        .scalars()
        .first()
    )
    if not student:
        raise NotFoundError("Student not found")
    db.delete(student)
    db.commit()
    return {"message": "Student deleted"}


def get_library(db=Depends(get_db)):
    lesson_repo = LessonRepository(db)
    return lesson_repo.list_with_question_counts()


def get_assignments(student_id: int, db=Depends(get_db)):
    assignments = list(
        db.execute(
            select(Assignment)
            .where(Assignment.student_id == student_id)
            .order_by(Assignment.created_at.desc())
        )
        .scalars()
        .all()
    )
    if not assignments:
        return []

    lesson_ids = list({assignment.lesson_id for assignment in assignments})
    lessons_map = batch_lessons_by_ids(db, lesson_ids)
    latest_by_lesson = ResultRepository(db).latest_by_lesson(student_id, lesson_ids)

    output = []
    for assignment in assignments:
        lesson = lessons_map.get(assignment.lesson_id)
        latest_result = latest_by_lesson.get(assignment.lesson_id)
        score = latest_result.score if latest_result else None
        if latest_result and assignment.result_id != latest_result.id:
            assignment.result_id = latest_result.id
            if assignment.status == "pending":
                assignment.status = "completed"
                assignment.completed_at = latest_result.submitted_at

        output.append(
            AssignmentOut(
                id=assignment.id,
                lesson_id=assignment.lesson_id,
                lesson_title=lesson.title if lesson else "Unknown",
                lesson_chapter=lesson.chapter if lesson else "",
                lesson_type=lesson.type if lesson else "",
                status=assignment.status,
                created_at=assignment.created_at,
                completed_at=assignment.completed_at,
                score=score,
                result_id=assignment.result_id,
                allow_retake=assignment.allow_retake or False,
            )
        )

    db.commit()
    return output


def assign_test(
    student_id: int, req: AssignRequest, bg_tasks: BackgroundTasks, db=Depends(get_db)
):
    coach = db.execute(select(User).where(User.role == "coach")).scalars().first()
    assignment = Assignment(
        coach_id=coach.id if coach else 1,
        student_id=student_id,
        lesson_id=req.lesson_id,
        status="pending",
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    lesson = (
        db.execute(select(Lesson).where(Lesson.id == assignment.lesson_id))
        .scalars()
        .first()
    )
    student = db.execute(select(User).where(User.id == student_id)).scalars().first()
    if student and student.email:
        bg_tasks.add_task(
            send_assignment_email,
            student.email,
            student.full_name or student.username,
            lesson.title if lesson else "Unknown",
            lesson.type if lesson else "Unknown",
        )

    return AssignmentOut(
        id=assignment.id,
        lesson_id=assignment.lesson_id,
        lesson_title=lesson.title if lesson else "Unknown",
        lesson_chapter=lesson.chapter if lesson else "",
        lesson_type=lesson.type if lesson else "",
        status=assignment.status,
        created_at=assignment.created_at,
        completed_at=None,
        score=None,
        result_id=assignment.result_id,
        allow_retake=assignment.allow_retake or False,
    )


def delete_assignment(assignment_id: int, db=Depends(get_db)):
    assignment = (
        db.execute(select(Assignment).where(Assignment.id == assignment_id))
        .scalars()
        .first()
    )
    if not assignment:
        raise NotFoundError("Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted"}


def toggle_retake(assignment_id: int, db=Depends(get_db)):
    assignment = (
        db.execute(select(Assignment).where(Assignment.id == assignment_id))
        .scalars()
        .first()
    )
    if not assignment:
        raise NotFoundError("Assignment not found")
    assignment.allow_retake = not (assignment.allow_retake or False)
    db.commit()
    return {
        "message": f"Retake {'allowed' if assignment.allow_retake else 'denied'}",
        "allow_retake": assignment.allow_retake,
    }


def get_student_results(student_id: int, db=Depends(get_db)):
    results = ResultRepository(db).list_for_user(student_id)
    if not results:
        return []
    lessons_map = batch_lessons_by_ids(
        db, list({result.lesson_id for result in results})
    )
    return [
        ResultOut(
            id=result.id,
            lesson_id=result.lesson_id,
            lesson_title=lessons_map.get(result.lesson_id).title
            if lessons_map.get(result.lesson_id)
            else "Unknown",
            lesson_type=lessons_map.get(result.lesson_id).type
            if lessons_map.get(result.lesson_id)
            else "",
            score=result.score,
            submitted_at=result.submitted_at,
        )
        for result in results
    ]


def get_detailed_result(result_id: int, db=Depends(get_db)):
    result = db.execute(select(Result).where(Result.id == result_id)).scalars().first()
    if not result:
        raise NotFoundError("Result not found")
    return result


def list_questions(status: str | None = None, db=Depends(get_db)):
    stmt = select(TeacherQuestion).order_by(TeacherQuestion.created_at.desc())
    if status:
        stmt = stmt.where(TeacherQuestion.status == status)
    questions = list(db.execute(stmt).scalars().all())
    if not questions:
        return []
    users_map = batch_users_by_ids(
        db, list({question.student_id for question in questions})
    )
    return [
        TeacherQuestionOut(
            id=question.id,
            student_id=question.student_id,
            student_name=(
                             users_map.get(question.student_id).full_name
                             if users_map.get(question.student_id)
                             else "Unknown"
                         )
                         or "Unknown",
            question_text=question.question_text,
            context=question.context,
            lesson_id=question.lesson_id,
            status=question.status,
            answer=question.answer,
            created_at=question.created_at,
            answered_at=question.answered_at,
        )
        for question in questions
    ]


def answer_question(
    question_id: int, req: AnswerRequest, bg_tasks: BackgroundTasks, db=Depends(get_db)
):
    question = (
        db.execute(
            select(TeacherQuestion)
            .where(TeacherQuestion.id == question_id)
            .options(joinedload(TeacherQuestion.student))
        )
        .scalars()
        .first()
    )
    if not question:
        raise NotFoundError("Question not found")
    question.answer = req.answer
    question.status = "answered"
    question.answered_at = datetime.now(UTC)
    db.commit()
    if question.student and question.student.email:
        bg_tasks.add_task(
            send_question_reply_email,
            question.student.email,
            question.student.full_name or question.student.username,
            question.question_text,
        )
    return {"message": "Question answered", "id": question.id}


def ai_explain_question(req: AIExplainRequest):
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"explanation": "Gemini API key not configured."}

    options_text = ""
    if req.options:
        options_text = "\n".join(
            [f"{key}: {value}" for key, value in req.options.items()]
        )
    options_section = f"Options:\n{options_text}" if options_text else ""
    prompt = f"""You are an expert IELTS Reading instructor helping a coach understand a question.

Reading Passage:
{req.passage[:3000]}

Question: {req.question_text}
{options_section}
Correct Answer: {req.correct_answer}

Please explain why the correct answer is '{req.correct_answer}' — reference the specific part of the passage. Write in English, professional tone. Under 300 words."""

    client = genai.Client(api_key=api_key)
    for model_name in [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=types.GenerateContentConfig(
                    temperature=0.4, max_output_tokens=600
                ),
            )
            return {"explanation": response.text}
        except Exception as exc:
            print(f"[AI Explain] {model_name} failed: {exc}")
    return {"explanation": "AI explanation failed."}


def ai_generate_passage(req: AIGeneratePassageRequest):
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"passage": "", "error": "Gemini API key not configured."}

    level_guide = {
        "beginner": "A1-A2 CEFR level, simple vocabulary, short sentences",
        "intermediate": "B1-B2 level, mix of simple and complex sentences",
        "advanced": "C1-C2 level, complex structures, academic tone",
    }
    level_hint = (
        f"\nTarget: {level_guide.get(req.level, level_guide['intermediate'])}."
        if req.level
        else ""
    )
    prompt = f"""You are a helpful AI assistant for an English language coach.

Coach's instructions:
{req.description}

Guidelines:
- Do exactly what the coach asks.
- Do NOT add meta-commentary — output content directly.{level_hint}
- Output clean, well-formatted text."""

    client = genai.Client(api_key=api_key)
    for model_name in [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=types.GenerateContentConfig(
                    temperature=0.7, max_output_tokens=2000
                ),
            )
            return {"passage": response.text}
        except Exception as exc:
            print(f"[AI Generate] {model_name} failed: {exc}")
    return {"passage": "", "error": "AI generation failed."}


def ai_parse_questions(req: AIParseQuestionsRequest):
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"questions": [], "error": "Gemini API key not configured."}

    prompt = f"""Extract quiz questions from raw text and output strictly valid JSON.

Raw text:
\"\"\"
{req.raw_text}
\"\"\"

Rules:
1. Identify all questions. Decide if "multiple_choice" or "fill_blank".
2. Extract question_text, options (dict with A/B/C/D keys for MC), correct_answer.
3. For fill_blank with multiple answers, separate by ";;".
4. Output ONLY a JSON array with keys: type, question_text, options, correct_answer.
Do not wrap in markdown code blocks."""

    client = genai.Client(api_key=api_key)
    for model_name in [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            questions = json.loads(response.text)
            if not isinstance(questions, list):
                questions = [questions]
            return {"questions": questions}
        except json.JSONDecodeError:
            return {"questions": [], "error": "Failed to parse JSON from AI response."}
        except Exception as exc:
            print(f"[AI Parse] {model_name} failed: {exc}")
    return {"questions": [], "error": "AI generation failed."}
