"""
Authentication Router — login, register, current user info.
Uses simple token-based auth (JWT).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from .. import models
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = "lwac-secret-key-change-in-production-2024"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Schemas ──────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str
    full_name: str = ""
    role: str = "student"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    avatar_color: str
    created_at: datetime

    class Config:
        orm_mode = True

class LoginResponse(BaseModel):
    token: str
    user: UserResponse


# ── Helpers ──────────────────────────────────────────────────────
def create_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str, db: Session) -> models.User:
    """Decode token and return the user."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Routes ───────────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_token(user.id, user.role)
    return LoginResponse(token=token, user=UserResponse(
        id=user.id,
        username=user.username,
        email=user.email or "",
        full_name=user.full_name or user.username,
        role=user.role,
        avatar_color=user.avatar_color or "#0d9488",
        created_at=user.created_at
    ))


@router.get("/me", response_model=UserResponse)
def get_me(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email or "",
        full_name=user.full_name or user.username,
        role=user.role,
        avatar_color=user.avatar_color or "#0d9488",
        created_at=user.created_at
    )
