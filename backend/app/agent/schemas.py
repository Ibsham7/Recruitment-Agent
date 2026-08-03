from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, Any
from datetime import datetime

class CandidateProfileOutput(BaseModel):
    """Output of the CV Parser LLM (omits raw_cv_text to save tokens)."""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    experience_calculation: str = Field(default="No calculation provided.", description="Step-by-step calculation: Role A (Jan 2020 - Jan 2022) = 24 months. Total = 24 months / 12 = 2.0 years")
    total_experience_years: float = Field(ge=0, description="Total years of professional experience")
    education: list[str] = Field(default_factory=list, description="Degrees and institutions")
    skills: list[str] = Field(default_factory=list, description="Technical and soft skills")
    previous_roles: list[str] = Field(default_factory=list, description="Job titles held")
    key_achievements: list[str] = Field(default_factory=list, description="Notable accomplishments")
    projects: list[str] = Field(default_factory=list, description="Notable projects")
    other_info: Optional[str] = Field(default="", description="Any other relevant info from the CV")

class CandidateProfile(CandidateProfileOutput):
    """Full candidate profile including the raw text, kept for later nodes."""
    raw_cv_text: str = Field(default="", description="Full extracted text, kept for later nodes")

class RequirementItemBreakdown(BaseModel):
    requirement: str
    match: Literal["full", "partial", "none"]
    points_earned: float = 0.0
    max_points: float = 0.0
    percentage: float = 0.0
    evidence: str = ""
    deduction_reason: Optional[str] = None

class RequirementMatch(BaseModel):
    requirement: str
    match: Literal["full", "partial", "none"]
    evidence: str = Field(default="", description="max 15 words")

class ExperienceBreakdown(BaseModel):
    score: int = 0
    points_earned: float = 0.0
    max_points: float = 25.0
    required_years: Optional[float] = None
    candidate_years: Optional[float] = None
    calculation: Optional[str] = None
    assessment: Optional[str] = None

    @field_validator("required_years", "candidate_years", mode="before")
    @classmethod
    def convert_years_to_float(cls, v):
        if isinstance(v, str):
            import re
            match = re.search(r"(\d+(?:\.\d+)?)", v)
            if match:
                return float(match.group(1))
            return None
        return v

class TrajectoryBreakdown(BaseModel):
    score: int = 0
    points_earned: float = 0.0
    max_points: float = 10.0
    assessment: Optional[str] = None

class PenaltyBreakdownItem(BaseModel):
    reason: str = ""
    severity: str = ""
    points_deducted: float = 0.0

class ScoreBreakdown(BaseModel):
    required_skills_score: Optional[int] = Field(default=None, ge=0, le=100)
    experience_score: Optional[int] = Field(default=None, ge=0, le=100)
    nice_to_have_score: Optional[int] = Field(default=None, ge=0, le=100)
    trajectory_score: Optional[int] = Field(default=None, ge=0, le=100)

    # Granular transparent attributions
    weights: Optional[dict[str, float]] = None
    eval_mode: Optional[str] = None
    formula_summary: Optional[str] = None
    must_have_breakdown: list[RequirementItemBreakdown] = Field(default_factory=list)
    nice_to_have_breakdown: list[RequirementItemBreakdown] = Field(default_factory=list)
    experience_breakdown: Optional[ExperienceBreakdown] = None
    trajectory_breakdown: Optional[TrajectoryBreakdown] = None
    penalties_breakdown: list[PenaltyBreakdownItem] = Field(default_factory=list)

    @field_validator("required_skills_score", "experience_score", "nice_to_have_score", "trajectory_score", mode="before")
    @classmethod
    def convert_sub_scores(cls, v):
        if isinstance(v, (float, int)):
            return int(round(v))
        return v

class ScreeningResult(BaseModel):
    """Output of the JD Matcher LLM."""
    must_have: list[RequirementMatch] = Field(default_factory=list)
    nice_to_have: list[RequirementMatch] = Field(default_factory=list)
    experience_assessment: str = Field(default="", description="1-2 sentences: required vs. directly relevant experience, and how any gap was weighted (not zeroed)")
    score_breakdown: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    fit_score: int = Field(default=0, description="A score out of 100 representing how well the candidate matches the job description.")
    decision: Literal["advance", "reject", "hold"] = Field(default="advance")
    reasoning_summary: str = Field(default="", description="2-3 sentence justification")

    @field_validator("fit_score", mode="before")
    @classmethod
    def convert_fit_score(cls, v):
        if isinstance(v, (float, int)):
            return int(round(v))
        return v

class InterviewQuestion(BaseModel):
    question: str
    category: str = Field(description="technical / behavioral / situational")
    what_to_look_for: str = Field(description="What a good answer should include")
    is_probe: Optional[bool] = Field(default=False, description="Whether this is an adaptive follow-up probe")
    is_adaptive: Optional[bool] = Field(default=False, description="Whether this is an adaptive sub-question")
    timer_seconds: Optional[int] = Field(default=90, description="Timer limit in seconds for answering this question")

class InterviewTranscript(BaseModel):
    """Accumulated across multiple interview turns."""
    questions_asked: list[InterviewQuestion] = Field(default_factory=list)
    answers_given: list[str] = Field(default_factory=list)
    current_question_index: int = 0
    probe_counts: dict[int, int] = Field(default_factory=dict, description="Maps question index to number of probes asked")
    anti_cheat_telemetry: Optional[Any] = Field(default=None, description="Cumulative anti-cheat telemetry metadata")

class InterviewQuestionList(BaseModel):
    """Wrapper for returning a list of questions via structured output."""
    questions: list[InterviewQuestion]

class CompetencyScore(BaseModel):
    competency: str
    score: float = Field(ge=0, le=100)
    evidence_quote: str = Field(description="Exact verbatim quote from candidate transcript supporting this score")
    rationale: str

class AntiCheatMetadata(BaseModel):
    blur_count: int = 0
    focus_duration_seconds: float = 0.0
    paste_count: int = 0
    total_pasted_chars: int = 0
    total_answer_chars: int = 0
    paste_ratio: float = 0.0
    paste_timestamps: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)

def normalize_telemetry(raw: Any) -> dict:
    if raw is None:
        raw = {}
    elif hasattr(raw, "model_dump"):
        raw = raw.model_dump()
    elif hasattr(raw, "dict"):
        raw = raw.dict()
    elif not isinstance(raw, dict):
        raw = {}

    def get_val(keys, default):
        for k in keys:
            if k in raw and raw[k] is not None:
                return raw[k]
        return default

    blur_count = int(get_val(["blur_count", "blurCount"], 0))
    focus_duration = float(get_val(["focus_duration_seconds", "focusDuration", "focus_duration"], 0.0))
    paste_count = int(get_val(["paste_count", "pasteCount"], 0))
    total_pasted = int(get_val(["total_pasted_chars", "totalPastedChars"], 0))
    total_answer = int(get_val(["total_answer_chars", "totalAnswerChars"], 0))
    paste_ratio_val = get_val(["paste_ratio", "pasteRatio"], None)
    if paste_ratio_val is not None:
        paste_ratio = float(paste_ratio_val)
    elif total_answer > 0:
        paste_ratio = round(total_pasted / total_answer, 4)
    else:
        paste_ratio = 0.0

    paste_timestamps = get_val(["paste_timestamps", "pasteTimestamps"], [])
    if not isinstance(paste_timestamps, list):
        paste_timestamps = []

    flags = get_val(["flags"], [])
    if not isinstance(flags, list):
        flags = []

    return {
        "blur_count": blur_count,
        "blurCount": blur_count,
        "focus_duration_seconds": focus_duration,
        "focusDuration": focus_duration,
        "paste_count": paste_count,
        "pasteCount": paste_count,
        "total_pasted_chars": total_pasted,
        "totalPastedChars": total_pasted,
        "total_answer_chars": total_answer,
        "totalAnswerChars": total_answer,
        "paste_ratio": paste_ratio,
        "pasteRatio": paste_ratio,
        "paste_timestamps": paste_timestamps,
        "pasteTimestamps": paste_timestamps,
        "flags": flags
    }

class InterviewAnswerInput(BaseModel):
    answer_text: str
    anti_cheat_telemetry: Optional[AntiCheatMetadata] = None

class EvaluationReport(BaseModel):
    """Output of the Evaluator node."""
    interview_score: float = Field(ge=0, le=100, default=0.0, description="Score based purely on interview Q&A performance")
    overall_score: float = Field(ge=0, le=100)
    communication_score: float = Field(ge=0, le=100)
    technical_score: float = Field(ge=0, le=100)
    cultural_fit_score: float = Field(ge=0, le=100)
    competency_scores: list[CompetencyScore] = Field(default_factory=list)
    strengths: list[str]
    concerns: list[str]
    score_breakdown: Optional[ScoreBreakdown] = Field(default=None, description="Detailed sub-scores breakdown")
    chain_of_thought: Optional[str] = Field(default=None, description="Step-by-step reasoning from screening")
    recommendation: str = Field(pattern="^(shortlist|reject|hold)$")
    summary: str = Field(description="2–3 sentence overall assessment")
    ai_generated_likelihood_score: Optional[float] = Field(default=0.0, ge=0, le=100)
    anti_cheat_flags: list[dict] = Field(default_factory=list)
