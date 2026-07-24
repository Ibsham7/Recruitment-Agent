from typing import Dict, Any, Tuple

WEIGHTS_CONFIG = {
    "default": {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "strict":  {"skills": 0.55, "exp": 0.30, "nice": 0.10, "traj": 0.05},
    "lenient": {"skills": 0.50, "exp": 0.20, "nice": 0.15, "traj": 0.15},
}

def calculate_weighted_fit_score(
    score_breakdown: Any,
    eval_mode: str = "default",
    penalties: list = None
) -> Tuple[int, str, str]:
    """
    Deterministic scoring engine that computes weighted scores, applies hard-filter penalties,
    and assigns decisions ('advance', 'hold', 'reject') with zero LLM math drift.
    """
    weights = WEIGHTS_CONFIG.get(eval_mode, WEIGHTS_CONFIG["default"])
    
    # Extract sub-scores (0-100 scale)
    skills_score = float(getattr(score_breakdown, "required_skills_score", 50))
    exp_score = float(getattr(score_breakdown, "experience_score", 50))
    nice_score = float(getattr(score_breakdown, "nice_to_have_score", 50))
    traj_score = float(getattr(score_breakdown, "trajectory_score", 50))
    
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
    if penalties:
        for p in penalties:
            sev = p.get("severity") if isinstance(p, dict) else getattr(p, "severity", "")
            reason = p.get("reason") if isinstance(p, dict) else getattr(p, "reason", "")
            if sev == "slight_penalize":
                deduction += 5
            elif sev == "intermediate_penalize":
                deduction += 10
            elif sev == "hard_penalize":
                deduction += 20
            if reason:
                penalty_reasons.append(reason)
                
    penalty_scale = 0.5 if eval_mode == "lenient" else 1.5 if eval_mode == "strict" else 1.0
    scaled_deduction = round(deduction * penalty_scale)
    
    final_score = int(round(max(0.0, min(100.0, raw_score - scaled_deduction))))
    
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
