import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import { Candidate, Campaign } from "../types";

export function getCandidateQueryKey(id: string) {
  return ["candidate", id] as const;
}

export async function fetchCandidateDetail(id: string) {
  if (!id) {
    return { candidate: null, campaign: null };
  }

  const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch candidate");
  }
  const candidateData = await res.json();
  if (!candidateData) {
    return { candidate: null, campaign: null };
  }

  const evalData = candidateData.evaluation || {};
  const mappedCand: Candidate = {
    ...candidateData,
    cvUrl: candidateData.cvUrl || candidateData.resumePath || null,
    score: Number((candidateData.fitScore ?? evalData.overallScore ?? 0).toFixed(2)),
    recommendation: candidateData.decision || evalData.recommendation || "pending",
    stage: candidateData.status,
    currentRole: candidateData.structuredProfile?.currentRole || "Candidate",
    experience: candidateData.structuredProfile?.experience || "",
    scores: {
      technical: Number((evalData.technicalScore || 0).toFixed(2)),
      communication: Number((evalData.communicationScore || 0).toFixed(2)),
      culturalFit: Number((evalData.culturalFitScore || 0).toFixed(2)),
      overall: Number((evalData.overallScore || candidateData.fitScore || 0).toFixed(2)),
    },
    summary: candidateData.rejectionReason
      ? (evalData.summary ? `Rejection Reason: ${candidateData.rejectionReason}\n\n${evalData.summary}` : candidateData.rejectionReason)
      : (evalData.summary || "No summary available."),
    strengths: evalData.strengths || [],
    concerns: evalData.concerns || [],
    chainOfThought: evalData.chainOfThought || "No reasoning provided.",
    transcript: evalData.interviewTranscript || [],
  };

  const campaign: Campaign | null = candidateData.campaign || null;

  return { candidate: mappedCand, campaign };
}

export function useCandidateDetail(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: getCandidateQueryKey(id || ""),
    queryFn: () => fetchCandidateDetail(id || ""),
    enabled: Boolean(id),
  });

  const invalidateCandidate = () => {
    if (!id) return;
    return queryClient.invalidateQueries({ queryKey: getCandidateQueryKey(id) });
  };

  return {
    ...query,
    candidate: query.data?.candidate || null,
    campaign: query.data?.campaign || null,
    invalidateCandidate,
  };
}
