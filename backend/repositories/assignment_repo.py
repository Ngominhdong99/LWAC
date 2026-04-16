"""
AssignmentRepository — SQLAlchemy v2 queries for Assignment model.
"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .base import BaseRepository


class AssignmentRepository(BaseRepository):
    """Repository for Assignment model."""

    def __init__(self, session: Session) -> None:
        from models.coach import Assignment

        self.model = Assignment
        self.session = session

    def get_for_student(self, student_id: int) -> List:
        """List all assignments for a student, ordered by newest first."""
        from models.coach import Assignment

        stmt = (
            select(Assignment)
            .where(Assignment.student_id == student_id)
            .order_by(Assignment.created_at.desc())
        )
        return list(self.session.execute(stmt).scalars().all())

    def get_for_student_and_lesson(
        self, student_id: int, lesson_id: int
    ) -> Optional[object]:
        """Fetch a single assignment for (student, lesson) with result joined."""
        from models.coach import Assignment

        stmt = (
            select(Assignment)
            .where(
                Assignment.student_id == student_id,
                Assignment.lesson_id == lesson_id,
            )
        )
        return self.session.execute(stmt).scalars().first()
