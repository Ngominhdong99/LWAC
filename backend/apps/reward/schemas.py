from typing import Optional

from pydantic import BaseModel


class CheckInStatus(BaseModel):
    checked_today: bool
    streak: int
    total_checkins: int
    last_7_days: list


class PointsSummary(BaseModel):
    total_earned: int
    total_redeemed: int
    balance: int


class PointsHistoryOut(BaseModel):
    id: int
    points: int
    reason: str
    lesson_title: str
    lesson_type: str
    created_at: str


class RewardRequestOut(BaseModel):
    id: int
    user_id: int
    username: str
    full_name: str
    avatar_color: str
    points: int
    status: str
    qr_image_url: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
