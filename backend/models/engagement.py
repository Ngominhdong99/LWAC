from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship

from base import Base


class DailyCheckIn(Base):
    __tablename__ = "daily_checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    check_date = Column(String, index=True)  # "YYYY-MM-DD"
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class DailyQuizActivity(Base):
    __tablename__ = "daily_quiz_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    quiz_date = Column(String, index=True)  # "YYYY-MM-DD"
    score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
