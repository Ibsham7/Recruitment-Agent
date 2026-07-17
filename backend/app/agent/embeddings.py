import os
import httpx
import numpy as np
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.prompts import JD_DISTILLER_SYSTEM
from app.agent.config import get_model, EMBEDDING_MODEL

async def get_embedding_async(text: str) -> list[float]:
    """Get embedding using configured model via OpenRouter asynchronously."""
    api_key = os.getenv("OPENROUTER_API_KEY_PAID")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY_PAID not set. Cannot get embeddings.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": EMBEDDING_MODEL,
        "input": text
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers=headers,
            json=data
        )
        if response.status_code != 200:
            raise RuntimeError(f"Failed to get embedding ({response.status_code}): {response.text}")
        
        return response.json()["data"][0]["embedding"]

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    a = np.array(v1)
    b = np.array(v2)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

async def _distill_jd_async(jd_text: str) -> str:
    """Distill the JD to its core requirements to avoid diluting embeddings."""
    try:
        model = get_model("fast")
        response = await model.ainvoke([
            SystemMessage(content=JD_DISTILLER_SYSTEM),
            HumanMessage(content=jd_text)
        ])
        return response.content
    except Exception as e:
        print(f"  [JD Distiller] LLM distillation failed (rate limit/error): {e}. Falling back to raw JD.")
        return jd_text
