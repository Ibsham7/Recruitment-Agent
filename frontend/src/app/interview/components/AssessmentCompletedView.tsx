import { Theme } from "../../../lib/types";
import { CheckCircle, Award } from "lucide-react";
import { hexToRgba } from "../../../lib/theme";

export interface AssessmentCompletedViewProps {
  theme: Theme;
  candidateName?: string;
  completedAt?: string;
}

export function AssessmentCompletedView({
  theme: t,
  candidateName,
  completedAt,
}: AssessmentCompletedViewProps) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="relative inline-block">
        <CheckCircle size={56} className="mx-auto" style={{ color: t.numPos }} />
      </div>
      <h2 className="text-2xl font-bold" style={{ color: t.txtPrimary }}>
        Assessment Completed!
      </h2>
      <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: t.txtMuted }}>
        Thank you{candidateName ? `, ${candidateName},` : ""} for taking the time to complete
        your technical evaluation. Your answers have been submitted securely to the recruiting
        team.
      </p>

      {completedAt && (
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mt-2"
          style={{
            background: hexToRgba(t.numPos, 0.1),
            color: t.numPos,
            border: `1px solid ${hexToRgba(t.numPos, 0.25)}`,
          }}
        >
          <Award size={13} /> Submitted on {completedAt}
        </div>
      )}
    </div>
  );
}
