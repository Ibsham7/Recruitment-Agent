import { useEffect } from "react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { Sparkles, X, Brain, ThumbsUp, ThumbsDown, MessageSquare, Loader2 } from "lucide-react";
import { InterviewCandidate } from "../types";
import { getCandidateDisplayName } from "../../../lib/candidate";

import { AntiCheatInspectionCard } from "../../candidate/components/AntiCheatInspectionCard";

export interface CandidateInspectionDrawerProps {
  candidate: InterviewCandidate | null;
  theme: Theme;
  onClose: () => void;
  handleRecruiterReview: (candidateId: string, decision: "approve" | "hold" | "reject") => void;
  reviewingAction: string | null;
}

export function CandidateInspectionDrawer({
  candidate,
  theme: t,
  onClose,
  handleRecruiterReview,
  reviewingAction,
}: CandidateInspectionDrawerProps) {
  useEffect(() => {
    if (!candidate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [candidate, onClose]);

  if (!candidate) return null;

  const displayName = getCandidateDisplayName(candidate);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      style={{ background: t.isDark ? "rgba(3, 3, 7, 0.82)" : "rgba(15, 15, 25, 0.6)", backdropFilter: "blur(12px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="eval-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: t.isDark ? t.bgSurface : t.bgCard,
          border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
          boxShadow: t.isDark ? `0 20px 50px rgba(0,0,0,0.6), 0 0 30px ${hexToRgba(t.accentPrimary, 0.15)}` : "0 20px 50px rgba(0,0,0,0.15)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header Bar */}
        <div
          className="shrink-0 flex items-center justify-between p-6 border-b z-10"
          style={{
            borderColor: hexToRgba(t.txtPrimary, 0.1),
            background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
            backdropFilter: "blur(8px)"
          }}
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: t.accentPrimary }}>
              <Sparkles size={14} /> Technical Evaluation Inspection
            </div>
            <div className="flex items-center gap-3">
              <h2 id="eval-modal-title" className="text-xl md:text-2xl font-bold" style={{ color: t.txtPrimary, fontFamily: "'Fraunces', serif" }}>
                {displayName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary, border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}` }}>
                {candidate.status}
              </span>
            </div>
            <p className="text-xs font-medium mt-0.5" style={{ color: t.txtSecondary }}>
              {candidate.email || "No email provided"} · Position: <span style={{ color: t.txtPrimary }}>{candidate.campaignTitle}</span>
            </p>
          </div>

          {/* Close Button - Always Visible at Top Right */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2.5 rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
            style={{ color: t.txtSecondary, background: hexToRgba(t.txtPrimary, 0.08), border: `1px solid ${hexToRgba(t.txtPrimary, 0.12)}` }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metrics Breakdown Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: "Overall Score", value: candidate.evaluation?.overallScore, color: t.numHero },
              { label: "Technical Score", value: candidate.evaluation?.technicalScore, color: t.accentPrimary },
              { label: "Communication", value: candidate.evaluation?.communicationScore, color: t.numPos },
              { label: "Cultural Fit", value: candidate.evaluation?.culturalFitScore, color: t.accentBadge },
            ].map((m) => {
              const formattedVal = m.value !== undefined && m.value !== null ? Math.round(m.value) : null;
              return (
                <div
                  key={m.label}
                  className="p-4 rounded-2xl flex flex-col justify-between transition-all"
                  style={{
                    background: hexToRgba(t.bgPage, t.isDark ? 0.5 : 0.6),
                    border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)"
                  }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: t.txtSecondary }}>
                    {m.label}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold" style={{ fontFamily: "'Fraunces', serif", color: m.color }}>
                      {formattedVal !== null ? formattedVal : "--"}
                    </span>
                    {formattedVal !== null && (
                      <span className="text-xs font-semibold" style={{ color: t.txtMuted }}>/100</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anti-Cheat & Telemetry Inspection Metric Card */}
          <AntiCheatInspectionCard candidate={candidate} theme={t} />

          {/* AI Summary Assessment */}
          {candidate.evaluation?.summary && (
            <div className="p-5 rounded-2xl" style={{ background: hexToRgba(t.accentPrimary, 0.05), border: `1px solid ${hexToRgba(t.accentPrimary, 0.2)}` }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: t.accentPrimary }}>
                <Brain size={15} /> AI Evaluator Assessment
              </div>
              <p className="text-xs md:text-sm leading-relaxed font-normal" style={{ color: t.txtPrimary }}>
                {candidate.evaluation.summary}
              </p>
            </div>
          )}

          {/* Strengths & Concerns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Technical Strengths */}
            <div className="p-5 rounded-2xl flex flex-col" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.numPos, 0.25)}` }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: t.numPos }}>
                <ThumbsUp size={15} /> Technical Strengths
              </div>
              {candidate.evaluation?.strengths && candidate.evaluation.strengths.length > 0 ? (
                <ul className="space-y-2 text-xs md:text-sm" style={{ color: t.txtPrimary }}>
                  {candidate.evaluation.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="font-bold text-base leading-none" style={{ color: t.numPos }}>✓</span>
                      <span className="leading-snug">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic" style={{ color: t.txtMuted }}>No specific strengths highlighted.</p>
              )}
            </div>

            {/* Key Concerns */}
            <div className="p-5 rounded-2xl flex flex-col" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.numNeg, 0.25)}` }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: t.numNeg }}>
                <ThumbsDown size={15} /> Key Concerns
              </div>
              {candidate.evaluation?.concerns && candidate.evaluation.concerns.length > 0 ? (
                <ul className="space-y-2 text-xs md:text-sm" style={{ color: t.txtPrimary }}>
                  {candidate.evaluation.concerns.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="font-bold text-base leading-none" style={{ color: t.numNeg }}>⚠</span>
                      <span className="leading-snug">{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic" style={{ color: t.txtMuted }}>No major concerns recorded.</p>
              )}
            </div>
          </div>

          {/* Transcript Log */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: t.txtPrimary }}>
              <MessageSquare size={15} style={{ color: t.accentPrimary }} /> Live Interview Q&A Transcript
            </div>
            <div className="p-4 rounded-2xl max-h-80 overflow-y-auto space-y-3" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.6 : 0.7), border: `1px solid ${hexToRgba(t.txtPrimary, 0.1)}` }}>
              {candidate.evaluation?.interviewTranscript && candidate.evaluation.interviewTranscript.length > 0 ? (
                candidate.evaluation.interviewTranscript.map((turn: any, idx: number) => {
                  const isAi = turn.role === "ai" || turn.role === "interviewer";
                  const telem = turn.telemetry || turn || {};
                  const turnPasteCount = telem.pasteCount ?? telem.paste_count ?? turn.pasteCount ?? 0;
                  const turnBlurCount = telem.blurCount ?? telem.blur_count ?? telem.tabSwitches ?? turn.blurCount ?? 0;
                  let turnPasteRatio = telem.pasteRatio ?? telem.paste_ratio ?? turn.pasteRatio;
                  if (typeof turnPasteRatio === "number" && turnPasteRatio > 0 && turnPasteRatio <= 1) {
                    turnPasteRatio = Math.round(turnPasteRatio * 100);
                  } else if (typeof turnPasteRatio === "number") {
                    turnPasteRatio = Math.round(turnPasteRatio);
                  }

                  const hasTurnTelem = !isAi && (turnPasteCount > 0 || turnBlurCount > 0 || (turnPasteRatio !== undefined && turnPasteRatio > 0));

                  return (
                    <div key={idx} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                      <div
                        className="max-w-[85%] p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm"
                        style={{
                          background: isAi ? hexToRgba(t.accentPrimary, 0.12) : hexToRgba(t.bgCard, t.isDark ? 0.8 : 1),
                          border: `1px solid ${hexToRgba(isAi ? t.accentPrimary : t.txtPrimary, 0.2)}`,
                          color: t.txtPrimary,
                        }}
                      >
                        <div className="font-bold text-[10px] uppercase tracking-wider mb-1.5 flex flex-wrap items-center justify-between gap-2" style={{ color: isAi ? t.accentPrimary : t.numPos }}>
                          <span>{isAi ? "🤖 AI Technical Interviewer" : `👤 ${displayName}`}</span>
                          {hasTurnTelem && (
                            <div className="flex items-center gap-1.5 text-[9px] font-semibold">
                              {turnPasteCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  📋 Pastes: {turnPasteCount}
                                </span>
                              )}
                              {turnBlurCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                  👁 Blurs: {turnBlurCount}
                                </span>
                              )}
                              {turnPasteRatio !== undefined && turnPasteRatio > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                  📊 Paste Ratio: {turnPasteRatio}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="font-normal">{turn.message}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-center py-8" style={{ color: t.txtMuted }}>
                  No interview transcript recorded yet for this candidate.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Recruiter Action Footer */}
        <div
          className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t z-10"
          style={{
            borderColor: hexToRgba(t.txtPrimary, 0.1),
            background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
            backdropFilter: "blur(8px)"
          }}
        >
          <div className="text-xs font-medium" style={{ color: t.txtSecondary }}>
            Final Decision: <span className="font-bold text-sm uppercase ml-1" style={{ color: t.txtPrimary }}>{candidate.status}</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => handleRecruiterReview(candidate.id, "hold")}
              disabled={reviewingAction !== null}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: hexToRgba(t.txtPrimary, 0.08), color: t.txtPrimary, border: `1px solid ${hexToRgba(t.txtPrimary, 0.18)}` }}
            >
              {reviewingAction === "hold" ? <Loader2 size={14} className="animate-spin" /> : null}
              Hold
            </button>
            <button
              onClick={() => handleRecruiterReview(candidate.id, "reject")}
              disabled={reviewingAction !== null}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: hexToRgba(t.numNeg, 0.15), color: t.numNeg, border: `1px solid ${hexToRgba(t.numNeg, 0.4)}` }}
            >
              {reviewingAction === "reject" ? <Loader2 size={14} className="animate-spin" /> : null}
              Reject Candidate
            </button>
            <button
              onClick={() => handleRecruiterReview(candidate.id, "approve")}
              disabled={reviewingAction !== null}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: t.accentPrimary, color: t.accentText, boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.35)}` }}
            >
              {reviewingAction === "approve" ? <Loader2 size={14} className="animate-spin" /> : null}
              Approve Candidate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
