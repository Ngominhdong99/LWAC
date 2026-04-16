"""
Repository layer — SQLAlchemy v2 style.
All DB access goes through repositories; no raw db.query() outside this layer.
"""

from .base import BaseRepository
from .lesson_repo import LessonRepository
from .question_repo import QuestionRepository
from .user_repo import UserRepository
from .result_repo import ResultRepository
from .assignment_repo import AssignmentRepository
from .reward_repo import RewardRepository

__all__ = [
    "BaseRepository",
    "LessonRepository",
    "QuestionRepository",
    "UserRepository",
    "ResultRepository",
    "AssignmentRepository",
    "RewardRepository",
]
