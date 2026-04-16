from fastapi import APIRouter, Depends

from core.security import get_current_user
from . import api

router = APIRouter(
    prefix="/upload",
    tags=["upload"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route("/audio", api.upload_audio, methods=["POST"])
router.add_api_route("/image", api.upload_image, methods=["POST"])
router.add_api_route("/video", api.upload_video, methods=["POST"])
router.add_api_route("/generate-tts", api.generate_tts_route, methods=["POST"])
