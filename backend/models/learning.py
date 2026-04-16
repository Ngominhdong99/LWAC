from sqlalchemy import Column, ForeignKey, Integer, String, JSON, Text
from sqlalchemy.orm import relationship

from base import Base


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    chapter = Column(String, index=True)
    type = Column(String)
    content = Column(JSON)
    media_url = Column(String, nullable=True)

    questions = relationship(
        "Question", back_populates="lesson", cascade="all, delete-orphan"
    )
    results = relationship(
        "Result", back_populates="lesson", cascade="all, delete-orphan"
    )
    vocab_sources = relationship("VocabVault", back_populates="source_lesson")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    type = Column(String)
    question_text = Column(Text)
    options = Column(JSON, nullable=True)
    correct_answer = Column(String)

    lesson = relationship("Lesson", back_populates="questions")
