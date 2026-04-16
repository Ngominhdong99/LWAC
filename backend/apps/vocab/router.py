from fastapi import APIRouter, Depends, status
from core.security import get_current_user
from . import schemas as vocab_schemas
from . import api

router = APIRouter(
    prefix="/vocab",
    tags=["vocab"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route(
    "/{user_id}",
    api.read_vocab,
    methods=["GET"],
    response_model=list[vocab_schemas.VocabOut],
)
router.add_api_route(
    "/{user_id}",
    api.create_vocab_route,
    methods=["POST"],
    response_model=vocab_schemas.VocabOut,
)
router.add_api_route(
    "/{user_id}/bulk",
    api.bulk_import_vocab_route,
    methods=["POST"],
    response_model=list[vocab_schemas.VocabOut],
)
router.add_api_route(
    "/{vocab_id}",
    api.delete_vocab_route,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)
