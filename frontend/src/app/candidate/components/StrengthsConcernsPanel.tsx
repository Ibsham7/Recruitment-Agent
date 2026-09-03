import { CheckCircle, AlertCircle } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export interface StrengthsConcernsPanelProps {
  strengths: string[];
  concerns: string[];
  theme: Theme;
}

function renderFormattedItem(item: string, isConcern: boolean, t: Theme) {
  if (!isConcern) return <span>{item}</span>;

  const tagMatch = item.match(/^\[(CRITICAL GAP|MODERATE GAP|TENURE GAP|TENURE NOTE|MINOR GAP)\]\s*(.*)/i);
  if (tagMatch) {
    const [, tag, body] = tagMatch;
    const tagUpper = tag.toUpperCase();
    let badgeColor = t.numMid;
    let badgeBg = hexToRgba(t.numMid, 0.15);

    if (tagUpper.includes("CRITICAL")) {
      badgeColor = t.numNeg;
      badgeBg = hexToRgba(t.numNeg, 0.18);
    } else if (tagUpper.includes("MODERATE")) {
      badgeColor = t.numMid;
      badgeBg = hexToRgba(t.numMid, 0.18);
    } else if (tagUpper.includes("TENURE")) {
      badgeColor = "#f59e0b";
      badgeBg = hexToRgba("#f59e0b", 0.18);
    } else if (tagUpper.includes("MINOR")) {
      badgeColor = t.txtMuted;
      badgeBg = hexToRgba(t.txtMuted, 0.15);
    }

    return (
      <div className="flex flex-col gap-1">
        <span
          className="self-start text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
          style={{ color: badgeColor, backgroundColor: badgeBg, border: `1px solid ${hexToRgba(badgeColor, 0.3)}` }}
        >
          {tagUpper}
        </span>
        <span style={{ color: t.txtBody }}>{body}</span>
      </div>
    );
  }

  return <span>{item}</span>;
}

export function StrengthsConcernsPanel({ strengths, concerns, theme: t }: StrengthsConcernsPanelProps) {
  const G = getGlass(t);

  const columns = [
    { title: "Strengths", icon: <CheckCircle size={12} />, color: t.numPos, items: strengths || [], isConcern: false },
    { title: "Concerns & Gaps", icon: <AlertCircle size={12} />, color: t.numMid, items: concerns || [], isConcern: true },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {columns.map((col) => (
        <div key={col.title} className="rounded-2xl p-4 sm:p-5" style={G.card}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: col.color }}>{col.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>
              {col.title}
            </span>
          </div>
          <ul className="space-y-3">
            {col.items.length === 0 ? (
              <li className="text-[11px] italic" style={{ color: t.txtGhost }}>No items flagged.</li>
            ) : (
              col.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: t.txtBody }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: col.color, boxShadow: `0 0 4px ${hexToRgba(col.color, 0.6)}` }}
                  />
                  {renderFormattedItem(item, col.isConcern, t)}
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
