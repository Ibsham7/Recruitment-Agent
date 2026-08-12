import hashlib
import json
import re
from datetime import date
from typing import Any, Optional, Tuple
from app.agent.config import get_model, MODELS
from app.agent.schemas import (
    ScreeningResult,
    CompactScreeningOutput,
    CanonicalJDSpec,
    CanonicalJDRequirement,
    RequirementMatch,
    ScoreBreakdown
)
from app.agent.state import RecruitmentState
from app.agent.utils import extract_cost_and_tokens, extract_json, clean_surrogates
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import JD_MATCHER_PROMPTS, CANONICAL_JD_DISTILLER_PROMPT, PROMPT_VERSION
from app.core.logging import logger
from app.agent.tools.scoring import TENURE_PATTERN, calculate_weighted_fit_score
from app.agent.tools.timeline import calculate_experience_for_domain
from app.agent.tools.verification import extract_dynamic_requirement_tokens, check_dynamic_token_presence, classify_evidence_source

# In-memory cache for canonical JD specifications to freeze requirements per JD text + PROMPT_VERSION
_JD_SPEC_CACHE: dict[str, CanonicalJDSpec] = {}

GENERIC_TENURE_WORDS = {
    "software", "engineering", "experience", "professional", "development", "minimum",
    "years", "yrs", "year", "yr", "work", "industry", "field", "hands-on", "proven",
    "track", "record", "background", "overall", "total", "relevant", "domain", "building",
    "operating", "production", "backend", "systems", "system", "in", "of", "with", "and",
    "for", "a", "an", "the", "strong", "expertise", "knowledge", "skills", "skill",
    "ability", "demonstrated", "required", "at", "least", "plus", "building", "operating",
    "senior", "lead", "engineer"
}

def classify_and_clean_requirement(req: CanonicalJDRequirement) -> tuple[str, float, str]:
    """
    Classifies requirement bullet into:
    - 'tenure_only': Pure experience duration bullet (e.g., '5+ years software engineering experience'). Returns ('tenure_only', extracted_years, cleaned_name)
    - 'skill_with_tenure': Technical skill with tenure specifier (e.g., 'Python and FastAPI (3+ years)'). Returns ('skill_with_tenure', extracted_years, cleaned_name)
    - 'qualitative_skill': Technical/qualitative skill with no tenure quantifier. Returns ('qualitative_skill', 0.0, cleaned_name)
    """
    name = req.requirement_name or ""
    quote = req.jd_quote or ""
    combined = f"{name} {quote}"
    
    # 1. Extract numerical tenure years
    extracted_yrs = 0.0
    years_match = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?|yr)", combined, re.IGNORECASE)
    if years_match:
        extracted_yrs = float(years_match.group(1))

    # 2. Strip tenure parentheticals and expressions from requirement_name
    cleaned = re.sub(r"\s*\(\s*\d+(?:\.\d+)?\+?\s*(?:years?|yrs?|yr)\b[^\)]*\)", "", name, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(?:minimum\s+)?\d+(?:\.\d+)?\+?\s*(?:years?|yrs?|yr)\b(?:\s+of\s+(?:professional\s+)?(?:software\s+engineering\s+|development\s+)?experience)?", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^\s*(?:experience\s+with|expertise\s+with|strong\s+hands-on\s+expertise\s+with|hands-on\s+experience\s+with|minimum\s+of)\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip(" :-–—(),.")

    # 3. Check remaining substantive tokens (ignoring pure digits and generic tenure words)
    tokens = [w.lower() for w in re.findall(r"\w+", cleaned)]
    substantive_tokens = [w for w in tokens if not w.isdigit() and w not in GENERIC_TENURE_WORDS]

    is_pure_tenure = (
        req.req_type == "tenure_duration" or
        TENURE_PATTERN.search(name) is not None or
        TENURE_PATTERN.search(quote) is not None
    )

    if (is_pure_tenure or extracted_yrs > 0) and len(substantive_tokens) == 0:
        return "tenure_only", extracted_yrs, name.strip()
    elif extracted_yrs > 0:
        display_name = cleaned if cleaned else name.strip()
        return "skill_with_tenure", extracted_yrs, display_name
    else:
        display_name = cleaned if cleaned else name.strip()
        return "qualitative_skill", 0.0, display_name


# In-memory cache for match assessments: keyed by (candidate_name, jd_fingerprint).
# Ensures all screening modes (lenient / moderate / strict) share the SAME LLM-assigned
# full/partial/none match levels — mode differentiation is handled deterministically by
# MATCH_MULTIPLIERS in scoring.py (75% / 50% / 25% partial credit).
# Guarantees structural L >= M >= S monotonicity with zero LLM re-invocation cost.
_MATCH_ASSESSMENT_CACHE: dict[str, CompactScreeningOutput] = {}


def _fuzzy_requirement_match(canonical_name: str, llm_name: str) -> bool:
    """Domain-agnostic fuzzy match using normalized token overlap and canonical skill normalization."""
    if not canonical_name or not llm_name:
        return False
    from app.agent.tools.skills import normalize_canonical_skill
    c_norm = normalize_canonical_skill(canonical_name)
    m_norm = normalize_canonical_skill(llm_name)
    c_lower = c_norm.strip().lower()
    m_lower = m_norm.strip().lower()
    if c_lower == m_lower or c_lower in m_lower or m_lower in c_lower:
        return True
    c_tokens = set(re.findall(r'\w+', c_lower))
    m_tokens = set(re.findall(r'\w+', m_lower))
    stop = {'and', 'or', 'the', 'a', 'an', 'of', 'in', 'for', 'with', 'to', 'is', 'at', 'on'}
    c_tokens -= stop
    m_tokens -= stop
    if not c_tokens or not m_tokens:
        return False
    overlap = len(c_tokens & m_tokens) / min(len(c_tokens), len(m_tokens))
    return overlap >= 0.5


def verify_and_clean_quote(quote: str, raw_jd: str) -> tuple[bool, str]:
    """Verify if jd_quote is present in raw_jd text via case-insensitive & whitespace-normalized substring matching."""
    if not quote or not quote.strip():
        return False, ""

    # Strip outer quotation marks (including smart/curly unicode quotes) AND surrounding/padded whitespace
    clean_q = quote.strip()
    quote_chars = "\"'`‘’‚‛“”„‟«»‹›"
    prev = None
    while clean_q != prev:
        prev = clean_q
        clean_q = clean_q.strip(quote_chars).strip()

    if not clean_q:
        return False, ""

    clean_q_lower = clean_q.lower()
    clean_raw = raw_jd.strip().lower()

    # 1. Exact substring match
    if clean_q_lower in clean_raw:
        return True, clean_q

    # 2. Collapse internal whitespace (newlines/tabs -> single space)
    norm_q = re.sub(r"\s+", " ", clean_q_lower)
    norm_raw = re.sub(r"\s+", " ", clean_raw)
    if norm_q in norm_raw:
        return True, clean_q

    # 3. Partial window match (at least 4 consecutive words found in raw JD)
    words = norm_q.split()
    if len(words) >= 4:
        four_words = " ".join(words[:4])
        if four_words in norm_raw:
            return True, clean_q

    return False, ""


def verify_verbatim_cv_quote(quote: str, raw_cv_text: str) -> tuple[bool, str]:
    """Verify if evidence quote is present in candidate raw_cv_text via case-insensitive, punctuation-insensitive, and whitespace-normalized verbatim matching."""
    if not quote or not quote.strip():
        return False, ""

    clean_q = quote.strip()
    quote_chars = "\"'`‘’‚‛“”„‟«»‹›"
    prev = None
    while clean_q != prev:
        prev = clean_q
        clean_q = clean_q.strip(quote_chars).strip()

    if not clean_q or clean_q.lower().startswith("no direct evidence"):
        return False, ""

    clean_q_lower = clean_q.lower()
    clean_cv = raw_cv_text.strip().lower()

    # 1. Exact substring match
    if clean_q_lower in clean_cv:
        return True, clean_q

    # 2. Collapse internal whitespace
    norm_q = re.sub(r"\s+", " ", clean_q_lower)
    norm_cv = re.sub(r"\s+", " ", clean_cv)
    if norm_q in norm_cv:
        return True, clean_q

    # 3. Punctuation-stripped match
    strip_punc_q = re.sub(r"[^\w\s]", "", norm_q)
    strip_punc_cv = re.sub(r"[^\w\s]", "", norm_cv)
    if strip_punc_q and strip_punc_q in strip_punc_cv:
        return True, clean_q

    # 4. Partial window match (at least 4 consecutive words found in raw CV)
    # FIX 5: Truncate to the matched CV line/snippet, not returning unverified full clean_q
    words = [w for w in re.findall(r"\w+", norm_q) if len(w) >= 2]
    if len(words) >= 4:
        for i in range(len(words) - 3):
            four_words = " ".join(words[i:i+4])
            if four_words in strip_punc_cv:
                for line in raw_cv_text.splitlines():
                    line_clean = re.sub(r"[^\w\s]", "", line.lower())
                    if four_words in line_clean:
                        cv_line = re.sub(r"^[•\-\*–—\d\.\)]+\s*", "", line).strip()
                        if cv_line:
                            return True, cv_line[:150]
                return True, four_words

    return False, ""


def extract_verbatim_sentence_for_requirement(
    req_name: str,
    candidate_profile: Any,
    proposed_evidence: str = "",
    jd_quote: str = "",
    prefer_employment_only: bool = False
) -> str | None:
    """Finds and ranks verbatim lines in raw_cv_text based on token overlap with proposed LLM quote + requirement name and section priority."""
    if not candidate_profile:
        return None

    raw_cv = getattr(candidate_profile, "raw_cv_text", "") or ""
    if not raw_cv.strip():
        return None

    from app.agent.tools.verification import (
        extract_dynamic_requirement_tokens,
        stem_token,
        SECTION_PRIORITY_WEIGHTS,
        SUBSTANTIVE_EXECUTION_VERBS,
        SKILLS_LIST_PROSE_PATTERNS
    )

    # Check if proposed_evidence is a skills dump (contains no substantive execution verbs)
    has_verbs = any(v in proposed_evidence.lower() for v in SUBSTANTIVE_EXECUTION_VERBS) if proposed_evidence else False

    # If proposed_evidence has execution verbs, extract ev_tokens; otherwise ignore proposed_evidence token contamination!
    ev_tokens = extract_dynamic_requirement_tokens(proposed_evidence) if (proposed_evidence and has_verbs) else set()
    req_tokens = extract_dynamic_requirement_tokens(req_name, jd_quote) if req_name else set()

    all_target = ev_tokens | req_tokens
    if not all_target:
        return None

    roles = getattr(candidate_profile, "previous_roles", []) or []
    roles_text = ""
    for r in roles:
        if isinstance(r, dict):
            roles_text += f" {r.get('title', '')} {r.get('description', '')} {' '.join([str(s) for s in r.get('skills_used', [])])}"
        else:
            roles_text += f" {getattr(r, 'title', '')} {getattr(r, 'description', '')} {' '.join([str(s) for s in getattr(r, 'skills_used', [])])}"
    roles_text = roles_text.lower()

    projects = getattr(candidate_profile, "projects", []) or []
    proj_text = ""
    for p in projects:
        if isinstance(p, dict):
            proj_text += f" {p.get('title', '')} {p.get('name', '')} {p.get('description', '')}"
        else:
            proj_text += f" {getattr(p, 'title', '')} {getattr(p, 'description', '')}"
    proj_text = proj_text.lower()

    skills = getattr(candidate_profile, "skills", []) or []
    skills_text = " ".join([str(s) for s in skills]).lower()

    lines = [line.strip() for line in raw_cv.splitlines() if line.strip()]
    best_line = None
    best_score = 0.0

    for line in lines:
        line_clean = re.sub(r"^[•\-\*–—\d\.\)]+\s*", "", line).strip()
        if not line_clean or len(line_clean) < 4:
            continue

        line_lower = line_clean.lower()
        if line_lower in ("experience", "work experience", "employment", "projects", "education", "skills", "technical skills", "summary", "personal projects"):
            continue

        is_in_skills = (line_lower in skills_text or any(pat.search(line_lower) for pat in SKILLS_LIST_PROSE_PATTERNS)) and not any(v in line_lower for v in SUBSTANTIVE_EXECUTION_VERBS)
        if prefer_employment_only and is_in_skills:
            continue

        line_words = [stem_token(w) for w in re.findall(r"\w+", line_lower)]
        if not line_words:
            continue

        line_words_set = set(line_words)

        ev_matches = sum(1 for t in ev_tokens if stem_token(t) in line_words_set or any(w.startswith(stem_token(t)[:4]) for w in line_words if len(stem_token(t)) >= 4))
        req_matches = sum(1 for t in req_tokens if stem_token(t) in line_words_set or any(w.startswith(stem_token(t)[:4]) for w in line_words if len(stem_token(t)) >= 4))

        if ev_matches == 0 and req_matches == 0:
            continue

        sec_mult = SECTION_PRIORITY_WEIGHTS["inferred"]
        if line_lower in roles_text or any(v in line_lower for v in SUBSTANTIVE_EXECUTION_VERBS):
            sec_mult = SECTION_PRIORITY_WEIGHTS["employment"]
        elif line_lower in proj_text:
            sec_mult = SECTION_PRIORITY_WEIGHTS["project"]
        elif is_in_skills:
            sec_mult = SECTION_PRIORITY_WEIGHTS["skills_list_only"]

        line_score = (2.0 * ev_matches + 1.0 * req_matches) * sec_mult
        if line_score > best_score:
            best_score = line_score
            best_line = line_clean[:150]

    return best_line if best_score >= 1.0 else None

# (Skipping down to alignment loops in jd_matcher_node...)



async def distill_jd_requirements(jd_text: str) -> CanonicalJDSpec:
    """Distill raw Job Description into a canonical specification upfront with model escalation and quote verification."""
    jd_clean = clean_surrogates(jd_text)
    spec_hash = hashlib.sha256(f"{jd_clean.strip()}::{PROMPT_VERSION}".encode("utf-8")).hexdigest()

    if spec_hash in _JD_SPEC_CACHE:
        logger.info(f"[JD Distiller] Returning cached CanonicalJDSpec for hash {spec_hash[:12]}")
        return _JD_SPEC_CACHE[spec_hash]

    cache_key = jd_clean.strip()
    if cache_key in _JD_SPEC_CACHE:
        logger.info("[JD Distiller] Returning cached CanonicalJDSpec")
        return _JD_SPEC_CACHE[cache_key]

    logger.info("[JD Distiller] Extracting canonical JD requirements upfront")

    model_escalation = [
        ("fast", 8192, True),
        ("smart", 8192, True),
        ("smart", 8192, False),
    ]

    human_content = f"JOB DESCRIPTION:\n{jd_clean}"
    last_exception = None

    for attempt, (tier, token_limit, use_structured) in enumerate(model_escalation):
        model_name = MODELS.get(tier, "google/gemini-2.5-flash-lite")
        try:
            m = get_model(tier, max_tokens=token_limit)
            if use_structured:
                sm = m.with_structured_output(CanonicalJDSpec, method="json_schema", include_raw=True)
                response = await sm.ainvoke([
                    SystemMessage(content=CANONICAL_JD_DISTILLER_PROMPT),
                    HumanMessage(content=human_content)
                ])
                r = response.get("parsed") if isinstance(response, dict) else None
                if not r and isinstance(response, dict):
                    raw_msg = response.get("raw")
                    raw_text = raw_msg.content if hasattr(raw_msg, "content") else (str(raw_msg) if raw_msg else None)
                    if raw_text:
                        extracted = extract_json(raw_text)
                        parsed_dict = json.loads(extracted)
                        r = CanonicalJDSpec.model_validate(parsed_dict)
            else:
                raw_prompt = CANONICAL_JD_DISTILLER_PROMPT + "\nOutput a single valid JSON object matching the CanonicalJDSpec schema."
                raw_resp = await m.ainvoke([
                    SystemMessage(content=raw_prompt),
                    HumanMessage(content=human_content)
                ])
                raw_text = raw_resp.content if hasattr(raw_resp, "content") else str(raw_resp)
                extracted = extract_json(raw_text)
                parsed_dict = json.loads(extracted)
                r = CanonicalJDSpec.model_validate(parsed_dict)

            if not r or not (r.must_have_skills or r.nice_to_have_skills or r.required_years > 0):
                raise ValueError("Incomplete CanonicalJDSpec extracted from LLM")

            # Post-processing: Substring verification & generic bullet classification
            final_must_have: list[CanonicalJDRequirement] = []
            final_nice_to_have: list[CanonicalJDRequirement] = []
            max_tenure_years = r.required_years

            all_raw_requirements = list(r.must_have_skills) + list(r.nice_to_have_skills)

            for req in all_raw_requirements:
                bullet_type, extracted_yrs, cleaned_name = classify_and_clean_requirement(req)
                if extracted_yrs > 0:
                    max_tenure_years = max(max_tenure_years, extracted_yrs)

                if bullet_type == "tenure_only":
                    logger.info(f"[JD Distiller] Excluding pure tenure requirement '{req.requirement_name}' from qualitative skill lists; max tenure updated to {max_tenure_years} yrs.")
                    continue

                req.requirement_name = cleaned_name
                req.req_type = "qualitative_skill"

                # Substring verification of quote against raw JD text
                is_valid_quote, cleaned_quote = verify_and_clean_quote(req.jd_quote, jd_clean)
                if not is_valid_quote:
                    is_valid_name, _ = verify_and_clean_quote(req.requirement_name, jd_clean)
                    if not is_valid_name:
                        logger.warning(f"[JD Distiller] Dropping unverified hallucinated requirement: '{req.requirement_name}'")
                        continue
                    cleaned_quote = req.requirement_name

                req.jd_quote = cleaned_quote

                if req.category == "must_have":
                    final_must_have.append(req)
                else:
                    final_nice_to_have.append(req)

            if not (4 <= len(final_must_have) <= 8):
                logger.warning(f"[JD Distiller] must_have count ({len(final_must_have)}) outside standard range [4, 8].")

            spec = CanonicalJDSpec(
                spec_hash=spec_hash,
                role_title=r.role_title or "Software Engineer",
                required_years=max_tenure_years,
                must_have_skills=final_must_have,
                nice_to_have_skills=final_nice_to_have
            )

            _JD_SPEC_CACHE[spec_hash] = spec
            _JD_SPEC_CACHE[cache_key] = spec
            return spec

        except Exception as e:
            last_exception = e
            logger.warning(f"[JD Distiller] Attempt {attempt+1} (tier={tier}, model={model_name}) failed: {e}")

    raise RuntimeError(f"Failed to distill canonical JD specification after {len(model_escalation)} attempts: {last_exception}")



async def jd_matcher_node(state: RecruitmentState) -> dict:
    """Score the candidate against the job description using Flash-Lite with full deterministic XAI hydration."""
    profile = state.get("candidate_profile")
    if profile is None:
        raise ValueError("candidate_profile is required for JD matching")

    logger.info(f"[JD Matcher] Scoring: {profile.name}")

    jd = clean_surrogates(state["job_description"])

    # 1. Obtain upfront canonical JD specification (distilled & frozen once per JD)
    canonical_spec = state.get("canonical_jd_spec")
    if isinstance(canonical_spec, dict):
        canonical_spec = CanonicalJDSpec.model_validate(canonical_spec)
    if not isinstance(canonical_spec, CanonicalJDSpec):
        canonical_spec = await distill_jd_requirements(jd)

    # 2. Format frozen requirement context into system prompt
    must_have_lines = [f"- [{req.id}] {req.requirement_name} (Quote: \"{req.jd_quote}\")" for req in canonical_spec.must_have_skills]
    nice_to_have_lines = [f"- [{req.id}] {req.requirement_name} (Quote: \"{req.jd_quote}\")" for req in canonical_spec.nice_to_have_skills]

    canonical_context = (
        f"FROZEN CANONICAL JD SPECIFICATION:\n"
        f"Target Role: {canonical_spec.role_title}\n"
        f"Required Experience Years: {canonical_spec.required_years}\n"
        f"Must-Have Skills ({len(canonical_spec.must_have_skills)} items):\n" + "\n".join(must_have_lines) + "\n"
        f"Nice-To-Have Skills ({len(canonical_spec.nice_to_have_skills)} items):\n" + "\n".join(nice_to_have_lines) + "\n\n"
    )

    today_str = date.today().isoformat()
    eval_mode = state.get("jd_matcher_prompt_variant") or "default"
    base_prompt = JD_MATCHER_PROMPTS.get(eval_mode, JD_MATCHER_PROMPTS["default"])
    base_prompt = base_prompt.replace("{current_date}", today_str)
    system_prompt = f"JOB DESCRIPTION:\n{jd}\n\n{canonical_context}" + base_prompt

    # Include profile dict with raw_cv_text capped at 2000 chars to save tokens
    profile_dict = profile.model_dump()
    raw_cv = clean_surrogates(profile_dict.get("raw_cv_text", ""))
    if len(raw_cv) > 2000:
        profile_dict["raw_cv_text"] = raw_cv[:2000] + "... [truncated]"
    else:
        profile_dict["raw_cv_text"] = raw_cv

    async def invoke_model(system_prompt, candidate_dict):
        model_escalation = [
            ("fast", 4096, True),
            ("smart", 8192, True),
            ("smart", 8192, False),
        ]

        cand_dict_clean = {k: v for k, v in candidate_dict.items() if k != "raw_cv_text"}
        human_content = clean_surrogates(f"CANDIDATE PROFILE (JSON):\n{json.dumps(cand_dict_clean, separators=(',', ':'))}")

        accumulated_cost = 0.0
        stage_tokens = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        last_exception = None

        for attempt, (tier, token_limit, use_structured) in enumerate(model_escalation):
            model_name = MODELS.get(tier, "google/gemini-2.5-flash-lite")
            try:
                attempt_prompt = system_prompt
                if attempt > 0:
                    attempt_prompt += "\n\nCRITICAL NOTICE: Ensure all required schema fields including must_have, experience_assessment, and reasoning_summary are completely populated."

                m = get_model(tier, max_tokens=token_limit)

                if use_structured:
                    sm = m.with_structured_output(CompactScreeningOutput, method="json_schema", include_raw=True)
                    response = await sm.ainvoke([
                        SystemMessage(content=attempt_prompt),
                        HumanMessage(content=human_content)
                    ])
                    r = response.get("parsed") if isinstance(response, dict) else None
                    if not r and isinstance(response, dict):
                        raw_msg = response.get("raw")
                        raw_text = raw_msg.content if hasattr(raw_msg, "content") else (str(raw_msg) if raw_msg else None)
                        if raw_text:
                            extracted = extract_json(raw_text)
                            parsed_dict = json.loads(extracted)
                            r = CompactScreeningOutput.model_validate(parsed_dict)

                    c, token_info = extract_cost_and_tokens(response, model_name=model_name)
                else:
                    raw_prompt = attempt_prompt + "\nOutput a single valid JSON object matching the CompactScreeningOutput schema with non-empty must_have and reasoning_summary."
                    raw_resp = await m.ainvoke([
                        SystemMessage(content=raw_prompt),
                        HumanMessage(content=human_content)
                    ])
                    raw_text = raw_resp.content if hasattr(raw_resp, "content") else str(raw_resp)
                    extracted = extract_json(raw_text)
                    parsed_dict = json.loads(extracted)
                    r = CompactScreeningOutput.model_validate(parsed_dict)

                    c, token_info = extract_cost_and_tokens(raw_resp, model_name=model_name)

                accumulated_cost += c
                stage_tokens["input_tokens"] += token_info.get("input_tokens", 0)
                stage_tokens["output_tokens"] += token_info.get("output_tokens", 0)
                stage_tokens["total_tokens"] += token_info.get("total_tokens", 0)

                if not r or not r.reasoning_summary or not r.reasoning_summary.strip():
                    raise ValueError(f"Incomplete CompactScreeningOutput: missing reasoning_summary")

                if not r.must_have and canonical_spec.must_have_skills:
                    r.must_have = [RequirementMatch(requirement=req.requirement_name, match="none") for req in canonical_spec.must_have_skills]

                return r, round(accumulated_cost, 6), stage_tokens

            except Exception as e:
                last_exception = e
                logger.warning(f"[JD Matcher] Attempt {attempt+1} (tier={tier}, model={model_name}, max_tokens={token_limit}, structured={use_structured}) failed: {e}.")

        raise RuntimeError(f"Failed to evaluate candidate against JD after {len(model_escalation)} escalation attempts: {last_exception}")

    # Cache key: candidate identity + JD fingerprint (first 120 chars, mode-agnostic)
    # All 3 modes share the SAME match assessment to guarantee monotonicity.
    match_cache_key = f"{profile.name}::{jd[:120]}"

    if match_cache_key in _MATCH_ASSESSMENT_CACHE:
        compact_output = _MATCH_ASSESSMENT_CACHE[match_cache_key]
        cost = 0.0
        stage_tokens = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        logger.info(f"[JD Matcher] Reusing cached match assessment for {profile.name} (mode={eval_mode})")
    else:
        # Always assess with the neutral DEFAULT prompt — partial credit is applied by
        # the deterministic scoring engine (scoring.py MATCH_MULTIPLIERS), not the LLM.
        neutral_default_prompt = JD_MATCHER_PROMPTS["default"].replace("{current_date}", today_str)
        neutral_prompt = (
            f"JOB DESCRIPTION:\n{jd}\n\n{canonical_context}"
            + neutral_default_prompt
        )
        compact_output, cost, stage_tokens = await invoke_model(neutral_prompt, profile_dict)
        _MATCH_ASSESSMENT_CACHE[match_cache_key] = compact_output
        logger.info(f"[JD Matcher] Cached new match assessment for {profile.name} (mode={eval_mode})")

    raw_cv_text = getattr(profile, "raw_cv_text", "") or ""

    # Override relevant_experience_years with deterministic domain calculation
    domain_keywords = [req.requirement_name for req in canonical_spec.must_have_skills]
    if canonical_spec.role_title:
        domain_keywords.append(canonical_spec.role_title)
    det_rel_years = calculate_experience_for_domain(profile.previous_roles, keywords=domain_keywords)
    if det_rel_years > 0:
        compact_output.relevant_experience_years = det_rel_years
    elif compact_output.relevant_experience_years is not None:
        compact_output.relevant_experience_years = min(
            compact_output.relevant_experience_years,
            profile.total_experience_years
        )

    # 3. Align compact_output matches against canonical_spec requirements
    profile_skills_text = " ".join([str(s) for s in (getattr(profile, "skills", []) or [])])
    roles_text = ""
    for r in (getattr(profile, "previous_roles", []) or []):
        r_title = getattr(r, "title", r.get("title", "") if isinstance(r, dict) else "")
        r_desc = getattr(r, "description", r.get("description", "") if isinstance(r, dict) else "")
        r_skills = " ".join([str(s) for s in (getattr(r, "skills_used", r.get("skills_used", [])) if isinstance(r, dict) else (getattr(r, "skills_used", []) or []))])
        roles_text += f" {r_title} {r_desc} {r_skills}"
    projects_text = ""
    for p in (getattr(profile, "projects", []) or []):
        p_title = getattr(p, "title", p.get("title", "") if isinstance(p, dict) else "")
        p_desc = getattr(p, "description", p.get("description", "") if isinstance(p, dict) else "")
        projects_text += f" {p_title} {p_desc}"
    education_text = " ".join([str(e) for e in (getattr(profile, "education", []) or [])])

    cand_corpus = f"{raw_cv_text} {profile_skills_text} {roles_text} {projects_text} {education_text}".lower()

    # 3. Align compact_output matches against canonical_spec requirements via 3-Branch Reduction Engine
    from app.agent.tools.reduction_engine import reduce_match

    aligned_must_have: list[RequirementMatch] = []
    claim_only_must_haves = []

    for canonical_req in canonical_spec.must_have_skills:
        c_name = canonical_req.requirement_name
        found = None
        for m in compact_output.must_have:
            if _fuzzy_requirement_match(c_name, m.requirement):
                found = m
                break

        if found:
            ev_bullet_ids = getattr(found, "evidence_bullet_ids", []) or []
            ev_scope = getattr(found, "scope", None) or "exact"
            ev_depth = getattr(found, "proficiency_signal", None) or getattr(found, "depth", None) or "used"
            declared_in_skills = getattr(found, "declared_in_skills", False) or False
            ev_quote = getattr(found, "evidence", "") or ""

            # Deterministic 3-branch reduction engine call
            verdict, flag = reduce_match(
                requirement_name=c_name,
                evidence_bullet_ids=ev_bullet_ids,
                scope=ev_scope,
                depth=ev_depth,
                declared_in_skills=declared_in_skills,
                candidate_profile=profile
            )

            if flag == "claim_only":
                claim_only_must_haves.append(c_name)
                ev_type = "skills_list_only"
                final_ev = ev_quote or "Declared in skills section (no experience/project bullet evidence)"
            elif flag == "absent":
                ev_type = "absent"
                final_ev = "No evidence found in experience, projects, or skills section"
            else:
                ev_type = "employment" if any(b.startswith("E") for b in ev_bullet_ids) else "project"
                final_ev = ev_quote or (f"Evidenced in bullet(s): {', '.join(ev_bullet_ids)}" if ev_bullet_ids else "Evidenced on CV")

            aligned_must_have.append(RequirementMatch(
                requirement=c_name,
                match=verdict,
                evidence=final_ev,
                evidence_bullet_ids=ev_bullet_ids,
                scope=ev_scope,
                declared_in_skills=declared_in_skills,
                evidence_type=ev_type,
                proficiency_signal=ev_depth if ev_depth in ("led", "built", "used", "assisted", "learning", "none") else "used"
            ))
        else:
            # Deterministic fallback check via alias_hit / profile skills
            skills_declared = getattr(profile, "skills_declared", []) or getattr(profile, "skills", []) or []
            from app.agent.tools.reduction_engine import alias_hit
            is_declared = alias_hit(c_name, skills_declared)
            if is_declared:
                claim_only_must_haves.append(c_name)
                verdict = "partial"
                ev_type = "skills_list_only"
                final_ev = "Declared in skills section"
            else:
                verdict = "none"
                ev_type = "absent"
                final_ev = "No evidence found on CV"

            aligned_must_have.append(RequirementMatch(
                requirement=c_name,
                match=verdict,
                evidence=final_ev,
                declared_in_skills=is_declared,
                evidence_type=ev_type,
                proficiency_signal="none"
            ))

    aligned_nice_to_have: list[RequirementMatch] = []
    for canonical_req in canonical_spec.nice_to_have_skills:
        c_name = canonical_req.requirement_name
        found = None
        for m in compact_output.nice_to_have:
            if _fuzzy_requirement_match(c_name, m.requirement):
                found = m
                break

        if found:
            ev_bullet_ids = getattr(found, "evidence_bullet_ids", []) or []
            ev_scope = getattr(found, "scope", None) or "exact"
            ev_depth = getattr(found, "proficiency_signal", None) or getattr(found, "depth", None) or "used"
            declared_in_skills = getattr(found, "declared_in_skills", False) or False
            ev_quote = getattr(found, "evidence", "") or ""

            verdict, flag = reduce_match(
                requirement_name=c_name,
                evidence_bullet_ids=ev_bullet_ids,
                scope=ev_scope,
                depth=ev_depth,
                declared_in_skills=declared_in_skills,
                candidate_profile=profile
            )

            if flag == "claim_only":
                ev_type = "skills_list_only"
                final_ev = ev_quote or "Declared in skills section"
            elif flag == "absent":
                ev_type = "absent"
                final_ev = "No evidence found on CV"
            else:
                ev_type = "employment" if any(b.startswith("E") for b in ev_bullet_ids) else "project"
                final_ev = ev_quote or "Evidenced on CV"

            aligned_nice_to_have.append(RequirementMatch(
                requirement=c_name,
                match=verdict,
                evidence=final_ev,
                evidence_bullet_ids=ev_bullet_ids,
                scope=ev_scope,
                declared_in_skills=declared_in_skills,
                evidence_type=ev_type,
                proficiency_signal=ev_depth if ev_depth in ("led", "built", "used", "assisted", "learning", "none") else "used"
            ))
        else:
            aligned_nice_to_have.append(RequirementMatch(
                requirement=c_name,
                match="none",
                evidence="No evidence found on CV",
                evidence_type="absent",
                proficiency_signal="none"
            ))

    compact_output.must_have = aligned_must_have
    compact_output.nice_to_have = aligned_nice_to_have

    # Hydrate full ScreeningResult object from aligned CompactScreeningOutput
    result = ScreeningResult(
        must_have=compact_output.must_have,
        nice_to_have=compact_output.nice_to_have,
        relevant_experience_years=compact_output.relevant_experience_years,
        experience_assessment=compact_output.experience_assessment,
        reasoning_summary=compact_output.reasoning_summary,
        score_breakdown=ScoreBreakdown(),
    )
    result.score_breakdown.relevant_experience_years = compact_output.relevant_experience_years

    # Calculate final weighted score, penalty deductions, and decision deterministically
    penalties = state.get("penalties", [])
    final_score, decision, score_note = calculate_weighted_fit_score(
        result.score_breakdown,
        eval_mode=eval_mode,
        penalties=penalties,
        must_have=result.must_have,
        nice_to_have=result.nice_to_have,
        experience_assessment=result.experience_assessment,
        candidate_profile=profile,
        required_years=canonical_spec.required_years,
        canonical_jd_spec=canonical_spec
    )

    # Claim-aware flags & STUFFER_ALERT
    num_must = len(aligned_must_have)
    claim_only_count = len(claim_only_must_haves)
    if num_must > 0:
        coverage = claim_only_count / num_must
        if coverage >= 0.5:
            if "STUFFER_ALERT" not in penalties:
                penalties.append("STUFFER_ALERT")
            result.reasoning_summary += f" [🚩 STUFFER_ALERT: {claim_only_count} of {num_must} required skills appear only in skills section ({coverage:.0%})]"
        elif claim_only_count > 0:
            if "unproven_claims" not in penalties:
                penalties.append("unproven_claims")

    result.fit_score = final_score
    result.decision = decision
    if "Penalty applied" in score_note:
        result.reasoning_summary += f" [{score_note}]"

    stage_cost_dict = {
        "jd_matcher": {
            "cost": cost,
            "tokens": stage_tokens
        }
    }

    res_dict = {
        "canonical_jd_spec": canonical_spec,
        "screening_result": result,
        "total_cost": cost,
        "stage_costs": stage_cost_dict
    }

    if result.decision == "reject":
        res_dict.update({
            "pipeline_status": "rejected",
            "rejection_reason": f"Screening score {result.fit_score}/100 — below threshold. {result.reasoning_summary}",
            "log": [f"Screened: REJECT (score={result.fit_score})"]
        })
        return res_dict

    if result.decision == "hold":
        res_dict.update({
            "pipeline_status": "awaiting_human",
            "log": [f"Screened: HOLD (score={result.fit_score}) - Borderline candidate awaiting human review"]
        })
        return res_dict

    if not state.get("enable_interviews", True):
        res_dict.update({
            "pipeline_status": "shortlisted",
            "log": [f"Screened: ADVANCE (score={result.fit_score}) (Interviews Disabled - Auto Shortlisted)"]
        })
        return res_dict

    res_dict.update({
        "pipeline_status": "shortlisted",
        "log": [f"Screened: ADVANCE (score={result.fit_score}) -> Shortlisted for Interview Invitation"]
    })
    return res_dict