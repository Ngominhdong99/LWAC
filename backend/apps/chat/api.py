from datetime import datetime, timedelta, UTC

from fastapi import BackgroundTasks, Depends, Query
from sqlalchemy import and_, func, or_, select

from database import get_db
from exceptions import NotFoundError, UnauthorizedError, ValidationError
from models import AIChatMessage, ChatMessage, TeacherQuestion, User
from services.chat import chat_with_assistant
from services.email import send_chat_reply_email
from .schemas import (
    AIChatRequest,
    AIChatResponse,
    AskTeacherRequest,
    SendMessageRequest,
    TypingSignal,
)

_typing_status: dict[tuple[int, int], datetime] = {}


def ai_chat(request: AIChatRequest, db=Depends(get_db)):
    if request.user_id:
        db.add(
            AIChatMessage(
                user_id=request.user_id,
                role="user",
                message=request.message,
                session_id=request.session_id,
            )
        )
        db.commit()

    reply = chat_with_assistant(
        session_id=request.session_id,
        user_message=request.message,
    )

    if request.user_id:
        db.add(
            AIChatMessage(
                user_id=request.user_id,
                role="assistant",
                message=reply,
                session_id=request.session_id,
            )
        )
        db.commit()

    return AIChatResponse(reply=reply, session_id=request.session_id)


def get_ai_chat_history(
    user_id: int,
    limit: int = Query(30, ge=1, le=100),
    before_id: int | None = Query(None),
    db=Depends(get_db),
):
    stmt = select(AIChatMessage).where(AIChatMessage.user_id == user_id)
    if before_id:
        stmt = stmt.where(AIChatMessage.id < before_id)
    messages = list(
        db.execute(stmt.order_by(AIChatMessage.id.desc()).limit(limit)).scalars().all()
    )
    messages.reverse()
    return messages


def send_message(
    req: SendMessageRequest, bg_tasks: BackgroundTasks, db=Depends(get_db)
):
    msg = ChatMessage(
        sender_id=req.sender_id,
        receiver_id=req.receiver_id,
        message=req.message,
        context=req.context,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    users = (
        db.execute(select(User).where(User.id.in_([req.sender_id, req.receiver_id])))
        .scalars()
        .all()
    )
    users_map = {user.id: user for user in users}
    sender = users_map.get(req.sender_id)
    receiver = users_map.get(req.receiver_id)
    if sender and sender.role == "coach" and receiver and receiver.email:
        bg_tasks.add_task(
            send_chat_reply_email,
            receiver.email,
            receiver.full_name or receiver.username,
        )

    return msg


def get_chat_history(
    user1_id: int,
    user2_id: int,
    limit: int = Query(30, ge=1, le=100),
    before_id: int | None = Query(None),
    db=Depends(get_db),
):
    stmt = select(ChatMessage).where(
        or_(
            and_(
                ChatMessage.sender_id == user1_id, ChatMessage.receiver_id == user2_id
            ),
            and_(
                ChatMessage.sender_id == user2_id, ChatMessage.receiver_id == user1_id
            ),
        )
    )
    if before_id:
        stmt = stmt.where(ChatMessage.id < before_id)
    messages = list(
        db.execute(stmt.order_by(ChatMessage.id.desc()).limit(limit)).scalars().all()
    )
    messages.reverse()
    for message in messages:
        if message.receiver_id == user1_id and not message.is_read:
            message.is_read = True
    db.commit()
    return messages


def mark_messages_read(user_id: int, other_id: int, db=Depends(get_db)):
    db.query(ChatMessage).filter(
        ChatMessage.sender_id == other_id,
        ChatMessage.receiver_id == user_id,
        ~ChatMessage.is_read,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


def delete_message_route(
    message_id: int, user_id: int = Query(...), db=Depends(get_db)
):
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise NotFoundError("Message not found")
    if message.sender_id != user_id:
        raise UnauthorizedError("Not authorized to delete this message")
    if message.is_read:
        raise ValidationError("Cannot delete a message that has already been read")
    db.delete(message)
    db.commit()
    return {"ok": True}


def get_unread_count(user_id: int, db=Depends(get_db)):
    count = db.execute(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.receiver_id == user_id,
            ~ChatMessage.is_read,
        )
    ).scalar()
    return {"unread": count or 0}


def get_conversations(user_id: int, db=Depends(get_db)):
    sent_ids = {
        row[0]
        for row in db.execute(
            select(ChatMessage.receiver_id)
            .where(ChatMessage.sender_id == user_id)
            .distinct()
        ).all()
    }
    recv_ids = {
        row[0]
        for row in db.execute(
            select(ChatMessage.sender_id)
            .where(ChatMessage.receiver_id == user_id)
            .distinct()
        ).all()
    }
    other_ids = list((sent_ids | recv_ids) - {user_id})
    if not other_ids:
        return []

    users_map = {
        user.id: user
        for user in db.execute(select(User).where(User.id.in_(other_ids)))
        .scalars()
        .all()
    }
    all_messages = (
        db.execute(
            select(ChatMessage)
            .where(
                or_(
                    ChatMessage.sender_id == user_id, ChatMessage.receiver_id == user_id
                )
            )
            .order_by(ChatMessage.created_at.desc())
        )
        .scalars()
        .all()
    )

    latest_per_partner: dict[int, ChatMessage] = {}
    for message in all_messages:
        partner_id = (
            message.receiver_id if message.sender_id == user_id else message.sender_id
        )
        if partner_id not in latest_per_partner:
            latest_per_partner[partner_id] = message

    conversations = []
    for other_id in other_ids:
        other_user = users_map.get(other_id)
        if not other_user:
            continue
        last_msg = latest_per_partner.get(other_id)
        conversations.append(
            {
                "user_id": other_user.id,
                "username": other_user.username,
                "full_name": other_user.full_name or other_user.username,
                "avatar_color": other_user.avatar_color or "#0d9488",
                "role": other_user.role,
                "last_message": last_msg.message[:50] if last_msg else "",
                "last_time": last_msg.created_at.isoformat() if last_msg else "",
            }
        )
    conversations.sort(key=lambda item: item["last_time"], reverse=True)
    return conversations


def ask_teacher(req: AskTeacherRequest, db=Depends(get_db)):
    teacher_question = TeacherQuestion(
        student_id=req.student_id,
        question_text=req.question_text,
        context=req.context,
        question_id=req.question_id,
        lesson_id=req.lesson_id,
    )
    db.add(teacher_question)
    db.commit()
    db.refresh(teacher_question)
    return {"message": "Question sent to your coach!", "id": teacher_question.id}


def get_my_questions(student_id: int, db=Depends(get_db)):
    questions = (
        db.query(TeacherQuestion)
        .filter(TeacherQuestion.student_id == student_id)
        .order_by(TeacherQuestion.created_at.desc())
        .all()
    )
    return [
        {
            "id": question.id,
            "question_text": question.question_text,
            "context": question.context,
            "status": question.status,
            "answer": question.answer,
            "created_at": question.created_at.isoformat(),
            "answered_at": question.answered_at.isoformat()
            if question.answered_at
            else None,
        }
        for question in questions
    ]


def heartbeat(user_id: int, db=Depends(get_db)):
    user = db.execute(select(User).where(User.id == user_id)).scalars().first()
    if user:
        user.last_active = datetime.now(UTC)
        db.commit()
    return {"ok": True}


def get_online_status(
    user_ids: str = Query(..., description="Comma-separated user IDs"),
    db=Depends(get_db),
):
    ids = [int(item.strip()) for item in user_ids.split(",") if item.strip().isdigit()]
    cutoff = datetime.now(UTC) - timedelta(minutes=2)
    users = db.query(User.id, User.last_active).filter(User.id.in_(ids)).all()
    return {
        str(user.id): {
            "online": user.last_active is not None and user.last_active >= cutoff,
            "last_active": user.last_active.isoformat() + "Z"
            if user.last_active
            else None,
        }
        for user in users
    }


def signal_typing(req: TypingSignal):
    _typing_status[(req.sender_id, req.receiver_id)] = datetime.now(UTC)
    return {"ok": True}


def get_typing_status(user_id: int, other_id: int):
    last = _typing_status.get((other_id, user_id))
    if last and (datetime.now(UTC) - last).total_seconds() < 4:
        return {"is_typing": True}
    return {"is_typing": False}
