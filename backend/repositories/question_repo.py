"""
QuestionRepository — SQLAlchemy v2 queries for Question model.
"""

from collections import defaultdict
from typing import List

from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from .base import BaseRepository


class QuestionRepository(BaseRepository):
    """Repository for Question model."""

    def __init__(self, session: Session) -> None:
        from models.learning import Question

        self.model = Question
        self.session = session

    def get_by_lesson(self, lesson_id: int) -> List:
        """Fetch all questions for a lesson."""
        stmt = select(self.model).where(self.model.lesson_id == lesson_id)
        return list(self.session.execute(stmt).scalars().all())

    def get_by_lessons_grouped(self, lesson_ids: List[int]) -> dict[int, list]:
        """
        Batch fetch all questions for multiple lessons.
        Returns {lesson_id: [Question, ...]} — single query, no N+1.
        """
        if not lesson_ids:
            return defaultdict(list)
        stmt = select(self.model).where(self.model.lesson_id.in_(lesson_ids))
        questions = self.session.execute(stmt).scalars().all()
        grouped: dict[int, list] = defaultdict(list)
        for q in questions:
            grouped[q.lesson_id].append(q)
        return grouped

    def delete_by_lesson(self, lesson_id: int) -> int:
        """Delete all questions for a lesson. Returns rowcount."""
        stmt = delete(self.model).where(self.model.lesson_id == lesson_id)
        result = self.session.execute(stmt)
        return result.rowcount

    def bulk_create(self, lesson_id: int, questions_data: List[dict]) -> List:
        """Bulk-insert questions for a lesson."""
        from models.learning import Question

        created = []
        for q_data in questions_data:
            q = Question(lesson_id=lesson_id, **q_data)
            self.session.add(q)
            created.append(q)
        return created
