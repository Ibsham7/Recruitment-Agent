# config.py
import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY_PAID")

# --- Model Settings ---
MODELS = {
    "smart": "google/gemini-2.5-flash",
    "fast": "google/gemini-2.5-flash-lite",
    "ocr": "google/gemini-2.5-flash-lite",
}
EMBEDDING_MODEL = "text-embedding-3-small"
# ----------------------

def get_model(tier: str = "smart", max_tokens: int = None) -> ChatOpenAI:
    """
    smart  → google/gemini-2.5-flash: Highly reliable and intelligent model with 1M context for complex JSON parsing.
    fast   → google/gemini-2.5-flash-lite: Using a non-reasoning, cost-effective model for fast and bulk extraction tasks.
    """
    kwargs = {"seed": 42, "top_p": 0.01}
    # Disable internal reasoning tokens for routine tasks to save costs, but keep for evaluations
    if tier != "smart":
        kwargs["extra_body"] = {"include_reasoning": False}
        kwargs["max_tokens"] = max_tokens if max_tokens is not None else 2000  # Default 2000 unless overridden
    elif max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
        
    return ChatOpenAI(
        model=MODELS[tier],
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