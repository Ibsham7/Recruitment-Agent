import os
import json
import asyncio
import httpx
import hashlib
from app.database import prisma
from app.agent.embeddings import get_embedding_async, get_embedding_with_cost_async, cosine_similarity, _distill_jd_async
from app.agent.state import RecruitmentState
from app.core.logging import logger

async def _ensure_resume_embedding_async(file_hash: str, text_to_embed: str) -> tuple[list[float] | None, float, dict]:
    """
    Ensures that the Resume embedding exists in the database.
    Returns the vector list and cost info only if generated on the fly.
    """
    result = await prisma.query_raw('''
        SELECT (embedding IS NOT NULL) AS has_embedding 
        FROM "Resume" 
        WHERE "fileHash" = $1
        LIMIT 1
    ''', file_hash)
    
    if result and result[0].get('has_embedding'):
        return None, 0.0, {}
        
    # Generate the embedding asynchronously if not present
    embedding, cost, token_info = await get_embedding_with_cost_async(text_to_embed)
    
    # Store it for the global Resume record
    await prisma.execute_raw('''
        UPDATE "Resume"
        SET embedding = $1::vector
        WHERE "fileHash" = $2
    ''', str(embedding), file_hash)
    
    return embedding, cost, token_info

async def _get_or_create_embedding_async(file_hash: str, text_to_embed: str) -> list[float]:
    """Legacy helper maintained for backward compatibility."""
    vector, _, _ = await _ensure_resume_embedding_async(file_hash, text_to_embed)
    if vector is not None:
        return vector
    result = await prisma.query_raw('''
        SELECT embedding::text FROM "Resume" WHERE "fileHash" = $1 AND embedding IS NOT NULL LIMIT 1
    ''', file_hash)
    if result and result[0].get('embedding'):
        return json.loads(result[0]['embedding'])
    return []

async def embedding_matcher_node(state: RecruitmentState) -> dict:
    """
    Filters candidates based on vector similarity between structured CV and JD.
    Uses native PGVector cosine distance (<=>) in PostgreSQL directly.
    """
    logger.info("[Embedding Matcher] Calculating semantic similarity...")
    profile = state.get("candidate_profile")
    jd = state.get("job_description", "")
    
    if not profile:
        return {"filter_rejections": ["No profile parsed."]}
    
    # Text representation of CV
    cv_summary = (
        f"Skills: {', '.join(profile.skills)}. "
        f"Experience: {profile.total_experience_years} years. "
        f"Roles: {', '.join([str(r) for r in profile.previous_roles])}. "
        f"Education: {', '.join(getattr(profile, 'education', []))}. "
        f"Projects: {', '.join(getattr(profile, 'projects', []))}. "
        f"Other Info: {getattr(profile, 'other_info', '')}."
    )
    
    # Use hash of the raw CV text for deterministic deduplication
    raw_text = profile.raw_cv_text or cv_summary
    file_hash = hashlib.sha256(raw_text.encode('utf-8', errors='replace')).hexdigest()
    
    # Ensure Resume embedding exists in DB (generated on-the-fly if missing)
    cv_vector, embed_cost, embed_tokens = await _ensure_resume_embedding_async(file_hash, cv_summary)
    
    candidate_id = state.get("candidate_id")
    
    # Query database for cached JD embedding availability
    campaign_data = await prisma.query_raw('''
        SELECT c.id, c."distilledJd", (c."jdEmbedding" IS NOT NULL) AS has_jd_embedding 
        FROM "Candidate" cand
        JOIN "Campaign" c ON cand."campaignId" = c.id
        WHERE cand.id = $1
    ''', candidate_id)

    has_jd_embedding = False
    jd_distilled = None
    campaign_id = None
    jd_vector = None

    if campaign_data:
        campaign_id = campaign_data[0]['id']
        jd_distilled = campaign_data[0].get('distilledJd')
        has_jd_embedding = bool(campaign_data[0].get('has_jd_embedding'))

    if not has_jd_embedding or not jd_distilled:
        # Compute JD distillation and embedding on the fly if missing
        jd_distilled = await _distill_jd_async(jd)
        jd_vector = await get_embedding_async(jd_distilled)
        
        # Self-heal: save it back to the campaign for the next candidates
        if campaign_id:
            await prisma.execute_raw('''
                UPDATE "Campaign"
                SET "distilledJd" = $1, "jdEmbedding" = $2::vector
                WHERE id = $3
            ''', jd_distilled, str(jd_vector), campaign_id)
            from app.dev_logger import log_event
            log_event(campaign_id, "JD_EMBEDDING", f"JD embedded successfully for Campaign {campaign_id}")
            logger.info(f"[JD Embedding] Distilled and embedded JD for Campaign {campaign_id}")
            
    # Try querying native PGVector cosine similarity directly from database
    similarity_result = await prisma.query_raw('''
        SELECT 1 - (r.embedding <=> c."jdEmbedding") AS similarity
        FROM "Candidate" cand
        JOIN "Resume" r ON cand."resumeId" = r.id
        JOIN "Campaign" c ON cand."campaignId" = c.id
        WHERE cand.id = $1 AND r.embedding IS NOT NULL AND c."jdEmbedding" IS NOT NULL
    ''', candidate_id)

    if similarity_result and similarity_result[0].get('similarity') is not None:
        similarity = float(similarity_result[0]['similarity'])
    else:
        # Fallback: Lazily load raw vector text only if native DB similarity query failed
        if cv_vector is None:
            resume_data = await prisma.query_raw('''
                SELECT embedding::text 
                FROM "Resume" 
                WHERE "fileHash" = $1 AND embedding IS NOT NULL
                LIMIT 1
            ''', file_hash)
            if resume_data and resume_data[0].get('embedding'):
                cv_vector = json.loads(resume_data[0]['embedding'])
        
        if jd_vector is None and campaign_id:
            camp_vec_data = await prisma.query_raw('''
                SELECT "jdEmbedding"::text 
                FROM "Campaign" 
                WHERE id = $1 AND "jdEmbedding" IS NOT NULL
            ''', campaign_id)
            if camp_vec_data and camp_vec_data[0].get('jdEmbedding'):
                jd_vector = json.loads(camp_vec_data[0]['jdEmbedding'])
                
        if cv_vector and jd_vector:
            similarity = cosine_similarity(cv_vector, jd_vector)
        else:
            similarity = 0.0

    logger.info(f"[Embedding Matcher] Semantic Score: {similarity:.2f}")
    
    # Read strategy from env or default to threshold
    strategy = os.getenv("EMBEDDING_STRATEGY", "threshold")
    
    ret_dict = {
        "semantic_score": similarity,
        "log": [f"Semantic score: {similarity:.2f}"]
    }
    if embed_cost > 0:
        ret_dict["total_cost"] = round(embed_cost, 6)
        ret_dict["stage_costs"] = {
            "embedding_matcher": {
                "cost": round(embed_cost, 6),
                "tokens": embed_tokens
            }
        }
    
    if strategy == "threshold":
        threshold = float(os.getenv("EMBEDDING_THRESHOLD", "0.25"))
        if similarity < threshold:
            reason = f"Candidate semantic similarity ({similarity:.2f}) is below threshold ({threshold})."
            logger.info(f"[Embedding Matcher] [FAIL] Rejected: {reason}")

            from app.agent.schemas import ScreeningResult, ScoreBreakdown
            breakdown = ScoreBreakdown(
                formula_summary=f"Filtered at Stage 3 (Embedding Similarity {similarity:.2f} < {threshold})"
            )
            screening = ScreeningResult(
                fit_score=0,
                decision="reject",
                reasoning_summary=f"Candidate was filtered at Stage 3 due to low semantic similarity to job domain ({similarity:.2f}).",
                score_breakdown=breakdown
            )

            ret_dict["pipeline_status"] = "rejected"
            ret_dict["rejection_reason"] = reason
            ret_dict["screening_result"] = screening
            ret_dict["log"] = [f"Semantic score: {similarity:.2f} (Rejected: below threshold {threshold})"]
            return ret_dict
        logger.info("[Embedding Matcher] [OK] Passed embedding threshold.")
        ret_dict["log"] = [f"Semantic score: {similarity:.2f} (Passed threshold {threshold})"]
        return ret_dict
    else:
        # Batch mode: we let everyone pass this node, but record their score.
        # batch_run.py will later filter the top N%.
        logger.info("[Embedding Matcher] [INFO] Batch mode active. Score recorded.")
        ret_dict["log"] = [f"Semantic score: {similarity:.2f} (Batch mode)"]
        return ret_dict
