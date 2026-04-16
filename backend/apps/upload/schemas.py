from typing import Optional
from pydantic import BaseModel


class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"
    dialogue_mode: bool = False
    voice2: Optional[str] = "en-US-GuyNeural"
