from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer, DateTime, JSON
from sqlalchemy.orm import relationship

from base import Base


class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    score = Column(Integer)
    responses = Column(JSON)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="results")
    lesson = relationship("Lesson", back_populates="results")
