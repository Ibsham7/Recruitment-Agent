import { Shield, ShieldAlert, ShieldCheck, Copy, Eye, Clock, FileText, Percent, AlertTriangle } from "lucide-react";
import { Theme, AntiCheatFlag } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export interface AntiCheatInspectionCardProps {
  candidate: any;
  theme: Theme;
}

export function AntiCheatInspectionCard({ candidate, theme: t }: AntiCheatInspectionCardProps) {
  if (!candidate) return null;

  const G = getGlass(t);
  const evalObj = candidate.evaluation || {};

  // Normalize AI Likelihood Score (0-100%)
  let rawScore = candidate.aiGeneratedLikelihoodScore ?? evalObj.aiGeneratedLikelihoodScore ?? 0;
  if (typeof rawScore === "number" && rawScore > 0 && rawScore <= 1) {
    rawScore = Math.round(rawScore * 100);
  } else {
    rawScore = Math.round(rawScore || 0);
  }
  const likelihoodScore = Math.min(100, Math.max(0, rawScore));

  // Risk Badge logic: Clean <20% green, Low Risk <45% yellow, Medium Risk <70% orange, High Risk >=70% red
  let riskLabel = "Clean";
  let badgeColor = "#22c55e";
  let badgeBg = "rgba(34, 197, 94, 0.15)";
  let badgeBorder = "rgba(34, 197, 94, 0.3)";

  if (likelihoodScore < 20) {
    riskLabel = "Clean";
    badgeColor = "#22c55e";
    badgeBg = "rgba(34, 197, 94, 0.15)";
    badgeBorder = "rgba(34, 197, 94, 0.3)";
  } else if (likelihoodScore < 45) {
    riskLabel = "Low Risk";
    badgeColor = "#eab308";
    badgeBg = "rgba(234, 179, 8, 0.15)";
    badgeBorder = "rgba(234, 179, 8, 0.3)";
  } else if (likelihoodScore < 70) {
    riskLabel = "Medium Risk";
    badgeColor = "#f97316";
    badgeBg = "rgba(249, 115, 22, 0.15)";
    badgeBorder = "rgba(249, 115, 22, 0.3)";
  } else {
    riskLabel = "High Risk";
    badgeColor = "#ef4444";
    badgeBg = "rgba(239, 68, 68, 0.15)";
    badgeBorder = "rgba(239, 68, 68, 0.3)";
  }

  // Telemetry Audit Trail Metadata
  const meta = candidate.antiCheatMetadata || evalObj.antiCheatMetadata || {};
  const blurCount = meta.blurCount ?? meta.blur_count ?? meta.tabSwitches ?? 0;

  let focusDurationSec = meta.focusDuration ?? meta.focus_duration_seconds ?? meta.focus_duration ?? 0;
  if (focusDurationSec > 0 && focusDurationSec < 10 && meta.focusDurationMins) {
    focusDurationSec = meta.focusDurationMins * 60;
  }
  const formattedDuration =
    focusDurationSec === 0
      ? "0s"
      : focusDurationSec < 60
      ? `${Math.round(focusDurationSec)}s`
      : `${Math.floor(focusDurationSec / 60)}m ${Math.round(focusDurationSec % 60)}s`;

  const pasteCount = meta.pasteCount ?? meta.paste_count ?? 0;
  const totalPastedChars = meta.totalPastedChars ?? meta.total_pasted_chars ?? 0;

  let pasteRatioRaw = meta.pasteRatio ?? meta.paste_ratio ?? 0;
  if (pasteRatioRaw > 0 && pasteRatioRaw <= 1) {
    pasteRatioRaw = Math.round(pasteRatioRaw * 100);
  } else {
    pasteRatioRaw = Math.round(pasteRatioRaw || 0);
  }
  const pasteRatio = Math.min(100, Math.max(0, pasteRatioRaw));

  // Anti-Cheat Flags Breakdown
  const rawFlags: any[] = candidate.antiCheatFlags || evalObj.antiCheatFlags || [];
  const flags: AntiCheatFlag[] = rawFlags.map((f: any) => {
    if (typeof f === "string") {
      return { flag: f, severity: "medium", description: f };
    }
    return {
      flag: f.flag || f.name || f.rule || "Suspicious Activity",
      severity: (f.severity as "low" | "medium" | "high") || "medium",
      description: f.description || f.message || f.flag || "Flagged during telemetry check."
    };
  });

  return (
    <div className="rounded-2xl p-5 md:p-6 space-y-5" style={G.card}>
      {/* Header & Risk Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: hexToRgba(t.txtPrimary, 0.08) }}>
        <div className="flex items-center gap-2">
          {likelihoodScore >= 70 ? (
            <ShieldAlert size={18} style={{ color: badgeColor }} />
          ) : likelihoodScore >= 20 ? (
            <Shield size={18} style={{ color: badgeColor }} />
          ) : (
            <ShieldCheck size={18} style={{ color: badgeColor }} />
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.txtMuted }}>
              Anti-Cheat & Session Integrity Inspection
            </div>
            <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
              AI Text Generation & Behavioral Risk Audit
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium" style={{ color: t.txtSecondary }}>AI Likelihood Score:</span>
          <span className="text-xl font-extrabold" style={{ fontFamily: "'Fraunces', serif", color: badgeColor }}>
            {likelihoodScore}%
          </span>
          <span
            className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-sm"
            style={{ color: badgeColor, backgroundColor: badgeBg, borderColor: badgeBorder }}
          >
            {riskLabel}
          </span>
        </div>
      </div>

      {/* Telemetry Audit Trail Grid */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: t.txtMuted }}>
          Candidate Telemetry Audit Trail
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Tab Switches / Blurs */}
          <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}` }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-1" style={{ color: t.txtMuted }}>
              <Eye size={13} /> Tab Switches / Blurs
            </div>
            <div className="text-xl font-extrabold" style={{ color: blurCount > 3 ? t.numNeg : t.txtPrimary }}>
              {blurCount}
            </div>
          </div>

          {/* Focus Duration */}
          <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}` }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-1" style={{ color: t.txtMuted }}>
              <Clock size={13} /> Focus Duration
            </div>
            <div className="text-xl font-extrabold" style={{ color: t.txtPrimary }}>
              {formattedDuration}
            </div>
          </div>

          {/* Paste Count */}
          <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}` }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-1" style={{ color: t.txtMuted }}>
              <Copy size={13} /> Paste Count
            </div>
            <div className="text-xl font-extrabold" style={{ color: pasteCount > 2 ? t.numNeg : t.txtPrimary }}>
              {pasteCount}
            </div>
          </div>

          {/* Pasted Characters */}
          <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}` }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-1" style={{ color: t.txtMuted }}>
              <FileText size={13} /> Pasted Characters
            </div>
            <div className="text-xl font-extrabold" style={{ color: totalPastedChars > 200 ? t.numNeg : t.txtPrimary }}>
              {totalPastedChars}
            </div>
          </div>

          {/* Paste Ratio */}
          <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}` }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-1" style={{ color: t.txtMuted }}>
              <Percent size={13} /> Paste Ratio
            </div>
            <div className="text-xl font-extrabold" style={{ color: pasteRatio > 50 ? t.numNeg : t.txtPrimary }}>
              {pasteRatio}%
            </div>
          </div>
        </div>
      </div>

      {/* Anti-Cheat Flags Breakdown */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: t.txtMuted }}>
          Anti-Cheat Risk Flags ({flags.length})
        </div>
        {flags.length > 0 ? (
          <div className="space-y-2">
            {flags.map((flag, idx) => {
              const sev = (flag.severity || "medium").toLowerCase();
              const sevColor = sev === "high" ? "#ef4444" : sev === "low" ? "#eab308" : "#f97316";
              const sevBg = sev === "high" ? "rgba(239, 68, 68, 0.12)" : sev === "low" ? "rgba(234, 179, 8, 0.12)" : "rgba(249, 115, 22, 0.12)";
              const sevBorder = sev === "high" ? "rgba(239, 68, 68, 0.3)" : sev === "low" ? "rgba(234, 179, 8, 0.3)" : "rgba(249, 115, 22, 0.3)";

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border flex items-start gap-3 transition-all"
                  style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.6), borderColor: hexToRgba(t.txtPrimary, 0.08) }}
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: sevColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold" style={{ color: t.txtPrimary }}>{flag.flag}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0" style={{ color: sevColor, backgroundColor: sevBg, borderColor: sevBorder }}>
                        {sev} severity
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>
                      {flag.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl text-xs flex items-center gap-2" style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.25)", color: "#22c55e" }}>
            <ShieldCheck size={16} /> Zero suspicious anti-cheat flags triggered during session.
          </div>
        )}
      </div>
    </div>
  );
}
