from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class VocabCreate(BaseModel):
    word: str
    meaning: str
    ipa: str
    audio_url: Optional[str] = None
    source_lesson_id: Optional[int] = None


class VocabOut(BaseModel):
    id: int
    user_id: int
    word: str
    meaning: str
    ipa: str
    audio_url: Optional[str] = None
    source_lesson_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
