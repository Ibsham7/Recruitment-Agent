import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
  errorReason?: string;
}

export interface HardFilter {
  type: string;
  value: string;
  penalty: string;
}

export function validateFile(file: File): { isError: boolean; reason?: string } {
  if (file.size === 0) {
    return { isError: true, reason: "Empty file (0 B)" };
  }
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
  const ext = "." + (file.name.split('.').pop() || "").toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { isError: true, reason: `Unsupported file type (${ext || 'unknown'})` };
  }
  return { isError: false };
}

export const DEFAULT_TITLE = "AI Engineer (Applied ML & Agentic Systems)";
export const DEFAULT_JD = `We are looking for an AI Developer to design, build, and deploy intelligent applications and machine learning infrastructure. In this role, you will bridge the gap between advanced deep learning models and production-ready software. You will focus heavily on large language model (LLM) orchestration, multi-agent frameworks, and building the robust backend architecture required to support scalable AI features.
Key Responsibilities
Agentic Workflow Development: Design and implement autonomous multi-agent execution loops and orchestration pipelines for complex problem-solving.
Backend & API Engineering: Build production-grade, scalable backend services and APIs to serve ML models and manage data flow between shared stores.
Model Integration & Optimization: Integrate various cloud-hosted multi-model platforms and manage API connectivity, rate limits, and contextual token scaling.
Advanced AI Architectures: Implement and maintain Retrieval-Augmented Generation (RAG) systems and apply parameter-efficient fine-tuning techniques to adapt open-weights models.
Infrastructure & Tooling: Establish reliable machine learning production pipelines and utilize open-source connectivity standards to allow models to interact with external tools and databases.
Required Qualifications
Programming Languages: Strong proficiency in Python and TypeScript/Node.js.
AI & LLM Frameworks: Hands-on experience with orchestration and agent frameworks such as LangChain, LangGraph, CrewAI, AutoGen, or the Model Context Protocol (MCP).
Backend Technologies: Experience with modern backend web architectures (e.g., NestJS, Express) and relational databases (PostgreSQL) using ORMs like Prisma or Drizzle.
Applied Machine Learning: Solid understanding of deep learning optimization strategies, post-training alignment, and architectures like LoRA (Low-Rank Adaptation) and GRPO.
Cloud & Model Ops: Experience utilizing platforms like OpenRouter to manage API keys, track billing structures, and test diverse production-grade model architectures.
Preferred Qualifications
A strong portfolio of independent, agent-based proof-of-concept projects demonstrating practical AI engineering skills.
An understanding of low-level hardware optimizations, compute thermal management, and cache organization mechanics for local model deployments.
A strong mathematical foundation in vector calculus and linear algebra.`;

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getPenaltyInfo(penalty: string, t: Theme) {
  switch (penalty) {
    case "reject":
      return { label: "Reject Candidate", color: "#ef4444", bg: hexToRgba("#ef4444", 0.15) };
    case "hard_penalize":
      return { label: "-30 Penalty", color: "#f97316", bg: hexToRgba("#f97316", 0.15) };
    case "intermediate_penalize":
      return { label: "-20 Penalty", color: "#eab308", bg: hexToRgba("#eab308", 0.15) };
    case "slight_penalize":
      return { label: "-10 Penalty", color: "#3b82f6", bg: hexToRgba("#3b82f6", 0.15) };
    default:
      return { label: penalty, color: t.txtSecondary, bg: hexToRgba(t.txtGhost, 0.15) };
  }
}
