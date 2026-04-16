"""
Reward module API — uses RewardRepository to prevent N+1 queries.
"""

from datetime import datetime, UTC, timedelta
import os
import shutil
import uuid

from fastapi import Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from exceptions import ValidationError, NotFoundError
from repositories import RewardRepository


QR_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "static",
    "qr",
)
os.makedirs(QR_DIR, exist_ok=True)


def get_points_summary(db: Session, user_id: int) -> dict:
    repo = RewardRepository(db)
    total = repo.total_earned(user_id)
    redeemed = repo.total_redeemed(user_id)
    return {
        "total_earned": total,
        "total_redeemed": redeemed,
        "balance": total - redeemed,
    }


def get_points_history(db: Session, user_id: int) -> list:
    """2 queries total (no N+1). Batch-fetches all lessons in one query."""
    repo = RewardRepository(db)
    return repo.points_history_with_lessons(user_id)


def get_user_latest_qr(db: Session, user_id: int) -> dict:
    repo = RewardRepository(db)
    latest = repo.get_latest_qr(user_id)
    return {"qr_url": latest.qr_image_url if latest else None}


def redeem_points(db: Session, user_id: int, qr_url: str = "") -> dict:
    from models.reward import RewardRequest

    summary = get_points_summary(db, user_id)
    if summary["balance"] < 100:
        raise ValidationError(f"Not enough points. Balance: {summary['balance']}")
    req = RewardRequest(
        user_id=user_id,
        points=100,
        status="pending",
        qr_image_url=qr_url or None,
    )
    db.add(req)
    return {
        "message": "Redemption request created!",
        "id": req.id,
        "balance": summary["balance"] - 100,
    }


def get_all_requests(db: Session) -> list:
    """2 queries total (no N+1). Batch-fetches all users in one query."""
    repo = RewardRepository(db)
    return repo.list_all_requests_with_users()


def complete_request(db: Session, request_id: int) -> dict:
    repo = RewardRepository(db)
    req = repo.get_request(request_id)
    if not req:
        raise NotFoundError("Request not found")
    req.status = "completed"
    req.completed_at = datetime.now(UTC)
    return {"message": "Request marked as completed"}


def get_my_requests(db: Session, user_id: int) -> list:
    repo = RewardRepository(db)
    requests = repo.get_requests_for_user(user_id)
    return [
        {
            "id": r.id,
            "points": r.points,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in requests
    ]


def daily_checkin(db: Session, user_id: int) -> dict:
    from models.reward import RewardPoint
    from models.engagement import DailyCheckIn

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    stmt = select(DailyCheckIn).where(
        DailyCheckIn.user_id == user_id,
        DailyCheckIn.check_date == today,
    )
    existing = db.execute(stmt).scalars().first()
    if existing:
        raise ValidationError("Already checked in today!")
    db.add(DailyCheckIn(user_id=user_id, check_date=today))
    db.add(RewardPoint(user_id=user_id, points=5, reason="Daily check-in"))
    return {"message": "Checked in! +5 points", "date": today}


def get_checkin_status(db: Session, user_id: int) -> dict:
    from models.engagement import DailyCheckIn

    today = datetime.now(UTC).strftime("%Y-%m-%d")

    # Single query: all check-in dates for user
    stmt = (
        select(DailyCheckIn.check_date)
        .where(DailyCheckIn.user_id == user_id)
        .order_by(DailyCheckIn.check_date.desc())
    )
    all_dates = [row[0] for row in db.execute(stmt).all()]
    checked_today = today in all_dates

    streak = 0
    check_date = datetime.now(UTC).date()
    if not checked_today:
        check_date = check_date - timedelta(days=1)
    while check_date.strftime("%Y-%m-%d") in all_dates:
        streak += 1
        check_date = check_date - timedelta(days=1)

    last_7 = [
        {
            "date": (datetime.now(UTC).date() - timedelta(days=i)).strftime("%Y-%m-%d"),
            "checked": (datetime.now(UTC).date() - timedelta(days=i)).strftime(
                "%Y-%m-%d"
            )
            in all_dates,
        }
        for i in range(6, -1, -1)
    ]

    return {
        "checked_today": checked_today,
        "streak": streak,
        "total_checkins": len(all_dates),
        "last_7_days": last_7,
    }


def get_total_points(user_id: int, db=Depends(get_db)):
    return get_points_summary(db, user_id)


def get_points_history_route(user_id: int, db=Depends(get_db)):
    return get_points_history(db, user_id)


async def upload_qr(user_id: int, file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(QR_DIR, filename)
    with open(filepath, "wb") as output_file:
        file.file.seek(0)
        shutil.copyfileobj(file.file, output_file)
    return {"qr_url": f"/static/qr/{filename}"}


def get_qr(user_id: int, db=Depends(get_db)):
    return get_user_latest_qr(db, user_id)


def redeem_points_route(user_id: int, qr_url: str = "", db=Depends(get_db)):
    result = redeem_points(db, user_id, qr_url)
    db.commit()
    return result


def get_all_requests_route(db=Depends(get_db)):
    return get_all_requests(db)


def complete_request_route(request_id: int, db=Depends(get_db)):
    result = complete_request(db, request_id)
    db.commit()
    return result


def get_my_requests_route(user_id: int, db=Depends(get_db)):
    return get_my_requests(db, user_id)


def daily_checkin_route(user_id: int, db=Depends(get_db)):
    result = daily_checkin(db, user_id)
    db.commit()
    return result


def get_checkin_status_route(user_id: int, db=Depends(get_db)):
    return get_checkin_status(db, user_id)
