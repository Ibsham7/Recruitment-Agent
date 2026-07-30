import { useParams } from "react-router";
import { useState, useEffect } from "react";
import { Theme, Campaign, Candidate } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import {
  CandidateHeader,
  ScorePanel,
  ResumeCard,
  AISummaryCard,
  ChainOfThoughtCard,
  StrengthsConcernsPanel,
  TranscriptPanel,
  DecisionBar,
} from "./components";

export default function CandidatePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCandidate() {
      if (!id) return;
      try {
        const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}`);
        if (!res.ok) throw new Error("Failed to fetch candidate");
        const candidateData = await res.json();

        if (candidateData) {
          const evalData = candidateData.evaluation || {};
          const mappedCand = {
            ...candidateData,
            cvUrl: candidateData.cvUrl || candidateData.resumePath || null,
            score: Number((candidateData.fitScore ?? evalData.overallScore ?? 0).toFixed(2)),
            recommendation: candidateData.decision || evalData.recommendation || 'pending',
            stage: candidateData.status,
            currentRole: candidateData.structuredProfile?.currentRole || "Candidate",
            experience: candidateData.structuredProfile?.experience || "",
            scores: {
              technical: Number((evalData.technicalScore || 0).toFixed(2)),
              communication: Number((evalData.communicationScore || 0).toFixed(2)),
              culturalFit: Number((evalData.culturalFitScore || 0).toFixed(2)),
              overall: Number((evalData.overallScore || candidateData.fitScore || 0).toFixed(2))
            },
            summary: candidateData.rejectionReason 
              ? (evalData.summary ? `Rejection Reason: ${candidateData.rejectionReason}\n\n${evalData.summary}` : candidateData.rejectionReason)
              : (evalData.summary || "No summary available."),
            strengths: evalData.strengths || [],
            concerns: evalData.concerns || [],
            chainOfThought: evalData.chainOfThought || "No reasoning provided.",
            transcript: evalData.interviewTranscript || []
          };

          setCandidate(mappedCand);
          if (candidateData.campaign) {
            setCampaign(candidateData.campaign);
          }
        }
      } catch (err) {
        console.error("Error fetching candidate:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCandidate();
  }, [id]);

  if (loading) {
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
          <StrengthsConcernsPanel strengths={candidate.strengths || []} concerns={candidate.concerns || []} theme={t} />
        </div>

        {hasInterviewData && (
          <TranscriptPanel transcript={candidate.transcript || []} candidateName={candidate.name} theme={t} />
        )}
      </div>

      <DecisionBar candidate={candidate} campaign={campaign} theme={t} onDecisionUpdate={setCandidate} />
    </div>
  );
}

