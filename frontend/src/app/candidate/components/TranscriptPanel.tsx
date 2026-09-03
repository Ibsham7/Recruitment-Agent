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
    <div className="w-full h-full flex flex-col flex-shrink-0">
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
          transcript.map((entry: any, i: number) => {
            const isAi = entry.role === "ai" || entry.role === "interviewer";
            const telem = entry.telemetry || entry || {};
            const turnPasteCount = telem.pasteCount ?? telem.paste_count ?? entry.pasteCount ?? 0;
            const turnBlurCount = telem.blurCount ?? telem.blur_count ?? telem.tabSwitches ?? entry.blurCount ?? 0;
            let turnPasteRatio = telem.pasteRatio ?? telem.paste_ratio ?? entry.pasteRatio;
            if (typeof turnPasteRatio === "number" && turnPasteRatio > 0 && turnPasteRatio <= 1) {
              turnPasteRatio = Math.round(turnPasteRatio * 100);
            } else if (typeof turnPasteRatio === "number") {
              turnPasteRatio = Math.round(turnPasteRatio);
            }
            const hasTurnTelem = !isAi && (turnPasteCount > 0 || turnBlurCount > 0 || (turnPasteRatio !== undefined && turnPasteRatio > 0));

            return (
              <div key={i} className={isAi ? "flex justify-start" : "flex justify-end"}>
                <div
                  className="max-w-[88%] px-4 py-3"
                  style={{
                    background: hexToRgba(isAi ? t.bgCard : t.accentPrimary, isAi ? (t.isDark ? 0.10 : 0.55) : 0.14),
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: `1px solid ${hexToRgba(isAi ? t.bgCard : t.accentPrimary, isAi ? (t.isDark ? 0.18 : 0.75) : 0.28)}`,
                    borderRadius: isAi ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                  }}
                >
                  <div
                    className="text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center justify-between gap-1"
                    style={{ color: isAi ? t.accentBadge : t.numPos }}
                  >
                    <span>{isAi ? "AI Interviewer" : candidateName.split(" ")[0]}</span>
                    {hasTurnTelem && (
                      <div className="flex items-center gap-1 text-[8px] font-semibold">
                        {turnPasteCount > 0 && (
                          <span className="px-1 py-0.25 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            📋 {turnPasteCount}
                          </span>
                        )}
                        {turnBlurCount > 0 && (
                          <span className="px-1 py-0.25 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                            👁 {turnBlurCount}
                          </span>
                        )}
                        {turnPasteRatio !== undefined && turnPasteRatio > 0 && (
                          <span className="px-1 py-0.25 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                            📊 {turnPasteRatio}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: t.txtBody }}>
                    {entry.message}
                  </p>
                  <div className="text-[9px] mt-1.5" style={{ fontFamily: "'DM Mono',monospace", color: t.txtGhost }}>
                    {entry.time}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
