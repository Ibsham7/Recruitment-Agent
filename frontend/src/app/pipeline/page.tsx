import { useParams } from "react-router";
import { useState, useEffect } from "react";
import { Theme, Campaign, Candidate, CandidateStage } from "../../lib/types";
import { getGlass } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";
import { ALL_STAGES } from "./constants";
import { PipelineHeader, PipelineStageTabs, CandidateGrid } from "./components";

export default function PipelinePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const G = getGlass(t);
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [activeStage, setActiveStage] = useState<CandidateStage>("screening");

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
          const processed = cands.filter((c: any) => !['pending', 'screening'].includes(c.status)).length;
          const shortlisted = cands.filter((c: any) => ['shortlisted', 'invited', 'interviewing', 'interview_completed', 'finalized', 'complete'].includes(c.status)).length;
          
          setCampaign({
            ...campaignData,
            total,
            processed,
            shortlisted,
            status: campaignData.status || 'active',
            location: campaignData.location || 'Remote'
          });
          
          const mappedCands = cands.map((c: any) => {
            let stage: CandidateStage = "screening";
            if (['pending', 'screening', 'screening_hold'].includes(c.status)) {
              stage = "screening";
            } else if (['shortlisted', 'invited'].includes(c.status)) {
              stage = "shortlisted";
            } else if (c.status === 'interviewing') {
              stage = "interviewing";
            } else if (['interview_completed', 'review'].includes(c.status)) {
              stage = "review";
            } else if (['finalized', 'complete'].includes(c.status)) {
              stage = "finalized";
            } else if (c.status === 'rejected') {
              stage = "rejected";
            }

            return {
              ...c,
              score: c.fitScore || c.evaluation?.overallScore || 0,
              recommendation: c.decision || c.evaluation?.recommendation || 'pending',
              stage,
              currentRole: c.structuredProfile?.currentRole || "",
              experience: c.structuredProfile?.experience || ""
            };
          });
          
          setCandidates(mappedCands);
        }
      } catch (err) {
        console.error("Error fetching pipeline data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchData();

    // Set up Supabase Realtime subscription with debounce
    let timeoutId: any = null;
    const channel = supabase
      .channel(`campaign-${id}-updates`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Candidate',
        },
        () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (isMounted) fetchData();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-lg" style={{ color: t.txtMuted }}>Loading pipeline...</div>;
  }

  if (!campaign) {
    return <div className="flex items-center justify-center h-full text-lg" style={{ color: t.txtMuted }}>Campaign not found.</div>;
  }

  const activeCandidates = candidates
    .filter((c) => c.stage === activeStage)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PipelineHeader 
        campaign={campaign} 
        theme={t} 
        G={G} 
        retrying={retrying} 
        onRetryFailed={handleRetryFailed} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
        <PipelineStageTabs 
          stages={ALL_STAGES} 
          activeStage={activeStage} 
          onSelectStage={setActiveStage} 
          candidates={candidates} 
          theme={t} 
        />
        
        <CandidateGrid 
          activeCandidates={activeCandidates} 
          activeStage={activeStage} 
          theme={t} 
          G={G} 
        />
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
