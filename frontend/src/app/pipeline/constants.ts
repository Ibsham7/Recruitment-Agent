import { CandidateStage } from "../../lib/types";

export const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  screening:    { label: "AI Screening",      color: "#EAB308" },
  shortlisted:  { label: "Shortlisted",       color: "#40A060" },
  interviewing: { label: "Interviewing",      color: "#4088C0" },
  review:       { label: "Interview Review",  color: "#9040C0" },
  finalized:    { label: "Finalized",         color: "#10B981" },
  rejected:     { label: "Rejected",          color: "#C04040" },
};

export const ALL_STAGES: CandidateStage[] = [
  "screening",
  "shortlisted",
  "interviewing",
  "review",
  "finalized",
  "rejected",
];
