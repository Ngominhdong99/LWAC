"""
ResultRepository — SQLAlchemy v2 queries for Result model.
"""

from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from .base import BaseRepository


class ResultRepository(BaseRepository):
    """Repository for Result model."""

    def __init__(self, session: Session) -> None:
        from models.result import Result

        self.model = Result
        self.session = session

    def get_with_lesson(self, result_id: int) -> Optional[object]:
        """Fetch result with lesson eagerly loaded (prevents lazy-load N+1)."""
        from models.result import Result

        stmt = (
            select(Result)
            .where(Result.id == result_id)
            .options(joinedload(Result.lesson))
        )
        return self.session.execute(stmt).scalars().first()

    def list_for_user(self, user_id: int, skip: int = 0, limit: int = 100) -> List:
        """List results for a user, with lesson eager loaded."""
        from models.result import Result

        stmt = (
            select(Result)
            .where(Result.user_id == user_id)
            .options(joinedload(Result.lesson))
            .order_by(Result.submitted_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(self.session.execute(stmt).scalars().all())

    def list_for_user_and_lessons(self, user_id: int, lesson_ids: List[int]) -> List:
        """Batch fetch results for a user filtered by lesson IDs. Single query."""
        if not lesson_ids:
            return []
        from models.result import Result

        stmt = select(Result).where(
            Result.user_id == user_id, Result.lesson_id.in_(lesson_ids)
        )
        return list(self.session.execute(stmt).scalars().all())

    def latest_by_lesson(
        self, user_id: int, lesson_ids: List[int]
    ) -> dict[int, object]:
        """
        Return the latest Result per lesson_id for a user.
        Single query + Python grouping — replaces N+1 loop over pairs.
        Returns: {lesson_id: Result}
        """
        results = self.list_for_user_and_lessons(user_id, lesson_ids)
        latest: dict[int, object] = {}
        for r in results:
            existing = latest.get(r.lesson_id)
            if existing is None or r.submitted_at > existing.submitted_at:
                latest[r.lesson_id] = r
        return latest

    def get_latest_for_lesson(self, user_id: int, lesson_id: int) -> Optional[object]:
        """Latest result for a specific user+lesson."""
        from models.result import Result

        stmt = (
            select(Result)
            .where(Result.user_id == user_id, Result.lesson_id == lesson_id)
            .order_by(Result.submitted_at.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalars().first()

    def count_and_avg_per_user(self, user_ids: List[int]) -> dict[int, dict]:
        """
        Single GROUP BY query for result stats.
        Returns: {user_id: {"count": int, "avg": float}}
        """
        if not user_ids:
            return {}
        from models.result import Result

        stmt = (
            select(
                Result.user_id,
                func.count(Result.id),
                func.avg(Result.score),
            )
            .where(Result.user_id.in_(user_ids))
            .group_by(Result.user_id)
        )
        rows = self.session.execute(stmt).all()
        return {
            row[0]: {
                "count": row[1],
                "avg": round(float(row[2]) if row[2] else 0.0, 1),
            }
            for row in rows
        }

    def get_for_assignment_check(
        self, user_id: int, lesson_id: int
    ) -> Optional[object]:
        """Check if a result already exists for this user+lesson."""
        from models.result import Result

        stmt = (
            select(Result)
            .where(Result.user_id == user_id, Result.lesson_id == lesson_id)
            .limit(1)
        )
        return self.session.execute(stmt).scalars().first()
