"""
RewardRepository — SQLAlchemy v2 queries for RewardPoint and RewardRequest.
Fixes N+1 in get_points_history and get_all_requests.
"""

from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session


class RewardRepository:
    """Repository for RewardPoint and RewardRequest models."""

    def __init__(self, session: Session) -> None:
        self.session = session

    # ── RewardPoint ───────────────────────────────────────────────

    def total_earned(self, user_id: int) -> int:
        from models.reward import RewardPoint

        stmt = select(func.sum(RewardPoint.points)).where(
            RewardPoint.user_id == user_id
        )
        return self.session.execute(stmt).scalar() or 0

    def list_points_for_user(self, user_id: int) -> List:
        """Fetch all reward points for a user, newest first."""
        from models.reward import RewardPoint

        stmt = (
            select(RewardPoint)
            .where(RewardPoint.user_id == user_id)
            .order_by(RewardPoint.created_at.desc())
        )
        return list(self.session.execute(stmt).scalars().all())

    def get_point_by_result(self, result_id: int) -> Optional[object]:
        from models.reward import RewardPoint

        stmt = select(RewardPoint).where(RewardPoint.result_id == result_id)
        return self.session.execute(stmt).scalars().first()

    def get_existing_reward(self, user_id: int, lesson_id: int) -> Optional[object]:
        from models.reward import RewardPoint

        stmt = select(RewardPoint).where(
            RewardPoint.user_id == user_id,
            RewardPoint.lesson_id == lesson_id,
        )
        return self.session.execute(stmt).scalars().first()

    def points_history_with_lessons(self, user_id: int) -> List[dict]:
        """
        Fetch point history WITH lesson titles — 2 queries total, no N+1.

        Previous code did: for p in points: db.query(Lesson).filter(id==p.lesson_id).first()
        This version: 1 query for all points + 1 batch query for all lessons.
        """
        from models.learning import Lesson

        # Query 1: all points for user
        points = self.list_points_for_user(user_id)
        if not points:
            return []

        # Query 2: batch fetch all referenced lessons
        lesson_ids = list({p.lesson_id for p in points if p.lesson_id})
        lessons_map: dict = {}
        if lesson_ids:
            stmt = select(Lesson).where(Lesson.id.in_(lesson_ids))
            lessons_map = {
                lesson.id: lesson
                for lesson in self.session.execute(stmt).scalars().all()
            }

        result = []
        for p in points:
            lesson = lessons_map.get(p.lesson_id) if p.lesson_id else None
            result.append(
                {
                    "id": p.id,
                    "points": p.points,
                    "reason": p.reason,
                    "lesson_title": lesson.title if lesson else "Unknown",
                    "lesson_type": lesson.type if lesson else "",
                    "created_at": p.created_at.isoformat(),
                }
            )
        return result

    # ── RewardRequest ─────────────────────────────────────────────

    def total_redeemed(self, user_id: int) -> int:
        from models.reward import RewardRequest

        stmt = select(func.sum(RewardRequest.points)).where(
            RewardRequest.user_id == user_id,
            RewardRequest.status.in_(["pending", "completed"]),
        )
        return self.session.execute(stmt).scalar() or 0

    def get_requests_for_user(self, user_id: int) -> List:
        from models.reward import RewardRequest

        stmt = (
            select(RewardRequest)
            .where(RewardRequest.user_id == user_id)
            .order_by(RewardRequest.created_at.desc())
        )
        return list(self.session.execute(stmt).scalars().all())

    def get_request(self, request_id: int) -> Optional[object]:
        from models.reward import RewardRequest

        stmt = select(RewardRequest).where(RewardRequest.id == request_id)
        return self.session.execute(stmt).scalars().first()

    def list_all_requests_with_users(self) -> List[dict]:
        """
        Fetch all reward requests WITH user info — 2 queries, no N+1.

        Previous code did: for r in requests: db.query(User).filter(id==r.user_id).first()
        This version: 1 query for requests + 1 batch query for users.
        """
        from models.reward import RewardRequest
        from models.user import User

        # Query 1: all requests
        stmt = select(RewardRequest).order_by(RewardRequest.created_at.desc())
        requests = list(self.session.execute(stmt).scalars().all())
        if not requests:
            return []

        # Query 2: batch fetch all referenced users
        user_ids = list({r.user_id for r in requests})
        users_stmt = select(User).where(User.id.in_(user_ids))
        users_map = {u.id: u for u in self.session.execute(users_stmt).scalars().all()}

        result = []
        for r in requests:
            user = users_map.get(r.user_id)
            result.append(
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "username": user.username if user else "Unknown",
                    "full_name": user.full_name if user else "Unknown",
                    "avatar_color": user.avatar_color if user else "#0d9488",
                    "points": r.points,
                    "status": r.status,
                    "qr_image_url": r.qr_image_url,
                    "created_at": r.created_at.isoformat(),
                    "completed_at": (
                        r.completed_at.isoformat() if r.completed_at else None
                    ),
                }
            )
        return result

    def get_latest_qr(self, user_id: int) -> Optional[object]:
        from models.reward import RewardRequest

        stmt = (
            select(RewardRequest)
            .where(
                RewardRequest.user_id == user_id,
                RewardRequest.qr_image_url.isnot(None),
            )
            .order_by(RewardRequest.created_at.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalars().first()
