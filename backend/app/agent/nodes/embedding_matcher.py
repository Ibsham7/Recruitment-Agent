from state import RecruitmentState
import os
import json
import asyncio
import numpy as np
from prisma import Prisma
from config import get_model
from langchain_core.messages import SystemMessage, HumanMessage

# Lazy load embeddings to avoid heavy import on startup if not needed
def get_embedding(text: str) -> list[float]:
    """Get embedding using a fast open-source model via OpenRouter or fallback."""
    # Note: OpenRouter doesn't have a standard embedding API, so for this prototype,
    # we could use a cheap LLM to generate a comma-separated array, OR we use
    # a local SentenceTransformer. Here we'll mock it if sentence-transformers isn't installed.
    try:
        from sentence_transformers import SentenceTransformer
        # Use a tiny local model
        model = SentenceTransformer("all-MiniLM-L6-v2")
        return model.encode(text).tolist()
    except ImportError:
        # Fallback dummy embedding for testing
        print("Warning: sentence-transformers not installed. Using dummy embedding.")
        return [0.1] * 384

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    a = np.array(v1)
    b = np.array(v2)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def _get_or_create_embedding_sync(cv_filepath: str, text_to_embed: str) -> list[float]:
    async def _async_task():
        prisma = Prisma()
        await prisma.connect()
        try:
            candidate = await prisma.candidate.find_first(
                where={"resumePath": cv_filepath}
            )
            # Prisma Python doesn't officially decode Unsupported("vector") nicely in all versions.
            # For this MVP, we'll embed on the fly and optionally store if we had raw SQL.
            # Since vector isn't fully supported in Prisma Client Py read, we generate it.
            return get_embedding(text_to_embed)
        finally:
            await prisma.disconnect()
    return asyncio.run(_async_task())

def embedding_matcher_node(state: RecruitmentState) -> dict:
    """
    Filters candidates based on vector similarity between structured CV and JD.
    Option A: Threshold-based. Option B: Batch Top-N% (implemented outside this node in batch_run.py).
    For the graph node (processing single candidate), we use Option A.
    """
    print("\n[Embedding Matcher] Calculating semantic similarity...")
    profile = state.get("candidate_profile")
    jd = state.get("job_description", "")
    
    if not profile:
        return {"pipeline_status": "rejected", "rejection_reason": "No profile parsed."}
    
    # Text representation of CV
    cv_summary = f"Skills: {', '.join(profile.skills)}. Experience: {profile.total_experience_years} years. Roles: {', '.join(profile.previous_roles)}."
    
    cv_vector = _get_or_create_embedding_sync(state["cv_filepath"], cv_summary)
    jd_vector = get_embedding(jd)
    
    similarity = cosine_similarity(cv_vector, jd_vector)
    print(f"  Similarity Score: {similarity:.2f}")
    
    # Read strategy from env or default to threshold
    strategy = os.getenv("EMBEDDING_STRATEGY", "threshold")
    
    if strategy == "threshold":
        threshold = float(os.getenv("EMBEDDING_THRESHOLD", "0.5"))
        if similarity < threshold:
            reason = f"Candidate semantic similarity ({similarity:.2f}) is below threshold ({threshold})."
            print(f"  [FAIL] Rejected: {reason}")
            return {
                "pipeline_status": "rejected",
                "rejection_reason": reason,
                "log": [f"Embedding rejected: {reason}"]
            }
        print("  [OK] Passed embedding threshold.")
        return {
            "pipeline_status": "running",
            "log": [f"Passed embedding threshold with score {similarity:.2f}"]
        }
    else:
        # Batch mode: we let everyone pass this node, but record their score.
        # batch_run.py will later filter the top N%.
        print("  ℹ Batch mode active. Score recorded.")
        return {
            "pipeline_status": "running",
            "log": [f"Embedding calculated (score {similarity:.2f}). Waiting for batch filter."]
        }
