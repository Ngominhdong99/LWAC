import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from apps.chat.router import router as chat_router
from apps.coach.router import router as coach_router
from apps.dailyquiz.router import router as daily_quiz_router
from apps.lesson.router import router as lesson_router
from apps.quiz.router import router as quiz_router
from apps.result.router import router as result_router
from apps.reward.router import router as reward_router
from apps.upload.router import router as upload_router
from apps.user.router import router as user_router
from apps.vocab.router import router as vocab_router
from exceptions import (
    NotFoundError,
    ConflictError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    ServiceError,
)

from core.config import settings

app = FastAPI(title="LWAC API", description="API for Learn With Amateur Coach Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.PLATFORM_URL],
    allow_credentials=True,    
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global Exception Handlers ────────────────────────────────────


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": exc.message})


@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=400, content={"detail": exc.message})


@app.exception_handler(UnauthorizedError)
async def unauthorized_handler(request: Request, exc: UnauthorizedError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": exc.message})


@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, exc: ServiceError):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Routes ───────────────────────────────────────────────────────
app.include_router(chat_router)
app.include_router(coach_router)
app.include_router(daily_quiz_router)
app.include_router(lesson_router)
app.include_router(quiz_router)
app.include_router(result_router)
app.include_router(reward_router)
app.include_router(upload_router)
app.include_router(user_router)
app.include_router(vocab_router)

# Mount static directory for serving uploaded files (QR, audio, images, etc.)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
def read_root():
    return {"message": "Welcome to LWAC API"}
