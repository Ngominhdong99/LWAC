from fastapi import APIRouter, Depends

from core.security import get_current_user
from . import api
from .schemas import (
    AIChatMessageOut,
    AIChatResponse,
    ChatMessageOut,
)

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
    dependencies=[Depends(get_current_user)],
)

router.add_api_route("/", api.ai_chat, methods=["POST"], response_model=AIChatResponse)
router.add_api_route(
    "/ai/history/{user_id}",
    api.get_ai_chat_history,
    methods=["GET"],
    response_model=list[AIChatMessageOut],
)
router.add_api_route(
    "/send", api.send_message, methods=["POST"], response_model=ChatMessageOut
)
router.add_api_route(
    "/history/{user1_id}/{user2_id}",
    api.get_chat_history,
    methods=["GET"],
    response_model=list[ChatMessageOut],
)
router.add_api_route(
    "/mark-read/{user_id}/{other_id}", api.mark_messages_read, methods=["POST"]
)
router.add_api_route(
    "/message/{message_id}", api.delete_message_route, methods=["DELETE"]
)
router.add_api_route("/unread/{user_id}", api.get_unread_count, methods=["GET"])
router.add_api_route("/conversations/{user_id}", api.get_conversations, methods=["GET"])
router.add_api_route("/ask-teacher", api.ask_teacher, methods=["POST"])
router.add_api_route(
    "/my-questions/{student_id}", api.get_my_questions, methods=["GET"]
)
router.add_api_route("/heartbeat/{user_id}", api.heartbeat, methods=["POST"])
router.add_api_route("/online-status", api.get_online_status, methods=["GET"])
router.add_api_route("/typing", api.signal_typing, methods=["POST"])
router.add_api_route(
    "/typing/{user_id}/{other_id}", api.get_typing_status, methods=["GET"]
)
