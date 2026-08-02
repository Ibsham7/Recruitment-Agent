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
  DecisionBar,
} from "./components";

export default function CandidatePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();

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
    (candidate.transcript && candidate.transcript.length > 0) || 
    (candidate.scores && (candidate.scores.technical > 0 || candidate.scores.communication > 0 || candidate.scores.culturalFit > 0))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CandidateHeader candidate={candidate} theme={t} />

      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-1 overflow-y-auto p-8 space-y-5"
          style={{ borderRight: hasInterviewData ? `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.45)}` : undefined }}
        >
          {hasInterviewData && <ScorePanel candidate={candidate} theme={t} />}
          <ResumeCard cvUrl={candidate.cvUrl} theme={t} />
          <AISummaryCard summary={candidate.summary || "No summary available."} theme={t} />
          <ChainOfThoughtCard chainOfThought={candidate.chainOfThought || "No reasoning provided."} theme={t} />
          <ScoreBreakdownPanel candidate={candidate} theme={t} />
          <StrengthsConcernsPanel strengths={candidate.strengths || []} concerns={candidate.concerns || []} theme={t} />
        </div>

        {hasInterviewData && (
          <TranscriptPanel transcript={candidate.transcript || []} candidateName={candidate.name} theme={t} />
        )}
      </div>

      <DecisionBar candidate={candidate} campaign={campaign} theme={t} onDecisionUpdate={handleDecisionUpdate} />
    </div>
  );
}


