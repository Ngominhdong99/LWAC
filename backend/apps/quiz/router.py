from fastapi import APIRouter, Depends

from core.security import get_current_user
from . import api

router = APIRouter(
    prefix="/quiz",
    tags=["Quiz"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route("/submit/writing", api.submit_writing_route, methods=["POST"])
