import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Theme } from "../../lib/types";
import { getGlass, hexToRgba } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { Send, Loader2, CheckCircle } from "lucide-react";

export default function InterviewPage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const G = getGlass(t);
  
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCandidate() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("Candidate")
          .select("*, campaign:Campaign(title)")
          .eq("id", id)
          .single();
          
        if (error) throw error;
        setCandidate(data);
      } catch (err) {
        console.error("Error fetching candidate:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCandidate();
    
    const channel = supabase
      .channel(`candidate_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Candidate', filter: `id=eq.${id}` }, (payload) => {
        setCandidate(payload.new);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    }
  }, [id]);

  const handleSubmit = async () => {
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
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-12 text-center" style={{ color: t.txtMuted }}>Loading interview...</div>;
  if (!candidate) return <div className="p-12 text-center" style={{ color: t.txtMuted }}>Candidate not found.</div>;

  const isInterviewing = candidate.status === "interviewing";
  const isComplete = candidate.status === "review" || candidate.status === "complete";

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgApp }}>
      <div className="w-full max-w-2xl rounded-3xl p-8 shadow-2xl" style={G.card}>
        <div className="text-center mb-8">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: t.accentPrimary }}>{candidate.campaign?.title}</div>
          <h1 className="text-3xl font-semibold mb-2" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>Candidate Interview</h1>
          <p className="text-sm" style={{ color: t.txtSecondary }}>Welcome, {candidate.name}</p>
        </div>
        
        {isComplete ? (
          <div className="text-center py-12">
            <CheckCircle size={48} className="mx-auto mb-4" style={{ color: t.numPos }} />
            <h2 className="text-xl font-medium mb-2" style={{ color: t.txtPrimary }}>Interview Complete</h2>
            <p className="text-sm" style={{ color: t.txtMuted }}>Thank you for your time. The recruiting team will be in touch shortly.</p>
          </div>
        ) : !isInterviewing ? (
          <div className="text-center py-12">
            <Loader2 size={32} className="animate-spin mx-auto mb-4" style={{ color: t.txtGhost }} />
            <p className="text-sm" style={{ color: t.txtMuted }}>Please wait while we prepare your next question...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6), border: `1px solid ${hexToRgba(t.bgCard, 0.3)}` }}>
               <h3 className="text-sm font-semibold mb-2" style={{ color: t.txtPrimary }}>Current Question</h3>
               <p className="text-sm leading-relaxed" style={{ color: t.txtBody }}>
                  {candidate.currentQuestion || "Please provide your detailed answer to the technical assessment question."}
               </p>
            </div>
            
            <div>
              <textarea 
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                placeholder="Type your answer here..."
                className="w-full rounded-2xl p-4 text-sm focus:outline-none resize-none"
                style={{ color: t.txtBody, background: hexToRgba(t.bgSurface, t.isDark ? 0.1 : 0.8), border: `1px solid ${hexToRgba(t.accentPrimary, 0.4)}` }}
              />
            </div>
            
            {error && <div className="text-xs text-red-500">{error}</div>}
            
            <button 
              onClick={handleSubmit} 
              disabled={submitting || !answer.trim()}
              className="w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})`, color: t.accentText, boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Submit Answer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
