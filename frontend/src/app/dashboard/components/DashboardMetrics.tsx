import React from "react";
import { Briefcase, Users, Award, Target } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { ParticleCard } from "../../../components/common/MagicBento";

export function StatCardSkeleton({ G }: { G: ReturnType<typeof getGlass> }) {
  return (
    <div className="magic-bento-card rounded-2xl p-5 animate-pulse" style={G.cardWarm}>
      <div className="h-3 w-24 bg-white/10 rounded mb-3" />
      <div className="h-8 w-16 bg-white/15 rounded mb-2" />
      <div className="h-3 w-32 bg-white/10 rounded" />
    </div>
  );
}

export interface DashboardMetricsProps {
  theme: Theme;
  G: ReturnType<typeof getGlass>;
  glow: string;
  loading: boolean;
  activeCount: number;
  completedCount: number;
  totalCampaigns: number;
  totalCandidates: number;
  totalShortlisted: number;
  globalAvgMatch: number | null;
}

export const DashboardMetrics = React.memo(
  function DashboardMetrics({
    theme: t,
    G,
    glow,
    loading,
    activeCount,
    completedCount,
    totalCampaigns,
    totalCandidates,
    totalShortlisted,
    globalAvgMatch,
  }: DashboardMetricsProps) {
    const stats = [
      { 
        label: "Active Campaigns", 
        value: activeCount.toString(), 
        sub: `${completedCount} completed · ${totalCampaigns} total`,
        icon: <Briefcase size={16} className="text-emerald-500" />
      },
      { 
        label: "Total Candidates",  
        value: totalCandidates.toString(), 
        sub: "Across all pipelines",
        icon: <Users size={16} className="text-blue-500" />
      },
      { 
        label: "AI Shortlisted",    
        value: totalShortlisted.toString(),  
        sub: totalCandidates > 0 ? `${Math.round((totalShortlisted / totalCandidates) * 100)}% shortlist rate` : "Awaiting evaluations",
        icon: <Award size={16} className="text-purple-500" />
      },
      { 
        label: "Avg. Match Score",  
        value: globalAvgMatch !== null ? `${globalAvgMatch}%` : "--%", 
        sub: globalAvgMatch !== null ? "Computed across evaluations" : "Awaiting evaluations",
        icon: <Target size={16} className="text-amber-500" />
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} G={G} />)
        ) : (
          stats.map((s) => (
            <ParticleCard 
              key={s.label}
              className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5"
              style={{ "--glow-color": glow, ...G.cardWarm } as React.CSSProperties}
              glowColor={glow} particleCount={8} enableTilt={true} clickEffect={true} enableMagnetism={true}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>
                  {s.label}
                </div>
                <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6) }}>
                  {s.icon}
                </div>
              </div>
              <div className="text-3xl font-bold leading-none mb-1.5 font-sans" style={{ color: t.numHero }}>
                {s.value}
              </div>
              <div className="text-[11px]" style={{ color: t.txtGhost }}>{s.sub}</div>
            </ParticleCard>
          ))
        )}
      </div>
    );
  }
);
