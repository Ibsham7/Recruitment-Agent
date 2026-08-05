import re
from typing import Dict, Any, Tuple, Optional
from app.agent.schemas import (
    RequirementItemBreakdown,
    ExperienceBreakdown,
    TrajectoryBreakdown,
    PenaltyBreakdownItem,
)

TENURE_PATTERN = re.compile(
    r"(\b\d+\+?\s*(years?|yrs?|yr)\b|\byears?\s+of\s+(professional\s+)?(software\s+engineering\s+|development\s+)?experience\b|\bminimum\s+\d+\s+years?\b|\b\d+\+\s*years?\b)",
    re.IGNORECASE
)

def _filter_tenure_requirements(items: list) -> list:
    """Sanitize requirement lists to ensure years of experience are strictly owned by Experience Depth, avoiding double-scoring."""
    if not items:
        return []
    filtered = []
    for item in items:
        req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
        if not TENURE_PATTERN.search(req_name):
            filtered.append(item)
    return filtered

LOW_PROFICIENCY_KEYWORDS = (
    "some exposure", "limited exposure", "basic exposure", "basic knowledge",
    "familiarity with", "assisted with", "supervised use", "introductory"
)

CICD_REQ_KEYWORDS = ("ci/cd", "continuous integration", "continuous deployment", "jenkins", "github actions", "gitlab ci", "circleci")
HOSTING_ONLY_EVIDENCE = ("azure app service", "aws ec2", "heroku", "vercel", "s3 bucket", "elastic beanstalk")
CICD_EXPLICIT_TOOLS = ("github actions", "jenkins", "gitlab ci", "circleci", "azure pipelines", "travis", "argocd", "bamboo", "harness")

def _sanitize_match_val(req_name: str, match_val: str, evidence_val: str, item: Any = None, eval_mode: str = "default") -> Tuple[str, str]:
    """
    Deterministic evidence guardrail to prevent evidence inflation/stretching:
    1. Proficiency Qualifier Cap: If evidence contains 'some exposure', 'basic', 'assisted', cap match_val at 'partial'.
    2. CI/CD vs Hosting Guardrail: If requirement is CI/CD, but evidence only mentions cloud hosting deployment without pipeline tooling, override match_val to 'none' in moderate and strict modes.
    """
    req_lower = req_name.lower()
    ev_lower = evidence_val.lower()
    override_note = ""

    # Rule 1: Low-proficiency qualifier cap
    if match_val == "full" and any(k in ev_lower for k in LOW_PROFICIENCY_KEYWORDS):
        match_val = "partial"
        override_note = " [Capped to partial due to low-proficiency qualifier in evidence]"

    # Rule 2: CI/CD vs Hosting Target (Strict & Default/Moderate modes)
    if eval_mode != "lenient" and any(k in req_lower for k in CICD_REQ_KEYWORDS):
        has_hosting = any(h in ev_lower for h in HOSTING_ONLY_EVIDENCE)
        has_pipeline_tool = any(t in ev_lower for t in CICD_EXPLICIT_TOOLS)
        if match_val != "none" and (has_hosting and not has_pipeline_tool or not ev_lower or "no " in ev_lower or "none" in ev_lower):
            match_val = "none"
            override_note = " [Overridden to none: hosting deployment target is not CI/CD pipeline experience]"

    if item is not None and match_val != getattr(item, "match", None):
        if hasattr(item, "match"):
            item.match = match_val
        elif isinstance(item, dict):
            item["match"] = match_val

    return match_val, override_note

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
            
            match_val, override_note = _sanitize_match_val(req_name, raw_match_val, evidence_val, item=item, eval_mode=eval_mode_key)
            
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
            
            match_val, override_note = _sanitize_match_val(req_name, raw_match_val, evidence_val, item=item, eval_mode=eval_mode_key)
            
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

    # Experience Score (Floor Removal: Direct Ratio Y_cand / Y_req clamped [0, 100])
    cand_years = float(getattr(candidate_profile, "total_experience_years", 0.0) if candidate_profile else 0.0)

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

    if req_years is None and experience_assessment:
        match = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", experience_assessment, re.IGNORECASE)
        if match:
            try:
                req_years = float(match.group(1))
            except (ValueError, TypeError):
                req_years = None

    if req_years is None:
        req_years = 5.0  # Default baseline for senior roles if unspecified

    if req_years == 0.0:
        exp_score = 100.0
    elif req_years > 0:
        exp_score = min(100.0, max(0.0, (cand_years / req_years) * 100.0))
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

    # Growth Trajectory (Bounded by Technical Skill Performance)
    raw_traj = getattr(score_breakdown, "trajectory_score", None)
    if raw_traj is not None:
        traj_score = float(raw_traj)
    else:
        traj_score = 80.0 if eval_mode_key == "lenient" else 40.0 if eval_mode_key == "strict" else 60.0

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
            sev = p.get("severity") if isinstance(p, dict) else getattr(p, "severity", "")
            reason = p.get("reason") if isinstance(p, dict) else getattr(p, "reason", "")
            pts = 5.0 if sev == "slight_penalize" else 10.0 if sev == "intermediate_penalize" else 20.0 if sev == "hard_penalize" else 0.0
            if pts > 0:
                deduction += pts
                if reason:
                    penalty_reasons.append(reason)
                    penalties_breakdown_items.append(PenaltyBreakdownItem(
                        reason=reason,
                        severity=sev,
                        points_deducted=pts
                    ))

    penalty_scale = 0.5 if eval_mode_key == "lenient" else 1.5 if eval_mode_key == "strict" else 1.0
    scaled_deduction = round(deduction * penalty_scale)

    final_score = int(round(max(0.0, min(100.0, raw_score - scaled_deduction))))

    # Experience Breakdown
    cand_calc = getattr(candidate_profile, "experience_calculation", None) if candidate_profile else None
    exp_pts_earned = round(exp_score * weights["exp"], 1)
    exp_breakdown_obj = ExperienceBreakdown(
        score=int(round(exp_score)),
        points_earned=exp_pts_earned,
        max_points=weights["exp"] * 100.0,
        required_years=req_years,
        candidate_years=cand_years,
        calculation=cand_calc or f"Direct ratio: {cand_years:.1f} cand yrs / {req_years:.1f} req yrs",
        assessment=experience_assessment or f"Candidate experience ({cand_years or 0} yrs) evaluated against required depth ({req_years} yrs)."
    )

    # Trajectory Breakdown
    traj_pts_earned = round(traj_score * weights["traj"], 1)
    traj_assessment = "Growth capacity evaluated from project complexity, educational background, and skill acquisition rate."
    if traj_cap_applied:
        traj_assessment += f" [Capped from {original_traj_score:.0f} to {traj_score:.0f} due to domain skills baseline ({skills_score:.0f}%)]"

    traj_breakdown_obj = TrajectoryBreakdown(
        score=int(round(traj_score)),
        points_earned=traj_pts_earned,
        max_points=weights["traj"] * 100.0,
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


