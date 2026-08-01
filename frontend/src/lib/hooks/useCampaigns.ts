import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import { CampaignStatus } from "../types";
import { ExtendedCampaign } from "../../app/dashboard/components/CampaignCard";

export const CAMPAIGNS_QUERY_KEY = ["campaigns"] as const;

export async function fetchCampaignsData(): Promise<ExtendedCampaign[]> {
  const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns`);
  if (!res.ok) {
    throw new Error(`Server returned HTTP ${res.status}`);
  }
  const campaignsData = await res.json();
  if (!Array.isArray(campaignsData)) {
    return [];
  }

  return campaignsData.map((c: any) => {
    const candidates = c.candidates || [];
    const total = candidates.length;
    const processed = candidates.filter((cand: any) =>
      cand.status !== "pending" && cand.status !== "screening"
    ).length;
    const shortlisted = candidates.filter((cand: any) =>
      cand.status === "shortlisted" || cand.status === "complete" || cand.status === "finalized"
    ).length;

    const scoredCandidates = candidates.filter((cand: any) =>
      typeof cand.fitScore === "number" && cand.fitScore > 0
    );
    const avgMatch = scoredCandidates.length > 0
      ? Math.round(scoredCandidates.reduce((acc: number, cand: any) => acc + cand.fitScore, 0) / scoredCandidates.length)
      : null;

    const rawStatus = (c.status as CampaignStatus) || "active";
    const isAllProcessed = total > 0 && processed >= total;

    const effectiveStatus: CampaignStatus = rawStatus === "paused"
      ? "paused"
      : (rawStatus === "completed" || isAllProcessed)
        ? "completed"
        : "active";

    return {
      ...c,
      total,
      processed,
      shortlisted,
      avgMatch,
      isAllProcessed,
      status: effectiveStatus,
      department: c.department || "General",
      location: c.location || "Remote",
    };
  });
}

export function useCampaigns() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CAMPAIGNS_QUERY_KEY,
    queryFn: fetchCampaignsData,
  });

  const invalidateCampaigns = () => {
    return queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
  };

  return {
    ...query,
    campaigns: query.data || [],
    invalidateCampaigns,
  };
}
