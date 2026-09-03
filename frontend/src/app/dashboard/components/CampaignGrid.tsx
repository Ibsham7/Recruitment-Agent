import { Plus } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { CampaignCard, ExtendedCampaign } from "./CampaignCard";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function CampaignSkeleton({ G }: { G: ReturnType<typeof getGlass> }) {
  return (
    <div className="magic-bento-card rounded-2xl p-4 sm:p-6 animate-pulse" style={G.card}>
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-20 bg-white/10 rounded" />
          <div className="h-5 w-3/4 bg-white/15 rounded" />
          <div className="h-3 w-1/2 bg-white/10 rounded" />
        </div>
        <div className="h-7 w-7 bg-white/10 rounded-lg" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-white/10 rounded" />
          <div className="h-3 w-12 bg-white/10 rounded" />
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full" />
      </div>
      <div className="flex justify-between pt-3.5 border-t border-white/10">
        <div className="h-6 w-12 bg-white/10 rounded" />
        <div className="h-6 w-12 bg-white/10 rounded" />
        <div className="h-4 w-20 bg-white/10 rounded" />
      </div>
    </div>
  );
}

export interface CampaignGridProps {
  loading: boolean;
  campaigns: ExtendedCampaign[];
  theme: Theme;
  G: ReturnType<typeof getGlass>;
  glowColor: string;
  onNavigateSetup: () => void;
  searchQuery: string;
  statusFilter: string;
  onClearFilters: () => void;
}

import React from "react";

export const CampaignGrid = React.memo(
  function CampaignGrid({
    loading,
    campaigns,
    theme: t,
    G,
    glowColor,
    onNavigateSetup,
    searchQuery,
    statusFilter,
    onClearFilters,
  }: CampaignGridProps) {
    if (loading) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CampaignSkeleton key={i} G={G} />
          ))}
        </div>
      );
    }

    if (campaigns.length === 0) {
      return (
        <DashboardEmptyState
          theme={t}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onClearFilters={onClearFilters}
          onNavigateSetup={onNavigateSetup}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} theme={t} G={G} glowColor={glowColor} />
        ))}

        {/* New Campaign Button */}
        <button 
          onClick={onNavigateSetup} 
          className="rounded-2xl flex flex-col items-center justify-center gap-2 py-8 sm:py-12 p-4 min-h-[140px] transition-all group border-2 border-dashed"
          style={{ 
            borderColor: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30), 
            background: hexToRgba(t.bgCard, t.isDark ? 0.04 : 0.20), 
            color: t.txtGhost 
          }}
          onMouseEnter={(e) => { 
            (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(t.accentPrimary, 0.45); 
            (e.currentTarget as HTMLElement).style.color = t.txtSecondary; 
          }}
          onMouseLeave={(e) => { 
            (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30); 
            (e.currentTarget as HTMLElement).style.color = t.txtGhost; 
          }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>
            <Plus size={20} />
          </div>
          <span className="text-sm font-semibold">Start New Campaign</span>
          <span className="text-xs" style={{ color: t.txtGhost }}>Upload JD & configure AI evaluation criteria</span>
        </button>
      </div>
    );
  }
);
