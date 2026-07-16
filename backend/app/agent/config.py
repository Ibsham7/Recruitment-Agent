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
    "fast": "google/gemini-2.5-flash",
}
EMBEDDING_MODEL = "text-embedding-3-small"
# ----------------------

def get_model(tier: str = "smart") -> ChatOpenAI:
    """
    smart  → google/gemini-2.5-flash: Highly reliable and intelligent model with 1M context for complex JSON parsing.
    fast   → google/gemini-2.5-flash: Using the same model for fast tasks due to its speed, low cost, and extreme reliability.
    """
    return ChatOpenAI(
        model=MODELS[tier],
        openai_api_base=OPENROUTER_BASE,  # type: ignore
        openai_api_key=OPENROUTER_KEY,    # type: ignore
        temperature=0,        # deterministic — you want consistent scoring
        max_retries=5,        # Automatically retry on 429 RateLimitError upstream
    )

# Verify before proceeding — run this once
if __name__ == "__main__":
    for tier in ["smart", "fast"]:
        m = get_model(tier)
        result = m.invoke("Reply with just: OK")
        print(f"{tier}: {result.content}")