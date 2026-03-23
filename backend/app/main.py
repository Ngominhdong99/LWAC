from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from . import models
from .database import engine
from .routers import lessons, vocab, results, quiz, chat, auth, coach, upload, rewards

models.Base.metadata.create_all(bind=engine)

# ── Lightweight migrations for new columns on existing tables ──
from sqlalchemy import text, inspect as sa_inspect
try:
    with engine.connect() as conn:
        insp = sa_inspect(engine)
        if insp.has_table("users"):
            user_cols = [c["name"] for c in insp.get_columns("users")]
            if "last_active" not in user_cols:
                # PostgreSQL uses TIMESTAMP, SQLite uses DATETIME
                col_type = "TIMESTAMP" if "postgresql" in str(engine.url) else "DATETIME"
                conn.execute(text(f"ALTER TABLE users ADD COLUMN last_active {col_type}"))
                conn.commit()
except Exception as e:
    print(f"Migration note: {e}")

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
app.include_router(rewards.router)

# Mount static directory for audio playback
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return {"message": "Welcome to LWAC API"}
