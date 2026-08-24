import { useEffect, useState, useRef } from "react";
import { Theme } from "../../lib/types";
import { hexToRgba, hexToRgb } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { Sliders, Loader2, Send } from "lucide-react";
import { GlobalSpotlight } from "../../components/common/MagicBento";

import { queryClient } from "../queryClient";
import { getCandidateQueryKey } from "../../lib/hooks/useCandidateDetail";

import { InterviewCandidate, CampaignItem } from "./types";
import {
  InterviewsStats,
  InterviewsFilterToolbar,
  InterviewListTable,
  CandidateInspectionDrawer,
  ScheduleConfigModal,
  NotificationToast,
} from "./components";

export default function InterviewsPage({ theme: t }: { theme: Theme }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);

  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectingCandidate, setInspectingCandidate] = useState<InterviewCandidate | null>(null);

  // Interview Configuration Modal state
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configCampaignId, setConfigCampaignId] = useState<string>("");
  const [configText, setConfigText] = useState<string>("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sending & reviewing state
  const [sending, setSending] = useState(false);
  const [sendingIds, setSendingIds] = useState<string[]>([]);
  const [reviewingAction, setReviewingAction] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const [candRes, campRes] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/interviews/candidates`),
        apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns`)
      ]);

      if (candRes.ok) {
        const data = await candRes.json();
        setCandidates(data);
      }

      if (campRes.ok) {
        const campData = await campRes.json();
        const loadedCamps: CampaignItem[] = campData.map((c: any) => ({
          id: c.id,
          title: c.title,
          interviewConfig: c.interviewConfig || null,
        }));
        setCampaigns(loadedCamps);
        if (loadedCamps.length > 0 && !configCampaignId) {
          setConfigCampaignId(loadedCamps[0].id);
          setConfigText(loadedCamps[0].interviewConfig || "");
        }
      }
    } catch (err) {
      console.error("Failed to fetch interview candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleSelectConfigCampaign = (campId: string) => {
    setConfigCampaignId(campId);
    const found = campaigns.find(c => c.id === campId);
    setConfigText(found?.interviewConfig || "");
  };

  const handleSaveInterviewConfig = async () => {
    if (!configCampaignId) return;
    setSavingConfig(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns/${configCampaignId}/interview-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewConfig: configText }),
      });
      if (!res.ok) throw new Error("Failed to update interview configuration");
      
      const updatedCampTitle = campaigns.find(c => c.id === configCampaignId)?.title || "campaign";
      setToastMessage(`Interview focus and custom questions saved for "${updatedCampTitle}"!`);
      setIsConfigModalOpen(false);
      await fetchCandidates();
    } catch (err: any) {
      setToastMessage(`Error: ${err.message || "Failed to save configuration"}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    if (selectedCampaign !== "all" && c.campaignId !== selectedCampaign) return false;
    if (selectedStatus !== "all") {
      if (selectedStatus === "complete" && !["complete", "finalized"].includes(c.status)) return false;
      else if (selectedStatus === "review" && !["review", "interview_completed"].includes(c.status)) return false;
      else if (selectedStatus !== "complete" && selectedStatus !== "review" && c.status !== selectedStatus) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchEmail = (c.email || "").toLowerCase().includes(q);
      const matchCamp = c.campaignTitle.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchCamp) return false;
    }
    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredCandidates.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSendInvitations = async (targetIds?: string[]) => {
    const idsToSend = targetIds || selectedIds;
    if (idsToSend.length === 0) return;

    setSending(true);
    setSendingIds(idsToSend);
    setToastMessage(null);

    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/interviews/send-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: idsToSend }),
      });

      if (!res.ok) throw new Error("Failed to send invitation emails");

      const data = await res.json();
      setToastMessage(`Success! Sent ${data.count} interview invitation email(s). Token protection enabled.`);
      setSelectedIds([]);
      await fetchCandidates();
    } catch (err: any) {
      setToastMessage(`Error: ${err.message || "Failed to send invitations"}`);
    } finally {
      setSending(false);
      setSendingIds([]);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const handleRecruiterReview = async (candidateId: string, decision: "approve" | "hold" | "reject") => {
    setReviewingAction(decision);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/${candidateId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("Failed to record review decision");
      setToastMessage(`Candidate decision recorded: ${decision.toUpperCase()}`);
      setInspectingCandidate(null);
      await fetchCandidates();
      await queryClient.invalidateQueries({ queryKey: getCandidateQueryKey(candidateId) });
    } catch (err: any) {
      setToastMessage(`Error: ${err.message || "Failed to submit decision"}`);
    } finally {
      setReviewingAction(null);
    }
  };

  const countShortlisted = candidates.filter((c) => c.status === "shortlisted").length;
  const countInvited = candidates.filter((c) => c.status === "invited").length;
  const countInterviewing = candidates.filter((c) => c.status === "interviewing").length;
  const countCompleted = candidates.filter((c) => ["interview_completed", "review", "complete", "finalized"].includes(c.status)).length;

  return (
    <div ref={gridRef} className="bento-section p-8 min-h-screen">
      <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={t.isDark} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: t.accentPrimary }}>
            Technical Candidate Evaluation Engine
          </div>
          <h1 className="text-2xl font-bold" style={{ color: t.txtPrimary, fontFamily: "'Fraunces', serif" }}>
            Candidate Interview Portal
          </h1>
          <p className="text-xs" style={{ color: t.txtMuted }}>
            Issue interview tokens, monitor live candidate Q&A sessions, and inspect multi-dimensional AI evaluation reports.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (campaigns.length > 0 && !configCampaignId) {
                setConfigCampaignId(campaigns[0].id);
                setConfigText(campaigns[0].interviewConfig || "");
              }
              setIsConfigModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer hover:opacity-90 active:scale-95"
            style={{
              background: hexToRgba(t.accentPrimary, 0.12),
              border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
              color: t.accentPrimary,
            }}
          >
            <Sliders size={15} />
            Interview Configuration
          </button>

          {selectedIds.length > 0 && (
            <button
              onClick={() => handleSendInvitations()}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold transition-all shadow-lg cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
                color: t.accentText,
                boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.4)}`,
              }}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Invitations ({selectedIds.length} Selected)
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      <NotificationToast
        message={toastMessage}
        theme={t}
        onDismiss={() => setToastMessage(null)}
      />

      {/* Stats Cards */}
      <InterviewsStats
        theme={t}
        glow={glow}
        countShortlisted={countShortlisted}
        countInvited={countInvited}
        countInterviewing={countInterviewing}
        countCompleted={countCompleted}
      />

      {/* Filter Toolbar */}
      <InterviewsFilterToolbar
        theme={t}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCampaign={selectedCampaign}
        setSelectedCampaign={setSelectedCampaign}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        campaigns={campaigns}
        filteredCandidates={filteredCandidates}
        handleSendInvitations={handleSendInvitations}
        sending={sending}
        sendingIds={sendingIds}
      />

      {/* Table */}
      <InterviewListTable
        theme={t}
        loading={loading}
        filteredCandidates={filteredCandidates}
        selectedIds={selectedIds}
        handleSelectAll={handleSelectAll}
        handleToggleSelect={handleToggleSelect}
        handleSendInvitations={handleSendInvitations}
        setInspectingCandidate={setInspectingCandidate}
        sending={sending}
        sendingIds={sendingIds}
      />

      {/* Candidate Interview Detail Modal Drawer */}
      <CandidateInspectionDrawer
        candidate={inspectingCandidate}
        theme={t}
        onClose={() => setInspectingCandidate(null)}
        handleRecruiterReview={handleRecruiterReview}
        reviewingAction={reviewingAction}
      />

      {/* Campaign-Specific Interview Configuration Modal */}
      <ScheduleConfigModal
        theme={t}
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        campaigns={campaigns}
        configCampaignId={configCampaignId}
        setConfigCampaignId={setConfigCampaignId}
        configText={configText}
        setConfigText={setConfigText}
        handleSelectConfigCampaign={handleSelectConfigCampaign}
        handleSaveInterviewConfig={handleSaveInterviewConfig}
        savingConfig={savingConfig}
      />
    </div>
  );
}
