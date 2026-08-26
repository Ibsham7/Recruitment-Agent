import { useState } from "react";
import { useNavigate } from "react-router";
import { Pause, XCircle, CheckCircle, Loader2 } from "lucide-react";
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
  const navigate = useNavigate();
  const [submittingAction, setSubmittingAction] = useState<"hold" | "reject" | "approve" | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleDecision = async (decision: "hold" | "reject" | "approve") => {
    if (submittingAction) return;
    setSubmittingAction(decision);
    setFeedbackMessage(null);

    try {
      const res = await apiFetch(`/api/candidates/${candidate.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit review decision");
      }

      const data = await res.json();
      const isPreInterview = ["pending", "screening", "screening_hold"].includes(candidate.status);

      let nextStatus: string = "screening_hold";
      if (decision === "approve") {
        nextStatus = isPreInterview ? "shortlisted" : "finalized";
      } else if (decision === "reject") {
        nextStatus = "rejected";
      } else {
        nextStatus = "screening_hold";
      }

      const updatedCandidate: Candidate = data.candidate
        ? {
            ...data.candidate,
            stage: isPreInterview && decision === "hold" ? "screening" : undefined,
          }
        : {
            ...candidate,
            recommendation: decision,
            status: nextStatus as any,
          };

      onDecisionUpdate(updatedCandidate);

      let msg = "";
      if (decision === "hold") {
        msg = "✓ Candidate placed on Screening Hold. Redirecting to pipeline...";
      } else if (decision === "reject") {
        msg = "✓ Candidate Rejected. Redirecting to pipeline...";
      } else {
        msg = isPreInterview
          ? "✓ Candidate Approved & Shortlisted for Interview. Redirecting to pipeline..."
          : "✓ Candidate Approved & Finalized. Redirecting to pipeline...";
      }

      setFeedbackMessage({ text: msg, type: "success" });

      const campaignId = candidate.campaignId || campaign?.id;
      setTimeout(() => {
        if (campaignId) {
          navigate(`/pipeline/${campaignId}`);
        } else {
          navigate("/pipeline");
        }
      }, 1100);
    } catch (e: any) {
      setFeedbackMessage({
        text: `Error: ${e.message || "Failed to submit decision"}`,
        type: "error"
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div
      className="px-8 py-4 flex items-center justify-between flex-shrink-0 relative"
      style={{
        background: hexToRgba(t.bgSurface, t.isDark ? 0.88 : 0.90),
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50)}`
      }}
    >
      <div className="flex items-center gap-4">
        <div className="text-xs" style={{ color: t.txtSecondary }}>
          Final decision for <span className="font-semibold" style={{ color: t.txtPrimary }}>{getCandidateDisplayName(candidate)}</span>
          {campaign && <span style={{ color: t.txtMuted }}> · {campaign.title}</span>}
        </div>

        {feedbackMessage && (
          <div
            className="px-3 py-1 rounded-lg text-xs font-semibold animate-fade-in flex items-center gap-1.5"
            style={{
              background: feedbackMessage.type === "error" ? hexToRgba(t.numNeg, 0.15) : hexToRgba(t.numPos, 0.15),
              color: feedbackMessage.type === "error" ? t.numNeg : t.numPos,
              border: `1px solid ${hexToRgba(feedbackMessage.type === "error" ? t.numNeg : t.numPos, 0.3)}`
            }}
          >
            {feedbackMessage.text}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={() => handleDecision("hold")}
          disabled={submittingAction !== null}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          style={{ ...G.card, color: t.txtSecondary }}
        >
          {submittingAction === "hold" ? <Loader2 size={11} className="animate-spin" /> : <Pause size={11} />}
          Hold
        </button>
        <button
          onClick={() => handleDecision("reject")}
          disabled={submittingAction !== null}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: hexToRgba(t.numNeg, 0.12), border: `1px solid ${hexToRgba(t.numNeg, 0.28)}`, color: t.numNeg }}
          onMouseEnter={(e) => {
            if (!submittingAction) (e.currentTarget as HTMLElement).style.background = hexToRgba(t.numNeg, 0.22);
          }}
          onMouseLeave={(e) => {
            if (!submittingAction) (e.currentTarget as HTMLElement).style.background = hexToRgba(t.numNeg, 0.12);
          }}
        >
          {submittingAction === "reject" ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
          Reject Candidate
        </button>
        <button
          onClick={() => handleDecision("approve")}
          disabled={submittingAction !== null}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})`,
            color: t.accentText,
            boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.40)}`
          }}
          onMouseEnter={(e) => {
            if (!submittingAction) (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${hexToRgba(t.accentPrimary, 0.55)}`;
          }}
          onMouseLeave={(e) => {
            if (!submittingAction) (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${hexToRgba(t.accentPrimary, 0.40)}`;
          }}
        >
          {submittingAction === "approve" ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
          Approve Candidate
        </button>
      </div>
    </div>
  );
}
