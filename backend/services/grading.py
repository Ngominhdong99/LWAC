"""
AI Writing Grader Service for LWAC — powered by Google Gemini (free tier).
Tries multiple models as fallback.
"""

import json
import time
from google import genai
from core.config import settings

GRADING_PROMPT = """You are "Coach Minh Dong", a friendly and supportive IELTS buddy who talks like a close friend, NOT a formal teacher.

When grading, you MUST:
1. Be ACCURATE and HONEST with the band score — never inflate grades.
2. Talk like a supportive FRIEND — casual, warm, and encouraging. Use "you" naturally.
3. Always start with what the student did WELL — genuinely praise their strengths!
4. Then gently point out areas to improve, like a friend giving honest advice ("Hey, one thing you could try is...").
5. End with a motivational boost ("You're getting better every day! Keep it up! 💪").
6. Write ALL feedback in English.
7. Use emojis naturally but not excessively (✨, 💪, 🌟, 👏, 🔥).

Respond STRICTLY in JSON:
{
    "estimated_band": float,
    "feedback": "Friendly, detailed feedback paragraph in English",
    "criteria_scores": {
        "Task Achievement": float,
        "Coherence and Cohesion": float,
        "Lexical Resource": float,
        "Grammatical Range": float
    }
}"""

MODELS_TO_TRY = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]


def grade_writing_task(prompt: str, user_response: str) -> dict:
    api_key = settings.GEMINI_API_KEY

    mock_result = {
        "estimated_band": 6.5,
        "feedback": "This is a demo evaluation. Your essay shows a reasonable structure with clear paragraphs. To improve: (1) Use more advanced vocabulary and collocations, (2) Vary your sentence structures with more complex grammar, (3) Add more specific examples to support your arguments. Keep practicing!",
        "criteria_scores": {
            "Task Achievement": 6.5,
            "Coherence and Cohesion": 7.0,
            "Lexical Resource": 6.0,
            "Grammatical Range": 6.0,
        },
    }

    if not api_key:
        return mock_result

    user_content = f"Task Prompt:\n{prompt}\n\nStudent Response:\n{user_response}"
    client = genai.Client(api_key=api_key)

    for model_name in MODELS_TO_TRY:
        for attempt in range(2):  # Retry once on rate limit
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[{"role": "user", "parts": [{"text": user_content}]}],
                    config=genai.types.GenerateContentConfig(
                        system_instruction=GRADING_PROMPT,
                        temperature=0.3,
                        max_output_tokens=800,
                        response_mime_type="application/json",
                    ),
                )
                result_text = response.text
                print(f"[Grading] Success with model: {model_name}")
                return json.loads(result_text)

            except Exception as e:
                error_str = str(e)
                print(
                    f"[Grading] Model {model_name} attempt {attempt + 1} failed: {error_str[:120]}"
                )
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    if attempt == 0:
                        time.sleep(3)  # Brief wait before retry
                        continue
                break  # Try next model

    print("[Grading] All models failed, returning mock result")
    return mock_result
