import React from "react";
import { Link } from "react-router";
import { ChevronRight, Loader2, CheckCircle2, Calendar } from "lucide-react";
import { Theme, Campaign, CampaignStatus } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { ParticleCard } from "../../../components/common/MagicBento";
import { StatusBadge } from "./StatusBadge";

export interface ExtendedCampaign extends Campaign {
  avgMatch?: number | null;
  candidates?: any[];
  isAllProcessed?: boolean;
}

export interface CampaignCardProps {
  campaign: ExtendedCampaign;
  theme: Theme;
  G: ReturnType<typeof getGlass>;
  glowColor: string;
}

export function CampaignCard({ campaign, theme: t, G, glowColor }: CampaignCardProps) {
  const statusColors: Record<CampaignStatus, string> = { 
    active: "#40A060", 
    completed: "#4A70D0", 
    paused: "#C09040" 
  };
  const status = campaign.status || "active";
  const sc = statusColors[status];
  const total = campaign.total || 0;
  const processed = campaign.processed || 0;
  const shortlisted = campaign.shortlisted || 0;
  const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const isProcessing = total > 0 && processed < total && status === "active";
  
  return (
    <Link to={`/pipeline/${campaign.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <ParticleCard 
        className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:translate-y-[-2px]"
        style={{ "--glow-color": glowColor, ...G.card } as React.CSSProperties}
        glowColor={glowColor} particleCount={10} enableTilt={true} clickEffect={true} enableMagnetism={true}
      >
        <div className="flex items-start justify-between mb-4" style={{ position: "relative", zIndex: 1 }}>
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={status} sc={sc} />
              {campaign.avgMatch !== null && campaign.avgMatch !== undefined && (
                <span 
                  className="inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: hexToRgba(t.accentPrimary, 0.12), color: t.accentPrimary, border: `1px solid ${hexToRgba(t.accentPrimary, 0.25)}` }}
                  title="Average candidate AI fit score across evaluations"
                >
                  Avg Fit: {campaign.avgMatch}%
                </span>
              )}
            </div>
            <h3 className="font-semibold text-base leading-snug truncate" style={{ color: t.txtPrimary }}>{campaign.title}</h3>
            <div className="text-xs mt-1 truncate font-medium" style={{ color: t.txtMuted }}>
              {campaign.department || "General"} · {campaign.location || "Remote"}
            </div>
          </div>
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:translate-x-1"
            style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.45), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.60)}`, color: t.txtMuted }}
          >
            <ChevronRight size={14} />
          </div>
        </div>

        {/* AI Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-[11px] mb-1.5 font-medium" style={{ color: t.txtMuted }}>
            <span className="flex items-center gap-1.5">
              {isProcessing ? "AI Processing" : progress === 100 ? "Processing Complete" : "AI Processing"}
              {isProcessing && <Loader2 size={12} className="animate-spin text-amber-500 flex-shrink-0" />}
              {progress === 100 && <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />}
            </span>
            <span className="font-mono text-xs font-semibold" style={{ color: t.txtSecondary }}>
              {processed}/{total} CVs ({progress}%)
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.25) }}>
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out" 
              style={{ 
                width: `${progress}%`, 
                backgroundColor: status === "completed" || progress === 100 ? "#40A060" : t.progressFill, 
                boxShadow: `0 0 10px ${hexToRgba(status === "completed" || progress === 100 ? "#40A060" : t.progressFill, 0.5)}` 
              }} 
            />
          </div>
        </div>

        {/* Stat metrics & date */}
        <div className="flex items-center gap-5 pt-3.5" style={{ borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.30)}` }}>
          {[
            { v: total, l: "Total CVs", c: t.numHero }, 
            { v: shortlisted, l: "Shortlisted", c: t.numPos }
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl font-bold leading-none mb-0.5 font-sans" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: t.txtGhost }}>{s.l}</div>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1 text-[11px]" style={{ color: t.txtGhost }}>
            <Calendar size={11} />
            {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
          </div>
        </div>
      </ParticleCard>
    </Link>
  );
}
