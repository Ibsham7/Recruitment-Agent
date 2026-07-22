import os
import json
import asyncio
from app.database import prisma
from app.agent.embeddings import get_embedding_async, cosine_similarity, _distill_jd_async
from app.agent.state import RecruitmentState

import httpx
import hashlib

async def _get_or_create_embedding_async(file_hash: str, text_to_embed: str) -> list[float]:
    # Check if we already have an embedding stored for this CV hash
    result = await prisma.query_raw('''
        SELECT embedding::text 
        FROM "Resume" 
        WHERE "fileHash" = $1 AND embedding IS NOT NULL
        LIMIT 1
    ''', file_hash)
    
    if result and result[0].get('embedding'):
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
    Uses native PGVector cosine distance (<=>) in PostgreSQL when embeddings are present.
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
    
    # Query database for cached JD embedding and distillation
    candidate_id = state.get("candidate_id")
    campaign_data = await prisma.query_raw('''
        SELECT c.id, c."distilledJd", c."jdEmbedding"::text 
        FROM "Candidate" cand
        JOIN "Campaign" c ON cand."campaignId" = c.id
        WHERE cand.id = $1
    ''', candidate_id)

    jd_distilled = None
    jd_vector = None
    campaign_id = None

    if campaign_data:
        campaign_id = campaign_data[0]['id']
        if campaign_data[0].get('jdEmbedding') and campaign_data[0].get('distilledJd'):
            jd_distilled = campaign_data[0]['distilledJd']
            jd_vector = json.loads(campaign_data[0]['jdEmbedding'])

    if not jd_vector or not jd_distilled:
        # Fallback: compute it on the fly
        jd_distilled = await _distill_jd_async(jd)
        jd_vector = await get_embedding_async(jd_distilled)
        
        # Self-heal: save it back to the campaign for the next candidates
        if campaign_id:
            await prisma.execute_raw('''
                UPDATE "Campaign"
                SET "distilledJd" = $1, "jdEmbedding" = $2::vector
                WHERE id = $3
            ''', jd_distilled, str(jd_vector), campaign_id)
            
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
