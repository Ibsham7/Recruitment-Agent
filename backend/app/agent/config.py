# config.py
import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY_PAID")

# --- Model Settings ---
MODELS = {
    "smart": os.getenv("SMART_MODEL", "google/gemini-3.1-flash-lite"),
    "fast": os.getenv("FAST_MODEL", "google/gemini-3.1-flash-lite"),
    "ocr": os.getenv("OCR_MODEL", "google/gemini-3.1-flash-lite"),
    "cv_parser": os.getenv("CV_PARSER_MODEL", "google/gemini-3.1-flash-lite"),
    "cv_parser_ocr": os.getenv("CV_PARSER_OCR_MODEL", "google/gemini-3.1-flash-lite"),
}
EMBEDDING_MODEL = "text-embedding-3-small"
# ----------------------

def get_model(tier: str = "smart", max_tokens: int = None) -> ChatOpenAI:
    """
    smart         → Screening, question generation, and evaluation.
    fast          → Extraction pass.
    cv_parser     → Model used specifically for CV parsing node.
    cv_parser_ocr → Vision OCR model used for CV parser fallback.
    ocr           → General vision OCR model.
    """
    model_name = MODELS.get(tier) or MODELS.get("fast") or "google/gemini-3.1-flash-lite"

    kwargs = {
        "seed": 42,
        "top_p": 0.01,
        "extra_body": {"include_reasoning": False},
        "default_headers": {
            "HTTP-Referer": "https://recruitmentagent.ai",
            "X-Title": "Recruitment Agent"
        }
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
        
    return ChatOpenAI(
        model=model_name,
        openai_api_base=OPENROUTER_BASE,  # type: ignore
        openai_api_key=OPENROUTER_KEY,    # type: ignore
        temperature=0,        # deterministic — you want consistent scoring
        max_retries=5,        # Automatically retry on 429 RateLimitError upstream
        **kwargs,
    )

# Verify before proceeding — run this once
if __name__ == "__main__":
    for tier in ["smart", "fast"]:
        m = get_model(tier)
        result = m.invoke("Reply with just: OK")
        print(f"{tier}: {result.content}")