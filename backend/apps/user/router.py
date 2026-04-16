from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.security import get_current_user
from database import get_db
from .schemas import UserOut, LoginResponse
from . import api

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ── Public routes (no auth) ──────────────────────────────────────
router.add_api_route(
    "/register", api.register, methods=["POST"], response_model=LoginResponse
)
router.add_api_route(
    "/login", api.login, methods=["POST"], response_model=LoginResponse
)
router.add_api_route(
    "/admin/setup",
    api.setup_admin,
    methods=["POST"],
    response_model=LoginResponse,
    summary="Bootstrap admin user (only works if no admin exists)",
)

@router.post("/token", summary="Swagger UI OAuth2 Login")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """
    Standard OAuth2 token endpoint strictly for Swagger UI (/docs) authentication.
    """
    user = api.authenticate_user(db, username=form_data.username, password=form_data.password)
    token = api.create_token(user.id, user.role)
    return {"access_token": token, "token_type": "bearer"}

# ── Protected routes (require valid token) ──────────────────────
router.add_api_route(
    "/users",
    api.list_users_route,
    methods=["GET"],
    dependencies=[Depends(get_current_user)],
)
router.add_api_route(
    "/me", api.get_me, methods=["GET"], response_model=UserOut
)
router.add_api_route(
    "/profile/{user_id}",
    api.update_profile,
    methods=["PUT"],
    response_model=UserOut,
    dependencies=[Depends(get_current_user)],
)
