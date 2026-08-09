import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { Theme, Candidate } from "../../../lib/types";
import { hexToRgba, getGlass, scoreColor } from "../../../lib/theme";

export interface ScorePanelProps {
  candidate: Candidate;
  theme: Theme;
}

export function ScorePanel({ candidate, theme: t }: ScorePanelProps) {
  const G = getGlass(t);

  const radarData = [
    { subject: "Technical", score: candidate.scores?.technical ?? 0 },
    { subject: "Comms", score: candidate.scores?.communication ?? 0 },
    { subject: "Culture", score: candidate.scores?.culturalFit ?? 0 },
    { subject: "Overall", score: candidate.scores?.overall ?? 0 },
  ];

  const scoreMetrics = [
    { label: "Technical Score",    value: candidate.scores?.technical ?? null },
    { label: "Communication Score",value: candidate.scores?.communication ?? null },
    { label: "Cultural Fit Score", value: candidate.scores?.culturalFit ?? null },
    { label: "Overall Match Score",value: candidate.scores?.overall ?? 0 },
  ];

  return (
    <div className="rounded-2xl p-6" style={G.cardWarm}>
      <div className="text-[10px] font-semibold uppercase tracking-widest mb-5" style={{ color: t.txtMuted }}>
        Score Breakdown
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
        {scoreMetrics.map((item) => {
          const hasVal = item.value !== null && item.value !== undefined;
          const numVal = hasVal ? (item.value as number) : 0;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px]" style={{ color: t.txtMuted }}>{item.label}</span>
                <span className="text-[11px] font-semibold" style={{ fontFamily: "'DM Mono',monospace", color: hasVal ? scoreColor(numVal, t) : t.txtMuted }}>
                  {hasVal ? item.value : "N/A"}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.25) }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${hasVal ? numVal : 0}%`,
                    backgroundColor: hasVal ? scoreColor(numVal, t) : t.txtMuted,
                    boxShadow: hasVal ? `0 0 6px ${hexToRgba(scoreColor(numVal, t), 0.5)}` : "none"
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: "180px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={65}>
            <PolarGrid stroke={hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.40)} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: t.txtMuted, fontSize: 9 }} />
            <Radar dataKey="score" stroke={t.numPos} fill={t.numPos} fillOpacity={0.18} strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
