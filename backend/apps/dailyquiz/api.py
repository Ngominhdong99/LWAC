import random
from datetime import datetime, UTC

from fastapi import Depends
from sqlalchemy import func

from data.master_vocabulary import seed_master_vocabulary
from database import get_db
from exceptions import UnauthorizedError
from models import DailyQuizActivity, User, VocabVault, VocabularyEntry


def _extract_vietnamese_meaning(meaning):
    if not meaning:
        return "Meaning unavailable"
    lines = meaning.split("\n")
    for line in lines:
        if "🇻🇳" in line:
            return line.replace("🇻🇳", "").strip()
    return lines[0].strip()


def get_daily_quiz_questions(db, user_id):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "student":
        raise UnauthorizedError("Only students can access the Daily Quiz")
    today_str = datetime.now(UTC).strftime("%Y-%m-%d")
    existing = (
        db.query(DailyQuizActivity)
        .filter(
            DailyQuizActivity.user_id == user.id,
            DailyQuizActivity.quiz_date == today_str,
        )
        .first()
    )
    if existing:
        return {"completed": True, "score": existing.score, "questions": []}

    user_words = db.query(VocabVault).filter(VocabVault.user_id == user.id).all()
    word_pool = [
        {"word": w.word, "meaning": _extract_vietnamese_meaning(w.meaning)}
        for w in user_words
    ]
    if len(word_pool) < 20:
        other = (
            db.query(VocabVault)
            .filter(VocabVault.user_id != user.id)
            .order_by(func.random())
            .limit(40)
            .all()
        )
        word_pool.extend(
            [
                {"word": w.word, "meaning": _extract_vietnamese_meaning(w.meaning)}
                for w in other
            ]
        )

    if db.query(VocabularyEntry).count() == 0:
        seed_master_vocabulary(db)

    master_words = (
        db.query(VocabularyEntry)
        .filter(VocabularyEntry.is_active.is_(True))
        .order_by(func.random())
        .limit(100)
        .all()
    )

    all_words = word_pool + [
        {"word": entry.word, "meaning": entry.meaning}
        for entry in master_words
    ]
    unique = {}
    for item in all_words:
        key = item["word"].lower()
        if key not in unique and len(item.get("meaning", "")) > 2:
            unique[key] = item
    pool = list(unique.values())
    random.shuffle(pool)
    selected = pool[:20]

    questions = []
    for correct in selected:
        distractors = [i for i in pool if i["word"] != correct["word"]]
        random.shuffle(distractors)
        options = [correct["word"]] + [d["word"] for d in distractors[:3]]
        random.shuffle(options)
        questions.append(
            {
                "meaning": correct["meaning"],
                "correct_word": correct["word"],
                "options": options,
            }
        )
    return {"completed": False, "questions": questions}


def submit_daily_quiz(db, user_id, score):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "student":
        raise UnauthorizedError("Only students can submit")
    today_str = datetime.now(UTC).strftime("%Y-%m-%d")
    existing = (
        db.query(DailyQuizActivity)
        .filter(
            DailyQuizActivity.user_id == user.id,
            DailyQuizActivity.quiz_date == today_str,
        )
        .first()
    )
    if existing:
        return {"msg": "Already completed today"}
    record = DailyQuizActivity(user_id=user.id, quiz_date=today_str, score=score)
    db.add(record)
    return {"msg": "Successfully recorded"}


def get_daily_questions(user_id: int, db=Depends(get_db)):
    return get_daily_quiz_questions(db, user_id)


def submit_daily_quiz_route(user_id: int, score: int, db=Depends(get_db)):
    result = submit_daily_quiz(db, user_id, score)
    db.commit()
    return result
