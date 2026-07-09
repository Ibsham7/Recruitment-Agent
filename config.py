# config.py
import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")

def get_model(tier: str = "smart") -> ChatOpenAI:
    """
    smart  → claude-sonnet-4-6   Best tool calling + instruction following.
                                  Use for CV parsing, interview conducting, evaluation.
    fast   → google/gemini-2.5-flash-preview-05-20
                                  Faster + cheaper. Use for JD matching/scoring.
    """
    models = {
        "smart": "anthropic/claude-sonnet-4-6",
        "fast": "google/gemini-3.1-flash-lite",
    }
    return ChatOpenAI(
        model=models[tier],
        openai_api_base=OPENROUTER_BASE,  # type: ignore
        openai_api_key=OPENROUTER_KEY,    # type: ignore
        temperature=0,        # deterministic — you want consistent scoring
    )

# Verify before proceeding — run this once
if __name__ == "__main__":
    for tier in ["smart", "fast"]:
        m = get_model(tier)
        result = m.invoke("Reply with just: OK")
        print(f"{tier}: {result.content}")