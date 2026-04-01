from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import shutil

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
