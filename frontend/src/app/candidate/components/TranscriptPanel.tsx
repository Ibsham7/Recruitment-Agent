import { MessageSquare } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export interface TranscriptPanelProps {
  transcript: any[];
  candidateName: string;
  theme: Theme;
}

export function TranscriptPanel({ transcript, candidateName, theme: t }: TranscriptPanelProps) {
  const G = getGlass(t);

  return (
    <div className="w-80 flex flex-col flex-shrink-0">
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{ ...G.bar, borderBottom: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50)}` }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={12} style={{ color: t.txtGhost }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtGhost }}>
            Interview Transcript
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!transcript || transcript.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare size={28} className="mx-auto mb-3" style={{ color: t.txtGhost }} />
            <div className="text-xs" style={{ color: t.txtGhost }}>No transcript available yet.</div>
          </div>
        ) : (
          transcript.map((entry: any, i: number) => (
            <div key={i} className={entry.role === "candidate" ? "flex justify-end" : "flex justify-start"}>
              <div
                className="max-w-[88%] px-4 py-3"
                style={{
                  background: hexToRgba(entry.role === "ai" ? t.bgCard : t.accentPrimary, entry.role === "ai" ? (t.isDark ? 0.10 : 0.55) : 0.14),
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  border: `1px solid ${hexToRgba(entry.role === "ai" ? t.bgCard : t.accentPrimary, entry.role === "ai" ? (t.isDark ? 0.18 : 0.75) : 0.28)}`,
                  borderRadius: entry.role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                }}
              >
                <div
                  className="text-[9px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: entry.role === "ai" ? t.accentBadge : t.numPos }}
                >
                  {entry.role === "ai" ? "AI Interviewer" : candidateName.split(" ")[0]}
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: t.txtBody }}>
                  {entry.message}
                </p>
                <div className="text-[9px] mt-1.5" style={{ fontFamily: "'DM Mono',monospace", color: t.txtGhost }}>
                  {entry.time}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
