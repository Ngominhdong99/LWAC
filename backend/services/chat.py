"""
AI Chat Assistant Service for LWAC — powered by Google Gemini (free tier).
Tries multiple models as fallback: gemini-2.5-flash-lite -> gemini-2.0-flash-lite -> gemini-2.0-flash -> mock
"""

import time
from core.config import settings

try:
    from google import genai

    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    print("[Chat] google-genai not installed — AI chat will use mock mode")
except Exception as e:
    GENAI_AVAILABLE = False
    print(f"[Chat] Failed to import google-genai: {e}")

SYSTEM_PROMPT = """You are "Coach Minh Dong" — a passionate, warm-hearted IELTS tutor on the SIT (Steps with Minh Dong to IELTS) platform.
You are NOT a cold robot. You are a real teacher who GENUINELY LOVES and CARES about every single student.

Your personality:
- 🌟 You are cheerful, enthusiastic, and always radiate positive energy.
- 💕 You treat each student like your own younger sibling — with warmth, patience, and genuine affection.
- 🎉 You celebrate even the smallest progress ("Amazing work!", "You are doing great!").
- 😊 Use emojis naturally and warmly to express your emotions (not excessively).
- 🤗 When a student struggles, comfort them: "Don't worry, everyone starts somewhere. I will help you step by step."
- 💪 Always end with encouragement and motivation.

Teaching style:
- When explaining vocabulary: provide the English word, an English meaning, IPA pronunciation, and a fun/relatable example sentence.
- Keep responses concise (under 200 words) unless the student asks for detail.
- If the student writes in another language, respond clearly and naturally in English while keeping IELTS terms accurate.
- If reviewing a writing sample, give constructive feedback like a caring mentor — praise strengths FIRST, then gently suggest improvements.
- Use phrases like "You're doing great!", "Keep going!", and "Nice work!" to create a warm atmosphere.
- Occasionally share mini motivational quotes or fun IELTS tips to keep students excited.
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
        "default": "Hello there! 👋 I'm Coach, the LWAC AI assistant. I can help you practice IELTS, explain vocabulary, review writing, or share study tips. Where would you like to start?",
        "vocab": '📚 Here are some useful IELTS vocabulary items:\n\n• **Subsequently** /sʌb.sɪ.kwənt.li/ - after that; later\n  _"Subsequently, the government introduced new policies."_\n\n• **Prevalent** /prev.əl.ənt/ - common; widespread\n  _"Obesity is becoming increasingly prevalent in modern society."_\n\nWhat topic would you like to study next?',
        "writing": "✍️ To reach Band 7+ in IELTS Writing Task 2, focus on:\n\n1. **Task Response**: answer the question fully and clearly\n2. **Coherence**: organize ideas logically across paragraphs\n3. **Lexical Resource**: use varied and accurate vocabulary\n4. **Grammar**: show a range of sentence structures\n\nWould you like me to review a writing sample? 😊",
        "reading": "📖 IELTS Reading tips:\n\n1. **Skim** the passage first (about 2 minutes)\n2. Read the questions **before** detailed reading\n3. Watch for **keywords** and **paraphrasing**\n4. Manage time: about 20 minutes per passage\n\nWhich question type feels hardest for you?",
        "listening": "🎧 IELTS Listening tips:\n\n1. Read the questions **before** the audio starts\n2. Watch for **signal words** like however, but, and although\n3. Write quickly and check answers afterward\n4. Practice listening to English audio every day\n\nWhat kind of listening practice do you want to do?",
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
    api_key = settings.GEMINI_API_KEY

    if session_id not in _conversations:
        _conversations[session_id] = []

    _conversations[session_id].append(
        {"role": "user", "parts": [{"text": user_message}]}
    )

    if len(_conversations[session_id]) > 20:
        _conversations[session_id] = _conversations[session_id][-20:]

    if not api_key or not GENAI_AVAILABLE:
        response = _get_mock_response(user_message)
        _conversations[session_id].append(
            {"role": "model", "parts": [{"text": response}]}
        )
        if not GENAI_AVAILABLE:
            response = "⚠️ [AI service unavailable, using demo mode]\n\n" + response
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
                _conversations[session_id].append(
                    {"role": "model", "parts": [{"text": assistant_message}]}
                )
                print(f"[Chat] Success with model: {model_name}")
                return assistant_message

            except Exception as e:
                last_error = e
                error_str = str(e)
                print(
                    f"[Chat] Model {model_name} attempt {attempt + 1} failed: {error_str[:120]}"
                )
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    if attempt == 0:
                        time.sleep(2)  # Brief wait before retry
                        continue
                break  # Try next model

    # All models failed — use mock with a note
    print(f"[Chat] All models failed, using mock. Last error: {last_error}")
    response = _get_mock_response(user_message)
    response = "⚠️ [AI is currently rate-limited, using demo mode]\n\n" + response
    _conversations[session_id].append({"role": "model", "parts": [{"text": response}]})
    return response
