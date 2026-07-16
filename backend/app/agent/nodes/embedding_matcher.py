from app.agent.state import RecruitmentState
import os
import json
import asyncio
import numpy as np
from app.database import prisma
from app.agent.config import get_model
from langchain_core.messages import SystemMessage, HumanMessage

import requests
import httpx
import hashlib

# Lazy load embeddings to avoid heavy import on startup if not needed
async def get_embedding_async(text: str) -> list[float]:
    """Get embedding using text-embedding-3-small via OpenRouter asynchronously."""
    api_key = os.getenv("OPENROUTER_API_KEY_PAID")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY_PAID not set. Cannot get embeddings.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "text-embedding-3-small",
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
            SystemMessage(content="You are a helpful assistant. Extract ONLY the core skills, required experience, and key responsibilities from this Job Description. Exclude company boilerplate, benefits, and EEO statements. Be concise."),
            HumanMessage(content=jd_text)
        ])
        return response.content
    except Exception as e:
        print(f"  [JD Distiller] LLM distillation failed (rate limit/error): {e}. Falling back to raw JD.")
        return jd_text

async def _get_or_create_embedding_async(file_hash: str, text_to_embed: str) -> list[float]:
    # Check if we already have an embedding stored for this CV hash
    result = await prisma.query_raw('''
        SELECT embedding::text 
        FROM "Resume" 
        WHERE "fileHash" = $1 AND embedding IS NOT NULL
        LIMIT 1
    ''', file_hash)
    
    if result and result[0].get('embedding'):
        # The database returns it as a string e.g. "[0.1, 0.2, ...]"
        embedding_str = result[0]['embedding']
        return json.loads(embedding_str)
        
    # Generate the embedding asynchronously
    embedding = await get_embedding_async(text_to_embed)
    
    # Store it for the global Resume record
    await prisma.execute_raw('''
        UPDATE "Resume"
        SET embedding = $1::vector
        WHERE "fileHash" = $2
    ''', str(embedding), file_hash)
    
    return embedding

async def embedding_matcher_node(state: RecruitmentState) -> dict:
    """
    Filters candidates based on vector similarity between structured CV and JD.
    Option A: Threshold-based. Option B: Batch Top-N% (implemented outside this node in batch_run.py).
    For the graph node (processing single candidate), we use Option A.
    """
    print("\n[Embedding Matcher] Calculating semantic similarity...")
    profile = state.get("candidate_profile")
    jd = state.get("job_description", "")
    
    if not profile:
        return {"filter_rejections": ["No profile parsed."]}
    
    # Text representation of CV
    cv_summary = (
        f"Skills: {', '.join(profile.skills)}. "
        f"Experience: {profile.total_experience_years} years. "
        f"Roles: {', '.join(profile.previous_roles)}. "
        f"Education: {', '.join(getattr(profile, 'education', []))}. "
        f"Projects: {', '.join(getattr(profile, 'projects', []))}. "
        f"Other Info: {getattr(profile, 'other_info', '')}."
    )
    
    # Use hash of the raw CV text for deterministic deduplication
    raw_text = profile.raw_cv_text or cv_summary
    file_hash = hashlib.sha256(raw_text.encode('utf-8')).hexdigest()
    
    cv_vector = await _get_or_create_embedding_async(file_hash, cv_summary)
    
    jd_distilled = await _distill_jd_async(jd)
    jd_vector = await get_embedding_async(jd_distilled)
    
    similarity = cosine_similarity(cv_vector, jd_vector)
    print(f"  Similarity Score: {similarity:.2f}")
    
    # Read strategy from env or default to threshold
    strategy = os.getenv("EMBEDDING_STRATEGY", "threshold")
    
    logs = [
        f"Embedder Input CV: {cv_summary}",
        f"Embedder Input JD (Distilled): {jd_distilled}",
        f"Semantic scoring worked by calculating cosine similarity between the CV and JD vectors, yielding: {similarity:.2f}"
    ]
    
    if strategy == "threshold":
        threshold = float(os.getenv("EMBEDDING_THRESHOLD", "0.4"))
        if similarity < threshold:
            reason = f"Candidate semantic similarity ({similarity:.2f}) is below threshold ({threshold})."
            print(f"  [FAIL] Rejected: {reason}")
            return {
                "pipeline_status": "rejected",
                "rejection_reason": reason,
                "semantic_score": similarity,
                "log": logs + [f"Embedding rejected: {reason}"]
            }
        print("  [OK] Passed embedding threshold.")
        return {
            "semantic_score": similarity,
            "log": logs + [f"Passed embedding threshold with score {similarity:.2f}"]
        }
    else:
        # Batch mode: we let everyone pass this node, but record their score.
        # batch_run.py will later filter the top N%.
        print("  ℹ Batch mode active. Score recorded.")
        return {
            "semantic_score": similarity,
            "log": logs + [f"Embedding calculated (score {similarity:.2f}). Waiting for batch filter."]
        }
