"""
LessonRepository — SQLAlchemy v2 queries for Lesson model.
"""

from typing import List

from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from .base import BaseRepository
from models.learning import Lesson


class LessonRepository(BaseRepository):
    """Repository for Lesson model with eager-load helpers."""

    model = Lesson

    def __init__(self, session: Session) -> None:
        super().__init__(session)

    # ── Batch helpers to prevent N+1 ─────────────────────────────

    def get_by_ids_as_map(self, lesson_ids: List[int]) -> dict:
        """Single query: fetch lessons by IDs → {lesson_id: Lesson}."""
        if not lesson_ids:
            return {}
        stmt = select(self.model).where(self.model.id.in_(lesson_ids))
        rows = self.session.execute(stmt).scalars().all()
        return {r.id: r for r in rows}

    def count_questions_per_lesson(self, lesson_ids: List[int]) -> dict[int, int]:
        """Single GROUP BY query: {lesson_id: question_count}."""
        if not lesson_ids:
            return {}
        from models.learning import Question

        stmt = (
            select(Question.lesson_id, func.count(Question.id))
            .where(Question.lesson_id.in_(lesson_ids))
            .group_by(Question.lesson_id)
        )
        rows = self.session.execute(stmt).all()
        return {row[0]: row[1] for row in rows}

    def list_with_question_counts(self) -> List[dict]:
        """
        Returns all lessons with their question counts in 2 queries total.
        Prevents N+1 when building lesson library views.
        """
        from models.learning import Lesson

        lessons = list(self.session.execute(select(Lesson)).scalars().all())
        if not lessons:
            return []
        lesson_ids = [lesson.id for lesson in lessons]
        q_counts = self.count_questions_per_lesson(lesson_ids)
        return [
            {
                "id": lesson.id,
                "title": lesson.title,
                "chapter": lesson.chapter,
                "type": lesson.type,
                "question_count": q_counts.get(lesson.id, 0),
            }
            for lesson in lessons
        ]

    def list_paginated(self, skip: int = 0, limit: int = 100):
        from models.learning import Lesson

        stmt = (
            select(Lesson)
            .options(joinedload(Lesson.questions))
            .offset(skip)
            .limit(limit)
        )
        return list(self.session.execute(stmt).unique().scalars().all())

    def get(self, entity_id: int):
        """Override base get to eagerly load questions."""
        stmt = (
            select(self.model)
            .options(joinedload(self.model.questions))
            .where(self.model.id == entity_id)
        )
        return self.session.execute(stmt).unique().scalars().first()
