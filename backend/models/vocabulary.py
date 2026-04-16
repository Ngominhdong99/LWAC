from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from base import Base


class VocabularyEntry(Base):
    __tablename__ = "vocabulary_entries"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, unique=True, index=True, nullable=False)
    meaning = Column(String, nullable=False)
    ipa = Column(String, nullable=True)
    part_of_speech = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
