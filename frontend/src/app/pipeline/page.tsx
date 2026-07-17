import { useParams, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { Theme, Campaign, Candidate, CandidateStage } from "../../lib/types";
import { hexToRgba, getGlass, scoreColor } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";

const STAGE_CONFIG: Record<CandidateStage, { label: string; color: string }> = {
  pending:      { label: "Pending Screening", color: "#808090" },
  rejected:     { label: "Rejected",          color: "#C04040" },
  interviewing: { label: "Interviewing",      color: "#4088C0" },
  shortlisted:  { label: "AI Shortlisted",    color: "#40A060" },
  review:       { label: "In Review",         color: "#9040C0" },
  finalized:    { label: "Finalized",         color: "#40C080" },
};

function CandidateGridCard({ candidate, theme: t, G, onClick }: { candidate: Candidate; theme: Theme; G: ReturnType<typeof getGlass>; onClick: () => void }) {
  const recMap = { shortlist: { text: t.numPos, label: "✓ Shortlist" }, reject: { text: t.numNeg, label: "✗ Reject" }, pending: { text: t.numMid, label: "⋯ Pending" } };
  const recommendation = (candidate.recommendation || "pending").toLowerCase();
  const rec = recMap[recommendation as keyof typeof recMap] || { text: t.numMid, label: `? ${candidate.recommendation}` };
  let score = candidate.score || candidate.fitScore || 0;
  // Format to 2 decimal places if it's a float
  score = typeof score === 'number' && score % 1 !== 0 ? Number(score.toFixed(2)) : score;
  
  return (
    <button onClick={onClick} className="w-full rounded-3xl p-5 text-left transition-all duration-300 flex flex-col justify-between h-full group" style={{ ...G.card, position: 'relative', overflow: 'hidden' }}
      onMouseEnter={(e) => { 
        const el = e.currentTarget as HTMLElement; 
        el.style.transform = "translateY(-6px)";
        el.style.border = `1px solid ${hexToRgba(t.accentPrimary, 0.50)}`; 
        el.style.boxShadow = t.isDark ? `0 16px 40px ${hexToRgba(t.accentPrimary, 0.20)}` : `0 16px 40px ${hexToRgba(t.accentPrimary, 0.15)}`; 
      }}
      onMouseLeave={(e) => { 
        const el = e.currentTarget as HTMLElement; 
        el.style.transform = "none";
        el.style.border = G.card.border as string; 
        el.style.boxShadow = G.card.boxShadow as string; 
      }}>
      
      {/* Decorative top gradient line based on score */}
      <div className="absolute top-0 left-0 right-0 h-1.5 opacity-60 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${scoreColor(score, t)}, transparent)` }}></div>

      <div className="flex items-start justify-between mb-5">
        <div className="flex-1 min-w-0 pr-4">
          <div className="text-lg font-semibold truncate transition-colors group-hover:text-opacity-90" style={{ color: t.txtPrimary }}>{candidate.name}</div>
          <div className="text-sm mt-1 truncate" style={{ color: t.txtMuted }}>{candidate.currentRole || "Candidate"}</div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full border-2" 
             style={{ 
               borderColor: hexToRgba(scoreColor(score, t), 0.3),
               background: hexToRgba(scoreColor(score, t), 0.1) 
             }}>
          <span className="text-2xl font-bold leading-none" style={{ fontFamily: "'Fraunces',serif", color: scoreColor(score, t) }}>{score}</span>
        </div>
      </div>
      
      <div className="mt-auto pt-4 border-t" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
        <div className="flex items-center justify-between">
          <span className="text-xs truncate max-w-[55%]" style={{ color: t.txtGhost }}>{candidate.experience || "No experience listed"}</span>
          <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" 
                style={{ 
                  color: rec.text, 
                  background: hexToRgba(rec.text, 0.15), 
                  border: `1px solid ${hexToRgba(rec.text, 0.25)}` 
                }}>
            {rec.label}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function PipelinePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const G = getGlass(t);
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [activeStage, setActiveStage] = useState<CandidateStage>("pending");

  const handleRetryFailed = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns/${id}/retry-failed`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to retry candidates");
      const data = await res.json();
      alert(`Successfully queued ${data.count} candidates for retry.`);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Error retrying candidates.");
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      if (!id) return;
      try {
        const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns/${id}`);
        if (!res.ok) throw new Error("Failed to fetch campaign data");
        const campaignData = await res.json();
        const candidatesData = campaignData.candidates || [];

        if (campaignData && isMounted) {
          const cands = candidatesData || [];
          const total = cands.length;
          const processed = cands.filter((c: any) => c.status !== 'pending').length;
          const shortlisted = cands.filter((c: any) => c.status === 'shortlisted').length;
          
          setCampaign({
            ...campaignData,
            total,
            processed,
            shortlisted,
            status: campaignData.status || 'active',
            location: campaignData.location || 'Remote'
          });
          
          const mappedCands = cands.map((c: any) => ({
            ...c,
            score: c.fitScore || c.evaluation?.overallScore || 0,
            recommendation: c.decision || c.evaluation?.recommendation || 'pending',
            stage: c.status,
            currentRole: c.structuredProfile?.currentRole || "",
            experience: c.structuredProfile?.experience || ""
          }));
          
          setCandidates(mappedCands);
        }
      } catch (err) {
        console.error("Error fetching pipeline data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchData();

    // Set up Supabase Realtime subscription
    const channel = supabase
      .channel(`campaign-${id}-updates`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Candidate',
        },
        (payload) => {
          console.log('Realtime Candidate update:', payload);
          if (payload.new && 'campaignId' in payload.new) {
             if (payload.new.campaignId === id) fetchData();
          } 
          else {
             fetchData(); 
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-lg" style={{ color: t.txtMuted }}>Loading pipeline...</div>;
  }

  if (!campaign) {
    return <div className="flex items-center justify-center h-full text-lg" style={{ color: t.txtMuted }}>Campaign not found.</div>;
  }

  const allStages: CandidateStage[] = ["pending","interviewing","shortlisted","review","finalized","rejected"];
  const stages = campaign.enableInterviews === false ? allStages.filter(s => s !== "interviewing") : allStages;
  const progress = campaign.total && campaign.total > 0 ? Math.round(((campaign.processed || 0) / campaign.total) * 100) : 0;
  
  const activeCandidates = candidates
    .filter((c) => c.stage === activeStage)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* CAMPAIGN HEADER */}
      <div className="px-8 py-5 flex-shrink-0 relative z-10" style={{ ...G.bar }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: t.numPos }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.numPos, boxShadow: `0 0 8px ${hexToRgba(t.numPos, 0.8)}` }} />{campaign.status}
              </span>
              <span className="text-xs" style={{ color: t.txtMuted }}>•</span>
              <span className="text-xs font-medium" style={{ color: t.txtMuted }}>{campaign.location}</span>
            </div>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>{campaign.title}</h2>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ width: "240px", background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.3) }}>
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: t.progressFill, boxShadow: `0 0 10px ${hexToRgba(t.progressFill, 0.6)}` }} />
              </div>
              <span className="text-xs font-medium" style={{ color: t.txtSecondary }}>{campaign.processed} / {campaign.total} Processed</span>
            </div>
          </div>
          <div className="flex items-center gap-10">
            <button 
              onClick={handleRetryFailed} 
              disabled={retrying}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-all hover:-translate-y-0.5"
              style={{ 
                background: hexToRgba(t.accentPrimary, 0.15), 
                color: t.accentText || t.accentPrimary, 
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
                boxShadow: `0 4px 12px ${hexToRgba(t.accentPrimary, 0.1)}`
              }}
            >
              {retrying ? "Retrying..." : "Retry Failed"}
            </button>
            <div className="flex gap-8">
              {[{ v: campaign.total, l: "Total CVs", c: t.numHero }, { v: campaign.processed, l: "Processed", c: t.txtPrimary }, { v: campaign.shortlisted, l: "Shortlisted", c: t.numPos }].map((s) => (
                <div key={s.l} className="text-center">
                  <div className="text-4xl font-bold mb-1" style={{ fontFamily: "'Fraunces',serif", color: s.c }}>{s.v}</div>
                  <div className="text-xs font-medium uppercase tracking-widest" style={{ color: t.txtGhost }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
        {/* STATUS TABS */}
        <div className="px-8 py-5 flex-shrink-0 border-b relative z-0 overflow-x-auto" style={{ borderColor: hexToRgba(t.txtGhost, 0.1) }}>
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
          <div className="flex items-center gap-3.5 min-w-max hide-scrollbar">
            {stages.map((stage) => {
              const config = STAGE_CONFIG[stage] || { label: stage, color: t.txtMuted };
              const count = candidates.filter((c) => c.stage === stage).length;
              const isActive = activeStage === stage;
              
              return (
                <button 
                  key={stage}
                  onClick={() => setActiveStage(stage)}
                  className="flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 group outline-none"
                  style={{ 
                    background: isActive ? hexToRgba(config.color, 0.12) : hexToRgba(t.bgCard, t.isDark ? 0.05 : 0.4),
                    border: `1px solid ${isActive ? hexToRgba(config.color, 0.5) : hexToRgba(t.txtGhost, 0.2)}`,
                    boxShadow: isActive ? `0 8px 24px ${hexToRgba(config.color, 0.15)}, inset 0 1px 0 ${hexToRgba('#fff', 0.1)}` : '0 2px 8px rgba(0,0,0,0.05)',
                    transform: isActive ? 'translateY(-2px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = hexToRgba(config.color, 0.05);
                      e.currentTarget.style.borderColor = hexToRgba(config.color, 0.3);
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = hexToRgba(t.bgCard, t.isDark ? 0.05 : 0.4);
                      e.currentTarget.style.borderColor = hexToRgba(t.txtGhost, 0.2);
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <div className="w-3 h-3 rounded-full transition-shadow duration-300" 
                       style={{ 
                         backgroundColor: config.color, 
                         boxShadow: isActive ? `0 0 12px ${config.color}` : 'none' 
                       }} 
                  />
                  <span className="text-sm font-semibold whitespace-nowrap transition-colors" 
                        style={{ color: isActive ? t.txtPrimary : t.txtSecondary }}>
                    {config.label}
                  </span>
                  <div className="ml-1.5 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center justify-center transition-all" 
                       style={{ 
                         color: isActive ? config.color : t.txtGhost,
                         background: isActive ? hexToRgba(config.color, 0.15) : hexToRgba(t.txtGhost, 0.1)
                       }}>
                    {count}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* GRID VIEW */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {activeCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center" style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div className="w-24 h-24 mb-6 rounded-[2rem] flex items-center justify-center transition-transform hover:scale-105" 
                   style={{ 
                     background: hexToRgba(STAGE_CONFIG[activeStage]?.color || t.txtGhost, 0.08), 
                     border: `1px solid ${hexToRgba(STAGE_CONFIG[activeStage]?.color || t.txtGhost, 0.2)}`,
                     boxShadow: `0 12px 32px ${hexToRgba(STAGE_CONFIG[activeStage]?.color || t.txtGhost, 0.1)}`
                   }}>
                <div className="w-10 h-10 rounded-full" 
                     style={{ 
                       backgroundColor: STAGE_CONFIG[activeStage]?.color || t.txtGhost, 
                       opacity: 0.8,
                       boxShadow: `0 0 20px ${STAGE_CONFIG[activeStage]?.color || t.txtGhost}`
                     }} 
                />
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: t.txtPrimary }}>No Candidates Yet</h3>
              <p className="text-base leading-relaxed" style={{ color: t.txtSecondary }}>
                There are currently no candidates in the <strong style={{ color: STAGE_CONFIG[activeStage]?.color || t.txtPrimary }}>{STAGE_CONFIG[activeStage]?.label || 'selected'}</strong> stage. 
                Candidates will appear here as they progress through your pipeline.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {activeCandidates.map((cand) => (
                <div key={cand.id} style={{ animation: 'fadeIn 0.4s ease-out' }}>
                  <CandidateGridCard 
                    candidate={cand} 
                    theme={t} 
                    G={G} 
                    onClick={() => navigate(`/candidate/${cand.id}`)} 
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
