from typing import Dict, Any
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ResultCreate(BaseModel):
    lesson_id: int
    score: int
    responses: Dict[str, Any]


class ResultOut(BaseModel):
    id: int
    user_id: int
    lesson_id: int
    score: int
    responses: Dict[str, Any]
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResultUpdate(BaseModel):
    responses: Dict[str, Any]
