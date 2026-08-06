import { Loader2, DollarSign, BarChart3 } from "lucide-react";
import { Campaign, Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

interface PipelineHeaderProps {
  campaign: Campaign;
  theme: Theme;
  G: ReturnType<typeof getGlass>;
  retrying: boolean;
  onRetryFailed: () => void;
  onOpenCostAnalysis?: () => void;
}

export function PipelineHeader({ campaign, theme: t, G, retrying, onRetryFailed, onOpenCostAnalysis }: PipelineHeaderProps) {
  const progress = campaign.total && campaign.total > 0 ? Math.round(((campaign.processed || 0) / campaign.total) * 100) : 0;
  const isProcessing = campaign.total && campaign.total > 0 ? campaign.processed! < campaign.total : false;

  const statItems = [
    { v: campaign.total, l: "Total CVs", c: t.numHero, onClick: undefined },
    { v: campaign.processed, l: "Processed", c: t.txtPrimary, onClick: undefined },
    { v: campaign.shortlisted, l: "Shortlisted", c: t.numPos, onClick: undefined },
    {
      v: campaign.totalCost ? `$${campaign.totalCost.toFixed(4)}` : "$0.00",
      l: "API Cost",
      c: t.numNeg,
      onClick: onOpenCostAnalysis,
      isInteractive: true,
    }
  ];

  return (
    <div className="px-8 py-5 flex-shrink-0 relative z-10" style={{ ...G.bar }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: t.numPos }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.numPos, boxShadow: `0 0 8px ${hexToRgba(t.numPos, 0.8)}` }} />{campaign.status}
            </span>
            <span className="text-xs" style={{ color: t.txtMuted }}>•</span>
            <span className="text-xs font-medium" style={{ color: t.txtMuted }}>{campaign.location}</span>
          </div>
          <h2 className="text-3xl font-bold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>{campaign.title}</h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ width: "240px", background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.3) }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: t.progressFill, boxShadow: `0 0 10px ${hexToRgba(t.progressFill, 0.6)}` }} />
            </div>
            <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: t.txtSecondary }}>
              {isProcessing && <Loader2 size={12} className="animate-spin text-amber-500" />}
              {campaign.processed} / {campaign.total} Processed
            </span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={onRetryFailed} 
              disabled={retrying}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
              style={{ 
                background: hexToRgba(t.accentPrimary, 0.15), 
                color: t.accentText || t.accentPrimary, 
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
                boxShadow: `0 4px 12px ${hexToRgba(t.accentPrimary, 0.1)}`
              }}
            >
              {retrying ? "Retrying..." : "Retry Failed"}
            </button>
            {onOpenCostAnalysis && (
              <button
                onClick={onOpenCostAnalysis}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
                style={{
                  background: hexToRgba(t.numNeg, 0.15),
                  color: t.numNeg,
                  border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`,
                  boxShadow: `0 4px 12px ${hexToRgba(t.numNeg, 0.1)}`
                }}
                title="View detailed candidate cost & model breakdown"
              >
                <BarChart3 size={16} /> Cost Breakdown
              </button>
            )}
          </div>
          <div className="flex gap-8">
            {statItems.map((s) => (
              <div 
                key={s.l} 
                className={`text-center transition-all ${s.isInteractive ? "cursor-pointer hover:scale-105 group" : ""}`}
                onClick={s.onClick}
                title={s.isInteractive ? "Click to open candidate cost breakdown analysis" : undefined}
              >
                <div className="text-4xl font-bold mb-1 flex items-center justify-center gap-1" style={{ fontFamily: "'Fraunces',serif", color: s.c }}>
                  {s.v}
                </div>
                <div className="text-xs font-medium uppercase tracking-widest flex items-center justify-center gap-1" style={{ color: t.txtGhost }}>
                  {s.l}
                  {s.isInteractive && <span className="text-[10px] text-amber-500 font-bold group-hover:underline">🔍</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

