from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship

from base import Base


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
    last_active = Column(DateTime, nullable=True)  # online presence tracking

    vocab_vault = relationship("VocabVault", back_populates="user")
    results = relationship("Result", back_populates="user")
    sent_messages = relationship(
        "ChatMessage", foreign_keys="ChatMessage.sender_id", back_populates="sender"
    )
    received_messages = relationship(
        "ChatMessage", foreign_keys="ChatMessage.receiver_id", back_populates="receiver"
    )
    teacher_questions = relationship("TeacherQuestion", back_populates="student")
    student_assignments = relationship(
        "Assignment", foreign_keys="Assignment.student_id", back_populates="student"
    )
