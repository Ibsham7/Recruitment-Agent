import { Theme } from "../../../lib/types";
import { getGlass, hexToRgba } from "../../../lib/theme";
import { Lock } from "lucide-react";

export interface AccessRestrictedViewProps {
  theme: Theme;
  accessError?: string;
}

export function AccessRestrictedView({
  theme: t,
  accessError,
}: AccessRestrictedViewProps) {
  const G = getGlass(t);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ background: t.bgPage }}>
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl text-center" style={G.card}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: hexToRgba(t.numNeg, 0.15),
            border: `1px solid ${t.numNeg}`,
          }}
        >
          <Lock size={24} style={{ color: t.numNeg }} />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: t.txtPrimary }}>
          Access Restricted
        </h1>
        <p className="text-xs leading-relaxed mb-6" style={{ color: t.txtMuted }}>
          {accessError ||
            "You must have a valid personalized invitation link to access this candidate assessment."}
        </p>
        <div
          className="p-4 rounded-xl text-[11px] text-left"
          style={{
            background: hexToRgba(t.bgCard, 0.3),
            border: `1px solid ${hexToRgba(t.bgCard, 0.5)}`,
            color: t.txtGhost,
          }}
        >
          <strong>Need help?</strong> If you applied for this position, please check your email
          inbox for your unique invitation link or contact the recruiter.
        </div>
      </div>
    </div>
  );
}
