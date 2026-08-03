import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Theme } from "../../lib/types";
import { getGlass } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";
import {
  InterviewHeader,
  EmailVerificationCard,
  QuestionRenderer,
  LiveAnswerCard,
  AssessmentTimer,
  AccessRestrictedView,
  AssessmentCompletedView,
} from "./components";

export default function InterviewPage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const G = getGlass(t);

  // URL Security token
  const token = new URLSearchParams(window.location.search).get("token") || "";

  // Access validation state
  const [accessValid, setAccessValid] = useState<boolean | null>(null);
  const [accessMeta, setAccessMeta] = useState<any>(null);
  const [accessError, setAccessError] = useState<string>("");

  // Candidate assessment state
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startingAssessment, setStartingAssessment] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);

  // Form inputs
  const [emailInput, setEmailInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Safely parse questions list and transcript list from candidate evaluation
  const rawQuestions = candidate?.evaluation?.interviewQuestions;
  const questionsList: any[] = Array.isArray(rawQuestions)
    ? rawQuestions
    : typeof rawQuestions === "string"
    ? (() => { try { return JSON.parse(rawQuestions); } catch { return []; } })()
    : [];

  const rawTranscript = candidate?.evaluation?.interviewTranscript;
  const transcriptList: any[] = Array.isArray(rawTranscript)
    ? rawTranscript
    : typeof rawTranscript === "string"
    ? (() => { try { return JSON.parse(rawTranscript); } catch { return []; } })()
    : [];

  // Sync local question index with transcript candidate responses for seamless re-entry / page refresh
  useEffect(() => {
    if (candidate) {
      const candidateTurns = transcriptList.filter(
        (t: any) => typeof t === "object" && t?.role === "candidate"
      ).length;
      if (candidate.answeredCount !== undefined) {
        setCurrentQuestionIdx(candidate.answeredCount);
      } else if (candidateTurns > 0) {
        setCurrentQuestionIdx(candidateTurns);
      }
    }
  }, [candidate?.id, candidate?.answeredCount]);

  // Step 1: Verify token access on load
  useEffect(() => {
    async function verifyAccess() {
      if (!id || !token) {
        setAccessValid(false);
        setAccessError("No invitation token provided. Direct access to this interview page is restricted.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}/interview-access?token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Invalid or expired interview token");
        }
        const data = await res.json();
        setAccessMeta(data);
        setAccessValid(true);

        // If candidate already in progress or completed, load full candidate details directly
        if (
          data.status === "interviewing" ||
          data.status === "interview_completed" ||
          data.status === "review" ||
          data.status === "complete"
        ) {
          const candRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}`);
          if (candRes.ok) {
            const candData = await candRes.json();
            setCandidate(candData);
          }
        }
      } catch (err: any) {
        setAccessValid(false);
        setAccessError(err.message || "Failed to verify access permissions.");
      } finally {
        setLoading(false);
      }
    }

    verifyAccess();

    // Supabase realtime channel for updates (safely preserves evaluation & current index)
    if (id) {
      const channel = supabase
        .channel(`candidate_${id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "Candidate", filter: `id=eq.${id}` }, (payload) => {
          setCandidate((prev: any) => ({ ...prev, ...payload.new }));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id, token]);

  // Step 2: Handle Start Assessment (Email verification + Consent + On-demand question generation)
  const handleStartAssessment = async () => {
    if (!emailInput.trim()) {
      setError("Please enter your email address to verify your identity.");
      return;
    }

    setStartingAssessment(true);
    setError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}/start-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: emailInput.trim(),
          consent: true,
          termsVersionAgreed: "v1.0",
          privacyPolicyVersionAgreed: "v1.0",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to start assessment");
      }

      const candData = await res.json();
      setCandidate(candData);
      setCurrentQuestionIdx(0);
    } catch (err: any) {
      setError(err.message || "Email verification failed.");
    } finally {
      setStartingAssessment(false);
    }
  };

  // Step 3: Handle Submit Answer with network error protection and fast submission guard
  const handleSubmitAnswer = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError("");

    const submittedAnswer = answer;
    setAnswer(""); // Immediately clear text field for smooth responsiveness

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: submittedAnswer }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit answer. Please try again.");
      }

      const candData = await res.json();
      if (candData && candData.id) {
        setCandidate(candData);
      }
      setCurrentQuestionIdx((prev) => prev + 1);
    } catch (err: any) {
      // Preserve candidate's typed answer on network or server error so work is not lost
      setAnswer(submittedAnswer);
      setError(err.message || "Something went wrong while submitting your answer. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgPage }}>
        <div className="text-center p-8 rounded-2xl" style={G.card}>
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: t.accentPrimary }} />
          <div className="text-sm font-semibold" style={{ color: t.txtPrimary }}>Verifying Access Token...</div>
          <p className="text-xs mt-1" style={{ color: t.txtMuted }}>Connecting to secure evaluation portal</p>
        </div>
      </div>
    );
  }

  // Security Access Error View
  if (accessValid === false) {
    return <AccessRestrictedView theme={t} accessError={accessError} />;
  }

  const campaignTitle = accessMeta?.campaignTitle || candidate?.campaign?.title || "Candidate Evaluation";
  const candidateName = accessMeta?.candidateName || candidate?.name || "Candidate";
  const isComplete =
    candidate?.status === "interview_completed" ||
    candidate?.status === "review" ||
    candidate?.status === "complete" ||
    candidate?.status === "finalized";

  const isInterviewing = candidate?.status === "interviewing";
  const currentStep = isComplete ? 3 : candidate ? 2 : 1;

  // Active question extraction
  const currentQObj = questionsList[currentQuestionIdx] || (questionsList.length > 0 ? questionsList[questionsList.length - 1] : null);
  const currentQText =
    typeof currentQObj === "object" && currentQObj?.question
      ? currentQObj.question
      : typeof currentQObj === "string"
      ? currentQObj
      : candidate?.currentQuestion || "Please provide your detailed answer to the technical assessment question.";

  const currentQTopic = typeof currentQObj === "object" ? currentQObj?.topic : candidate?.currentTopic || candidate?.topic;
  const currentQDiff = typeof currentQObj === "object" ? currentQObj?.difficulty : candidate?.difficulty;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgPage }}>
      <div className="w-full max-w-2xl rounded-3xl p-8 shadow-2xl" style={G.card}>
        
        {/* Top Branding Header with Step Indicator */}
        <InterviewHeader
          theme={t}
          campaignTitle={campaignTitle}
          candidateName={candidateName}
          currentStep={currentStep}
        />

        {/* STEP 1: Email Verification & Consent (Before Candidate Starts) */}
        {!candidate && !isComplete && (
          <EmailVerificationCard
            theme={t}
            accessMeta={accessMeta}
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            startingAssessment={startingAssessment}
            error={error}
            onStartAssessment={handleStartAssessment}
          />
        )}

        {/* STEP 2: Completed State */}
        {isComplete && (
          <AssessmentCompletedView
            theme={t}
            candidateName={candidateName}
          />
        )}

        {/* STEP 3: Active Question & Response Interface */}
        {candidate && isInterviewing && !isComplete && (
          <div className="space-y-6">
            <div className="flex justify-end mb-2">
              <AssessmentTimer theme={t} />
            </div>

            <QuestionRenderer
              theme={t}
              questionText={currentQText}
              topic={currentQTopic}
              difficulty={currentQDiff}
              questionIndex={currentQuestionIdx + 1}
              totalQuestions={questionsList.length || 3}
            />

            <LiveAnswerCard
              theme={t}
              answer={answer}
              setAnswer={setAnswer}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmitAnswer}
            />
          </div>
        )}

      </div>
    </div>
  );
}


