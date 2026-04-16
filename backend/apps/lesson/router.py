from fastapi import APIRouter, Depends, status
from core.security import get_current_user
from . import schemas as lesson_schemas
from . import api

router = APIRouter(
    prefix="/lessons",
    tags=["lessons"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route(
    "/",
    api.read_lessons,
    methods=["GET"],
    response_model=list[lesson_schemas.LessonOut],
)
router.add_api_route(
    "/{lesson_id}",
    api.read_lesson,
    methods=["GET"],
    response_model=lesson_schemas.LessonOut,
)
router.add_api_route(
    "/",
    api.create_lesson_route,
    methods=["POST"],
    response_model=lesson_schemas.LessonOut,
)
router.add_api_route(
    "/{lesson_id}/questions/bulk",
    api.create_questions_bulk_route,
    methods=["POST"],
    response_model=list[lesson_schemas.QuestionOut],
)
router.add_api_route(
    "/{lesson_id}/questions",
    api.get_questions_route,
    methods=["GET"],
    response_model=list[lesson_schemas.QuestionOut],
)
router.add_api_route(
    "/{lesson_id}/questions",
    api.update_questions_bulk_route,
    methods=["PUT"],
    response_model=list[lesson_schemas.QuestionOut],
)
router.add_api_route(
    "/{lesson_id}",
    api.update_lesson_route,
    methods=["PUT"],
    response_model=lesson_schemas.LessonOut,
)
router.add_api_route(
    "/{lesson_id}",
    api.delete_lesson_route,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)
