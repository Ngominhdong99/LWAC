from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship

from base import Base


class RewardPoint(Base):
    __tablename__ = "reward_points"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    result_id = Column(Integer, ForeignKey("results.id"), nullable=True)
    points = Column(Integer, default=0)
    reason = Column(String)  # e.g. "3 correct answers in Reading", "Writing submission"
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    result = relationship("Result")


class RewardRequest(Base):
    __tablename__ = "reward_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    points = Column(Integer, default=100)
    status = Column(String, default="pending")  # pending, completed
    qr_image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


