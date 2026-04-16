from typing import Optional

from pydantic import BaseModel


class DailyQuizAttemptCreate(BaseModel):
    score: int


class DailyQuizQuestionsOut(BaseModel):
    completed: bool
    score: Optional[int] = None
    questions: list = []


class DailyQuizSubmitOut(BaseModel):
    msg: str
