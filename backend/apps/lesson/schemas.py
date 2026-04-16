from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class LessonCreate(BaseModel):
    title: str
    chapter: str
    type: str
    content: Optional[Dict[str, Any]] = None
    media_url: Optional[str] = None


class LessonUpdate(BaseModel):
    title: str
    chapter: str
    content: Optional[Dict[str, Any]] = None
    media_url: Optional[str] = None


class LessonOut(BaseModel):
    id: int
    title: str
    chapter: str
    type: str
    content: Optional[Dict[str, Any]] = None
    media_url: Optional[str] = None
    questions: List["QuestionOut"] = []

    model_config = ConfigDict(from_attributes=True)


class QuestionCreate(BaseModel):
    type: str
    question_text: str
    options: Optional[Dict[str, Any]] = None
    correct_answer: str


class QuestionOut(BaseModel):
    id: int
    lesson_id: int
    type: str
    question_text: str
    options: Optional[Dict[str, Any]] = None
    correct_answer: str

    model_config = ConfigDict(from_attributes=True)
