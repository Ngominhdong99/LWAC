from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship

from base import Base


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
