"""
Chat Router — AI assistant chat (persistent) + persistent coach-student messaging + ask-teacher.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from .. import models
from ..database import get_db
from ..services.chat import chat_with_assistant
from datetime import timedelta

router = APIRouter(prefix="/chat", tags=["Chat"])

# In-memory typing status: {(sender_id, receiver_id): last_typing_time}
_typing_status = {}


# ── Schemas ──────────────────────────────────────────────────────
class AIChatRequest(BaseModel):
    session_id: str = "default"
    message: str
    user_id: Optional[int] = None

class AIChatResponse(BaseModel):
    reply: str
    session_id: str

class AIChatMessageOut(BaseModel):
    id: int
    role: str
    message: str
    created_at: datetime
    class Config:
        orm_mode = True

class SendMessageRequest(BaseModel):
    sender_id: int
    receiver_id: int
    message: str
    context: Optional[str] = None

class ChatMessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    message: str
    context: Optional[str] = None
    is_read: bool = False
    created_at: datetime
    class Config:
        orm_mode = True

class AskTeacherRequest(BaseModel):
    student_id: int
    question_text: str
    context: Optional[str] = None
    question_id: Optional[int] = None
    lesson_id: Optional[int] = None


# ── AI Chat (persistent) ────────────────────────────────────────
@router.post("/", response_model=AIChatResponse)
def ai_chat(request: AIChatRequest, db: Session = Depends(get_db)):
    user_id = request.user_id
    session_id = request.session_id

    # Save user message to DB
    if user_id:
        db_user_msg = models.AIChatMessage(
            user_id=user_id, role="user", message=request.message, session_id=session_id
        )
        db.add(db_user_msg)
        db.commit()

    # Get AI reply
    reply = chat_with_assistant(session_id=session_id, user_message=request.message)

    # Save assistant reply to DB
    if user_id:
        db_ai_msg = models.AIChatMessage(
            user_id=user_id, role="assistant", message=reply, session_id=session_id
        )
        db.add(db_ai_msg)
        db.commit()

    return AIChatResponse(reply=reply, session_id=session_id)


@router.get("/ai/history/{user_id}", response_model=List[AIChatMessageOut])
def get_ai_chat_history(
    user_id: int,
    limit: int = Query(30, ge=1, le=100),
    before_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get AI chat history for a user, paginated (newest first, reversed to chronological)."""
    query = db.query(models.AIChatMessage).filter(
        models.AIChatMessage.user_id == user_id
    )
    if before_id:
        query = query.filter(models.AIChatMessage.id < before_id)
    messages = query.order_by(models.AIChatMessage.id.desc()).limit(limit).all()
    messages.reverse()  # Return in chronological order
    return messages


# ── Persistent Coach-Student Chat ────────────────────────────────
@router.post("/send", response_model=ChatMessageOut)
def send_message(req: SendMessageRequest, db: Session = Depends(get_db)):
    msg = models.ChatMessage(
        sender_id=req.sender_id,
        receiver_id=req.receiver_id,
        message=req.message,
        context=req.context
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/history/{user1_id}/{user2_id}", response_model=List[ChatMessageOut])
def get_chat_history(
    user1_id: int,
    user2_id: int,
    limit: int = Query(30, ge=1, le=100),
    before_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get chat history between two users, paginated."""
    query = db.query(models.ChatMessage).filter(
        ((models.ChatMessage.sender_id == user1_id) & (models.ChatMessage.receiver_id == user2_id)) |
        ((models.ChatMessage.sender_id == user2_id) & (models.ChatMessage.receiver_id == user1_id))
    )
    if before_id:
        query = query.filter(models.ChatMessage.id < before_id)
    messages = query.order_by(models.ChatMessage.id.desc()).limit(limit).all()
    messages.reverse()  # Return in chronological order
    # Mark messages as read for the requesting user
    for m in messages:
        if m.receiver_id == user1_id and not m.is_read:
            m.is_read = True
    db.commit()
    return messages


@router.post("/mark-read/{user_id}/{other_id}")
def mark_messages_read(user_id: int, other_id: int, db: Session = Depends(get_db)):
    """Mark all messages from other_id to user_id as read."""
    db.query(models.ChatMessage).filter(
        models.ChatMessage.sender_id == other_id,
        models.ChatMessage.receiver_id == user_id,
        models.ChatMessage.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.delete("/message/{message_id}")
def delete_message(message_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    """Delete an unread message sent by the user."""
    msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    if msg.is_read:
        raise HTTPException(status_code=400, detail="Cannot delete a message that has already been read")
    
    db.delete(msg)
    db.commit()
    return {"ok": True}


@router.get("/unread/{user_id}")
def get_unread_count(user_id: int, db: Session = Depends(get_db)):
    """Get count of unread messages for a user."""
    from sqlalchemy import func
    count = db.query(func.count(models.ChatMessage.id)).filter(
        models.ChatMessage.receiver_id == user_id,
        models.ChatMessage.is_read == False
    ).scalar()
    return {"unread": count or 0}


@router.get("/conversations/{user_id}")
def get_conversations(user_id: int, db: Session = Depends(get_db)):
    """Get list of users this person has chatted with + last message."""
    sent = db.query(models.ChatMessage.receiver_id.label("other_id")).filter(
        models.ChatMessage.sender_id == user_id
    ).distinct()
    received = db.query(models.ChatMessage.sender_id.label("other_id")).filter(
        models.ChatMessage.receiver_id == user_id
    ).distinct()
    
    other_ids = set()
    for row in sent.all():
        other_ids.add(row.other_id)
    for row in received.all():
        other_ids.add(row.other_id)
    
    conversations = []
    for oid in other_ids:
        other_user = db.query(models.User).filter(models.User.id == oid).first()
        if not other_user:
            continue
        
        last_msg = db.query(models.ChatMessage).filter(
            ((models.ChatMessage.sender_id == user_id) & (models.ChatMessage.receiver_id == oid)) |
            ((models.ChatMessage.sender_id == oid) & (models.ChatMessage.receiver_id == user_id))
        ).order_by(models.ChatMessage.created_at.desc()).first()
        
        conversations.append({
            "user_id": other_user.id,
            "username": other_user.username,
            "full_name": other_user.full_name or other_user.username,
            "avatar_color": other_user.avatar_color or "#0d9488",
            "role": other_user.role,
            "last_message": last_msg.message[:50] if last_msg else "",
            "last_time": last_msg.created_at.isoformat() if last_msg else ""
        })
    
    conversations.sort(key=lambda x: x["last_time"], reverse=True)
    return conversations


# ── Ask Teacher ──────────────────────────────────────────────────
@router.post("/ask-teacher")
def ask_teacher(req: AskTeacherRequest, db: Session = Depends(get_db)):
    tq = models.TeacherQuestion(
        student_id=req.student_id,
        question_text=req.question_text,
        context=req.context,
        question_id=req.question_id,
        lesson_id=req.lesson_id
    )
    db.add(tq)
    db.commit()
    db.refresh(tq)
    return {"message": "Question sent to your coach!", "id": tq.id}


@router.get("/my-questions/{student_id}")
def get_my_questions(student_id: int, db: Session = Depends(get_db)):
    questions = db.query(models.TeacherQuestion).filter(
        models.TeacherQuestion.student_id == student_id
    ).order_by(models.TeacherQuestion.created_at.desc()).all()
    
    result = []
    for tq in questions:
        result.append({
            "id": tq.id,
            "question_text": tq.question_text,
            "context": tq.context,
            "status": tq.status,
            "answer": tq.answer,
            "created_at": tq.created_at.isoformat(),
            "answered_at": tq.answered_at.isoformat() if tq.answered_at else None
        })
    return result


# ── Presence & Typing ────────────────────────────────────────────

@router.post("/heartbeat/{user_id}")
def heartbeat(user_id: int, db: Session = Depends(get_db)):
    """Update user's last_active timestamp. Call every ~30s from frontend."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.last_active = datetime.utcnow()
        db.commit()
    return {"ok": True}


@router.get("/online-status")
def get_online_status(user_ids: str = Query(..., description="Comma-separated user IDs"), db: Session = Depends(get_db)):
    """Check online status for a list of users. Online = active within last 2 minutes."""
    ids = [int(x.strip()) for x in user_ids.split(",") if x.strip().isdigit()]
    cutoff = datetime.utcnow() - timedelta(minutes=2)
    users = db.query(models.User.id, models.User.last_active).filter(models.User.id.in_(ids)).all()
    result = {}
    for u in users:
        is_online = u.last_active is not None and u.last_active >= cutoff
        result[str(u.id)] = {
            "online": is_online,
            "last_active": u.last_active.isoformat() + "Z" if u.last_active else None
        }
    return result


class TypingSignal(BaseModel):
    sender_id: int
    receiver_id: int


@router.post("/typing")
def signal_typing(req: TypingSignal):
    """Signal that a user is typing to another user."""
    _typing_status[(req.sender_id, req.receiver_id)] = datetime.utcnow()
    return {"ok": True}


@router.get("/typing/{user_id}/{other_id}")
def get_typing_status(user_id: int, other_id: int):
    """Check if other_id is currently typing to user_id. Typing expires after 4 seconds."""
    last = _typing_status.get((other_id, user_id))
    if last and (datetime.utcnow() - last).total_seconds() < 4:
        return {"is_typing": True}
    return {"is_typing": False}

