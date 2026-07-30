import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { MailCheck, ShieldAlert, Loader2 } from "lucide-react";

export interface EmailVerificationCardProps {
  theme: Theme;
  accessMeta?: { maskedEmail?: string; [key: string]: any } | null;
  emailInput: string;
  setEmailInput: (val: string) => void;
  startingAssessment: boolean;
  error?: string;
  onStartAssessment: () => void;
}

export function EmailVerificationCard({
  theme: t,
  accessMeta,
  emailInput,
  setEmailInput,
  startingAssessment,
  error,
  onStartAssessment,
}: EmailVerificationCardProps) {
  return (
    <div
      className="space-y-6 text-left p-6 rounded-2xl"
      style={{
        background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6),
        border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
      }}
    >
      <div>
        <h2
          className="text-base font-semibold mb-1 flex items-center gap-2"
          style={{ color: t.txtPrimary }}
        >
          <MailCheck size={18} style={{ color: t.accentPrimary }} /> Verify Email Ownership
        </h2>
        <p className="text-xs" style={{ color: t.txtMuted }}>
          Please enter the email address where you received your invitation link (
          {accessMeta?.maskedEmail || "on file"}) to unlock your assessment.
        </p>
      </div>

      <div>
        <input
          type="email"
          placeholder="Enter your email address (e.g. john@example.com)..."
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !startingAssessment && emailInput.trim()) {
              onStartAssessment();
            }
          }}
          className="w-full rounded-xl p-3.5 text-sm focus:outline-none"
          style={{
            color: t.txtBody,
            background: hexToRgba(t.bgSurface, t.isDark ? 0.1 : 0.8),
            border: `1px solid ${hexToRgba(t.accentPrimary, 0.4)}`,
          }}
        />
      </div>

      {/* AI Policy Disclosure */}
      <div
        className="space-y-2 pt-2"
        style={{ borderTop: `1px solid ${hexToRgba(t.bgCard, 0.4)}` }}
      >
        <h3 className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
          AI Evaluation Disclosure & Privacy Policy
        </h3>
        <ul className="text-xs list-disc list-inside space-y-1" style={{ color: t.txtMuted }}>
          <li>This assessment uses automated AI models to generate tailored, job-anchored questions.</li>
          <li>Your written responses will be evaluated against objective domain technical rubrics.</li>
          <li>No video recording, facial analysis, or biometric tracking is conducted.</li>
          <li>Questions are generated dynamically on-demand only when you click start below.</li>
        </ul>
      </div>

      {error && (
        <div
          className="p-3 rounded-xl text-xs flex items-center gap-2"
          style={{
            background: hexToRgba(t.numNeg, 0.15),
            border: `1px solid ${t.numNeg}`,
            color: t.txtPrimary,
          }}
        >
          <ShieldAlert size={14} style={{ color: t.numNeg }} />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={onStartAssessment}
        disabled={startingAssessment || !emailInput.trim()}
        className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        style={{
          background: t.accentPrimary,
          color: t.accentText,
          boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}`,
        }}
      >
        {startingAssessment ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating Personalized Questions...
          </>
        ) : (
          "I Understand & Agree — Start Assessment"
        )}
      </button>
    </div>
  );
}
