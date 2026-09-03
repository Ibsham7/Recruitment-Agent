import { useState } from "react";
import { useParams } from "react-router";
import { Theme, Candidate } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import { queryClient } from "../queryClient";
import { useCandidateDetail, getCandidateQueryKey } from "../../lib/hooks/useCandidateDetail";
import { getPipelineQueryKey } from "../../lib/hooks/usePipeline";
import { CAMPAIGNS_QUERY_KEY } from "../../lib/hooks/useCampaigns";
import {
  CandidateHeader,
  ScorePanel,
  ResumeCard,
  AISummaryCard,
  ChainOfThoughtCard,
  StrengthsConcernsPanel,
  ScoreBreakdownPanel,
  TranscriptPanel,
  AntiCheatInspectionCard,
  CostBreakdownCard,
  DecisionBar,
} from "./components";

export default function CandidatePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const [mobileTab, setMobileTab] = useState<"evaluation" | "transcript">("evaluation");

  const { candidate, campaign, isLoading } = useCandidateDetail(id);

  const handleDecisionUpdate = async (updatedCandidate: Candidate) => {
    await queryClient.invalidateQueries({ queryKey: getCandidateQueryKey(id || "") });
    if (updatedCandidate.campaignId) {
      await queryClient.invalidateQueries({ queryKey: getPipelineQueryKey(updatedCandidate.campaignId) });
    }
    await queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
  };

  if (isLoading) {
    return <div className="p-8 text-center" style={{ color: t.txtMuted }}>Loading candidate...</div>;
  }

  if (!candidate) {
    return <div className="p-8 text-center" style={{ color: t.txtMuted }}>Candidate not found.</div>;
  }

  const hasInterviewData = Boolean(
    (candidate.transcript && candidate.transcript.some((t: any) => t.role === "candidate")) || 
    (candidate.scores && (candidate.scores.technical > 0 || candidate.scores.communication > 0 || candidate.scores.culturalFit > 0)) ||
    Boolean(candidate.antiCheatMetadata && Object.keys(candidate.antiCheatMetadata).length > 0) ||
    Boolean(candidate.evaluation?.antiCheatMetadata && Object.keys(candidate.evaluation.antiCheatMetadata).length > 0)
  );

  const isStage3Exit = Boolean(
    candidate.scoreBreakdown?.formula_summary?.includes("Stage 3") ||
    (candidate.fitScore !== null && candidate.fitScore !== undefined && candidate.fitScore < 1.0 && (candidate.scoreBreakdown?.must_have_breakdown || []).length === 0) ||
    (candidate.score !== undefined && candidate.score < 1.0 && (candidate.scoreBreakdown?.must_have_breakdown || []).length === 0)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CandidateHeader candidate={candidate} theme={t} />

      {/* Mobile Tab Switcher when interview data exists */}
      {hasInterviewData && (
        <div
          className="lg:hidden flex items-center px-4 py-2 border-b gap-2 flex-shrink-0"
          style={{
            borderColor: hexToRgba(t.txtGhost, 0.15),
            background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.4),
          }}
        >
          <button
            onClick={() => setMobileTab("evaluation")}
            className="min-h-[40px] flex-1 py-1.5 px-3 text-xs font-semibold rounded-xl transition-all active:scale-95"
            style={{
              background: mobileTab === "evaluation" ? hexToRgba(t.accentPrimary, 0.22) : "transparent",
              color: mobileTab === "evaluation" ? t.accentPrimary : t.txtMuted,
              border: `1px solid ${mobileTab === "evaluation" ? hexToRgba(t.accentPrimary, 0.35) : "transparent"}`,
            }}
          >
            Candidate Evaluation
          </button>
          <button
            onClick={() => setMobileTab("transcript")}
            className="min-h-[40px] flex-1 py-1.5 px-3 text-xs font-semibold rounded-xl transition-all active:scale-95"
            style={{
              background: mobileTab === "transcript" ? hexToRgba(t.accentPrimary, 0.22) : "transparent",
              color: mobileTab === "transcript" ? t.accentPrimary : t.txtMuted,
              border: `1px solid ${mobileTab === "transcript" ? hexToRgba(t.accentPrimary, 0.35) : "transparent"}`,
            }}
          >
            Transcript ({candidate.transcript?.length || 0})
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div
          className={`${hasInterviewData && mobileTab === "transcript" ? "hidden lg:block" : "block"} flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5`}
          style={{ borderRight: hasInterviewData ? `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.45)}` : undefined }}
        >
          {hasInterviewData && <ScorePanel candidate={candidate} theme={t} />}
          {hasInterviewData && <AntiCheatInspectionCard candidate={candidate} theme={t} />}
          <CostBreakdownCard candidate={candidate} theme={t} />
          <ResumeCard cvUrl={candidate.cvUrl} theme={t} />
          <AISummaryCard summary={candidate.summary || "No summary available."} theme={t} />
          {!isStage3Exit && <ChainOfThoughtCard chainOfThought={candidate.chainOfThought || "No reasoning provided."} theme={t} />}
          {!isStage3Exit && <ScoreBreakdownPanel candidate={candidate} theme={t} />}
          {!isStage3Exit && <StrengthsConcernsPanel strengths={candidate.strengths || []} concerns={candidate.concerns || []} theme={t} />}
        </div>

        {hasInterviewData && (
          <div className={`${mobileTab === "transcript" ? "flex" : "hidden lg:flex"} w-full lg:w-80 flex-shrink-0 flex-col overflow-hidden`}>
            <TranscriptPanel transcript={candidate.transcript || []} candidateName={candidate.name} theme={t} />
          </div>
        )}
      </div>

      <DecisionBar candidate={candidate} campaign={campaign} theme={t} onDecisionUpdate={handleDecisionUpdate} />
    </div>
  );
}


