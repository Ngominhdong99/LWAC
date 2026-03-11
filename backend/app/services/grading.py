"""
AI Writing Grader Service for LWAC — powered by Google Gemini (free tier).
Tries multiple models as fallback.
"""
import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

GRADING_PROMPT = """You are an expert IELTS examiner. Evaluate the student's response based on IELTS criteria.
Respond STRICTLY in JSON:
{
    "estimated_band": float,
    "feedback": "Detailed feedback paragraph",
    "criteria_scores": {
        "Task Achievement": float,
        "Coherence and Cohesion": float,
        "Lexical Resource": float,
        "Grammatical Range": float
    }
}"""

MODELS_TO_TRY = [
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash",
]


def grade_writing_task(prompt: str, user_response: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")

    mock_result = {
        "estimated_band": 6.5,
        "feedback": "This is a demo evaluation. Your essay shows a reasonable structure with clear paragraphs. To improve: (1) Use more advanced vocabulary and collocations, (2) Vary your sentence structures with more complex grammar, (3) Add more specific examples to support your arguments. Keep practicing!",
        "criteria_scores": {
            "Task Achievement": 6.5,
            "Coherence and Cohesion": 7.0,
            "Lexical Resource": 6.0,
            "Grammatical Range": 6.0
        }
    }

    if not api_key:
        return mock_result

    user_content = f"Task Prompt:\n{prompt}\n\nStudent Response:\n{user_response}"
    client = genai.Client(api_key=api_key)

    for model_name in MODELS_TO_TRY:
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
            print(f"[Grading] Model {model_name} failed: {error_str[:100]}")
            continue

    print("[Grading] All models failed, returning mock result")
    return mock_result
