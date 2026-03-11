from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str
    role: str = "student"

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class QuestionBase(BaseModel):
    type: str
    question_text: str
    options: Optional[Dict[str, Any]] = None
    correct_answer: str
    
class QuestionResponse(QuestionBase):
    id: int
    lesson_id: int
    
    class Config:
        orm_mode = True

class LessonBase(BaseModel):
    title: str
    chapter: str
    type: str
    content: Dict[str, Any]
    media_url: Optional[str] = None

class LessonCreate(LessonBase):
    pass

class LessonResponse(LessonBase):
    id: int
    questions: List[QuestionResponse] = []
    
    class Config:
        orm_mode = True

class VocabVaultBase(BaseModel):
    word: str
    meaning: str
    ipa: str
    audio_url: Optional[str] = None
    source_lesson_id: Optional[int] = None

class VocabVaultCreate(VocabVaultBase):
    pass

class VocabVaultResponse(VocabVaultBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class ResultBase(BaseModel):
    lesson_id: int
    score: int
    responses: Dict[str, Any]

class ResultCreate(ResultBase):
    pass

class ResultUpdate(BaseModel):
    responses: Dict[str, Any]

class ResultResponse(ResultBase):
    id: int
    user_id: int
    submitted_at: datetime
    
    class Config:
        orm_mode = True

class AssignmentBase(BaseModel):
    coach_id: int
    student_id: int
    lesson_id: int
    status: str = "pending"

class AssignmentCreate(BaseModel):
    lesson_id: int

class AssignmentResponse(AssignmentBase):
    id: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    result_id: Optional[int] = None
    
    class Config:
        orm_mode = True
