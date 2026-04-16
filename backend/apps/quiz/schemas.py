from pydantic import BaseModel


class WritingSubmission(BaseModel):
    user_id: int
    lesson_id: int
    question_text: str
    user_response: str
