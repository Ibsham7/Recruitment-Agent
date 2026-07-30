import { CheckCircle, AlertCircle } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export interface StrengthsConcernsPanelProps {
  strengths: string[];
  concerns: string[];
  theme: Theme;
}

export function StrengthsConcernsPanel({ strengths, concerns, theme: t }: StrengthsConcernsPanelProps) {
  const G = getGlass(t);

  const columns = [
    { title: "Strengths", icon: <CheckCircle size={12} />, color: t.numPos, items: strengths || [] },
    { title: "Concerns",  icon: <AlertCircle size={12} />, color: t.numMid,  items: concerns || [] },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {columns.map((col) => (
        <div key={col.title} className="rounded-2xl p-5" style={G.card}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: col.color }}>{col.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>
              {col.title}
            </span>
          </div>
          <ul className="space-y-2">
            {col.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: t.txtBody }}>
                <span
                  className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: col.color, boxShadow: `0 0 4px ${hexToRgba(col.color, 0.6)}` }}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
