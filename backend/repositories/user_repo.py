"""
UserRepository — SQLAlchemy v2 queries for User model.
"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .base import BaseRepository


class UserRepository(BaseRepository):
    """Repository for User model."""

    def __init__(self, session: Session) -> None:
        from models.user import User

        self.model = User
        self.session = session

    def get_by_username(self, username: str) -> Optional[object]:
        """Fetch user by username (unique)."""
        from models.user import User

        stmt = select(User).where(User.username == username)
        return self.session.execute(stmt).scalars().first()

    def get_by_ids_as_map(self, user_ids: List[int]) -> dict:
        """Batch fetch users by IDs → {user_id: User}. Single query."""
        if not user_ids:
            return {}
        from models.user import User

        stmt = select(User).where(User.id.in_(user_ids))
        rows = self.session.execute(stmt).scalars().all()
        return {r.id: r for r in rows}

    def list_students(self) -> List:
        """Return all users with role='student'."""
        from models.user import User

        stmt = select(User).where(User.role == "student")
        return list(self.session.execute(stmt).scalars().all())

    def list_all(self) -> List:
        from models.user import User

        stmt = select(User)
        return list(self.session.execute(stmt).scalars().all())
