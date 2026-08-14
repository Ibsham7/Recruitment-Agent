export type View = "landing" | "login" | "signup" | "dashboard" | "setup" | "pipeline" | "candidate" | "notfound";
export type CampaignStatus = "active" | "completed" | "paused";
export type CandidateStage = "pending" | "screening" | "screening_hold" | "shortlisted" | "invited" | "interviewing" | "interview_completed" | "review" | "finalized" | "complete" | "rejected";
export type Recommendation = "shortlist" | "reject" | "pending" | "hold" | "approve" | "override";

export interface Campaign {
  id: string;
  title: string;
  jobDescription: string;
  createdAt: string;
  updatedAt: string;
  
  // UI computed/fallback fields
  evaluationStrictness?: "lenient" | "moderate" | "strict";
  department?: string;
  location?: string;
  status?: CampaignStatus;
  total?: number;
  processed?: number;
  shortlisted?: number;
  totalCost?: number; // COST_TRACKING
  apiCost?: number;
  costBreakdown?: Record<string, any>;
}

export interface RequirementItemBreakdown {
  requirement: string;
  match: "full" | "partial" | "none";
  points_earned: number;
  max_points: number;
  percentage: number;
  evidence: string;
  deduction_reason?: string;
  evidence_bullet_ids?: string[];
  scope?: "exact" | "adjacent" | "unrelated";
  declared_in_skills?: boolean;
  warning_flag?: string;
  ui_warning?: string;
}

export interface ExperienceBreakdown {
  score: number;
  points_earned: number;
  max_points: number;
  required_years?: number;
  candidate_years?: number;
  calculation?: string;
  assessment?: string;
}

export interface TrajectorySubCriterion {
  criterion_name: string;
  points_earned: number;
  max_points: number;
  rubric_rule: string;
  evidence: string;
  status: "full" | "partial" | "none";
}

export interface TrajectoryBreakdown {
  score: number;
  points_earned: number;
  max_points: number;
  sub_criteria?: TrajectorySubCriterion[];
  calculation_summary?: string;
  assessment?: string;
}

export interface PenaltyBreakdownItem {
  reason: string;
  severity: string;
  points_deducted: number;
}

export interface ScoreBreakdown {
  required_skills_score?: number;
  experience_score?: number;
  nice_to_have_score?: number;
  trajectory_score?: number;

  weights?: {
    skills: number;
    exp: number;
    nice: number;
    traj: number;
  };
  eval_mode?: string;
  formula_summary?: string;
  must_have_breakdown?: RequirementItemBreakdown[];
  nice_to_have_breakdown?: RequirementItemBreakdown[];
  experience_breakdown?: ExperienceBreakdown;
  trajectory_breakdown?: TrajectoryBreakdown;
  penalties_breakdown?: PenaltyBreakdownItem[];
  flags?: string[];
  claim_only_coverage?: number;
  claim_only_count?: number;
  flag_details?: string[];
}

export interface AntiCheatFlag {
  flag: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface AntiCheatMetadata {
  blurCount: number;
  focusDuration: number; // in seconds
  pasteCount: number;
  totalPastedChars: number;
  totalAnswerChars: number;
  pasteRatio: number;
  pasteTimestamps: string[];
  flags: string[];
}

export interface Evaluation {
  id: string;
  candidateId: string;
  overallScore: number;
  technicalScore?: number | null;
  communicationScore?: number | null;
  culturalFitScore?: number | null;
  recommendation: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  scoreBreakdown?: ScoreBreakdown;
  chainOfThought?: string;
  interviewTranscript: any;
  interviewQuestions?: any;
  aiGeneratedLikelihoodScore?: number;
  antiCheatFlags?: AntiCheatFlag[];
  antiCheatMetadata?: AntiCheatMetadata;
  createdAt: string;
}

export interface CandidateScores {
  technical?: number | null;
  communication?: number | null;
  culturalFit?: number | null;
  overall: number;
}

export interface Candidate {
  id: string;
  campaignId: string;
  name: string;
  email: string | null;
  phone: string | null;
  resumePath: string | null;
  cvUrl?: string | null;
  status: CandidateStage;
  fitScore: number | null;
  decision: string | null;
  totalExperienceYears?: number | null;
  currentRole?: string | null;
  structuredProfile: any;
  currentQuestion?: string | null;
  createdAt: string;
  updatedAt: string;
  
  // UI fallbacks (often derived from structuredProfile or Evaluation)
  experience?: string;
  score?: number;
  stage?: CandidateStage;
  recommendation?: Recommendation;
  scores?: CandidateScores;
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  scoreBreakdown?: ScoreBreakdown;
  chainOfThought?: string;
  transcript?: any[];
  aiGeneratedLikelihoodScore?: number;
  antiCheatFlags?: AntiCheatFlag[];
  // Telemetry & Cost Breakdown
  apiCost?: number;
  costBreakdown?: Record<string, any>;

  evaluation?: Evaluation;
}


export interface Theme {
  name: string;
  isDark: boolean;
  bgPage: string;
  bgCard: string;
  bgSurface: string;
  txtPrimary: string;
  txtBody: string;
  txtSecondary: string;
  txtMuted: string;
  txtGhost: string;
  numHero: string;
  numPos: string;
  numMid: string;
  numNeg: string;
  accentPrimary: string;
  accentText: string;
  accentBadge: string;
  progressFill: string;
  darkVariant?: Partial<Omit<Theme, "darkVariant" | "name" | "isDark">>;
}
