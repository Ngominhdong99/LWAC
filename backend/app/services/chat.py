"""
AI Chat Assistant Service for LWAC — powered by Google Gemini (free tier).
Tries multiple models as fallback: gemini-2.5-flash-lite -> gemini-2.0-flash-lite -> gemini-2.0-flash -> mock
"""
import os
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are "Coach", an expert IELTS tutor on the LWAC (Learn With Amateur Coach) platform.
Your role is to help Vietnamese students prepare for the IELTS exam.

Key behaviors:
- Answer questions about IELTS strategies, vocabulary, grammar, and test format.
- When the student asks about vocabulary, provide the English word, its Vietnamese meaning, IPA pronunciation, and an example sentence.
- Keep responses concise (under 200 words) unless the student asks for a detailed explanation.
- Be encouraging, friendly, and supportive. Use emojis occasionally.
- If the student writes in Vietnamese, respond in Vietnamese but use English for IELTS-specific terms.
- If the student shares a writing sample, provide band-score-style feedback with specific improvement suggestions.
"""

# Models to try in order (cheapest/fastest first for free tier)
MODELS_TO_TRY = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]

_conversations: dict[str, list] = {}


def _get_mock_response(user_message: str) -> str:
    mock_responses = {
        "default": "Chào bạn! 👋 Mình là Coach - trợ lý AI của LWAC. Mình có thể giúp bạn luyện IELTS, giải thích từ vựng, chấm Writing, hoặc chia sẻ tips làm bài. Bạn muốn bắt đầu từ đâu?",
        "vocab": "📚 Đây là một số từ vựng IELTS quan trọng:\n\n• **Subsequently** /sʌb.sɪ.kwənt.li/ - Sau đó, tiếp theo\n  _\"Subsequently, the government introduced new policies.\"_\n\n• **Prevalent** /prev.əl.ənt/ - Phổ biến, thịnh hành\n  _\"Obesity is becoming increasingly prevalent in modern society.\"_\n\nBạn muốn học thêm chủ đề nào?",
        "writing": "✍️ Để đạt Band 7+ IELTS Writing Task 2, bạn cần:\n\n1. **Task Response**: Trả lời đúng câu hỏi, có đủ ý\n2. **Coherence**: Liên kết mạch lạc giữa các đoạn\n3. **Lexical Resource**: Sử dụng từ vựng đa dạng\n4. **Grammar**: Dùng các cấu trúc câu phức tạp\n\nBạn muốn mình chấm một bài viết không? 😊",
        "reading": "📖 Tips làm IELTS Reading hiệu quả:\n\n1. **Skim** qua bài đọc trước (2 phút)\n2. Đọc câu hỏi **trước** khi đọc chi tiết\n3. Chú ý **keywords** và **paraphrasing**\n4. Quản lý thời gian: 20 phút/passage\n\nBạn gặp khó khăn ở dạng câu hỏi nào nhất?",
        "listening": "🎧 Tips IELTS Listening:\n\n1. Đọc câu hỏi **trước** khi nghe\n2. Chú ý **signal words** (however, but, although)\n3. Viết nhanh và kiểm tra sau\n4. Tập nghe podcast tiếng Anh mỗi ngày\n\nBạn muốn luyện nghe bài nào?",
    }
    msg_lower = user_message.lower()
    if any(k in msg_lower for k in ["vocab", "tu vung", "word", "tu"]):
        return mock_responses["vocab"]
    elif any(k in msg_lower for k in ["writing", "viet", "essay", "bai viet"]):
        return mock_responses["writing"]
    elif any(k in msg_lower for k in ["reading", "doc", "passage"]):
        return mock_responses["reading"]
    elif any(k in msg_lower for k in ["listening", "nghe", "audio"]):
        return mock_responses["listening"]
    return mock_responses["default"]


def chat_with_assistant(session_id: str, user_message: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")

    if session_id not in _conversations:
        _conversations[session_id] = []

    _conversations[session_id].append({"role": "user", "parts": [{"text": user_message}]})

    if len(_conversations[session_id]) > 20:
        _conversations[session_id] = _conversations[session_id][-20:]

    if not api_key:
        response = _get_mock_response(user_message)
        _conversations[session_id].append({"role": "model", "parts": [{"text": response}]})
        return response

    # Try each model until one works
    client = genai.Client(api_key=api_key)
    last_error = None

    for model_name in MODELS_TO_TRY:
        for attempt in range(2):  # Retry once on rate limit
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=_conversations[session_id],
                    config=genai.types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.7,
                        max_output_tokens=500,
                    ),
                )
                assistant_message = response.text
                _conversations[session_id].append({"role": "model", "parts": [{"text": assistant_message}]})
                print(f"[Chat] Success with model: {model_name}")
                return assistant_message

            except Exception as e:
                last_error = e
                error_str = str(e)
                print(f"[Chat] Model {model_name} attempt {attempt+1} failed: {error_str[:120]}")
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    if attempt == 0:
                        time.sleep(2)  # Brief wait before retry
                        continue
                break  # Try next model

    # All models failed — use mock with a note
    print(f"[Chat] All models failed, using mock. Last error: {last_error}")
    response = _get_mock_response(user_message)
    response = "⚠️ [AI đang bị giới hạn, đang dùng chế độ demo]\n\n" + response
    _conversations[session_id].append({"role": "model", "parts": [{"text": response}]})
    return response
