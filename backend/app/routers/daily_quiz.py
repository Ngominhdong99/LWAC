from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import random

from app.database import get_db
from app.models import User, VocabVault, DailyQuizActivity
from app.dependencies import get_current_user

router = APIRouter(prefix="/daily_quiz", tags=["daily_quiz"])

# Basic fallback dictionary if the user doesn't have enough words
FALLBACK_WORDS = [
    {"word": "abandon", "meaning": "Từ bỏ, bỏ rơi"},
    {"word": "abstract", "meaning": "Trừu tượng, khó hiểu"},
    {"word": "academic", "meaning": "Thuộc về học thuật"},
    {"word": "access", "meaning": "Sự truy cập, đường đi vào"},
    {"word": "accommodate", "meaning": "Cung cấp chỗ ở, đáp ứng"},
    {"word": "accompany", "meaning": "Đồng hành, đi kèm"},
    {"word": "accumulate", "meaning": "Tích tụ, tích lũy"},
    {"word": "accurate", "meaning": "Chính xác, đúng đắn"},
    {"word": "achieve", "meaning": "Đạt được, giành được"},
    {"word": "acknowledge", "meaning": "Công nhận, thừa nhận"},
    {"word": "acquire", "meaning": "Thu được, giành được"},
    {"word": "adapt", "meaning": "Thích nghi, biến đổi"},
    {"word": "adequate", "meaning": "Đầy đủ, tương xứng"},
    {"word": "adjacent", "meaning": "Gần kề, liền kề"},
    {"word": "adjust", "meaning": "Điều chỉnh, làm cho phù hợp"},
    {"word": "administration", "meaning": "Sự quản lý, hành chính"},
    {"word": "adult", "meaning": "Người trưởng thành"},
    {"word": "advocate", "meaning": "Ủng hộ, biện hộ"},
    {"word": "affect", "meaning": "Ảnh hưởng, tác động đến"},
    {"word": "aggregate", "meaning": "Tổng số, gộp chung"},
    {"word": "aid", "meaning": "Sự viện trợ, giúp đỡ"},
    {"word": "albeit", "meaning": "Mặc dù, dẫu cho"},
    {"word": "allocate", "meaning": "Phân bổ, phân phát"},
    {"word": "alter", "meaning": "Thay đổi, biến đổi"},
    {"word": "alternative", "meaning": "Sự thay thế, phương án khác"},
    {"word": "ambiguous", "meaning": "Mơ hồ, không rõ ràng"},
    {"word": "amend", "meaning": "Sửa đổi, cải thiện"},
    {"word": "analogy", "meaning": "Sự tương tự, loại suy"},
    {"word": "analyze", "meaning": "Phân tích, xem xét"},
    {"word": "annual", "meaning": "Hàng năm, thường niên"}
]

def extract_vietnamese_meaning(meaning: str) -> str:
    """Extracts the Vietnamese meaning from the combined string."""
    if not meaning: return "Nghĩa không xác định"
    
    # Format typically: "🇻🇳 Nghĩa tiếng Việt\n🇬🇧 English meaning"
    lines = meaning.split('\n')
    for line in lines:
        if '🇻🇳' in line:
            return line.replace('🇻🇳', '').strip()
            
    # Fallback to the first line if no flag is found, assuming it might be translated
    return lines[0].strip()

@router.get("/questions")
def get_daily_questions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generates 20 random vocabulary questions for the daily quiz.
    It priorities the student's own VocabVault. If there are fewer than 20 words,
    it mixes in words from the global VocabVault, and then the FALLBACK_WORDS.
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can access the Daily Quiz")
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Check if already completed today
    activity = db.query(DailyQuizActivity).filter(
        DailyQuizActivity.user_id == current_user.id,
        DailyQuizActivity.quiz_date == today_str
    ).first()
    
    if activity:
        return {"completed": True, "score": activity.score, "questions": []}
    
    # Fetch words from user's vault
    user_words = db.query(VocabVault).filter(VocabVault.user_id == current_user.id).all()
    user_dict = [{"word": w.word, "meaning": extract_vietnamese_meaning(w.meaning)} for w in user_words]
    
    # If not enough, fetch random words from overall vault
    if len(user_dict) < 20:
        other_words = db.query(VocabVault).filter(VocabVault.user_id != current_user.id).order_by(func.random()).limit(40).all()
        for w in other_words:
            user_dict.append({"word": w.word, "meaning": extract_vietnamese_meaning(w.meaning)})
            
    # Combine with fallback and remove duplicates (by word)
    all_words_pool = user_dict + FALLBACK_WORDS
    
    unique_words = {}
    for item in all_words_pool:
        word_key = item['word'].lower()
        if word_key not in unique_words and len(item['meaning']) > 2:
            unique_words[word_key] = item
            
    pool_list = list(unique_words.values())
    
    # Need at least 20 words, usually guaranteed since fallback is 30
    if len(pool_list) < 20:
        pool_list.extend(FALLBACK_WORDS) # just in case
        
    random.shuffle(pool_list)
    selected_words = pool_list[:20]
    
    questions = []
    
    for correct_item in selected_words:
        question = {
            "meaning": correct_item["meaning"],
            "correct_word": correct_item["word"]
        }
        
        # Pick 3 random distractors
        distractors = [item for item in pool_list if item["word"] != correct_item["word"]]
        random.shuffle(distractors)
        
        options = [correct_item["word"]] + [d["word"] for d in distractors[:3]]
        random.shuffle(options)
        
        question["options"] = options
        questions.append(question)
        
    return {"completed": False, "questions": questions}

@router.post("/submit")
def submit_daily_quiz(score: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Submits the daily quiz score and records activity.
    No points are awarded.
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit the Daily Quiz")
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Check if already submitted
    existing = db.query(DailyQuizActivity).filter(
        DailyQuizActivity.user_id == current_user.id,
        DailyQuizActivity.quiz_date == today_str
    ).first()
    
    if existing:
        return {"msg": "Already completed today"}
        
    # Record completion
    new_activity = DailyQuizActivity(
        user_id=current_user.id,
        quiz_date=today_str,
        score=score
    )
    db.add(new_activity)
    
    db.commit()
    
    return {"msg": "Successfully recorded"}
