"""
Reward Router — points history, redemption, QR upload, coach approval.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import shutil, uuid, os

from .. import models
from ..database import get_db

router = APIRouter(prefix="/rewards", tags=["Rewards"])


# ── Student: Get total points ────────────────────────────────────
@router.get("/points/{user_id}")
def get_total_points(user_id: int, db: Session = Depends(get_db)):
    total = db.query(func.sum(models.RewardPoint.points)).filter(
        models.RewardPoint.user_id == user_id
    ).scalar() or 0
    # Subtract redeemed points
    redeemed = db.query(func.sum(models.RewardRequest.points)).filter(
        models.RewardRequest.user_id == user_id,
        models.RewardRequest.status.in_(["pending", "completed"])
    ).scalar() or 0
    return {"total_earned": total, "total_redeemed": redeemed, "balance": total - redeemed}


# ── Student: Get points history ──────────────────────────────────
@router.get("/history/{user_id}")
def get_points_history(user_id: int, db: Session = Depends(get_db)):
    points = db.query(models.RewardPoint).filter(
        models.RewardPoint.user_id == user_id
    ).order_by(models.RewardPoint.created_at.desc()).all()
    result = []
    for p in points:
        lesson = db.query(models.Lesson).filter(models.Lesson.id == p.lesson_id).first() if p.lesson_id else None
        result.append({
            "id": p.id,
            "points": p.points,
            "reason": p.reason,
            "lesson_title": lesson.title if lesson else "Unknown",
            "lesson_type": lesson.type if lesson else "",
            "created_at": p.created_at.isoformat()
        })
    return result


# ── Student: Upload QR code ──────────────────────────────────────
@router.post("/qr/{user_id}")
async def upload_qr(user_id: int, file: UploadFile = File(...)):
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "qr")
    os.makedirs(upload_dir, exist_ok=True)
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"qr_url": f"/static/qr/{filename}"}


# ── Student: Get saved QR ────────────────────────────────────────
@router.get("/qr/{user_id}")
def get_qr(user_id: int, db: Session = Depends(get_db)):
    # Get latest QR from reward_requests or return None
    latest = db.query(models.RewardRequest).filter(
        models.RewardRequest.user_id == user_id,
        models.RewardRequest.qr_image_url != None
    ).order_by(models.RewardRequest.created_at.desc()).first()
    return {"qr_url": latest.qr_image_url if latest else None}


# ── Student: Redeem points ───────────────────────────────────────
@router.post("/redeem/{user_id}")
def redeem_points(user_id: int, qr_url: str = "", db: Session = Depends(get_db)):
    # Check balance
    total = db.query(func.sum(models.RewardPoint.points)).filter(
        models.RewardPoint.user_id == user_id
    ).scalar() or 0
    redeemed = db.query(func.sum(models.RewardRequest.points)).filter(
        models.RewardRequest.user_id == user_id,
        models.RewardRequest.status.in_(["pending", "completed"])
    ).scalar() or 0
    balance = total - redeemed
    if balance < 100:
        raise HTTPException(status_code=400, detail=f"Not enough points. Balance: {balance}")
    
    req = models.RewardRequest(
        user_id=user_id,
        points=100,
        status="pending",
        qr_image_url=qr_url or None
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"message": "Redemption request created!", "id": req.id, "balance": balance - 100}


# ── Coach: Get all pending requests ──────────────────────────────
@router.get("/requests")
def get_all_requests(db: Session = Depends(get_db)):
    requests = db.query(models.RewardRequest).order_by(
        models.RewardRequest.created_at.desc()
    ).all()
    result = []
    for r in requests:
        user = db.query(models.User).filter(models.User.id == r.user_id).first()
        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "username": user.username if user else "Unknown",
            "full_name": user.full_name if user else "Unknown",
            "avatar_color": user.avatar_color if user else "#0d9488",
            "points": r.points,
            "status": r.status,
            "qr_image_url": r.qr_image_url,
            "created_at": r.created_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None
        })
    return result


# ── Coach: Complete a request ────────────────────────────────────
@router.put("/requests/{request_id}/complete")
def complete_request(request_id: int, db: Session = Depends(get_db)):
    req = db.query(models.RewardRequest).filter(models.RewardRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = "completed"
    req.completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Request marked as completed"}


# ── Student: Get own requests ────────────────────────────────────
@router.get("/my-requests/{user_id}")
def get_my_requests(user_id: int, db: Session = Depends(get_db)):
    requests = db.query(models.RewardRequest).filter(
        models.RewardRequest.user_id == user_id
    ).order_by(models.RewardRequest.created_at.desc()).all()
    return [{
        "id": r.id,
        "points": r.points,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
        "completed_at": r.completed_at.isoformat() if r.completed_at else None
    } for r in requests]


# ── Daily Check-In ───────────────────────────────────────────────
@router.post("/checkin/{user_id}")
def daily_checkin(user_id: int, db: Session = Depends(get_db)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    existing = db.query(models.DailyCheckIn).filter(
        models.DailyCheckIn.user_id == user_id,
        models.DailyCheckIn.check_date == today
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already checked in today!")
    
    checkin = models.DailyCheckIn(user_id=user_id, check_date=today)
    db.add(checkin)
    # Award 5 points
    rp = models.RewardPoint(
        user_id=user_id,
        points=5,
        reason="Daily check-in"
    )
    db.add(rp)
    db.commit()
    return {"message": "Checked in! +5 points", "date": today}


@router.get("/checkin/{user_id}")
def get_checkin_status(user_id: int, db: Session = Depends(get_db)):
    from datetime import timedelta
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Check if already checked in today
    checked_today = db.query(models.DailyCheckIn).filter(
        models.DailyCheckIn.user_id == user_id,
        models.DailyCheckIn.check_date == today
    ).first() is not None
    
    # Get all check-in dates
    all_checkins = db.query(models.DailyCheckIn.check_date).filter(
        models.DailyCheckIn.user_id == user_id
    ).order_by(models.DailyCheckIn.check_date.desc()).all()
    all_dates = [c.check_date for c in all_checkins]
    
    # Calculate streak
    streak = 0
    check_date = datetime.utcnow().date()
    # If not checked in today, start from yesterday
    if not checked_today:
        check_date = check_date - timedelta(days=1)
    while check_date.strftime("%Y-%m-%d") in all_dates:
        streak += 1
        check_date = check_date - timedelta(days=1)
    
    # Last 7 days for calendar display
    last_7 = []
    for i in range(6, -1, -1):
        d = (datetime.utcnow().date() - timedelta(days=i)).strftime("%Y-%m-%d")
        last_7.append({"date": d, "checked": d in all_dates})
    
    return {
        "checked_today": checked_today,
        "streak": streak,
        "total_checkins": len(all_dates),
        "last_7_days": last_7
    }
