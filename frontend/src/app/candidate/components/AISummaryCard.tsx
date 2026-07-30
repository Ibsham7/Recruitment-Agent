import { Zap } from "lucide-react";
import { Theme } from "../../../lib/types";
import { getGlass } from "../../../lib/theme";

export interface AISummaryCardProps {
  summary: string;
  theme: Theme;
}

export function AISummaryCard({ summary, theme: t }: AISummaryCardProps) {
  const G = getGlass(t);

  return (
    <div className="rounded-2xl p-6" style={G.card}>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={12} style={{ color: t.accentBadge }} />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>
          AI Summary
        </span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.txtBody }}>
        {summary}
      </p>
    </div>
  );
}
