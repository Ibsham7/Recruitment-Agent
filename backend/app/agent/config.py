# config.py
import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY_PAID")

# --- Model Settings ---
MODELS = {
    "smart": "google/gemini-3.1-flash-lite",
    "fast": "google/gemini-3.1-flash-lite",
    "ocr": "google/gemini-2.5-flash-lite",
}
EMBEDDING_MODEL = "text-embedding-3-small"
# ----------------------

def get_model(tier: str = "smart", max_tokens: int = None) -> ChatOpenAI:
    """
    smart  → google/gemini-2.5-flash: High-performance reasoning model for structured/complex extraction.
    fast   → google/gemini-2.5-flash-lite: Fast, cost-effective model for initial extraction pass.
    """
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
        model=MODELS.get(tier, MODELS["fast"]),
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