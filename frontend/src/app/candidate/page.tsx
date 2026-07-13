import { useParams } from "react-router";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Zap, AlertCircle, MessageSquare, Pause } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { Theme, Campaign, Candidate } from "../../lib/types";
import { hexToRgba, getGlass, scoreColor } from "../../lib/theme";
import { supabase } from "../../lib/supabase";

export default function CandidatePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const G = getGlass(t);
  
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCandidate() {
      if (!id) return;
      try {
        const { data: candidateData, error: candidateError } = await supabase
          .from('Candidate')
          .select('*, evaluation:Evaluation(*), campaign:Campaign(*)')
          .eq('id', id)
          .single();
          
        if (candidateError) throw candidateError;
        
        if (candidateData) {
          const evalData = candidateData.evaluation || {};
          const mappedCand = {
            ...candidateData,
            score: candidateData.fitScore || evalData.overallScore || 0,
            recommendation: candidateData.decision || evalData.recommendation || 'pending',
            stage: candidateData.status,
            currentRole: candidateData.structuredProfile?.currentRole || "Candidate",
            experience: candidateData.structuredProfile?.experience || "",
            scores: {
              technical: evalData.technicalScore || 0,
              communication: evalData.communicationScore || 0,
              culturalFit: evalData.culturalFitScore || 0,
              problemSolving: evalData.technicalScore || 0, // Fallback if missing
              leadership: evalData.culturalFitScore || 0, // Fallback if missing
              domain: evalData.technicalScore || 0 // Fallback if missing
            },
            summary: candidateData.rejectionReason 
              ? (evalData.summary ? `Rejection Reason: ${candidateData.rejectionReason}\n\n${evalData.summary}` : candidateData.rejectionReason)
              : (evalData.summary || "No summary available."),
            strengths: evalData.strengths || [],
            concerns: evalData.concerns || [],
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

  const radarData = [
    { subject: "Technical", score: candidate.scores.technical }, { subject: "Comms", score: candidate.scores.communication },
    { subject: "Culture", score: candidate.scores.culturalFit }, { subject: "Problems", score: candidate.scores.problemSolving },
    { subject: "Leadership", score: candidate.scores.leadership }, { subject: "Domain", score: candidate.scores.domain },
  ];
  
  const recommendation = candidate.recommendation || "pending";
  const recCfg = {
    shortlist: { label: "Highly Recommended", color: t.numPos, icon: <CheckCircle size={13} /> },
    approve:   { label: "Approved",            color: t.numPos, icon: <CheckCircle size={13} /> },
    reject:    { label: "Not Recommended",     color: t.numNeg, icon: <XCircle size={13} /> },
    pending:   { label: "Evaluation Pending",  color: t.numMid, icon: <Clock size={13} /> },
    hold:      { label: "On Hold",             color: t.numMid, icon: <Pause size={13} /> },
  };
  const rec = recCfg[recommendation as keyof typeof recCfg] || recCfg.pending;
  
  const scoreMetrics = [
    { label: "Technical",       value: candidate.scores.technical },
    { label: "Communication",   value: candidate.scores.communication },
    { label: "Cultural Fit",    value: candidate.scores.culturalFit },
    { label: "Problem Solving", value: candidate.scores.problemSolving },
    { label: "Leadership",      value: candidate.scores.leadership },
    { label: "Domain Knowledge",value: candidate.scores.domain },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-5 flex-shrink-0" style={G.bar}>
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
            style={{ fontFamily: "'Fraunces',serif", color: t.accentBadge, ...G.card }}>
            {candidate.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-0.5">
              <h2 className="text-xl font-semibold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>{candidate.name}</h2>
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ color: rec.color, background: hexToRgba(rec.color, 0.14), border: `1px solid ${hexToRgba(rec.color, 0.28)}` }}>{rec.icon}{rec.label}</span>
            </div>
            <div className="text-sm" style={{ color: t.txtSecondary }}>{candidate.currentRole} · {candidate.experience}</div>
            <div className="text-[11px] mt-0.5" style={{ fontFamily: "'DM Mono',monospace", color: t.txtGhost }}>{candidate.email || "No email provided"}</div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-semibold leading-none" style={{ fontFamily: "'Fraunces',serif", color: t.numHero, textShadow: `0 0 30px ${hexToRgba(t.numHero, 0.40)}` }}>{candidate.score}</div>
            <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: t.txtGhost }}>Overall Score</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 space-y-5" style={{ borderRight: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.45)}` }}>
          {/* Score breakdown */}
          <div className="rounded-2xl p-6" style={G.cardWarm}>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-5" style={{ color: t.txtMuted }}>Score Breakdown</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
              {scoreMetrics.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px]" style={{ color: t.txtMuted }}>{item.label}</span>
                    <span className="text-[11px] font-semibold" style={{ fontFamily: "'DM Mono',monospace", color: scoreColor(item.value, t) }}>{item.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.25) }}>
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: scoreColor(item.value, t), boxShadow: `0 0 6px ${hexToRgba(scoreColor(item.value, t), 0.5)}` }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: "180px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={65}>
                  <PolarGrid stroke={hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.40)} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: t.txtMuted, fontSize: 9 }} />
                  <Radar dataKey="score" stroke={t.numPos} fill={t.numPos} fillOpacity={0.18} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Summary */}
          <div className="rounded-2xl p-6" style={G.card}>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} style={{ color: t.accentBadge }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>AI Summary</span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.txtBody }}>{candidate.summary}</p>
          </div>

          {/* Strengths & Concerns */}
          <div className="grid grid-cols-2 gap-4">
            {[{ title: "Strengths", icon: <CheckCircle size={12} />, color: t.numPos, items: candidate.strengths || [] },
              { title: "Concerns",  icon: <AlertCircle size={12} />, color: t.numMid,  items: candidate.concerns || [] }].map((col) => (
              <div key={col.title} className="rounded-2xl p-5" style={G.card}>
                <div className="flex items-center gap-2 mb-3"><span style={{ color: col.color }}>{col.icon}</span><span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>{col.title}</span></div>
                <ul className="space-y-2">{col.items.map((item) => (<li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: t.txtBody }}><span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: col.color, boxShadow: `0 0 4px ${hexToRgba(col.color, 0.6)}` }} />{item}</li>))}</ul>
              </div>
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div className="w-80 flex flex-col flex-shrink-0">
          <div className="px-5 py-4 flex-shrink-0" style={{ ...G.bar, borderBottom: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50)}` }}>
            <div className="flex items-center gap-2"><MessageSquare size={12} style={{ color: t.txtGhost }} /><span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtGhost }}>Interview Transcript</span></div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!candidate.transcript || candidate.transcript.length === 0 ? (
              <div className="text-center py-16"><MessageSquare size={28} className="mx-auto mb-3" style={{ color: t.txtGhost }} /><div className="text-xs" style={{ color: t.txtGhost }}>No transcript available yet.</div></div>
            ) : (
              candidate.transcript.map((entry: any, i: number) => (
                <div key={i} className={entry.role === "candidate" ? "flex justify-end" : "flex justify-start"}>
                  <div className="max-w-[88%] px-4 py-3" style={{
                    background: hexToRgba(entry.role === "ai" ? t.bgCard : t.accentPrimary, entry.role === "ai" ? (t.isDark ? 0.10 : 0.55) : 0.14),
                    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                    border: `1px solid ${hexToRgba(entry.role === "ai" ? t.bgCard : t.accentPrimary, entry.role === "ai" ? (t.isDark ? 0.18 : 0.75) : 0.28)}`,
                    borderRadius: entry.role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                  }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: entry.role === "ai" ? t.accentBadge : t.numPos }}>
                      {entry.role === "ai" ? "AI Interviewer" : candidate.name.split(" ")[0]}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: t.txtBody }}>{entry.message}</p>
                    <div className="text-[9px] mt-1.5" style={{ fontFamily: "'DM Mono',monospace", color: t.txtGhost }}>{entry.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Decision bar */}
      <div className="px-8 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: hexToRgba(t.bgSurface, t.isDark ? 0.88 : 0.90), backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50)}` }}>
        <div className="text-xs" style={{ color: t.txtSecondary }}>
          Final decision for <span className="font-semibold" style={{ color: t.txtPrimary }}>{candidate.name}</span>
          {campaign && <span style={{ color: t.txtMuted }}> · {campaign.title}</span>}
        </div>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={async () => {
              try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${candidate.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "hold" }) });
                if (!res.ok) throw new Error("Failed to submit");
                setCandidate({ ...candidate, recommendation: "hold", status: "complete" });
              } catch (e) { alert("Failed to submit"); }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium" style={{ ...G.card, color: t.txtSecondary }}><Pause size={11} /> Hold</button>
          <button 
            onClick={async () => {
              try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${candidate.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "reject" }) });
                if (!res.ok) throw new Error("Failed to submit");
                setCandidate({ ...candidate, recommendation: "reject", status: "complete" });
              } catch (e) { alert("Failed to submit"); }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: hexToRgba(t.numNeg, 0.12), border: `1px solid ${hexToRgba(t.numNeg, 0.28)}`, color: t.numNeg }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hexToRgba(t.numNeg, 0.22); }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = hexToRgba(t.numNeg, 0.12); }}>
            <XCircle size={11} /> Reject Candidate
          </button>
          <button 
            onClick={async () => {
              try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${candidate.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "approve" }) });
                if (!res.ok) throw new Error("Failed to submit");
                setCandidate({ ...candidate, recommendation: "approve", status: "complete" });
              } catch (e) { alert("Failed to submit"); }
            }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})`, color: t.accentText, boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.40)}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${hexToRgba(t.accentPrimary, 0.55)}`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${hexToRgba(t.accentPrimary, 0.40)}`; }}>
            <CheckCircle size={11} /> Approve Candidate
          </button>
        </div>
      </div>
    </div>
  );
}
