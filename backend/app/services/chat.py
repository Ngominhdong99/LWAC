"""
AI Chat Assistant Service for LWAC — powered by Google Gemini (free tier).
Tries multiple models as fallback: gemini-2.0-flash-lite -> gemini-1.5-flash -> mock
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

# Models to try in order (most capable first, then fallbacks)
MODELS_TO_TRY = [
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash",
]

_conversations: dict[str, list] = {}


def _get_mock_response(user_message: str) -> str:
    mock_responses = {
        "default": "Chao ban! 👋 Minh la Coach - tro ly AI cua LWAC. Minh co the giup ban luyen IELTS, giai thich tu vung, cham Writing, hoac chia se tips lam bai. Ban muon bat dau tu dau?",
        "vocab": "📚 Day la mot so tu vung IELTS quan trong:\n\n• **Subsequently** /sVb.sI.kw@nt.li/ - Sau do, tiep theo\n  _\"Subsequently, the government introduced new policies.\"_\n\n• **Prevalent** /prev.@l.@nt/ - Pho bien, thinh hanh\n  _\"Obesity is becoming increasingly prevalent in modern society.\"_\n\nBan muon hoc them chu de nao?",
        "writing": "✍️ De dat Band 7+ IELTS Writing Task 2, ban can:\n\n1. **Task Response**: Tra loi dung cau hoi, co du y\n2. **Coherence**: Lien ket mach lac giua cac doan\n3. **Lexical Resource**: Su dung tu vung da dang\n4. **Grammar**: Dung cac cau truc cau phuc tap\n\nBan muon minh cham mot bai viet khong? 😊",
        "reading": "📖 Tips lam IELTS Reading hieu qua:\n\n1. **Skim** qua bai doc truoc (2 phut)\n2. Doc cau hoi **truoc** khi doc chi tiet\n3. Chu y **keywords** va **paraphrasing**\n4. Quan ly thoi gian: 20 phut/passage\n\nBan gap kho khan o dang cau hoi nao nhat?",
        "listening": "🎧 Tips IELTS Listening:\n\n1. Doc cau hoi **truoc** khi nghe\n2. Chu y **signal words** (however, but, although)\n3. Viet nhanh va kiem tra sau\n4. Tap nghe podcast tieng Anh moi ngay\n\nBan muon luyen nghe bai nao?",
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
            print(f"[Chat] Model {model_name} failed: {error_str[:100]}")
            # If rate limited, try next model
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                continue
            # For other errors, also try next model
            continue

    # All models failed — use mock with a note
    print(f"[Chat] All models failed, using mock. Last error: {last_error}")
    response = _get_mock_response(user_message)
    response = "⚠️ [AI dang bi gioi han, dang dung che do demo]\n\n" + response
    _conversations[session_id].append({"role": "model", "parts": [{"text": response}]})
    return response
