import { useParams } from "react-router";
import { useState, useEffect } from "react";
import { Theme, CandidateStage } from "../../lib/types";
import { getGlass } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";
import { ALL_STAGES } from "./constants";
import { PipelineHeader, PipelineStageTabs, CandidateGrid, CostAnalysisModal, ExportCampaignModal } from "./components";

import { queryClient } from "../queryClient";
import { usePipeline, getPipelineQueryKey } from "../../lib/hooks/usePipeline";
import { CAMPAIGNS_QUERY_KEY } from "../../lib/hooks/useCampaigns";

export default function PipelinePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const G = getGlass(t);

  const { campaign, candidates, isLoading, invalidatePipeline } = usePipeline(id);
  const [retrying, setRetrying] = useState(false);
  const [activeStage, setActiveStage] = useState<CandidateStage>("screening");
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleRetryFailed = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const res = await apiFetch(`/api/campaigns/${id}/retry-failed`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to retry candidates");
      const data = await res.json();
      alert(`Successfully queued ${data.count} candidates for retry.`);
      await queryClient.invalidateQueries({ queryKey: getPipelineQueryKey(id) });
      await queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
    } catch (err) {
      console.error(err);
      alert("Error retrying candidates.");
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!id) return;
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
            invalidatePipeline();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [id, invalidatePipeline]);

  if (isLoading) {
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
        onOpenCostAnalysis={() => setIsCostModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
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

      <CostAnalysisModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        campaign={campaign}
        candidates={candidates}
        theme={t}
      />

      <ExportCampaignModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        campaign={campaign}
        candidates={candidates}
        theme={t}
      />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

