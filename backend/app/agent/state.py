from typing import TypedDict, Annotated, Optional
from operator import add
from app.agent.schemas import CandidateProfile, ScreeningResult, InterviewQuestion, InterviewTranscript, EvaluationReport, CanonicalJDSpec

def merge_dicts(a: dict | None, b: dict | None) -> dict:
    """Merges two dictionaries for LangGraph Annotated state fields."""
    res = dict(a or {})
    if not b:
        return res
    for k, v in b.items():
        if k in res and isinstance(res[k], dict) and isinstance(v, dict):
            res[k] = merge_dicts(res[k], v)
        elif k in res and isinstance(res[k], (int, float)) and isinstance(v, (int, float)):
            res[k] = round(res[k] + v, 6)
        else:
            res[k] = v
    return res

class RecruitmentState(TypedDict):
    # ── Input ───────────────────────────────────────────────────────────────
    cv_filepath: str                         # path to the candidate's PDF
    job_description: str                     # full JD text
    candidate_id: str                        # unique ID for this run
    hard_filters_config: list[dict]          # explicit hard filter rules
    penalties: list[dict]                    # accrued penalties
    enable_interviews: bool                  # whether to conduct an interview
    interview_config: Optional[str]          # custom interview questions or focus
    jd_matcher_prompt_variant: Optional[str] # specific prompt variant to use (strict, lenient, default)
    canonical_jd_spec: Optional[CanonicalJDSpec] # upfront distilled frozen JD spec

    # ── Node outputs (each node fills one of these) ──────────────────────
    candidate_profile: Optional[CandidateProfile]     # filled by cv_parser
    semantic_score: Optional[float]                    # filled by embedding_matcher
    screening_result: Optional[ScreeningResult]        # filled by jd_matcher
    interview_questions: list[InterviewQuestion]       # filled by question_generator
    interview_transcript: Optional[InterviewTranscript] # filled by interviewer
    evaluation_report: Optional[EvaluationReport]     # filled by evaluator

    # ── Control flow ─────────────────────────────────────────────────────
    pipeline_status: str    # "running" | "awaiting_human" | "review" | "finalized" | "rejected"
    rejection_reason: Optional[str]
    filter_rejections: Annotated[list[str], add] # collects parallel rejections

    # ── Log — accumulates messages across nodes ───────────────────────────
    log: Annotated[list[str], add]

    # ── Human review output ───────────────────────────────────────────────
    human_decision: Optional[str]   # "approve" | "reject" | "hold"
    human_notes: Optional[str]

    # ── Telemetry & Cost Breakdown ────────────────────────────────────────
    total_cost: Annotated[float, add]
    stage_costs: Annotated[dict, merge_dicts]