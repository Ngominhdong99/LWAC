"""
Query Builder — Batch fetch utilities to prevent N+1 queries.
SQLAlchemy v2 style (select() instead of db.query()).

Usage:
    # Instead of: for lesson in lessons:
    #     questions = db.query(Question).filter(Question.lesson_id == lesson.id).all()
    # Use:
    #     questions_by_lesson = batch_questions_by_lesson(db, lesson_ids)
"""

from collections import defaultdict

from sqlalchemy import select, func


def batch_questions_by_lesson(db, lesson_ids: list) -> dict:
    """Fetch all questions for a set of lesson_ids.
    Returns: {lesson_id: [Question, ...]}"""
    if not lesson_ids:
        return defaultdict(list)
    from models.learning import Question

    stmt = select(Question).where(Question.lesson_id.in_(lesson_ids))
    questions = db.execute(stmt).scalars().all()
    result: dict = defaultdict(list)
    for q in questions:
        result[q.lesson_id].append(q)
    return result


def count_questions_by_lesson(db, lesson_ids: list) -> dict:
    """Count questions per lesson.
    Returns: {lesson_id: count}"""
    if not lesson_ids:
        return {}
    from models.learning import Question

    stmt = (
        select(Question.lesson_id, func.count(Question.id))
        .where(Question.lesson_id.in_(lesson_ids))
        .group_by(Question.lesson_id)
    )
    rows = db.execute(stmt).all()
    return {row[0]: row[1] for row in rows}


def batch_users_by_ids(db, user_ids: list) -> dict:
    """Fetch all users by IDs.
    Returns: {user_id: User}"""
    if not user_ids:
        return {}
    from models.user import User

    stmt = select(User).where(User.id.in_(user_ids))
    users = db.execute(stmt).scalars().all()
    return {u.id: u for u in users}


def batch_lessons_by_ids(db, lesson_ids: list) -> dict:
    """Fetch all lessons by IDs.
    Returns: {lesson_id: Lesson}"""
    if not lesson_ids:
        return {}
    from models.learning import Lesson

    stmt = select(Lesson).where(Lesson.id.in_(lesson_ids))
    lessons = db.execute(stmt).scalars().all()
    return {lesson.id: lesson for lesson in lessons}


def batch_results_by_user(db, user_ids: list) -> dict:
    """Fetch all results for a set of user_ids in ONE query.
    Returns: {user_id: [Result, ...]}

    Bug fix: previous version had typo 'dbs' instead of 'db'.
    """
    if not user_ids:
        return defaultdict(list)
    from models.result import Result

    stmt = select(Result).where(Result.user_id.in_(user_ids))
    results = db.execute(stmt).scalars().all()
    grouped: dict = defaultdict(list)
    for r in results:
        grouped[r.user_id].append(r)
    return grouped


def batch_results_by_assignment(db, assignments: list) -> dict:
    """
    Fetch latest results for a set of student_id+lesson_id pairs.
    Returns: {(student_id, lesson_id): Result}

    N+1 Fix: previous version queried DB once per pair in a loop.
    New version:
      1. Collect all (student_id, lesson_id) pairs
      2. Fetch ALL matching results in ONE query
      3. Group by (student_id, lesson_id) in Python, keep latest
    """
    if not assignments:
        return {}
    from models.result import Result

    student_ids = list({a.student_id for a in assignments})
    lesson_ids = list({a.lesson_id for a in assignments})

    stmt = select(Result).where(
        Result.user_id.in_(student_ids),
        Result.lesson_id.in_(lesson_ids),
    )
    all_results = db.execute(stmt).scalars().all()

    # Keep latest per (student_id, lesson_id)
    latest: dict = {}
    for r in all_results:
        key = (r.user_id, r.lesson_id)
        existing = latest.get(key)
        if existing is None or r.submitted_at > existing.submitted_at:
            latest[key] = r

    return latest


def count_results_by_user(db, user_ids: list) -> dict:
    """Count results and avg score per user.
    Returns: {user_id: {"count": int, "avg": float}}"""
    if not user_ids:
        return {}
    from models.result import Result

    stmt = (
        select(
            Result.user_id,
            func.count(Result.id),
            func.avg(Result.score),
        )
        .where(Result.user_id.in_(user_ids))
        .group_by(Result.user_id)
    )
    rows = db.execute(stmt).all()
    return {
        row[0]: {"count": row[1], "avg": round(float(row[2]) if row[2] else 0.0, 1)}
        for row in rows
    }
