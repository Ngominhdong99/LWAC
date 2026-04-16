from fastapi import APIRouter, Depends

from core.security import get_current_user
from . import api

router = APIRouter(
    prefix="/rewards",
    tags=["rewards"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route("/total/{user_id}", api.get_total_points, methods=["GET"])
# FE calls /rewards/points/{user_id}
router.add_api_route("/points/{user_id}", api.get_total_points, methods=["GET"])
router.add_api_route(
    "/history/{user_id}", api.get_points_history_route, methods=["GET"]
)
router.add_api_route("/qr/{user_id}", api.upload_qr, methods=["POST"])
router.add_api_route("/qr/{user_id}", api.get_qr, methods=["GET"])
router.add_api_route("/redeem/{user_id}", api.redeem_points_route, methods=["POST"])
router.add_api_route("/requests", api.get_all_requests_route, methods=["GET"])
# FE uses PUT for complete
router.add_api_route(
    "/requests/{request_id}/complete", api.complete_request_route, methods=["POST", "PUT"]
)
# FE calls /rewards/my-requests/{user_id}
router.add_api_route("/my-requests/{user_id}", api.get_my_requests_route, methods=["GET"])
router.add_api_route("/requests/{user_id}", api.get_my_requests_route, methods=["GET"])
router.add_api_route(
    "/daily-checkin/{user_id}", api.daily_checkin_route, methods=["POST"]
)
router.add_api_route(
    "/daily-checkin/status/{user_id}", api.get_checkin_status_route, methods=["GET"]
)
# FE calls /rewards/checkin/{user_id} for both GET (status) and POST (do checkin)
router.add_api_route(
    "/checkin/{user_id}", api.get_checkin_status_route, methods=["GET"]
)
router.add_api_route(
    "/checkin/{user_id}", api.daily_checkin_route, methods=["POST"]
)
