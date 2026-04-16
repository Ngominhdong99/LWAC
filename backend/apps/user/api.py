from datetime import datetime, timedelta, UTC

from fastapi import Depends
from jose import jwt

from core.config import settings
from database import get_db
from exceptions import ConflictError, NotFoundError, UnauthorizedError
from models import User
from core.security import get_current_user
from .schemas import LoginRequest, UserCreate, UserOut, LoginResponse, ProfileUpdate


def register_user(db, username, password, email, full_name="", role="student"):
    from core.config import pwd_context

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise ConflictError(f"Username '{username}' already exists")
    user = User(
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=pwd_context.hash(password),
        role=role,
    )
    db.add(user)
    return user


def authenticate_user(db, username, password):
    from core.config import pwd_context

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise UnauthorizedError("Invalid username or password")
    if not pwd_context.verify(password, user.hashed_password):
        raise UnauthorizedError("Invalid username or password")
    return user


def get_user(db, user_id):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError("User not found")
    return user


def get_user_or_none(db, user_id):
    return db.query(User).filter(User.id == user_id).first()


def list_users(db):
    return db.query(User).all()


def student_list(db):
    return db.query(User).filter(User.role == "student").all()


def create_student(
    db, username, password, email="", full_name="", avatar_color="#0d9488"
):
    from core.config import pwd_context

    user = User(
        username=username,
        email=email,
        full_name=full_name or username,
        hashed_password=pwd_context.hash(password),
        role="student",
        avatar_color=avatar_color,
    )
    db.add(user)
    return user


def update_user(db, user_id, **kwargs):
    from core.config import pwd_context

    user = get_user(db, user_id)
    if "password" in kwargs and kwargs["password"]:
        user.hashed_password = pwd_context.hash(kwargs.pop("password"))
    for k, v in kwargs.items():
        if v is not None and hasattr(user, k):
            setattr(user, k, v)
    return user


def delete_user(db, user_id):
    user = get_user(db, user_id)
    db.delete(user)


def user_to_dict(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "full_name": user.full_name or user.username,
        "role": user.role,
        "avatar_color": user.avatar_color or "#0d9488",
    }


def create_token(user_id, role):
    return jwt.encode(
        {
            "sub": str(user_id),
            "role": role,
            "exp": datetime.now(UTC) + timedelta(days=30),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def decode_token(token):
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise UnauthorizedError("Invalid token")


def _user_out(user: User) -> UserOut:
    return UserOut(**user_to_dict(user), created_at=user.created_at)


def register(req: UserCreate, db=Depends(get_db)):
    user = register_user(
        db,
        username=req.username,
        password=req.password,
        email=req.email,
        full_name=req.full_name,
        role=req.role,
    )
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.role)
    return LoginResponse(token=token, user=_user_out(user))


def login(req: LoginRequest, db=Depends(get_db)):
    user = authenticate_user(db, username=req.username, password=req.password)
    token = create_token(user.id, user.role)
    return LoginResponse(token=token, user=_user_out(user))


def list_users_route(db=Depends(get_db)):
    users = list_users(db)
    return [user_to_dict(user) for user in users]


def get_me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)


def update_profile(user_id: int, req: ProfileUpdate, db=Depends(get_db)):
    update_user(
        db,
        user_id,
        full_name=req.full_name,
        email=req.email,
        avatar_color=req.avatar_color,
        password=req.password,
    )
    db.commit()
    return _user_out(get_user(db, user_id))


def setup_admin(req: UserCreate, db=Depends(get_db)):
    """Bootstrap an admin user. Only works when no admin exists yet."""
    existing_admin = db.query(User).filter(User.role == "admin").first()
    if existing_admin:
        raise ConflictError("Admin user already exists. Use login instead.")
    user = register_user(
        db,
        username=req.username,
        password=req.password,
        email=req.email,
        full_name=req.full_name or req.username,
        role="admin",
    )
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.role)
    return LoginResponse(token=token, user=_user_out(user))

