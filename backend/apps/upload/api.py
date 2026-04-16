import os
import shutil
import uuid
from typing import Optional

from fastapi import File, UploadFile
from pydantic import BaseModel


# ... (at top of file, before the classes)


class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"
    dialogue_mode: bool = False
    voice2: Optional[str] = "en-US-GuyNeural"


UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "static",
)
AUDIO_DIR = os.path.join(UPLOAD_DIR, "audio")
IMAGE_DIR = os.path.join(UPLOAD_DIR, "images")
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
for d in (AUDIO_DIR, IMAGE_DIR, VIDEO_DIR):
    os.makedirs(d, exist_ok=True)


def save_audio(file):
    if not (file.content_type or "").startswith("audio/"):
        raise ValueError("Only audio files are allowed")
    fn = _save_file(file, AUDIO_DIR, ".mp3")
    return {"url": f"/static/audio/{fn}"}


def save_image(file):
    if not (file.content_type or "").startswith("image/"):
        raise ValueError("Only image files are allowed")
    fn = _save_file(file, IMAGE_DIR, ".jpg")
    return {"url": f"/static/images/{fn}"}


def save_video(file):
    if not (file.content_type or "").startswith("video/"):
        raise ValueError("Only video files are allowed")
    fn = _save_file(file, VIDEO_DIR, ".mp4")
    return {"url": f"/static/videos/{fn}"}


async def generate_tts(
    text, voice="en-US-AriaNeural", dialogue_mode=False, voice2="en-US-GuyNeural"
):
    import re

    import edge_tts

    if not text or not text.strip():
        raise ValueError("Text is required")
    unique_filename = f"{uuid.uuid4()}.mp3"
    file_path = os.path.join(AUDIO_DIR, unique_filename)

    if dialogue_mode:
        lines = text.strip().split("\n")
        temp_files = []
        speaker_map = {}
        speaker_count = 0
        for index, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            match = re.match(r"^([^:]+):\s*(.*)$", line)
            if match:
                speaker = match.group(1).strip()
                spoken_text = match.group(2).strip()
                if speaker not in speaker_map:
                    fallback_voices = [
                        voice,
                        voice2 or "en-US-GuyNeural",
                        "en-GB-SoniaNeural",
                        "en-GB-RyanNeural",
                    ]
                    speaker_map[speaker] = fallback_voices[
                        speaker_count % len(fallback_voices)
                    ]
                    speaker_count += 1
                current_voice = speaker_map[speaker]
            else:
                spoken_text = line
                current_voice = voice
            if spoken_text:
                tf = os.path.join(AUDIO_DIR, f"temp_{uuid.uuid4()}_{index}.mp3")
                comm = edge_tts.Communicate(spoken_text, current_voice)
                await comm.save(tf)
                temp_files.append(tf)
        if temp_files:
            with open(file_path, "wb") as out:
                for tf in temp_files:
                    with open(tf, "rb") as inp:
                        out.write(inp.read())
                    os.remove(tf)
        else:
            raise ValueError("No readable text found")
    else:
        comm = edge_tts.Communicate(text, voice)
        await comm.save(file_path)
    return {"url": f"/static/audio/{unique_filename}"}


def _save_file(file, upload_dir, default_ext):
    ext = os.path.splitext(file.filename)[1] or default_ext
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    file.file.close()
    return filename


async def upload_audio(file: UploadFile = File(...)):
    return save_audio(file)


async def upload_image(file: UploadFile = File(...)):
    return save_image(file)


async def upload_video(file: UploadFile = File(...)):
    return save_video(file)


async def generate_tts_route(request: TTSRequest):
    return await generate_tts(
        text=request.text,
        voice=request.voice,
        dialogue_mode=request.dialogue_mode,
        voice2=request.voice2,
    )
