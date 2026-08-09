import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import { Campaign, Candidate, CandidateStage } from "../types";

export function getPipelineQueryKey(id: string) {
  return ["campaign", id] as const;
}

export async function fetchPipelineData(id: string) {
  if (!id) {
    return { campaign: null, candidates: [] };
  }

  const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch campaign data");
  }
  const campaignData = await res.json();
  const candidatesData = campaignData.candidates || [];

  const total = candidatesData.length;
  const processed = candidatesData.filter((c: any) => !["pending", "screening"].includes(c.status)).length;
  const shortlisted = candidatesData.filter((c: any) =>
    ["shortlisted", "invited", "interviewing", "interview_completed", "finalized", "complete"].includes(c.status)
  ).length;

  const mappedCandidates: Candidate[] = candidatesData.map((c: any) => {
    let stage: CandidateStage = "screening";
    if (["pending", "screening", "screening_hold"].includes(c.status)) {
      stage = "screening";
    } else if (["shortlisted", "invited"].includes(c.status)) {
      stage = "shortlisted";
    } else if (c.status === "interviewing") {
      stage = "interviewing";
    } else if (["interview_completed", "review"].includes(c.status)) {
      stage = "review";
    } else if (["finalized", "complete"].includes(c.status)) {
      stage = "finalized";
    } else if (c.status === "rejected") {
      stage = "rejected";
    }

    const apiCost = typeof c.apiCost === 'number' ? c.apiCost : (typeof c.api_cost === 'number' ? c.api_cost : 0);
    const costBreakdown = c.costBreakdown || c.cost_breakdown || null;

    const evalData = c.evaluation || {};

    return {
      ...c,
      cvUrl: c.cvUrl || c.resumePath || c.resume?.cvUrl || c.resume?.resumePath || null,
      score: Math.min(100, Math.max(0, Number((evalData.overallScore ?? c.fitScore ?? 0).toFixed(2)))),
      recommendation: c.decision || evalData.recommendation || "pending",
      stage,
      currentRole: c.currentRole || c.structuredProfile?.currentRole || c.structuredProfile?.current_role || "Candidate",
      totalExperienceYears: c.totalExperienceYears ?? c.structuredProfile?.totalExperienceYears ?? c.structuredProfile?.total_experience_years ?? null,
      experience: (c.totalExperienceYears ?? c.structuredProfile?.totalExperienceYears ?? c.structuredProfile?.total_experience_years) != null
        ? `${c.totalExperienceYears ?? c.structuredProfile?.totalExperienceYears ?? c.structuredProfile?.total_experience_years} yrs`
        : (c.structuredProfile?.experience || ""),
      scores: {
        technical: evalData.technicalScore != null ? Number(evalData.technicalScore.toFixed(2)) : null,
        communication: evalData.communicationScore != null ? Number(evalData.communicationScore.toFixed(2)) : null,
        culturalFit: evalData.culturalFitScore != null ? Number(evalData.culturalFitScore.toFixed(2)) : null,
        overall: Math.min(100, Math.max(0, Number((evalData.overallScore ?? c.fitScore ?? 0).toFixed(2)))),
      },
      summary: c.rejectionReason
        ? (evalData.summary ? `Rejection Reason: ${c.rejectionReason}\n\n${evalData.summary}` : c.rejectionReason)
        : (evalData.summary || "No summary available."),
      strengths: evalData.strengths || [],
      concerns: evalData.concerns || [],
      scoreBreakdown: evalData.scoreBreakdown || null,
      chainOfThought: evalData.chainOfThought || "No reasoning provided.",
      transcript: evalData.interviewTranscript || [],
      aiGeneratedLikelihoodScore: evalData.aiGeneratedLikelihoodScore ?? c.aiGeneratedLikelihoodScore ?? 0,
      antiCheatFlags: evalData.antiCheatFlags || c.antiCheatFlags || [],
      antiCheatMetadata: evalData.antiCheatMetadata || c.antiCheatMetadata || null,
      evaluation: evalData,
      apiCost,
      costBreakdown,
    };
  });

  const sumTotalCost = mappedCandidates.reduce((acc, c) => acc + (c.apiCost || 0), 0);

  const campaign: Campaign = {
    ...campaignData,
    total,
    processed,
    shortlisted,
    status: campaignData.status || "active",
    location: campaignData.location || "Remote",
    totalCost: typeof campaignData.totalCost === 'number' && campaignData.totalCost > 0 ? campaignData.totalCost : sumTotalCost,
  };

  return { campaign, candidates: mappedCandidates };
}


export function usePipeline(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: getPipelineQueryKey(id || ""),
    queryFn: () => fetchPipelineData(id || ""),
    enabled: Boolean(id),
    // Selective Caching Strategy:
    // - In-process / Active campaigns: staleTime = 0 (always fetch fresh live data)
    // - Completed or Paused campaigns: staleTime = 5 minutes (cache results)
    staleTime: (query) => {
      const campaign = query.state.data?.campaign;
      if (!campaign || campaign.status === "active") {
        return 0;
      }
      return 1000 * 60 * 5;
    },
  });

  const invalidatePipeline = useCallback(() => {
    if (!id) return;
    return queryClient.invalidateQueries({ queryKey: getPipelineQueryKey(id) });
  }, [id, queryClient]);

  return {
    ...query,
    campaign: query.data?.campaign || null,
    candidates: query.data?.candidates || [],
    invalidatePipeline,
  };
}
