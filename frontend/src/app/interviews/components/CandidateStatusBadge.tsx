import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface CandidateStatusBadgeProps {
  status: string;
  theme: Theme;
}

export function getStatusBadgeConfig(status: string, t: Theme): { label: string; bg: string; fg: string } {
  const statusBadges: Record<string, { label: string; bg: string; fg: string }> = {
    shortlisted: { label: "Ready to Invite", bg: hexToRgba(t.accentPrimary, 0.15), fg: t.accentPrimary },
    invited: { label: "Invitation Sent", bg: hexToRgba("#eab308", 0.15), fg: "#eab308" },
    interviewing: { label: "Interview In Progress", bg: hexToRgba("#3b82f6", 0.15), fg: "#3b82f6" },
    interview_completed: { label: "Evaluation Ready", bg: hexToRgba("#a855f7", 0.15), fg: "#a855f7" },
    review: { label: "Evaluation Ready", bg: hexToRgba("#a855f7", 0.15), fg: "#a855f7" },
    screening_hold: { label: "Screening Hold", bg: hexToRgba("#eab308", 0.15), fg: "#eab308" },
    finalized: { label: "Finalized", bg: hexToRgba(t.numPos, 0.2), fg: t.numPos },
    complete: { label: "Finalized", bg: hexToRgba(t.numPos, 0.2), fg: t.numPos },
    rejected: { label: "Rejected", bg: hexToRgba(t.numNeg, 0.15), fg: t.numNeg },
  };

  return statusBadges[status] || { label: status, bg: hexToRgba(t.bgCard, 0.3), fg: t.txtMuted };
}

export function CandidateStatusBadge({ status, theme: t }: CandidateStatusBadgeProps) {
  const badge = getStatusBadgeConfig(status, t);
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold"
      style={{ background: badge.bg, color: badge.fg }}
    >
      {badge.label}
    </span>
  );
}
