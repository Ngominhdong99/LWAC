from datetime import datetime

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship

from base import Base


class TeacherQuestion(Base):
    __tablename__ = "teacher_questions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    question_text = Column(Text)  # What the student is asking
    context = Column(Text, nullable=True)  # The original question/passage text
    status = Column(String, default="pending")  # pending, answered
    answer = Column(Text, nullable=True)  # Coach's answer
    created_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)

    student = relationship("User", back_populates="teacher_questions")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("users.id"))
    student_id = Column(Integer, ForeignKey("users.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    status = Column(String, default="pending")  # pending, completed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    result_id = Column(Integer, ForeignKey("results.id"), nullable=True)
    allow_retake = Column(Boolean, default=False)

    coach = relationship("User", foreign_keys=[coach_id])
    student = relationship(
        "User", foreign_keys=[student_id], back_populates="student_assignments"
    )
    lesson = relationship("Lesson")
