from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from . import models
from .database import engine
from .routers import lessons, vocab, results, quiz, chat, auth, coach, upload

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LWAC API", description="API for Learn With Amateur Coach Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(lessons.router)
app.include_router(vocab.router)
app.include_router(results.router)
app.include_router(quiz.router)
app.include_router(chat.router)
app.include_router(coach.router)
app.include_router(upload.router)

# Mount static directory for audio playback
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return {"message": "Welcome to LWAC API"}
