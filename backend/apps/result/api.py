"""
Result module API — uses ResultRepository (SQLAlchemy v2) to prevent N+1 queries.
"""

from datetime import datetime, UTC

from fastapi import Depends
from sqlalchemy.orm import Session

from database import get_db
from exceptions import NotFoundError, ValidationError
from repositories import ResultRepository, AssignmentRepository

from . import schemas as result_schemas


def list_results(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """Fetch results with lesson eagerly loaded (no lazy-load N+1)."""
    repo = ResultRepository(db)
    return repo.list_for_user(user_id, skip=skip, limit=limit)


def create_result(
    db: Session, user_id: int, lesson_id: int, score: int, responses: dict
):
    """
    Create a result for a user on a lesson.
    All prerequisite data is pre-fetched in dedicated queries — no N+1.
    """
    from models.user import User
    from models.learning import Lesson, Question
    from models.result import Result
    from sqlalchemy import select

    result_repo = ResultRepository(db)
    assignment_repo = AssignmentRepository(db)

    # Fetch user
    user = db.execute(select(User).where(User.id == user_id)).scalars().first()
    if not user:
        raise NotFoundError("User not found")

    # Fetch lesson
    lesson = db.execute(select(Lesson).where(Lesson.id == lesson_id)).scalars().first()
    if not lesson:
        raise NotFoundError("Lesson not found")

    # Fetch assignment (with result pre-joined)
    assignment = assignment_repo.get_for_student_and_lesson(user_id, lesson_id)

    # Check for existing result
    existing_result = result_repo.get_for_assignment_check(user_id, lesson_id)

    # Fetch questions in one query
    questions_stmt = select(Question).where(Question.lesson_id == lesson_id)
    questions = list(db.execute(questions_stmt).scalars().all())

    # Fetch existing reward to avoid double-awarding
    from repositories import RewardRepository

    reward_repo = RewardRepository(db)
    existing_reward = reward_repo.get_existing_reward(user_id, lesson_id)

    # Business logic
    if assignment:
        if assignment.status == "completed" and not assignment.allow_retake:
            raise ValidationError("Assignment already completed")
        assignment.status = "completed"
        assignment.completed_at = datetime.now(UTC)
        if existing_result:
            raise ValidationError("Already completed")
    else:
        if existing_result:
            raise ValidationError("Already completed")

    result = Result(
        user_id=user_id,
        lesson_id=lesson_id,
        score=score,
        responses=responses,
    )
    db.add(result)
    db.flush()  # Get result.id before awarding points

    _award_points(
        db,
        user_id,
        lesson_id,
        result,
        lesson,
        questions,
        existing_reward,
        score,
        responses,
    )

    if assignment:
        assignment.result_id = result.id

    return result


def update_result(db: Session, result_id: int, responses: dict):
    repo = ResultRepository(db)
    result = repo.get_with_lesson(result_id)
    if not result:
        raise NotFoundError("Result not found")
    result.responses = responses
    _update_points_from_responses(db, result)
    return result


def get_result(db: Session, result_id: int):
    repo = ResultRepository(db)
    r = repo.get_with_lesson(result_id)
    if not r:
        raise NotFoundError("Result not found")
    return r


# ── Internal helpers ──────────────────────────────────────────────


def _award_points(
    db, user_id, lesson_id, result, lesson, questions, existing_reward, score, responses
):
    from models.reward import RewardPoint

    if lesson.type not in ("reading", "listening"):
        return

    correct = 0
    resp = responses if isinstance(responses, dict) else {}

    for q in questions:
        ans = resp.get(str(q.id))
        if not ans:
            continue
        if q.type == "multiple_choice":
            if ans.strip().lower() == (q.correct_answer or "").strip().lower():
                correct += 1
        elif q.type in ("fill_blank", "written_answer"):
            if _check_answer(ans, q.correct_answer):
                correct += 1

    points = correct if lesson.type == "reading" else correct * 2
    if points > 0 and not existing_reward:
        rp = RewardPoint(
            user_id=user_id,
            lesson_id=lesson_id,
            result_id=result.id,
            points=points,
            reason=f"{correct} correct in {lesson.type}",
        )
        db.add(rp)


def _update_points_from_responses(db, result):
    from repositories import RewardRepository
    from models.reward import RewardPoint

    lesson = result.lesson
    if lesson.type not in ("writing", "speaking"):
        return

    responses = result.responses or {}
    score_val = responses.get("score")
    if score_val is None:
        return

    try:
        score = float(score_val)
        points = 0
        reason = ""

        if lesson.type == "writing" and score > 5:
            points = 5
            reason = f"Writing score ({score}) > 5"
        elif lesson.type == "speaking" and score > 0:
            points = int(score)
            reason = f"Speaking score: {score}"

        if points > 0:
            repo = RewardRepository(db)
            rp = repo.get_point_by_result(result.id)
            if rp:
                rp.points = points
                rp.reason = reason
            else:
                rp = RewardPoint(
                    user_id=result.user_id,
                    lesson_id=lesson.id,
                    result_id=result.id,
                    points=points,
                    reason=reason,
                )
                db.add(rp)
    except (ValueError, TypeError):
        pass


def _check_answer(user_answer: str, correct_answer: str) -> bool:
    trimmed = (user_answer or "").strip().lower()
    if not trimmed:
        return False
    accepted = [a.strip().lower() for a in (correct_answer or "").split("|")]
    return trimmed in accepted


def read_results(user_id: int, skip: int = 0, limit: int = 100, db=Depends(get_db)):
    return list_results(db, user_id, skip=skip, limit=limit)


def create_result_route(
    user_id: int, data: result_schemas.ResultCreate, db=Depends(get_db)
):
    result = create_result(db, user_id, data.lesson_id, data.score, data.responses)
    db.commit()
    db.refresh(result)
    return result


def update_result_route(
    result_id: int, data: result_schemas.ResultUpdate, db=Depends(get_db)
):
    result = update_result(db, result_id, data.responses)
    db.commit()
    db.refresh(result)
    return result
