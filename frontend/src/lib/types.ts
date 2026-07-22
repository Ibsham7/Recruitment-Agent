export type View = "landing" | "login" | "signup" | "dashboard" | "setup" | "pipeline" | "candidate" | "notfound";
export type CampaignStatus = "active" | "completed" | "paused";
export type CandidateStage = "pending" | "screening" | "interviewing" | "shortlisted" | "review" | "finalized" | "complete" | "rejected";
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
  created?: string;
  totalCost?: number; // COST_TRACKING
}

export interface Evaluation {
  id: string;
  candidateId: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  culturalFitScore: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  chainOfThought?: string;
  interviewTranscript: any;
  interviewQuestions?: any;
  createdAt: string;
}

export interface Candidate {
  id: string;
  campaignId: string;
  name: string;
  email: string | null;
  phone: string | null;
  resumePath: string | null;
  status: CandidateStage;
  fitScore: number | null;
  decision: string | null;
  structuredProfile: any;
  currentQuestion?: string | null;
  createdAt: string;
  updatedAt: string;
  
  // UI fallbacks (often derived from structuredProfile or Evaluation)
  currentRole?: string;
  experience?: string;
  score?: number;
  stage?: CandidateStage;
  recommendation?: Recommendation;
  scores?: any;
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  chainOfThought?: string;
  transcript?: any[];
  
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
