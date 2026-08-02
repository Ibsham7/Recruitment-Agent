import { Pause, XCircle, CheckCircle } from "lucide-react";
import { Theme, Campaign, Candidate } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";
import { getCandidateDisplayName } from "../../../lib/candidate";

export interface DecisionBarProps {
  candidate: Candidate;
  campaign: Campaign | null;
  theme: Theme;
  onDecisionUpdate: (updatedCandidate: Candidate) => void;
}

export function DecisionBar({ candidate, campaign, theme: t, onDecisionUpdate }: DecisionBarProps) {
  const G = getGlass(t);

  const handleHold = async () => {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${candidate.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "hold" })
      });
      if (!res.ok) throw new Error("Failed to submit");
      const nextStatus = candidate.status === 'screening_hold' ? 'screening_hold' : 'interview_completed';
      onDecisionUpdate({ ...candidate, recommendation: "hold", status: nextStatus as any });
    } catch (e) {
      alert("Failed to submit");
    }
  };

  const handleReject = async () => {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${candidate.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "reject" })
      });
      if (!res.ok) throw new Error("Failed to submit");
      onDecisionUpdate({ ...candidate, recommendation: "reject", status: "rejected" });
    } catch (e) {
      alert("Failed to submit");
    }
  };

  const handleApprove = async () => {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${candidate.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" })
      });
      if (!res.ok) throw new Error("Failed to submit");
      const nextStatus = candidate.status === 'screening_hold' ? 'shortlisted' : 'finalized';
      onDecisionUpdate({ ...candidate, recommendation: "approve", status: nextStatus as any });
    } catch (e) {
      alert("Failed to submit");
    }
  };

  return (
    <div
      className="px-8 py-4 flex items-center justify-between flex-shrink-0"
      style={{
        background: hexToRgba(t.bgSurface, t.isDark ? 0.88 : 0.90),
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50)}`
      }}
    >
      <div className="text-xs" style={{ color: t.txtSecondary }}>
        Final decision for <span className="font-semibold" style={{ color: t.txtPrimary }}>{getCandidateDisplayName(candidate)}</span>
        {campaign && <span style={{ color: t.txtMuted }}> · {campaign.title}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <button 
          onClick={handleHold}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium"
          style={{ ...G.card, color: t.txtSecondary }}
        >
          <Pause size={11} /> Hold
        </button>
        <button 
          onClick={handleReject}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ background: hexToRgba(t.numNeg, 0.12), border: `1px solid ${hexToRgba(t.numNeg, 0.28)}`, color: t.numNeg }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hexToRgba(t.numNeg, 0.22); }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = hexToRgba(t.numNeg, 0.12); }}
        >
          <XCircle size={11} /> Reject Candidate
        </button>
        <button 
          onClick={handleApprove}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})`, color: t.accentText, boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.40)}` }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${hexToRgba(t.accentPrimary, 0.55)}`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${hexToRgba(t.accentPrimary, 0.40)}`; }}
        >
          <CheckCircle size={11} /> Approve Candidate
        </button>
      </div>
    </div>
  );
}
