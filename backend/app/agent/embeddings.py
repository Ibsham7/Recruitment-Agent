import os
import httpx
import numpy as np
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.prompts import JD_DISTILLER_SYSTEM
from app.agent.config import get_model, EMBEDDING_MODEL

async def get_embedding_with_cost_async(text: str) -> tuple[list[float], float, dict]:
    """Get embedding using configured model via OpenRouter asynchronously and compute token cost."""
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
    timeout = httpx.Timeout(timeout=30.0, connect=15.0)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/embeddings",
                    headers=headers,
                    json=data
                )
                if response.status_code != 200:
                    raise RuntimeError(f"Failed to get embedding ({response.status_code}): {response.text}")
                
                resp_json = response.json()
                embedding = resp_json["data"][0]["embedding"]
                usage = resp_json.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens") or usage.get("total_tokens") or len(text.split())
                cost = round((prompt_tokens / 1_000_000) * 0.02, 6)
                token_info = {
                    "input_tokens": prompt_tokens,
                    "output_tokens": 0,
                    "total_tokens": prompt_tokens,
                    "cost": cost
                }
                return embedding, cost, token_info
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPError) as e:
            if attempt == max_retries - 1:
                raise RuntimeError(f"Failed to get embedding after {max_retries} attempts: {e}") from e
            import asyncio
            await asyncio.sleep(2 ** attempt)

async def get_embedding_async(text: str) -> list[float]:
    """Get embedding using configured model via OpenRouter asynchronously."""
    vec, _, _ = await get_embedding_with_cost_async(text)
    return vec


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    a = np.array(v1)
    b = np.array(v2)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

async def _distill_jd_with_cost_async(jd_text: str) -> tuple[str, float, dict]:
    """Distill the JD to its core requirements and compute token costs."""
    try:
        from app.agent.utils import extract_cost_and_tokens
        from app.agent.security import build_secure_llm_payload
        secure_jd_payload, _ = build_secure_llm_payload(
            jd_text,
            label="JOB_DESCRIPTION",
            task_description="Distill the core technical qualification requirements from this Job Description"
        )
        model = get_model("fast")
        response = await model.ainvoke([
            SystemMessage(content=JD_DISTILLER_SYSTEM),
            HumanMessage(content=secure_jd_payload)
        ])
        cost, token_info = extract_cost_and_tokens(response, model_name="google/gemini-3.1-flash-lite")
        return response.content, cost, token_info
    except Exception as e:
        print(f"  [JD Distiller] LLM distillation failed (rate limit/error): {e}. Falling back to raw JD.")
        return jd_text, 0.0, {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost": 0.0}

async def _distill_jd_async(jd_text: str) -> str:
    """Distill the JD to its core requirements to avoid diluting embeddings."""
    distilled_text, _, _ = await _distill_jd_with_cost_async(jd_text)
    return distilled_text
