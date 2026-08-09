import { useCallback } from "react";
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
    score: Math.min(100, Math.max(0, Number((evalData.overallScore ?? candidateData.fitScore ?? 0).toFixed(2)))),
    recommendation: evalData.recommendation || candidateData.decision || "pending",
    stage: candidateData.status,
    currentRole: candidateData.currentRole || candidateData.structuredProfile?.currentRole || candidateData.structuredProfile?.current_role || "Candidate",
    totalExperienceYears: candidateData.totalExperienceYears ?? candidateData.structuredProfile?.totalExperienceYears ?? candidateData.structuredProfile?.total_experience_years ?? null,
    experience: (candidateData.totalExperienceYears ?? candidateData.structuredProfile?.totalExperienceYears ?? candidateData.structuredProfile?.total_experience_years) != null
      ? `${candidateData.totalExperienceYears ?? candidateData.structuredProfile?.totalExperienceYears ?? candidateData.structuredProfile?.total_experience_years} yrs`
      : (candidateData.structuredProfile?.experience || ""),
    scores: {
      technical: evalData.technicalScore != null ? Number(evalData.technicalScore.toFixed(2)) : null,
      communication: evalData.communicationScore != null ? Number(evalData.communicationScore.toFixed(2)) : null,
      culturalFit: evalData.culturalFitScore != null ? Number(evalData.culturalFitScore.toFixed(2)) : null,
      overall: Math.min(100, Math.max(0, Number((evalData.overallScore ?? candidateData.fitScore ?? 0).toFixed(2)))),
    },
    summary: candidateData.rejectionReason
      ? (evalData.summary ? `Rejection Reason: ${candidateData.rejectionReason}\n\n${evalData.summary}` : candidateData.rejectionReason)
      : (evalData.summary || "No summary available."),
    strengths: evalData.strengths || [],
    concerns: evalData.concerns || [],
    scoreBreakdown: evalData.scoreBreakdown || null,
    chainOfThought: evalData.chainOfThought || "No reasoning provided.",
    transcript: evalData.interviewTranscript || [],
    aiGeneratedLikelihoodScore: evalData.aiGeneratedLikelihoodScore ?? candidateData.aiGeneratedLikelihoodScore ?? 0,
    antiCheatFlags: evalData.antiCheatFlags || candidateData.antiCheatFlags || [],
    antiCheatMetadata: evalData.antiCheatMetadata || candidateData.antiCheatMetadata,
    evaluation: evalData,
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
    staleTime: 0,
  });

  const invalidateCandidate = useCallback(() => {
    if (!id) return;
    return queryClient.invalidateQueries({ queryKey: getCandidateQueryKey(id) });
  }, [id, queryClient]);

  return {
    ...query,
    candidate: query.data?.candidate || null,
    campaign: query.data?.campaign || null,
    invalidateCandidate,
  };
}
