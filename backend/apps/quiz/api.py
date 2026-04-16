from fastapi import Depends

from database import get_db
from exceptions import NotFoundError
from models import Result
from services.grading import grade_writing_task

from . import schemas as quiz_schemas


def submit_writing(db, user_id, lesson_id, question_text, user_response):
    """Submit writing for AI grading. Creates result, updates assignment, awards points."""
    from models import User, Lesson, Assignment, RewardPoint
    from datetime import datetime, UTC

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError("User not found")
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise NotFoundError("Lesson not found")

    evaluation = grade_writing_task(prompt=question_text, user_response=user_response)
    band = evaluation.get("estimated_band", 0)
    normalized = int((band / 9.0) * 100)

    result = Result(
        user_id=user_id,
        lesson_id=lesson_id,
        score=normalized,
        responses={
            "type": "writing_task_auto_grade",
            "prompt": question_text,
            "user_essay": user_response,
            "evaluation": evaluation,
        },
    )
    db.add(result)

    assignment = (
        db.query(Assignment)
        .filter(Assignment.student_id == user_id, Assignment.lesson_id == lesson_id)
        .first()
    )
    if assignment:
        assignment.status = "completed"
        assignment.completed_at = datetime.now(UTC)
        assignment.result_id = result.id
        assignment.allow_retake = False

    if band > 5:
        rp = RewardPoint(
            user_id=user_id,
            lesson_id=lesson_id,
            result_id=result.id,
            points=5,
            reason=f"Writing score ({band}) > 5",
        )
        db.add(rp)

    return {
        "result_id": result.id,
        "score_normalized": normalized,
        "evaluation": evaluation,
    }


def submit_writing_route(data: quiz_schemas.WritingSubmission, db=Depends(get_db)):
    result = submit_writing(
        db,
        user_id=data.user_id,
        lesson_id=data.lesson_id,
        question_text=data.question_text,
        user_response=data.user_response,
    )
    db.commit()
    return result
