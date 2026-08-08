import re
from typing import Dict, Any, Tuple, Optional
from app.agent.schemas import (
    RequirementItemBreakdown,
    ExperienceBreakdown,
    TrajectoryBreakdown,
    PenaltyBreakdownItem,
)

from app.agent.tools.timeline import generate_experience_calculation_summary

TENURE_PATTERN = re.compile(
    r"(\b\d+\+?\s*(years?|yrs?|yr)\b|\byears?\s+of\s+(professional\s+)?(software\s+engineering\s+|development\s+)?experience\b|\bminimum\s+\d+\s+years?\b|\b\d+\+\s*years?\b)",
    re.IGNORECASE
)

GENERIC_TENURE_WORDS = {
    "software", "engineering", "experience", "professional", "development",
    "minimum", "years", "yrs", "year", "yr", "work", "industry", "field",
    "hands-on", "strong", "proven", "track", "record", "background", "overall",
    "total", "relevant", "domain", "in", "of", "with", "and", "for", "a", "an"
}

def _filter_tenure_requirements(items: list) -> list:
    """Sanitize requirement lists to ensure years of experience are strictly owned by Experience Depth, avoiding double-scoring.
    If a requirement contains qualitative skills + a tenure phrase (e.g. 'Python and FastAPI (3+ years)'),
    strip the tenure phrase rather than discarding the qualitative skill requirement.
    Exclude only pure tenure requirements (e.g. '5+ years of experience').
    """
    if not items:
        return []
    filtered = []
    for item in items:
        req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
        if TENURE_PATTERN.search(req_name) or re.search(r"\b\d+\+?\s*(?:years?|yrs?|yr)\b", req_name, re.IGNORECASE):
            cleaned = TENURE_PATTERN.sub("", req_name).strip(" ().-:," )
            cleaned = re.sub(r"\(?\s*\d+\+?\s*(?:years?|yrs?|yr)\s*\)?", "", cleaned, flags=re.IGNORECASE).strip(" ().-:," )
            cleaned = re.sub(r"^(?:experience\s+(?:in|with|of)?|of\s+experience\s+(?:in|with)?)\s*", "", cleaned, flags=re.IGNORECASE).strip(" ().-:," )
            tokens = set(re.findall(r'\w+', cleaned.lower()))
            if not cleaned or len(cleaned) < 3 or not (tokens - GENERIC_TENURE_WORDS):
                continue
            if hasattr(item, "requirement"):
                try:
                    item.requirement = cleaned
                except AttributeError:
                    pass
            elif isinstance(item, dict):
                item["requirement"] = cleaned
        filtered.append(item)
    return filtered

LOW_PROFICIENCY_KEYWORDS = (
    "some exposure", "limited exposure", "basic exposure", "basic knowledge",
    "familiarity with", "assisted with", "assisted", "supervised use", "introductory",
    "learning", "(learning)", "personal project", "personal projects",
    "beginner", "self-taught", "coursework", "academic use", "student"
)

NEGATIVE_EVIDENCE_PHRASES = (
    "no evidence", "no specific", "not mentioned", "no direct",
    "lack of", "absence of", "no explicit", "unmentioned", "not listed"
)

def _sanitize_match_val(req_name: str, match_val: str, evidence_val: str, item: Any = None, eval_mode: str = "default", candidate_profile: Any = None) -> Tuple[str, str]:
    """
    Domain-agnostic evidence guardrail to prevent evidence inflation/stretching:
    0. Zero Proficiency Signal Guardrail: If proficiency_signal is 'none', force match_val to 'none'.
    1. Proficiency Qualifier Cap: If evidence, proficiency signal, or profile raw skills contain low-proficiency keywords ('assisted', 'learning', 'basic exposure'), cap match_val at 'partial'.
    2. Parenthetical Alternatives Upgrade: If requirement lists alternatives in parentheses and evidence names one explicitly, upgrade partial -> full.
    3. Self-Contradiction Guardrail: If match is non-none, but evidence explicitly states absence of evidence, force match_val to 'none'.
    4. Soft / Unevidenced Skill Listing Guardrail: If evidence_type is 'skills_list_only', 'inferred', or 'absent', or text indicates merely listed in skills section, force match_val to 'none'.
    """
    req_lower = req_name.lower()
    ev_lower = evidence_val.lower()
    override_note = ""

    # Extract structured enum attributes if available on item
    ev_type = getattr(item, "evidence_type", None) if item else None
    if ev_type is None and isinstance(item, dict):
        ev_type = item.get("evidence_type")

    prof_signal = getattr(item, "proficiency_signal", None) if item else None
    if prof_signal is None and isinstance(item, dict):
        prof_signal = item.get("proficiency_signal")

    # Rule 0: Zero Proficiency Signal Guardrail
    if match_val != "none" and prof_signal == "none":
        match_val = "none"
        override_note = " [Overridden to none: proficiency signal is none]"
        if item is not None:
            if hasattr(item, "match"):
                try:
                    item.match = match_val
                except AttributeError:
                    pass
            elif isinstance(item, dict):
                item["match"] = match_val
        return match_val, override_note

    # Rule 1: Low-proficiency / hedging qualifier cap
    has_hedge = (
        prof_signal in ("assisted", "learning") or
        any(k in ev_lower for k in LOW_PROFICIENCY_KEYWORDS)
    )
    if not has_hedge and candidate_profile and match_val == "full":
        cand_skills = getattr(candidate_profile, "skills", []) or []
        tech_words = [w.lower() for w in re.findall(r'\b[a-zA-Z0-9+#/\-]{3,}\b', req_name) if w.lower() not in {"experience", "with", "and", "or", "services", "core", "preferred", "requirement"}]
        for s in cand_skills:
            s_lower = str(s).lower()
            if any(tw in s_lower for tw in tech_words) and any(k in s_lower for k in LOW_PROFICIENCY_KEYWORDS):
                has_hedge = True
                break

    if not has_hedge and candidate_profile and match_val == "full":
        raw_cv = str(getattr(candidate_profile, "raw_cv_text", "") or "").lower()
        if raw_cv and ev_lower:
            ev_words = [w for w in re.findall(r'\b[a-zA-Z0-9+#/\-]{4,}\b', ev_lower) if w not in {"with", "that", "this", "from", "using", "used", "role", "work", "after", "review"}]
            for word in ev_words:
                idx = raw_cv.find(word)
                if idx != -1:
                    w_start = max(0, idx - 200)
                    w_end = min(len(raw_cv), idx + 200)
                    cv_window = raw_cv[w_start:w_end]
                    if any(k in cv_window for k in LOW_PROFICIENCY_KEYWORDS):
                        has_hedge = True
                        break

    if match_val == "full" and has_hedge:
        match_val = "partial"
        override_note = " [Capped to partial due to low-proficiency / hedging qualifier in evidence or profile]"

    # Rule 2: Parenthetical Alternatives Upgrade (Domain-Agnostic)
    if match_val == "partial" and not has_hedge:
        paren_match = re.search(r'\(([^)]+)\)', req_lower)
        if paren_match:
            alternatives = [t.strip() for t in re.split(r'[/,|]', paren_match.group(1))]
            if any(alt in ev_lower for alt in alternatives if len(alt) > 2):
                match_val = "full"
                override_note = " [Upgraded to full: evidence names an exact alternative from requirement's listed options]"

    # Rule 3: Self-Contradiction Guardrail (Evidence text explicitly states absence of requirement/evidence)
    if match_val != "none" and (ev_type == "absent" or any(p in ev_lower for p in NEGATIVE_EVIDENCE_PHRASES)):
        match_val = "none"
        override_note = " [Overridden to none: evidence explicitly states absence of requirement or evidence]"

    # Rule 4: Soft / Unevidenced Skill Listing Guardrail (Nice-to-have or soft competencies)
    if match_val != "none":
        is_skills_only = (
            ev_type in ("skills_list_only", "inferred") or
            re.search(r"listed\s+.*in\s+skills", ev_lower) or
            re.search(r"listed\s+['\"`]?\w+['\"`]?\s+as\s+a\s+skill", ev_lower) or
            "listed as a skill" in ev_lower or
            "listed in skills" in ev_lower
        )
        if is_skills_only:
            substantive = re.sub(r"listed\s+['\"`]?\w+['\"`]?\s+as\s+a\s+skill", "", ev_lower)
            substantive = re.sub(r"listed\s+in\s+skills\s*(section)?", "", substantive)
            substantive = re.sub(r"participated\s+in\s+on-call\s+rotation", "", substantive).strip(" ;,.-")
            if not substantive or len(substantive) < 5 or ev_type == "skills_list_only":
                match_val = "none"
                override_note = " [Overridden to none: unevidenced skill listing without substantive employment/project execution]"

    if item is not None and match_val != getattr(item, "match", None):
        if hasattr(item, "match"):
            item.match = match_val
        elif isinstance(item, dict):
            item["match"] = match_val

    return match_val, override_note

def classify_degree_relevance(education_list: list, jd_keywords: list = None) -> Tuple[float, str, str]:
    """
    Evaluates education records against JD domain keywords.
    Returns (points_earned, evidence_summary, relevance_status).
    """
    if not education_list:
        return 0.0, "No formal degree or educational records found on CV.", "none"

    edu_strings = []
    for item in education_list:
        if isinstance(item, str):
            if item.strip():
                edu_strings.append(item.strip())
        elif isinstance(item, dict):
            deg = item.get("degree") or item.get("title") or ""
            inst = item.get("institution") or item.get("school") or ""
            if deg or inst:
                edu_strings.append(f"{deg} - {inst}".strip(" -"))

    if not edu_strings:
        return 0.0, "No formal degree or educational records found on CV.", "none"

    all_edu_text = " ".join(edu_strings).lower()
    jd_text = " ".join([str(k) for k in (jd_keywords or [])]).lower()
    
    # Extract domain tokens from JD
    from app.agent.tools.timeline import extract_domain_tokens
    domain_tokens = extract_domain_tokens(jd_keywords) if jd_keywords else set()

    edu_tokens = set(re.findall(r'[a-zA-Z0-9+#/\-]+', all_edu_text))
    
    direct_match = domain_tokens & edu_tokens
    is_advanced = any(deg in all_edu_text for deg in ["master", "m.s.", "m.a.", "ph.d", "phd", "doctorate", "mba"])

    # High-relevance discipline pairs
    tech_jd = any(k in jd_text for k in ["python", "java", "backend", "frontend", "software", "developer", "engineer", "data", "cloud", "api", "ai", "artificial intelligence", "rag", "llm"])
    tech_deg = any(k in all_edu_text for k in ["computer", "software", "information technology", "data science", "electrical", "artificial intelligence", "ai", "machine learning", "cybersecurity"])

    direct_match_patterns = [
        r"\bartificial\s+intelligence\b", r"\bbs\s+ai\b", r"\bb\.s\.\s+ai\b", r"\bbachelor\s+of\s+science\s+in\s+ai\b",
        r"\bmachine\s+learning\b", r"\bbs\s+ml\b", r"\bb\.s\.\s+ml\b", r"\bdata\s+science\b", r"\bbs\s+ds\b", r"\bb\.s\.\s+ds\b",
        r"\bcomputer\s+science\b", r"\bbs\s+cs\b", r"\bb\.s\.\s+cs\b", r"\bsoftware\s+engineering\b", r"\bbs\s+se\b", r"\bb\.s\.\s+se\b",
        r"\bcomputer\s+engineering\b", r"\binformation\s+technology\b"
    ]

    if (tech_jd or not jd_keywords) and any(re.search(pat, all_edu_text, re.IGNORECASE) for pat in direct_match_patterns):
        pts = 25.0 if (len(edu_strings) >= 2 or is_advanced) else 20.0
        return pts, f"Domain-Relevant Degree ({'; '.join(edu_strings)}) matching target field.", "full"

    math_jd = any(k in jd_text for k in ["math", "mathematics", "physics", "teaching", "teacher", "curriculum", "education"])
    math_deg = any(k in all_edu_text for k in ["math", "mathematics", "education", "physics", "science"])

    biz_jd = any(k in jd_text for k in ["business", "marketing", "sales", "finance", "accounting", "management"])
    biz_deg = any(k in all_edu_text for k in ["business", "mba", "finance", "economics", "marketing", "accounting"])

    is_domain_relevant = bool(direct_match or (tech_jd and tech_deg) or (math_jd and math_deg) or (biz_jd and biz_deg))
    
    if is_domain_relevant:
        pts = 25.0 if (len(edu_strings) >= 2 or is_advanced) else 20.0
        return pts, f"Domain-Relevant Degree ({'; '.join(edu_strings)}) matching target field.", "full"

    broad_disciplines = {"science", "engineering", "technology", "mathematics", "computer", "business", "finance", "economics", "education", "management", "law", "medicine", "nursing", "artificial", "intelligence", "ai", "data"}
    if broad_disciplines & edu_tokens:
        pts = 18.0 if (len(edu_strings) >= 2 or is_advanced) else 14.0
        return pts, f"Foundational Degree ({'; '.join(edu_strings)}) providing general core discipline background.", "partial"

    return 5.0, f"Unrelated Degree Completed ({'; '.join(edu_strings)}). Low direct relevance to target role domain.", "partial"

def _compute_evidence_trajectory(candidate_profile: Any, skills_score: float, eval_mode: str, jd_keywords: list = None) -> Tuple[float, list, str]:
    """
    Domain-agnostic trajectory calculated from verifiable structural profile signals.
    Returns (score, sub_criteria_list, calculation_summary).
    """
    from app.agent.schemas import TrajectorySubCriterion

    if not candidate_profile:
        fallback_score = 40.0 if eval_mode == "strict" else 60.0
        return fallback_score, [], f"Default baseline trajectory ({fallback_score:.0f} pts)."

    sub_criteria = []

    # 1. Career Progression
    roles = getattr(candidate_profile, "previous_roles", [])
    unique_titles = []
    for r in roles:
        t = getattr(r, "title", "") if hasattr(r, "title") else (r.get("title", "") if isinstance(r, dict) else "")
        if t and str(t).strip() and str(t).strip() not in unique_titles:
            unique_titles.append(str(t).strip())

    if len(unique_titles) >= 3:
        p1 = 25.0
        s1 = "full"
        e1 = f"{len(unique_titles)} distinct roles showing career growth: " + ", ".join(unique_titles[:3])
    elif len(unique_titles) >= 2:
        p1 = 15.0
        s1 = "partial"
        e1 = f"{len(unique_titles)} distinct roles listed: " + ", ".join(unique_titles)
    elif len(unique_titles) >= 1:
        p1 = 7.0
        s1 = "partial"
        e1 = f"1 role listed on CV: {unique_titles[0]}"
    else:
        p1 = 0.0
        s1 = "none"
        e1 = "No prior work experience roles listed."

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Career Title Progression",
        points_earned=p1,
        max_points=25.0,
        rubric_rule="≥3 distinct roles = 25 pts | 2 roles = 15 pts | 1 role = 7 pts",
        evidence=e1,
        status=s1
    ))

    # 2. Skill Portfolio Breadth
    skills = getattr(candidate_profile, "skills", []) or []
    skill_names = [str(s) for s in skills if s]
    if len(skill_names) >= 8:
        p2 = 25.0
        s2 = "full"
        e2 = f"{len(skill_names)} competencies listed on CV: " + ", ".join(skill_names[:12]) + ("..." if len(skill_names) > 12 else "")
    elif len(skill_names) >= 4:
        p2 = 15.0
        s2 = "partial"
        e2 = f"{len(skill_names)} competencies listed: " + ", ".join(skill_names)
    elif len(skill_names) >= 1:
        p2 = 7.0
        s2 = "partial"
        e2 = f"{len(skill_names)} skill listed: " + ", ".join(skill_names)
    else:
        p2 = 0.0
        s2 = "none"
        e2 = "No explicit skills extracted from CV."

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Skill Portfolio Breadth",
        points_earned=p2,
        max_points=25.0,
        rubric_rule="≥8 skills = 25 pts | 4-7 skills = 15 pts | 1-3 skills = 7 pts",
        evidence=e2,
        status=s2
    ))

    # 3. Proven Deliverables & Projects
    projects = getattr(candidate_profile, "projects", []) or []
    achievements = getattr(candidate_profile, "key_achievements", []) or []
    proj_names = []
    for p in projects:
        if isinstance(p, str):
            proj_names.append(p)
        elif isinstance(p, dict):
            proj_names.append(str(p.get("title") or p.get("name") or str(p)))
        else:
            t = getattr(p, "title", None) or getattr(p, "name", None)
            proj_names.append(str(t) if t and not callable(t) else str(p))

    achieve_names = [str(a) for a in achievements if a]

    # Filter out generic responsibility phrases that are unquantified duties
    GENERIC_DUTY_PATTERNS = [
        r"^participated\s+in", r"^attended\s+", r"^assisted\s+with", r"^responsible\s+for",
        r"^helped\s+with", r"^monitored\s+", r"^on-call\s+rotation"
    ]
    raw_evidence = proj_names + achieve_names
    evidence_items = []
    for item_str in raw_evidence:
        item_lower = item_str.lower().strip()
        if any(re.search(pat, item_lower) for pat in GENERIC_DUTY_PATTERNS) and not any(char.isdigit() for char in item_str):
            continue
        evidence_items.append(item_str)
    
    if len(evidence_items) >= 3:
        p3 = 25.0
        s3 = "full"
        e3 = f"{len(evidence_items)} projects/achievements documented: " + "; ".join(evidence_items[:3])
    elif len(evidence_items) >= 1:
        p3 = 12.0
        s3 = "partial"
        e3 = f"{len(evidence_items)} project/achievement documented: " + "; ".join(evidence_items[:2])
    else:
        p3 = 0.0
        s3 = "none"
        e3 = "No independent projects or key achievements documented."

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Proven Deliverables & Projects",
        points_earned=p3,
        max_points=25.0,
        rubric_rule="≥3 projects/achievements = 25 pts | 1-2 projects = 12 pts",
        evidence=e3,
        status=s3
    ))

    # 4. Educational Attainment & Degree Relevance
    education = getattr(candidate_profile, "education", []) or []
    p4, e4, s4 = classify_degree_relevance(education, jd_keywords)

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Educational Relevance & Credentials",
        points_earned=p4,
        max_points=25.0,
        rubric_rule="Relevant Degree = 18-25 pts | Adjacent = 10-14 pts | Unrelated = 5 pts",
        evidence=e4,
        status=s4
    ))

    total_score = min(100.0, p1 + p2 + p3 + p4)
    calc_summary = f"Career Progression ({p1:.0f}/25) + Skill Breadth ({p2:.0f}/25) + Deliverables ({p3:.0f}/25) + Education ({p4:.0f}/25) = {total_score:.0f}/100 pts"

    return total_score, sub_criteria, calc_summary

MATCH_MULTIPLIERS = {
    # Lenient: partial credit is generous (75%), rewarding adjacent/transferable skills
    "lenient":  {"full": 1.00, "partial": 0.75, "none": 0.00},
    # Moderate/Default: balanced 50% partial credit
    "moderate": {"full": 1.00, "partial": 0.50, "none": 0.00},
    "default":  {"full": 1.00, "partial": 0.50, "none": 0.00},
    # Strict: partial credit is minimal (25%), penalising non-exact matches
    "strict":   {"full": 1.00, "partial": 0.25, "none": 0.00},
}

# IDENTICAL weights across all modes — monotonicity is guaranteed structurally, not
# by weight tweaking. Differentiation comes from:
#   1. MATCH_MULTIPLIERS (partial=75% lenient / 50% moderate / 25% strict)
#      → skills_score and nice_score are inherently L >= M >= S for any candidate
#   2. Trajectory defaults (80 lenient / 60 moderate / 40 strict)
#      → traj contribution is inherently L >= M >= S
#   3. Exp domain bounds (lenient/moderate floor=25, strict floor=0)
#      → exp contribution is inherently L >= M >= S
#   Using different weights breaks monotonicity for near-perfect candidates because
#   strict's 55% skills weight gives MORE pts than lenient's 45% when skills=100%.
WEIGHTS_CONFIG = {
    "lenient":  {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "default":  {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "moderate": {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "strict":   {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
}

# Score ceiling per mode.
SCORE_CEILING = {
    "lenient":  100.0,
    "default":  100.0,
    "moderate": 100.0,
    "strict":   100.0,
}

# Lenient mode bonus: a modest flat bonus to reward trajectory & transferable skills
# for candidates with partial-but-real domain overlap (skills_score >= 15).
# Withheld for near-zero domain candidates (Jake Sullivan class) to avoid inflation.
LENIENT_BONUS = 4.0

def calculate_weighted_fit_score(
    score_breakdown: Any,
    eval_mode: str = "default",
    penalties: list = None,
    must_have: list = None,
    nice_to_have: list = None,
    experience_assessment: str = "",
    candidate_profile: Any = None,
    required_years: Optional[float] = None,
    canonical_jd_spec: Any = None,
) -> Tuple[int, str, str]:
    """
    Deterministic scoring engine that computes weighted scores, applies hard-filter penalties,
    assigns decisions ('advance', 'hold', 'reject') with zero LLM math drift,
    and constructs a fully transparent XAI breakdown for every requirement, tenure metric, and penalty.
    """
    eval_mode_key = (eval_mode or "default").lower().strip()
    if eval_mode_key not in WEIGHTS_CONFIG:
        eval_mode_key = "default"

    weights = WEIGHTS_CONFIG[eval_mode_key]
    multipliers = MATCH_MULTIPLIERS[eval_mode_key]
    
    # 1. Itemized Must-Have Skills Breakdown (Sanitized to prevent double scoring of tenure)
    must_have_list = _filter_tenure_requirements(must_have or [])
    must_have_breakdown_items = []
    max_skills_pts = weights["skills"] * 100.0
    num_must = len(must_have_list)
    if num_must > 0:
        pts_per_must = max_skills_pts / num_must
        for item in must_have_list:
            req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
            raw_match_val = getattr(item, "match", item.get("match", "none") if isinstance(item, dict) else "none")
            evidence_val = getattr(item, "evidence", item.get("evidence", "") if isinstance(item, dict) else "")
            
            match_val, override_note = _sanitize_match_val(req_name, raw_match_val, evidence_val, item=item, eval_mode=eval_mode_key, candidate_profile=candidate_profile)
            
            mult = multipliers.get(match_val, 0.0)
            pct = mult * 100.0
            pts_earned = pts_per_must * mult

            if match_val == "full":
                reason = f"Full requirement match (+{pts_earned:.1f} pts){override_note}"
            elif match_val == "partial":
                ded = pts_per_must - pts_earned
                reason = f"Partial match ({pct:.0f}% credit). Deduction: -{ded:.1f} pts{override_note}"
            else:
                reason = f"Requirement missing (0% credit). Deduction: -{pts_per_must:.1f} pts{override_note}"
                
            must_have_breakdown_items.append(RequirementItemBreakdown(
                requirement=req_name,
                match=match_val,
                points_earned=round(pts_earned, 1),
                max_points=round(pts_per_must, 1),
                percentage=pct,
                evidence=evidence_val,
                deduction_reason=reason
            ))

    # 2. Itemized Nice-To-Have Skills Breakdown (Sanitized)
    nice_have_list = _filter_tenure_requirements(nice_to_have or [])
    nice_have_breakdown_items = []
    max_nice_pts = weights["nice"] * 100.0
    num_nice = len(nice_have_list)
    if num_nice > 0:
        pts_per_nice = max_nice_pts / num_nice
        for item in nice_have_list:
            req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
            raw_match_val = getattr(item, "match", item.get("match", "none") if isinstance(item, dict) else "none")
            evidence_val = getattr(item, "evidence", item.get("evidence", "") if isinstance(item, dict) else "")
            
            match_val, override_note = _sanitize_match_val(req_name, raw_match_val, evidence_val, item=item, eval_mode=eval_mode_key, candidate_profile=candidate_profile)
            
            mult = multipliers.get(match_val, 0.0)
            pct = mult * 100.0
            pts_earned = pts_per_nice * mult

            if match_val == "full":
                reason = f"Preferred skill satisfied (+{pts_earned:.1f} pts){override_note}"
            elif match_val == "partial":
                reason = f"Partial match ({pct:.0f}% credit) (+{pts_earned:.1f} pts){override_note}"
            else:
                reason = f"Preferred skill missing (0 pts){override_note}"
                
            nice_have_breakdown_items.append(RequirementItemBreakdown(
                requirement=req_name,
                match=match_val,
                points_earned=round(pts_earned, 1),
                max_points=round(pts_per_nice, 1),
                percentage=pct,
                evidence=evidence_val,
                deduction_reason=reason
            ))

    # 3. Deterministic Category Sub-Scores (0-100 scale)
    raw_skills = getattr(score_breakdown, "required_skills_score", None)
    if num_must > 0:
        skills_score = sum(item.percentage for item in must_have_breakdown_items) / num_must
    elif raw_skills is not None:
        skills_score = float(raw_skills)
    else:
        skills_score = 50.0

    raw_nice = getattr(score_breakdown, "nice_to_have_score", None)
    if num_nice > 0:
        nice_score = sum(item.percentage for item in nice_have_breakdown_items) / num_nice
    elif raw_nice is not None:
        nice_score = float(raw_nice)
    else:
        # If JD has no nice-to-have items, candidate gets full credit
        nice_score = 100.0

    # Experience Score (Floor Removal: Ratio Y_relevant / Y_req with relevance proportion discount)
    cand_years = float(getattr(candidate_profile, "total_experience_years", 0.0) if candidate_profile else 0.0)

    # Determine relevant years (prioritize deterministic code calculation from work experience roles)
    rel_years = None
    if candidate_profile and hasattr(candidate_profile, "previous_roles") and candidate_profile.previous_roles:
        from app.agent.tools.timeline import calculate_experience_for_domain
        domain_kw = []
        if canonical_jd_spec and hasattr(canonical_jd_spec, "must_have_skills"):
            domain_kw.extend([r.requirement_name for r in canonical_jd_spec.must_have_skills if hasattr(r, "requirement_name")])
        if canonical_jd_spec and hasattr(canonical_jd_spec, "role_title") and canonical_jd_spec.role_title:
            domain_kw.append(canonical_jd_spec.role_title)
        if not domain_kw and must_have:
            for item in must_have:
                req_name = item.get("requirement") if isinstance(item, dict) else getattr(item, "requirement", "")
                if req_name:
                    domain_kw.append(str(req_name))
        det_years = calculate_experience_for_domain(candidate_profile.previous_roles, keywords=domain_kw)
        if det_years > 0:
            rel_years = det_years

    if rel_years is None and hasattr(score_breakdown, "relevant_experience_years") and score_breakdown.relevant_experience_years is not None:
        rel_years = float(score_breakdown.relevant_experience_years)
    elif rel_years is None and candidate_profile and hasattr(candidate_profile, "relevant_experience_years") and candidate_profile.relevant_experience_years is not None:
        rel_years = float(candidate_profile.relevant_experience_years)

    if rel_years is None and experience_assessment:
        match_rel = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:directly\s+)?relevant", experience_assessment, re.IGNORECASE)
        if match_rel:
            try:
                rel_years = float(match_rel.group(1))
            except (ValueError, TypeError):
                rel_years = None

    effective_exp_years = rel_years if rel_years is not None else cand_years

    # Determine required years
    req_years = None
    if required_years is not None:
        try:
            req_years = float(required_years)
        except (ValueError, TypeError):
            req_years = None

    if req_years is None and canonical_jd_spec is not None:
        c_years = getattr(canonical_jd_spec, "required_years", None)
        if c_years is not None:
            try:
                req_years = float(c_years)
            except (ValueError, TypeError):
                req_years = None

    if req_years is None:
        req_years = 5.0  # Default baseline for senior roles if unspecified

    if req_years == 0.0:
        exp_score = 100.0
    elif req_years > 0:
        ratio_score = min(100.0, max(0.0, (effective_exp_years / req_years) * 100.0))
        # Relevance proportion discount: blend 70% requirement ratio + 30% career relevance ratio
        if cand_years > 0 and effective_exp_years < cand_years:
            relevance_ratio = effective_exp_years / cand_years
            exp_score = (ratio_score * 0.7) + (relevance_ratio * 100.0 * 0.3)
        else:
            exp_score = ratio_score
    else:
        exp_score = 100.0

    # Domain Relevance Experience Bound:
    # Irrelevant experience depth cannot score at full depth — experience must be
    # anchored to demonstrated domain skills.
    # Strict mode: no floor (pure frontend years give 0 credit for a backend role),
    # smaller delta (20 pts headroom above skills_score).
    # Lenient/moderate: 25pt floor and 35pt headroom are more forgiving.
    if eval_mode_key == "strict":
        max_allowed_exp = min(100.0, max(0.0, skills_score + 20.0))
    else:
        max_allowed_exp = min(100.0, max(25.0, skills_score + 35.0))
    exp_score = min(exp_score, max_allowed_exp)

    # Extract JD keywords for education domain matching
    jd_kw_list = []
    if must_have:
        for item in must_have:
            req_name = item.get("requirement") if isinstance(item, dict) else getattr(item, "requirement", "")
            if req_name:
                jd_kw_list.append(str(req_name))
    if canonical_jd_spec and getattr(canonical_jd_spec, "role_title", None):
        jd_kw_list.append(str(canonical_jd_spec.role_title))

    # Growth Trajectory (Evidence-Derived, Structural & Domain-Agnostic)
    raw_traj = getattr(score_breakdown, "trajectory_score", None)
    if raw_traj is not None:
        traj_score = float(raw_traj)
        traj_sub_criteria = []
        traj_calc_summary = f"Pre-computed trajectory score ({traj_score:.0f} pts)."
    else:
        traj_score, traj_sub_criteria, traj_calc_summary = _compute_evidence_trajectory(
            candidate_profile, skills_score, eval_mode_key, jd_keywords=jd_kw_list
        )

    # Trajectory Skill Bounding:
    # Growth trajectory cannot inflate candidate score beyond technical competence
    delta_cap = 30.0 if eval_mode_key == "lenient" else 10.0 if eval_mode_key == "strict" else 20.0
    max_allowed_traj = min(100.0, max(0.0, skills_score + delta_cap))

    traj_cap_applied = False
    original_traj_score = traj_score
    if traj_score > max_allowed_traj:
        traj_score = max_allowed_traj
        traj_cap_applied = True

    # Raw Weighted Score
    raw_score = (
        skills_score * weights["skills"] +
        exp_score * weights["exp"] +
        nice_score * weights["nice"] +
        traj_score * weights["traj"]
    )

    # Mode-based adjustments: simple, principled, no per-candidate buckets.
    # Lenient: apply a flat bonus for candidates with meaningful partial domain overlap.
    # The bonus is withheld for near-zero domain candidates to avoid inflating
    # pure non-domain candidates (e.g. Jake Sullivan class: skills_score < 15).
    if eval_mode_key == "lenient" and skills_score >= 15.0:
        raw_score = min(SCORE_CEILING["lenient"], raw_score + LENIENT_BONUS)

    # Hard-filter penalty deductions
    deduction = 0.0
    penalty_reasons = []
    penalties_breakdown_items = []
    if penalties:
        for p in penalties:
            sev = str(p.get("severity", "")) if isinstance(p, dict) else str(getattr(p, "severity", ""))
            reason = str(p.get("reason", "")) if isinstance(p, dict) else str(getattr(p, "reason", ""))
            raw_pts = p.get("points_deducted") if isinstance(p, dict) else getattr(p, "points_deducted", None)
            if raw_pts is not None:
                pts = float(raw_pts)
            else:
                pts = 5.0 if sev == "slight_penalize" else 10.0 if sev == "intermediate_penalize" else 20.0 if sev == "hard_penalize" else 50.0 if sev in ("reject", "completely_reject") else 10.0 if sev else 0.0
            
            deduction += pts
            if reason:
                penalty_reasons.append(reason)
                penalties_breakdown_items.append(PenaltyBreakdownItem(
                    reason=reason,
                    severity=sev or "penalty",
                    points_deducted=pts
                ))

    penalty_scale = 0.5 if eval_mode_key == "lenient" else 1.5 if eval_mode_key == "strict" else 1.0
    scaled_deduction = round(deduction * penalty_scale)

    final_score = int(round(max(0.0, min(100.0, raw_score - scaled_deduction))))

    # Experience Breakdown
    if candidate_profile and hasattr(candidate_profile, "previous_roles") and candidate_profile.previous_roles:
        calc_summary = generate_experience_calculation_summary(candidate_profile.previous_roles)
    else:
        calc_summary = getattr(candidate_profile, "experience_calculation", None) if candidate_profile else None
        if not calc_summary:
            calc_summary = f"Direct ratio: {effective_exp_years:.1f} relevant yrs / {req_years:.1f} req yrs (total career tenure: {cand_years:.1f} yrs)"

    exp_pts_earned = round(exp_score * weights["exp"], 1)
    exp_breakdown_obj = ExperienceBreakdown(
        score=int(round(exp_score)),
        points_earned=exp_pts_earned,
        max_points=weights["exp"] * 100.0,
        required_years=req_years,
        candidate_years=cand_years,
        relevant_years=effective_exp_years,
        calculation=calc_summary,
        assessment=experience_assessment or f"Candidate relevant experience ({effective_exp_years:.1f} yrs, {cand_years:.1f} yrs total) evaluated against required depth ({req_years} yrs)."
    )

    # Trajectory Breakdown
    traj_pts_earned = round(traj_score * weights["traj"], 1)
    traj_assessment = "Growth capacity evaluated from career progression, skill acquisition breadth, project evidence, and degree domain relevance."
    if traj_cap_applied:
        traj_assessment += f" [Capped from {original_traj_score:.0f} to {traj_score:.0f} due to domain skills baseline ({skills_score:.0f}%)]"
        traj_calc_summary += f" (Capped to {traj_score:.0f} pts due to domain skill baseline of {skills_score:.0f}%)"

    traj_breakdown_obj = TrajectoryBreakdown(
        score=int(round(traj_score)),
        points_earned=traj_pts_earned,
        max_points=weights["traj"] * 100.0,
        sub_criteria=traj_sub_criteria or [],
        calculation_summary=traj_calc_summary,
        assessment=traj_assessment
    )

    skills_contrib = round(skills_score * weights["skills"], 1)
    nice_contrib = round(nice_score * weights["nice"], 1)
    formula_str = (
        f"Fit Score ({final_score}/100) = {skills_contrib:.1f} (Required Skills {weights['skills']*100:.0f}%) + "
        f"{exp_pts_earned:.1f} (Experience {weights['exp']*100:.0f}%) + "
        f"{nice_contrib:.1f} (Nice-To-Have {weights['nice']*100:.0f}%) + "
        f"{traj_pts_earned:.1f} (Growth Trajectory {weights['traj']*100:.0f}%)"
    )
    if scaled_deduction > 0:
        formula_str += f" - {scaled_deduction:.1f} (Penalties)"

    # Populate fields on score_breakdown if it is an object
    if score_breakdown is not None:
        if hasattr(score_breakdown, "required_skills_score"):
            score_breakdown.required_skills_score = int(round(skills_score))
            score_breakdown.experience_score = int(round(exp_score))
            score_breakdown.nice_to_have_score = int(round(nice_score))
            score_breakdown.trajectory_score = int(round(traj_score))
            score_breakdown.weights = weights
            score_breakdown.eval_mode = eval_mode_key
            score_breakdown.relevant_experience_years = effective_exp_years
            score_breakdown.formula_summary = formula_str
            score_breakdown.must_have_breakdown = must_have_breakdown_items
            score_breakdown.nice_to_have_breakdown = nice_have_breakdown_items
            score_breakdown.experience_breakdown = exp_breakdown_obj
            score_breakdown.trajectory_breakdown = traj_breakdown_obj
            score_breakdown.penalties_breakdown = penalties_breakdown_items

    # Thresholding logic
    if eval_mode_key == "strict":
        decision = "advance" if final_score >= 70 else "hold" if final_score >= 60 else "reject"
    elif eval_mode_key == "lenient":
        decision = "advance" if final_score >= 55 else "hold" if final_score >= 40 else "reject"
    else:
        decision = "advance" if final_score >= 60 else "hold" if final_score >= 50 else "reject"

    note = f"Score: {final_score}/100."
    if scaled_deduction > 0:
        note += f" [Penalty applied: -{scaled_deduction} pts for: {', '.join(penalty_reasons)}]"

    return final_score, decision, note


