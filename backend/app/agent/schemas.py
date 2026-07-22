from pydantic import BaseModel, Field
from typing import Optional
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

from typing import Literal

class RequirementMatch(BaseModel):
    requirement: str
    match: Literal["full", "partial", "none"]
    evidence: str = Field(description="max 15 words")

class ScoreBreakdown(BaseModel):
    required_skills_score: int = Field(ge=0, le=100)
    experience_score: int = Field(ge=0, le=100)
    nice_to_have_score: int = Field(ge=0, le=100)
    trajectory_score: int = Field(ge=0, le=100)

class ScreeningResult(BaseModel):
    """Output of the JD Matcher LLM."""
    must_have: list[RequirementMatch]
    nice_to_have: list[RequirementMatch]
    experience_assessment: str = Field(description="1-2 sentences: required vs. directly relevant experience, and how any gap was weighted (not zeroed)")
    score_breakdown: ScoreBreakdown
    fit_score: int = Field(description="A score out of 100 representing how well the candidate matches the job description.")
    decision: Literal["advance", "reject", "hold"]
    reasoning_summary: str = Field(description="2-3 sentence justification")

class InterviewQuestion(BaseModel):
    question: str
    category: str = Field(description="technical / behavioral / situational")
    what_to_look_for: str = Field(description="What a good answer should include")

class InterviewTranscript(BaseModel):
    """Accumulated across multiple interview turns."""
    questions_asked: list[InterviewQuestion] = Field(default_factory=list)
    answers_given: list[str] = Field(default_factory=list)
    current_question_index: int = 0

class InterviewQuestionList(BaseModel):
    """Wrapper for returning a list of questions via structured output."""
    questions: list[InterviewQuestion]

class EvaluationReport(BaseModel):
    """Output of the Evaluator node."""
    overall_score: float = Field(ge=0, le=100)
    communication_score: float = Field(ge=0, le=100)
    technical_score: float = Field(ge=0, le=100)
    cultural_fit_score: float = Field(ge=0, le=100)
    strengths: list[str]
    concerns: list[str]
    chain_of_thought: Optional[str] = Field(default=None, description="Step-by-step reasoning from screening")
    recommendation: str = Field(pattern="^(shortlist|reject|hold)$")
    summary: str = Field(description="2–3 sentence overall assessment")