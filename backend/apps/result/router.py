from fastapi import APIRouter, Depends
from core.security import get_current_user
from . import schemas as result_schemas
from . import api

router = APIRouter(
    prefix="/results",
    tags=["results"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route(
    "/{user_id}",
    api.read_results,
    methods=["GET"],
    response_model=list[result_schemas.ResultOut],
)
router.add_api_route(
    "/{user_id}",
    api.create_result_route,
    methods=["POST"],
    response_model=result_schemas.ResultOut,
)
router.add_api_route(
    "/{result_id}",
    api.update_result_route,
    methods=["PUT"],
    response_model=result_schemas.ResultOut,
)
