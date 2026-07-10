export type View = "landing" | "login" | "signup" | "dashboard" | "setup" | "pipeline" | "candidate" | "notfound";
export type CampaignStatus = "active" | "completed" | "paused";
export type CandidateStage = "pending" | "screening" | "rejected" | "interviewing" | "shortlisted";
export type Recommendation = "shortlist" | "reject" | "pending";

export interface Campaign {
  id: string;
  title: string;
  department: string;
  location: string;
  status: CampaignStatus;
  total: number;
  processed: number;
  shortlisted: number;
  created: string;
}

export interface TranscriptEntry {
  role: "ai" | "candidate";
  message: string;
  time: string;
}

export interface Candidate {
  id: string;
  campaignId: string;
  name: string;
  email: string;
  currentRole: string;
  experience: string;
  score: number;
  stage: CandidateStage;
  recommendation: Recommendation;
  scores: {
    technical: number;
    communication: number;
    culturalFit: number;
    problemSolving: number;
    leadership: number;
    domain: number;
  };
  summary: string;
  strengths: string[];
  concerns: string[];
  transcript: TranscriptEntry[];
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
