import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { Moon, Sun, CheckCircle2, Circle } from "lucide-react";

export interface InterviewHeaderProps {
  theme: Theme;
  campaignTitle?: string;
  candidateName?: string;
  currentStep?: number;
  totalSteps?: number;
  onToggleTheme?: () => void;
}

export function InterviewHeader({
  theme: t,
  campaignTitle = "Candidate Evaluation",
  candidateName = "Candidate",
  currentStep,
  onToggleTheme,
}: InterviewHeaderProps) {
  const steps = [
    { label: "Verification", stepNum: 1 },
    { label: "Assessment", stepNum: 2 },
    { label: "Completion", stepNum: 3 },
  ];

  return (
    <div className="text-center mb-8">
      {/* Optional Theme Switcher & Step Status Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        {currentStep ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: t.txtMuted }}>
            {steps.map((s) => {
              const isDone = s.stepNum < currentStep;
              const isCurrent = s.stepNum === currentStep;
              return (
                <div
                  key={s.stepNum}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    background: isCurrent
                      ? hexToRgba(t.accentPrimary, 0.15)
                      : isDone
                      ? hexToRgba(t.numPos, 0.12)
                      : hexToRgba(t.bgCard, 0.2),
                    color: isCurrent
                      ? t.accentPrimary
                      : isDone
                      ? t.numPos
                      : t.txtMuted,
                    border: `1px solid ${
                      isCurrent
                        ? hexToRgba(t.accentPrimary, 0.3)
                        : isDone
                        ? hexToRgba(t.numPos, 0.3)
                        : hexToRgba(t.bgCard, 0.3)
                    }`,
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={12} style={{ color: t.numPos }} />
                  ) : (
                    <Circle size={10} className={isCurrent ? "fill-current" : ""} />
                  )}
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div />
        )}

        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl transition-all hover:opacity-80"
            title="Toggle theme"
            style={{
              background: hexToRgba(t.bgSurface, t.isDark ? 0.3 : 0.8),
              border: `1px solid ${hexToRgba(t.bgCard, 0.3)}`,
              color: t.txtPrimary,
            }}
          >
            {t.isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        )}
      </div>

      {/* Top Branding Header */}
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-3"
        style={{
          background: hexToRgba(t.accentPrimary, 0.12),
          color: t.accentPrimary,
          border: `1px solid ${hexToRgba(t.accentPrimary, 0.25)}`,
        }}
      >
        {campaignTitle}
      </div>
      <h1
        className="text-3xl font-semibold mb-2"
        style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}
      >
        Technical Candidate Assessment
      </h1>
      <p className="text-sm" style={{ color: t.txtSecondary }}>
        Welcome, {candidateName}
      </p>
    </div>
  );
}
