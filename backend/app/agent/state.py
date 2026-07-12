from typing import TypedDict, Annotated, Optional
from operator import add
from app.agent.schemas import CandidateProfile, ScreeningResult, InterviewQuestion, InterviewTranscript, EvaluationReport

class RecruitmentState(TypedDict):
    # ── Input ───────────────────────────────────────────────────────────────
    cv_filepath: str                         # path to the candidate's PDF
    job_description: str                     # full JD text
    candidate_id: str                        # unique ID for this run
    hard_filters_config: list[dict]          # explicit hard filter rules
    penalties: list[dict]                    # accrued penalties

    # ── Node outputs (each node fills one of these) ──────────────────────
    candidate_profile: Optional[CandidateProfile]     # filled by cv_parser
    screening_result: Optional[ScreeningResult]        # filled by jd_matcher
    interview_questions: list[InterviewQuestion]       # filled by question_generator
    interview_transcript: Optional[InterviewTranscript] # filled by interviewer
    evaluation_report: Optional[EvaluationReport]     # filled by evaluator

    # ── Control flow ─────────────────────────────────────────────────────
    pipeline_status: str    # "running" | "awaiting_human" | "complete" | "rejected"
    rejection_reason: Optional[str]
    filter_rejections: Annotated[list[str], add] # collects parallel rejections

    # ── Log — accumulates messages across nodes ───────────────────────────
    log: Annotated[list[str], add]

    # ── Human review output ───────────────────────────────────────────────
    human_decision: Optional[str]   # "approve" | "reject" | "hold"
    human_notes: Optional[str]