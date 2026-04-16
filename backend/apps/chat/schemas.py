from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AIChatRequest(BaseModel):
    session_id: str = "default"
    message: str
    user_id: Optional[int] = None


class AIChatResponse(BaseModel):
    reply: str
    session_id: str


class AIChatMessageOut(BaseModel):
    id: int
    role: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SendMessageRequest(BaseModel):
    sender_id: int
    receiver_id: int
    message: str
    context: Optional[str] = None


class ChatMessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    message: str
    context: Optional[str] = None
    is_read: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AskTeacherRequest(BaseModel):
    student_id: int
    question_text: str
    context: Optional[str] = None
    question_id: Optional[int] = None
    lesson_id: Optional[int] = None


class TypingSignal(BaseModel):
    sender_id: int
    receiver_id: int


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
