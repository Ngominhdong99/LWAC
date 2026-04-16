"""
Lesson module API — uses LessonRepository and QuestionRepository (SQLAlchemy v2).
"""

from typing import Any

from fastapi import Body, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from exceptions import NotFoundError
from repositories import LessonRepository, QuestionRepository

from . import schemas as lesson_schemas


def list_lessons(db: Session, *, skip: int = 0, limit: int = 100):
    repo = LessonRepository(db)
    return repo.list_paginated(skip=skip, limit=limit)


def get_lesson(db: Session, lesson_id: int):
    repo = LessonRepository(db)
    lesson = repo.get(lesson_id)
    if not lesson:
        raise NotFoundError(f"Lesson {lesson_id} not found")
    return lesson


def create_lesson(
    db: Session,
    *,
    title: str,
    chapter: str,
    type_: str,
    content: dict = None,
    media_url: str = None,
):
    from models.learning import Lesson

    lesson = Lesson(
        title=title,
        chapter=chapter,
        type=type_,
        content=content,
        media_url=media_url,
    )
    db.add(lesson)
    return lesson


def update_lesson(
    db: Session,
    lesson_id: int,
    *,
    title: str,
    chapter: str,
    content=None,
    media_url=None,
):
    lesson = get_lesson(db, lesson_id)
    lesson.title = title
    lesson.chapter = chapter
    if content is not None:
        lesson.content = content
    if media_url is not None:
        lesson.media_url = media_url
    return lesson


def delete_lesson(db: Session, lesson_id: int) -> None:
    """Delete lesson with manual cascade cleanup for SQLite."""
    from sqlalchemy import select, delete
    from models.result import Result
    from models.reward import RewardPoint
    from models.coach import Assignment, TeacherQuestion
    from models.vocab import VocabVault

    lesson = get_lesson(db, lesson_id)

    # Fetch result IDs in one query, then batch delete reward points
    result_ids_stmt = select(Result.id).where(Result.lesson_id == lesson_id)
    result_ids = [row[0] for row in db.execute(result_ids_stmt).all()]
    if result_ids:
        db.execute(delete(RewardPoint).where(RewardPoint.result_id.in_(result_ids)))
    db.execute(delete(RewardPoint).where(RewardPoint.lesson_id == lesson_id))
    db.execute(delete(Assignment).where(Assignment.lesson_id == lesson_id))
    db.execute(delete(TeacherQuestion).where(TeacherQuestion.lesson_id == lesson_id))
    db.execute(
        delete(VocabVault).where(VocabVault.source_lesson_id == lesson_id)
        # SQLAlchemy v2 update via execute for null-out
    )
    # Null out the FK on VocabVault (can't use delete; need update)
    from sqlalchemy import update

    db.execute(
        update(VocabVault)
        .where(VocabVault.source_lesson_id == lesson_id)
        .values(source_lesson_id=None)
    )

    db.delete(lesson)


def create_questions_bulk(db: Session, lesson_id: int, questions_data: list) -> list:
    """Create questions for a lesson. Verifies lesson exists first."""
    get_lesson(db, lesson_id)
    repo = QuestionRepository(db)
    return repo.bulk_create(lesson_id, questions_data)


def update_questions_bulk(db: Session, lesson_id: int, questions_data: list) -> list:
    """Replace all questions for a lesson (DELETE + INSERT pattern)."""
    get_lesson(db, lesson_id)
    repo = QuestionRepository(db)
    repo.delete_by_lesson(lesson_id)
    return repo.bulk_create(lesson_id, questions_data)


class LessonUpdate(BaseModel):
    title: str
    chapter: str
    content: dict[str, Any] | None = None
    media_url: str | None = None


def read_lessons(skip: int = 0, limit: int = 100, db=Depends(get_db)):
    return list_lessons(db, skip=skip, limit=limit)


def read_lesson(lesson_id: int, db=Depends(get_db)):
    return get_lesson(db, lesson_id)


def create_lesson_route(data: lesson_schemas.LessonCreate, db=Depends(get_db)):
    lesson = create_lesson(
        db,
        title=data.title,
        chapter=data.chapter,
        type_=data.type,
        content=data.content,
        media_url=data.media_url,
    )
    db.commit()
    db.refresh(lesson)
    return lesson


def create_questions_bulk_route(
    lesson_id: int,
    questions: list[lesson_schemas.QuestionCreate] = Body(...),
    db=Depends(get_db),
):
    created = create_questions_bulk(
        db, lesson_id, [question.model_dump() for question in questions]
    )
    db.commit()
    for question in created:
        db.refresh(question)
    return created


def update_lesson_route(lesson_id: int, data: LessonUpdate, db=Depends(get_db)):
    update_lesson(
        db,
        lesson_id,
        title=data.title,
        chapter=data.chapter,
        content=data.content,
        media_url=data.media_url,
    )
    db.commit()
    return get_lesson(db, lesson_id)


def delete_lesson_route(lesson_id: int, db=Depends(get_db)):
    delete_lesson(db, lesson_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def get_questions_route(lesson_id: int, db=Depends(get_db)):
    """GET /lessons/{lesson_id}/questions — return questions for a lesson."""
    get_lesson(db, lesson_id)  # verify lesson exists
    repo = QuestionRepository(db)
    return repo.get_by_lesson(lesson_id)


def update_questions_bulk_route(
    lesson_id: int,
    questions: list[lesson_schemas.QuestionCreate] = Body(...),
    db=Depends(get_db),
):
    """PUT /lessons/{lesson_id}/questions — replace all questions for a lesson."""
    updated = update_questions_bulk(
        db, lesson_id, [question.model_dump() for question in questions]
    )
    db.commit()
    for question in updated:
        db.refresh(question)
    return updated
