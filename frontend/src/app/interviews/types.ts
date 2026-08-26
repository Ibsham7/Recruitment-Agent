import { AntiCheatFlag, AntiCheatMetadata, CandidateStage } from "../../lib/types";

export interface InterviewCandidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: CandidateStage;
  fitScore?: number;
  campaignId: string;
  campaignTitle: string;
  invitedAt?: string;
  hasQuestions: boolean;
  createdAt: string;
  evaluation?: {
    overallScore?: number;
    technicalScore?: number;
    communicationScore?: number;
    culturalFitScore?: number;
    recommendation?: string;
    summary?: string;
    strengths?: string[];
    concerns?: string[];
    chainOfThought?: string;
    interviewTranscript?: any[];
    interviewQuestions?: any[];
    aiGeneratedLikelihoodScore?: number;
    antiCheatFlags?: AntiCheatFlag[];
    antiCheatMetadata?: AntiCheatMetadata;
  };
}

export interface CampaignItem {
  id: string;
  title: string;
  interviewConfig?: string | null;
}

export interface PresetFocusTemplate {
  label: string;
  text: string;
}

export const PRESET_FOCUS_TEMPLATES: PresetFocusTemplate[] = [
  {
    label: "System Design & Scalability",
    text: "Focus heavily on distributed system architecture, caching strategies (Redis), database indexing/scaling, and microservices resilience."
  },
  {
    label: "Frontend & Performance",
    text: "Ask candidate to explain state management in complex React applications, rendering optimization, Lighthouse performance scores, and CSS modern layouts."
  },
  {
    label: "AI & LLM Orchestration",
    text: "Focus on experience with LangChain/LangGraph, prompt engineering, RAG pipelines, vector embeddings, and fallback/tool-calling reliability."
  },
  {
    label: "Problem Solving & Live Coding",
    text: "Deep-dive on live coding problem-solving methodology, clean code principles, automated unit testing, and debugging edge cases."
  }
];
