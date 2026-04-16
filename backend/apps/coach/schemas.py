from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class StudentCreate(BaseModel):
    username: str
    password: str
    email: str = ""
    full_name: str = ""


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class StudentOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    avatar_color: str
    created_at: datetime
    tests_completed: int = 0
    avg_score: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class ResultOut(BaseModel):
    id: int
    lesson_id: int
    lesson_title: str = ""
    lesson_type: str = ""
    score: int
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeacherQuestionOut(BaseModel):
    id: int
    student_id: int
    student_name: str = ""
    question_text: str
    context: Optional[str] = None
    lesson_id: Optional[int] = None
    status: str
    answer: Optional[str] = None
    created_at: datetime
    answered_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AnswerRequest(BaseModel):
    answer: str


class AssignRequest(BaseModel):
    lesson_id: int


class AssignmentOut(BaseModel):
    id: int
    lesson_id: int
    lesson_title: str = ""
    lesson_chapter: str = ""
    lesson_type: str = ""
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    score: Optional[int] = None
    result_id: Optional[int] = None
    allow_retake: bool = False

    model_config = ConfigDict(from_attributes=True)


class AIExplainRequest(BaseModel):
    passage: str
    question_text: str
    options: Optional[dict] = None
    correct_answer: str


class AIGeneratePassageRequest(BaseModel):
    description: str
    lesson_type: str = "reading"
    level: str = "intermediate"


class AIParseQuestionsRequest(BaseModel):
    raw_text: str


class LibraryItem(BaseModel):
    id: int
    title: str
    chapter: str
    type: str
    question_count: int
