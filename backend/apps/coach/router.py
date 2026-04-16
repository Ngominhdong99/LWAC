from fastapi import APIRouter, Depends

from core.security import get_current_user
from . import api
from .schemas import (
    AssignmentOut,
    ResultOut,
    StudentOut,
    TeacherQuestionOut,
)

router = APIRouter(
    prefix="/coach",
    tags=["Coach"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route(
    "/students", api.list_students, methods=["GET"], response_model=list[StudentOut]
)
router.add_api_route(
    "/students", api.create_student, methods=["POST"], response_model=StudentOut
)
router.add_api_route(
    "/students/{student_id}",
    api.update_student,
    methods=["PUT"],
    response_model=StudentOut,
)
router.add_api_route("/students/{student_id}", api.delete_student, methods=["DELETE"])
router.add_api_route("/library", api.get_library, methods=["GET"])
router.add_api_route(
    "/students/{student_id}/assignments",
    api.get_assignments,
    methods=["GET"],
    response_model=list[AssignmentOut],
)
router.add_api_route(
    "/students/{student_id}/assignments",
    api.assign_test,
    methods=["POST"],
    response_model=AssignmentOut,
)
router.add_api_route(
    "/assignments/{assignment_id}", api.delete_assignment, methods=["DELETE"]
)
router.add_api_route(
    "/assignments/{assignment_id}/toggle-retake", api.toggle_retake, methods=["PUT"]
)
router.add_api_route(
    "/students/{student_id}/results",
    api.get_student_results,
    methods=["GET"],
    response_model=list[ResultOut],
)
router.add_api_route("/results/{result_id}", api.get_detailed_result, methods=["GET"])
router.add_api_route(
    "/questions",
    api.list_questions,
    methods=["GET"],
    response_model=list[TeacherQuestionOut],
)
router.add_api_route(
    "/questions/{question_id}/answer", api.answer_question, methods=["PUT"]
)
router.add_api_route("/ai-explain", api.ai_explain_question, methods=["POST"])
router.add_api_route("/ai-generate-passage", api.ai_generate_passage, methods=["POST"])
router.add_api_route("/ai-parse-questions", api.ai_parse_questions, methods=["POST"])
