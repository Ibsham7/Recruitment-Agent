from typing import Dict, Any, Tuple
from app.agent.schemas import (
    RequirementItemBreakdown,
    ExperienceBreakdown,
    TrajectoryBreakdown,
    PenaltyBreakdownItem,
)

WEIGHTS_CONFIG = {
    "default": {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "strict":  {"skills": 0.55, "exp": 0.30, "nice": 0.10, "traj": 0.05},
    "lenient": {"skills": 0.50, "exp": 0.20, "nice": 0.15, "traj": 0.15},
}

def calculate_weighted_fit_score(
    score_breakdown: Any,
    eval_mode: str = "default",
    penalties: list = None,
    must_have: list = None,
    nice_to_have: list = None,
    experience_assessment: str = "",
    candidate_profile: Any = None
) -> Tuple[int, str, str]:
    """
    Deterministic scoring engine that computes weighted scores, applies hard-filter penalties,
    assigns decisions ('advance', 'hold', 'reject') with zero LLM math drift,
    and constructs a fully transparent XAI breakdown for every requirement, tenure metric, and penalty.
    """
    weights = WEIGHTS_CONFIG.get(eval_mode, WEIGHTS_CONFIG["default"])
    
    # 1. Itemized Must-Have Skills Breakdown
    must_have_list = must_have or []
    must_have_breakdown_items = []
    max_skills_pts = weights["skills"] * 100.0
    num_must = len(must_have_list)
    if num_must > 0:
        pts_per_must = max_skills_pts / num_must
        for item in must_have_list:
            req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
            match_val = getattr(item, "match", item.get("match", "none") if isinstance(item, dict) else "none")
            evidence_val = getattr(item, "evidence", item.get("evidence", "") if isinstance(item, dict) else "")
            
            if match_val == "full":
                pct = 100.0
                pts_earned = pts_per_must
                reason = f"Full requirement match (+{pts_earned:.1f} pts)"
            elif match_val == "partial":
                pct = 25.0 if eval_mode == "strict" else 75.0 if eval_mode == "lenient" else 50.0
                pts_earned = pts_per_must * (pct / 100.0)
                ded = pts_per_must - pts_earned
                reason = f"Partial match ({pct:.0f}% credit). Deduction: -{ded:.1f} pts"
            else:
                pct = 0.0
                pts_earned = 0.0
                reason = f"Requirement missing (0% credit). Deduction: -{pts_per_must:.1f} pts"
                
            must_have_breakdown_items.append(RequirementItemBreakdown(
                requirement=req_name,
                match=match_val,
                points_earned=round(pts_earned, 1),
                max_points=round(pts_per_must, 1),
                percentage=pct,
                evidence=evidence_val,
                deduction_reason=reason
            ))

    # 2. Itemized Nice-To-Have Skills Breakdown
    nice_have_list = nice_to_have or []
    nice_have_breakdown_items = []
    max_nice_pts = weights["nice"] * 100.0
    num_nice = len(nice_have_list)
    if num_nice > 0:
        pts_per_nice = max_nice_pts / num_nice
        for item in nice_have_list:
            req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
            match_val = getattr(item, "match", item.get("match", "none") if isinstance(item, dict) else "none")
            evidence_val = getattr(item, "evidence", item.get("evidence", "") if isinstance(item, dict) else "")
            
            if match_val == "full":
                pct = 100.0
                pts_earned = pts_per_nice
                reason = f"Preferred skill satisfied (+{pts_earned:.1f} pts)"
            elif match_val == "partial":
                pct = 50.0
                pts_earned = pts_per_nice * 0.5
                reason = f"Partial match (+{pts_earned:.1f} pts)"
            else:
                pct = 0.0
                pts_earned = 0.0
                reason = f"Preferred skill missing (0 pts)"
                
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
    elif raw_skills is not None and float(raw_skills) > 0:
        skills_score = float(raw_skills)
    else:
        skills_score = 50.0

    raw_nice = getattr(score_breakdown, "nice_to_have_score", None)
    if num_nice > 0:
        nice_score = sum(item.percentage for item in nice_have_breakdown_items) / num_nice
    elif raw_nice is not None and float(raw_nice) > 0:
        nice_score = float(raw_nice)
    else:
        # If JD has no nice-to-have items, candidate gets full credit
        nice_score = 100.0

    raw_exp = getattr(score_breakdown, "experience_score", None)
    if raw_exp is not None and float(raw_exp) > 0:
        exp_score = float(raw_exp)
    else:
        cand_years = getattr(candidate_profile, "total_experience_years", 0.0) if candidate_profile else 0.0
        if cand_years and float(cand_years) > 0:
            exp_score = min(100.0, max(60.0, float(cand_years) * 15.0))
        else:
            exp_score = 50.0

    raw_traj = getattr(score_breakdown, "trajectory_score", None)
    if raw_traj is not None and float(raw_traj) > 0:
        traj_score = float(raw_traj)
    else:
        traj_score = 80.0 if eval_mode == "lenient" else 50.0 if eval_mode == "strict" else 65.0

    raw_score = (
        skills_score * weights["skills"] +
        exp_score * weights["exp"] +
        nice_score * weights["nice"] +
        traj_score * weights["traj"]
    )
    
    if eval_mode == "lenient":
        raw_score = min(100.0, raw_score + 3.0)
        
    # Calculate penalty deductions
    deduction = 0
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
                
    penalty_scale = 0.5 if eval_mode == "lenient" else 1.5 if eval_mode == "strict" else 1.0
    scaled_deduction = round(deduction * penalty_scale)
    
    final_score = int(round(max(0.0, min(100.0, raw_score - scaled_deduction))))
    
    # Experience Breakdown
    cand_years = getattr(candidate_profile, "total_experience_years", None) if candidate_profile else None
    cand_calc = getattr(candidate_profile, "experience_calculation", None) if candidate_profile else None
    exp_pts_earned = round(exp_score * weights["exp"], 1)
    exp_breakdown_obj = ExperienceBreakdown(
        score=int(round(exp_score)),
        points_earned=exp_pts_earned,
        max_points=weights["exp"] * 100.0,
        candidate_years=cand_years,
        calculation=cand_calc,
        assessment=experience_assessment or f"Candidate experience ({cand_years or 0} yrs) evaluated against role depth requirements."
    )

    # Trajectory Breakdown
    traj_pts_earned = round(traj_score * weights["traj"], 1)
    traj_breakdown_obj = TrajectoryBreakdown(
        score=int(round(traj_score)),
        points_earned=traj_pts_earned,
        max_points=weights["traj"] * 100.0,
        assessment="Growth capacity evaluated from project complexity, educational background, and skill acquisition rate."
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
            score_breakdown.eval_mode = eval_mode
            score_breakdown.formula_summary = formula_str
            score_breakdown.must_have_breakdown = must_have_breakdown_items
            score_breakdown.nice_to_have_breakdown = nice_have_breakdown_items
            score_breakdown.experience_breakdown = exp_breakdown_obj
            score_breakdown.trajectory_breakdown = traj_breakdown_obj
            score_breakdown.penalties_breakdown = penalties_breakdown_items

    # Thresholding logic
    if eval_mode == "strict":
        decision = "advance" if final_score >= 70 else "hold" if final_score >= 60 else "reject"
    elif eval_mode == "lenient":
        decision = "advance" if final_score >= 55 else "hold" if final_score >= 40 else "reject"
    else:
        decision = "advance" if final_score >= 60 else "hold" if final_score >= 50 else "reject"
        
    note = f"Score: {final_score}/100."
    if scaled_deduction > 0:
        note += f" [Penalty applied: -{scaled_deduction} pts for: {', '.join(penalty_reasons)}]"
        
    return final_score, decision, note
