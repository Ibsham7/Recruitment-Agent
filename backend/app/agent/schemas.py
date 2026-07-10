from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CandidateProfile(BaseModel):
    """Output of the CV Parser node."""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    total_experience_years: float = Field(ge=0, description="Total years of professional experience")
    education: list[str] = Field(default_factory=list, description="Degrees and institutions")
    skills: list[str] = Field(default_factory=list, description="Technical and soft skills")
    previous_roles: list[str] = Field(default_factory=list, description="Job titles held")
    key_achievements: list[str] = Field(default_factory=list, description="Notable accomplishments")
    raw_cv_text: str = Field(description="Full extracted text, kept for later nodes")

class ScreeningResult(BaseModel):
    """Output of the JD Matcher node."""
    fit_score: float = Field(ge=0, le=100, description="0–100 match score against the JD")
    matched_requirements: list[str] = Field(description="JD requirements the candidate meets")
    missing_requirements: list[str] = Field(description="JD requirements the candidate lacks")
    reasoning: str = Field(description="2–3 sentence explanation of the score")
    decision: str = Field(pattern="^(advance|reject)$", description="advance or reject")

class InterviewQuestion(BaseModel):
    question: str
    category: str = Field(description="technical / behavioral / situational")
    what_to_look_for: str = Field(description="What a good answer should include")

class InterviewTranscript(BaseModel):
    """Accumulated across multiple interview turns."""
    questions_asked: list[InterviewQuestion] = Field(default_factory=list)
    answers_given: list[str] = Field(default_factory=list)
    current_question_index: int = 0

class EvaluationReport(BaseModel):
    """Output of the Evaluator node."""
    overall_score: float = Field(ge=0, le=100)
    communication_score: float = Field(ge=0, le=100)
    technical_score: float = Field(ge=0, le=100)
    cultural_fit_score: float = Field(ge=0, le=100)
    strengths: list[str]
    concerns: list[str]
    recommendation: str = Field(pattern="^(shortlist|reject|hold)$")
    summary: str = Field(description="2–3 sentence overall assessment")