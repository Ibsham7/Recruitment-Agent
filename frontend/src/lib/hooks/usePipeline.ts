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

  const campaign: Campaign = {
    ...campaignData,
    total,
    processed,
    shortlisted,
    status: campaignData.status || "active",
    location: campaignData.location || "Remote",
  };

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

    return {
      ...c,
      score: c.fitScore || c.evaluation?.overallScore || 0,
      recommendation: c.decision || c.evaluation?.recommendation || "pending",
      stage,
      currentRole: c.structuredProfile?.currentRole || "",
      experience: c.structuredProfile?.experience || "",
    };
  });

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
