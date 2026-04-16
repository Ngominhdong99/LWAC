from fastapi import APIRouter, Depends

from core.security import get_current_user
from . import api

router = APIRouter(
    prefix="/daily_quiz",
    tags=["daily_quiz"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route("/questions/{user_id}", api.get_daily_questions, methods=["GET"])
router.add_api_route("/submit", api.submit_daily_quiz_route, methods=["POST"])
