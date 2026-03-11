from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String, default="")
    hashed_password = Column(String)
    role = Column(String, default="student")  # student or coach
    avatar_color = Column(String, default="#0d9488")  # teal default
    created_at = Column(DateTime, default=datetime.utcnow)

    vocab_vault = relationship("VocabVault", back_populates="user")
    results = relationship("Result", back_populates="user")
    sent_messages = relationship("ChatMessage", foreign_keys="ChatMessage.sender_id", back_populates="sender")
    received_messages = relationship("ChatMessage", foreign_keys="ChatMessage.receiver_id", back_populates="receiver")
    teacher_questions = relationship("TeacherQuestion", back_populates="student")
    student_assignments = relationship("Assignment", foreign_keys="Assignment.student_id", back_populates="student")

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    chapter = Column(String, index=True)
    type = Column(String)
    content = Column(JSON)
    media_url = Column(String, nullable=True)

    questions = relationship("Question", back_populates="lesson", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="lesson", cascade="all, delete-orphan")
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

class VocabVault(Base):
    __tablename__ = "vocab_vault"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    word = Column(String, index=True)
    meaning = Column(String)
    ipa = Column(String)
    audio_url = Column(String, nullable=True)
    source_lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="vocab_vault")
    source_lesson = relationship("Lesson", back_populates="vocab_sources")

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

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    context = Column(String, nullable=True)  # e.g. "lesson:3" or "question:12"
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")

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

    coach = relationship("User", foreign_keys=[coach_id])
    student = relationship("User", foreign_keys=[student_id], back_populates="student_assignments")
    lesson = relationship("Lesson")
    result = relationship("Result")
