from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import shutil

router = APIRouter(prefix="/upload", tags=["upload"])

# Ensure the upload directory exists relative to this file
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "audio")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/audio")
async def upload_audio(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Only audio files are allowed")

    # Generate a unique filename to prevent overwrites
    file_extension = os.path.splitext(file.filename)[1]
    if not file_extension:
        file_extension = ".mp3" # default 
    
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        file.file.close()

    # Return the URL path that can be mapped via StaticFiles
    return {"url": f"http://127.0.0.1:8000/static/audio/{unique_filename}"}
