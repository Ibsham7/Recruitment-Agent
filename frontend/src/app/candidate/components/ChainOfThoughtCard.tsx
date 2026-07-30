import { AlertCircle } from "lucide-react";
import { Theme } from "../../../lib/types";
import { getGlass } from "../../../lib/theme";

export interface ChainOfThoughtCardProps {
  chainOfThought: string;
  theme: Theme;
}

export function ChainOfThoughtCard({ chainOfThought, theme: t }: ChainOfThoughtCardProps) {
  const G = getGlass(t);

  return (
    <div className="rounded-2xl p-6" style={G.card}>
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={12} style={{ color: t.txtGhost }} />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>
          JD Match Reasoning
        </span>
      </div>
      <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono" style={{ color: t.txtSecondary }}>
        {chainOfThought}
      </p>
    </div>
  );
}
