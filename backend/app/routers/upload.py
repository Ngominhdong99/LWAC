from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import shutil
import edge_tts
import re
from app.schemas import TTSRequest

router = APIRouter(prefix="/upload", tags=["upload"])

# Ensure upload directories exist
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
AUDIO_DIR = os.path.join(BASE_DIR, "static", "audio")
IMAGE_DIR = os.path.join(BASE_DIR, "static", "images")
VIDEO_DIR = os.path.join(BASE_DIR, "static", "videos")
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)
os.makedirs(VIDEO_DIR, exist_ok=True)


def _save_file(file: UploadFile, upload_dir: str, default_ext: str) -> str:
    file_extension = os.path.splitext(file.filename)[1] or default_ext
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        file.file.close()
    return unique_filename


@router.post("/audio")
async def upload_audio(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Only audio files are allowed")
    filename = _save_file(file, AUDIO_DIR, ".mp3")
    return {"url": f"/static/audio/{filename}"}


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    filename = _save_file(file, IMAGE_DIR, ".jpg")
    return {"url": f"/static/images/{filename}"}


@router.post("/video")
async def upload_video(file: UploadFile = File(...)):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are allowed")
    filename = _save_file(file, VIDEO_DIR, ".mp4")
    return {"url": f"/static/videos/{filename}"}


@router.post("/generate-tts")
async def generate_tts(request: TTSRequest):
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text is required")
        
    try:
        # Create a unique filename for the generated audio
        unique_filename = f"{uuid.uuid4()}.mp3"
        file_path = os.path.join(AUDIO_DIR, unique_filename)
        
        if request.dialogue_mode:
            lines = request.text.strip().split('\n')
            temp_files = []
            speaker_map = {}
            speaker_count = 0
            
            for index, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                
                # Check for "Speaker: Text" format
                match = re.match(r'^([^:]+):\s*(.*)$', line)
                if match:
                    speaker = match.group(1).strip()
                    spoken_text = match.group(2).strip()
                    
                    if speaker not in speaker_map:
                        fallback_voices = [
                            request.voice,
                            request.voice2 or "en-US-GuyNeural",
                            "en-GB-SoniaNeural",
                            "en-GB-RyanNeural",
                            "en-AU-NatashaNeural",
                            "en-AU-WilliamNeural"
                        ]
                        speaker_map[speaker] = fallback_voices[speaker_count % len(fallback_voices)]
                        speaker_count += 1
                        
                    current_voice = speaker_map[speaker]
                    text_to_speak = spoken_text
                else:
                    text_to_speak = line
                    current_voice = request.voice
                    
                if text_to_speak:
                    temp_file = os.path.join(AUDIO_DIR, f"temp_{uuid.uuid4()}_{index}.mp3")
                    communicate = edge_tts.Communicate(text_to_speak, current_voice)
                    await communicate.save(temp_file)
                    temp_files.append(temp_file)
            
            # Binary concatenation of the MP3 files
            if temp_files:
                with open(file_path, 'wb') as outfile:
                    for f in temp_files:
                        with open(f, 'rb') as infile:
                            outfile.write(infile.read())
                        os.remove(f)  # Cleanup temp files
            else:
                raise HTTPException(status_code=400, detail="No readable text found")
        else:
            # Standard single voice mode
            communicate = edge_tts.Communicate(request.text, request.voice)
            await communicate.save(file_path)
        
        return {"url": f"/static/audio/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

