import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Theme } from "../../lib/types";
import { getGlass, hexToRgba } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { Send, Loader2, CheckCircle, ShieldAlert, Lock, Sparkles, MailCheck } from "lucide-react";

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

  // Form inputs
  const [emailInput, setEmailInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}/interview-access?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Invalid or expired interview token");
        }
        const data = await res.json();
        setAccessMeta(data);
        setAccessValid(true);

        // If candidate already in progress or completed, load full candidate details directly
        if (data.status === "interviewing" || data.status === "review" || data.status === "complete") {
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

    // Supabase realtime channel for updates
    if (id) {
      const channel = supabase
        .channel(`candidate_${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Candidate', filter: `id=eq.${id}` }, (payload) => {
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
          consent: true
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to start assessment");
      }

      const candData = await res.json();
      setCandidate(candData);
    } catch (err: any) {
      setError(err.message || "Email verification failed.");
    } finally {
      setStartingAssessment(false);
    }
  };

  // Step 3: Handle Submit Answer
  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer })
      });

      if (!res.ok) throw new Error("Failed to submit answer");

      setAnswer("");
      // Refresh candidate data to pick up next question or completed status
      const candRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${id}`);
      if (candRes.ok) {
        const candData = await candRes.json();
        setCandidate(candData);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while submitting your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgApp }}>
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
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgApp }}>
        <div className="w-full max-w-md rounded-3xl p-8 shadow-2xl text-center" style={G.card}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: hexToRgba(t.numNeg, 0.15), border: `1px solid ${t.numNeg}` }}>
            <Lock size={24} style={{ color: t.numNeg }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: t.txtPrimary }}>Access Restricted</h1>
          <p className="text-xs leading-relaxed mb-6" style={{ color: t.txtMuted }}>
            {accessError || "You must have a valid personalized invitation link to access this candidate assessment."}
          </p>
          <div className="p-4 rounded-xl text-[11px] text-left" style={{ background: hexToRgba(t.bgCard, 0.3), border: `1px solid ${hexToRgba(t.bgCard, 0.5)}`, color: t.txtGhost }}>
            <strong>Need help?</strong> If you applied for this position, please check your email inbox for your unique invitation link or contact the recruiter.
          </div>
        </div>
      </div>
    );
  }

  const campaignTitle = accessMeta?.campaignTitle || candidate?.campaign?.title || "Candidate Evaluation";
  const candidateName = accessMeta?.candidateName || candidate?.name || "Candidate";
  const isComplete = candidate?.status === "review" || candidate?.status === "complete" || candidate?.status === "finalized";
  const isInterviewing = candidate?.status === "interviewing";

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgApp }}>
      <div className="w-full max-w-2xl rounded-3xl p-8 shadow-2xl" style={G.card}>
        
        {/* Top Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-3" style={{ background: hexToRgba(t.accentPrimary, 0.12), color: t.accentPrimary, border: `1px solid ${hexToRgba(t.accentPrimary, 0.25)}` }}>
            <Sparkles size={12} /> {campaignTitle}
          </div>
          <h1 className="text-3xl font-semibold mb-2" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>
            Technical Candidate Assessment
          </h1>
          <p className="text-sm" style={{ color: t.txtSecondary }}>Welcome, {candidateName}</p>
        </div>

        {/* STEP 1: Email Verification & Consent (Before Candidate Starts) */}
        {!candidate && !isComplete && (
          <div className="space-y-6 text-left p-6 rounded-2xl" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6), border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}` }}>
            <div>
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2" style={{ color: t.txtPrimary }}>
                <MailCheck size={18} style={{ color: t.accentPrimary }} /> Verify Email Ownership
              </h2>
              <p className="text-xs" style={{ color: t.txtMuted }}>
                Please enter the email address where you received your invitation link ({accessMeta?.maskedEmail || "on file"}) to unlock your assessment.
              </p>
            </div>

            <div>
              <input
                type="email"
                placeholder="Enter your email address (e.g. john@example.com)..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-xl p-3.5 text-sm focus:outline-none"
                style={{
                  color: t.txtBody,
                  background: hexToRgba(t.bgSurface, t.isDark ? 0.1 : 0.8),
                  border: `1px solid ${hexToRgba(t.accentPrimary, 0.4)}`
                }}
              />
            </div>

            {/* AI Policy Disclosure */}
            <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${hexToRgba(t.bgCard, 0.4)}` }}>
              <h3 className="text-xs font-semibold" style={{ color: t.txtPrimary }}>AI Evaluation Disclosure & Privacy Policy</h3>
              <ul className="text-xs list-disc list-inside space-y-1" style={{ color: t.txtMuted }}>
                <li>This assessment uses automated AI models to generate tailored, job-anchored questions.</li>
                <li>Your written responses will be evaluated against objective domain technical rubrics.</li>
                <li>No video recording, facial analysis, or biometric tracking is conducted.</li>
                <li>Questions are generated dynamically on-demand only when you click start below.</li>
              </ul>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: hexToRgba(t.numNeg, 0.15), border: `1px solid ${t.numNeg}`, color: t.txtPrimary }}>
                <ShieldAlert size={14} style={{ color: t.numNeg }} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleStartAssessment}
              disabled={startingAssessment || !emailInput.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: t.accentPrimary, color: t.accentText, boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` }}
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
        )}

        {/* STEP 2: Completed State */}
        {isComplete && (
          <div className="text-center py-12">
            <CheckCircle size={56} className="mx-auto mb-4" style={{ color: t.numPos }} />
            <h2 className="text-2xl font-bold mb-2" style={{ color: t.txtPrimary }}>Assessment Completed!</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: t.txtMuted }}>
              Thank you for taking the time to complete your technical evaluation. Your answers have been submitted securely to the recruiting team.
            </p>
          </div>
        )}

        {/* STEP 3: Active Question & Response Interface */}
        {candidate && isInterviewing && !isComplete && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6), border: `1px solid ${hexToRgba(t.bgCard, 0.3)}` }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.accentPrimary }}>Current Question</h3>
              </div>
              <p className="text-sm leading-relaxed font-medium" style={{ color: t.txtBody }}>
                {candidate.currentQuestion || "Please provide your detailed answer to the technical assessment question."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: t.txtMuted }}>Your Response</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={7}
                placeholder="Type your response here... Include specific examples, methodology, and technical reasoning."
                className="w-full rounded-2xl p-4 text-sm focus:outline-none resize-none"
                style={{ color: t.txtBody, background: hexToRgba(t.bgSurface, t.isDark ? 0.1 : 0.8), border: `1px solid ${hexToRgba(t.accentPrimary, 0.4)}` }}
              />
            </div>

            {error && <div className="text-xs text-red-500">{error}</div>}

            <button
              onClick={handleSubmitAnswer}
              disabled={submitting || !answer.trim()}
              className="w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.75)})`, color: t.accentText, boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Submit Answer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
