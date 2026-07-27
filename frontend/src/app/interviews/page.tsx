import { useEffect, useState, useRef } from "react";
import { Theme } from "../../lib/types";
import { getGlass, hexToRgba, hexToRgb } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { Mail, CheckCircle2, Clock, Loader2, Filter, Search, Send, ShieldAlert, Sparkles, UserCheck, X, MessageSquare, Brain, ThumbsUp, ThumbsDown, Sliders } from "lucide-react";
import { ParticleCard, GlobalSpotlight } from "../../components/common/MagicBento";

interface InterviewCandidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  fitScore?: number;
  campaignId: string;
  campaignTitle: string;
  invitedAt?: string;
  hasQuestions: boolean;
  createdAt: string;
  evaluation?: {
    overallScore?: number;
    technicalScore?: number;
    communicationScore?: number;
    culturalFitScore?: number;
    recommendation?: string;
    summary?: string;
    strengths?: string[];
    concerns?: string[];
    chainOfThought?: string;
    interviewTranscript?: any[];
    interviewQuestions?: any[];
  };
}

interface CampaignItem {
  id: string;
  title: string;
  interviewConfig?: string | null;
}

const PRESET_FOCUS_TEMPLATES = [
  {
    label: "System Design & Scalability",
    text: "Focus heavily on distributed system architecture, caching strategies (Redis), database indexing/scaling, and microservices resilience."
  },
  {
    label: "Frontend & Performance",
    text: "Ask candidate to explain state management in complex React applications, rendering optimization, Lighthouse performance scores, and CSS modern layouts."
  },
  {
    label: "AI & LLM Orchestration",
    text: "Focus on experience with LangChain/LangGraph, prompt engineering, RAG pipelines, vector embeddings, and fallback/tool-calling reliability."
  },
  {
    label: "Problem Solving & Live Coding",
    text: "Deep-dive on live coding problem-solving methodology, clean code principles, automated unit testing, and debugging edge cases."
  }
];

export default function InterviewsPage({ theme: t }: { theme: Theme }) {
  const G = getGlass(t);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isConfigModalOpen) {
          setIsConfigModalOpen(false);
        } else if (inspectingCandidate) {
          setInspectingCandidate(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectingCandidate, isConfigModalOpen]);

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
    if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
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
    } catch (err: any) {
      setToastMessage(`Error: ${err.message || "Failed to submit decision"}`);
    } finally {
      setReviewingAction(null);
    }
  };

  const statusBadges: Record<string, { label: string; bg: string; fg: string }> = {
    shortlisted: { label: "Ready to Invite", bg: hexToRgba(t.accentPrimary, 0.15), fg: t.accentPrimary },
    invited: { label: "Invitation Sent", bg: hexToRgba("#eab308", 0.15), fg: "#eab308" },
    interviewing: { label: "Interview In Progress", bg: hexToRgba("#3b82f6", 0.15), fg: "#3b82f6" },
    interview_completed: { label: "Evaluation Ready", bg: hexToRgba("#a855f7", 0.15), fg: "#a855f7" },
    review: { label: "Evaluation Ready", bg: hexToRgba("#a855f7", 0.15), fg: "#a855f7" },
    screening_hold: { label: "Screening Hold", bg: hexToRgba("#eab308", 0.15), fg: "#eab308" },
    finalized: { label: "Finalized", bg: hexToRgba(t.numPos, 0.2), fg: t.numPos },
    complete: { label: "Finalized", bg: hexToRgba(t.numPos, 0.2), fg: t.numPos },
    rejected: { label: "Rejected", bg: hexToRgba(t.numNeg, 0.15), fg: t.numNeg },
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
            <Sparkles size={14} /> Technical Candidate Evaluation Engine
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
      {toastMessage && (
        <div
          className="mb-6 p-4 rounded-xl text-xs font-medium flex items-center justify-between shadow-lg"
          style={{
            background: toastMessage.startsWith("Error")
              ? hexToRgba(t.numNeg, 0.15)
              : hexToRgba(t.numPos, 0.15),
            border: `1px solid ${toastMessage.startsWith("Error") ? t.numNeg : t.numPos}`,
            color: t.txtPrimary,
          }}
        >
          <div className="flex items-center gap-2">
            {toastMessage.startsWith("Error") ? (
              <ShieldAlert size={16} style={{ color: t.numNeg }} />
            ) : (
              <CheckCircle2 size={16} style={{ color: t.numPos }} />
            )}
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Shortlisted (Ready)", value: countShortlisted, sub: "Pending email invitation", icon: <UserCheck size={16} /> },
          { label: "Invitations Sent", value: countInvited, sub: "Protected link issued", icon: <Mail size={16} /> },
          { label: "Assessment In Progress", value: countInterviewing, sub: "Candidate verified email", icon: <Clock size={16} /> },
          { label: "Completed / Review", value: countCompleted, sub: "Scored by AI evaluator", icon: <CheckCircle2 size={16} /> },
        ].map((s) => (
          <ParticleCard
            key={s.label}
            className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5"
            style={{ "--glow-color": glow, ...G.cardWarm } as React.CSSProperties}
            glowColor={glow}
            particleCount={6}
            enableTilt={true}
            clickEffect={true}
            enableMagnetism={true}
          >
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: t.txtMuted }}>
              <span>{s.label}</span>
              <span style={{ color: t.accentPrimary }}>{s.icon}</span>
            </div>
            <div className="text-3xl font-semibold leading-none mb-1" style={{ fontFamily: "'Fraunces',serif", color: t.numHero }}>
              {s.value}
            </div>
            <div className="text-[11px]" style={{ color: t.txtGhost }}>
              {s.sub}
            </div>
          </ParticleCard>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 p-4 rounded-2xl" style={G.card}>
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtGhost }} />
            <input
              type="text"
              placeholder="Search candidate name, email or campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs focus:outline-none"
              style={{
                background: hexToRgba(t.bgSurface, t.isDark ? 0.2 : 0.8),
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.25)}`,
                color: t.txtBody,
              }}
            />
          </div>

          {/* Campaign Filter */}
          <div className="flex items-center gap-2 text-xs" style={{ color: t.txtMuted }}>
            <Filter size={12} />
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="py-2 px-3 rounded-xl text-xs focus:outline-none cursor-pointer"
              style={{
                background: hexToRgba(t.bgSurface, t.isDark ? 0.2 : 0.8),
                border: `1px solid ${hexToRgba(t.bgCard, 0.4)}`,
                color: t.txtPrimary,
              }}
            >
              <option value="all">All Campaigns ({campaigns.length})</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 text-xs" style={{ color: t.txtMuted }}>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="py-2 px-3 rounded-xl text-xs focus:outline-none cursor-pointer"
              style={{
                background: hexToRgba(t.bgSurface, t.isDark ? 0.2 : 0.8),
                border: `1px solid ${hexToRgba(t.bgCard, 0.4)}`,
                color: t.txtPrimary,
              }}
            >
              <option value="all">All Statuses</option>
              <option value="shortlisted">Ready to Invite</option>
              <option value="invited">Invitation Sent</option>
              <option value="interviewing">In Progress</option>
              <option value="review">Awaiting Review</option>
              <option value="complete">Completed</option>
            </select>
          </div>
        </div>

        {/* Quick Send All Filtered */}
        {filteredCandidates.filter((c) => c.status === "shortlisted").length > 0 && (
          <button
            onClick={() => {
              const shortlistedIds = filteredCandidates.filter((c) => c.status === "shortlisted").map((c) => c.id);
              handleSendInvitations(shortlistedIds);
            }}
            disabled={sending}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: hexToRgba(t.accentPrimary, 0.15),
              border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
              color: t.accentPrimary,
            }}
          >
            {sending && sendingIds.some(id => filteredCandidates.some(c => c.id === id && c.status === "shortlisted")) ? (
              <Loader2 size={14} className="animate-spin text-amber-400" />
            ) : (
              <Mail size={14} />
            )}
            Invite All Shortlisted ({filteredCandidates.filter((c) => c.status === "shortlisted").length})
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-16 text-center text-xs" style={{ color: t.txtGhost }}>
          <Loader2 size={24} className="animate-spin mx-auto mb-2" />
          Loading candidate assessment database...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={{ ...G.card, color: t.txtMuted }}>
          No candidates found matching current filter criteria.
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-xl" style={G.card}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6), borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.3)}` }}>
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredCandidates.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Candidate</th>
                <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Campaign / Position</th>
                <th className="p-4 text-xs font-semibold text-center" style={{ color: t.txtMuted }}>Interview Score</th>
                <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Status</th>
                <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Invitation Sent</th>
                <th className="p-4 text-xs font-semibold text-right" style={{ color: t.txtMuted }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const badge = statusBadges[c.status] || { label: c.status, bg: hexToRgba(t.bgCard, 0.3), fg: t.txtMuted };
                const intScore = c.evaluation?.overallScore;
                const isRowSending = sendingIds.includes(c.id);

                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.15)}`,
                      background: isSelected ? hexToRgba(t.accentPrimary, 0.06) : "transparent",
                    }}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setInspectingCandidate(c)}
                  >
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(c.id)}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>{c.name}</div>
                      <div className="text-[11px]" style={{ color: t.txtMuted }}>{c.email || "No email provided"}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-medium" style={{ color: t.txtBody }}>{c.campaignTitle}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs font-bold" style={{ color: intScore && intScore >= 75 ? t.numPos : t.txtPrimary }}>
                        {intScore !== undefined && intScore !== null ? `${Math.round(intScore)}/100` : "--"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold" style={{ background: badge.bg, color: badge.fg }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-4 text-xs" style={{ color: t.txtMuted }}>
                      {c.invitedAt ? new Date(c.invitedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not Sent"}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {c.status === "shortlisted" || c.status === "invited" ? (
                          <button
                            onClick={() => handleSendInvitations([c.id])}
                            disabled={sending}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                              background: hexToRgba(t.accentPrimary, 0.15),
                              border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
                              color: t.accentPrimary,
                            }}
                          >
                            {isRowSending ? (
                              <>
                                <Loader2 size={12} className="animate-spin text-amber-400" />
                                <span>{c.status === "invited" ? "Resending..." : "Sending..."}</span>
                              </>
                            ) : (
                              <>
                                <Mail size={12} />
                                <span>{c.status === "invited" ? "Resend Invite" : "Send Invite"}</span>
                              </>
                            )}
                          </button>
                        ) : null}
                        <button
                          onClick={() => setInspectingCandidate(c)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                          style={{
                            background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.7),
                            border: `1px solid ${hexToRgba(t.bgCard, 0.5)}`,
                            color: t.txtPrimary,
                          }}
                        >
                          Inspect Interview
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Candidate Interview Detail Modal Drawer */}
      {inspectingCandidate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" 
          style={{ background: t.isDark ? "rgba(3, 3, 7, 0.82)" : "rgba(15, 15, 25, 0.6)", backdropFilter: "blur(12px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="eval-modal-title"
          onClick={() => setInspectingCandidate(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
            style={{ 
              background: t.isDark ? t.bgSurface : t.bgCard, 
              border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
              boxShadow: t.isDark ? `0 20px 50px rgba(0,0,0,0.6), 0 0 30px ${hexToRgba(t.accentPrimary, 0.15)}` : "0 20px 50px rgba(0,0,0,0.15)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header Bar */}
            <div 
              className="shrink-0 flex items-center justify-between p-6 border-b z-10" 
              style={{ 
                borderColor: hexToRgba(t.txtPrimary, 0.1),
                background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
                backdropFilter: "blur(8px)"
              }}
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: t.accentPrimary }}>
                  <Sparkles size={14} /> Technical Evaluation Inspection
                </div>
                <div className="flex items-center gap-3">
                  <h2 id="eval-modal-title" className="text-xl md:text-2xl font-bold" style={{ color: t.txtPrimary, fontFamily: "'Fraunces', serif" }}>
                    {inspectingCandidate.name}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary, border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}` }}>
                    {inspectingCandidate.status}
                  </span>
                </div>
                <p className="text-xs font-medium mt-0.5" style={{ color: t.txtSecondary }}>
                  {inspectingCandidate.email || "No email provided"} · Position: <span style={{ color: t.txtPrimary }}>{inspectingCandidate.campaignTitle}</span>
                </p>
              </div>

              {/* Close Button - Always Visible at Top Right */}
              <button
                onClick={() => setInspectingCandidate(null)}
                aria-label="Close modal"
                className="p-2.5 rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                style={{ color: t.txtSecondary, background: hexToRgba(t.txtPrimary, 0.08), border: `1px solid ${hexToRgba(t.txtPrimary, 0.12)}` }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metrics Breakdown Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: "Overall Score", value: inspectingCandidate.evaluation?.overallScore, color: t.numHero },
                  { label: "Technical Score", value: inspectingCandidate.evaluation?.technicalScore, color: t.accentPrimary },
                  { label: "Communication", value: inspectingCandidate.evaluation?.communicationScore, color: t.numPos },
                  { label: "Cultural Fit", value: inspectingCandidate.evaluation?.culturalFitScore, color: t.accentBadge },
                ].map((m) => {
                  const formattedVal = m.value !== undefined && m.value !== null ? Math.round(m.value) : null;
                  return (
                    <div 
                      key={m.label} 
                      className="p-4 rounded-2xl flex flex-col justify-between transition-all"
                      style={{ 
                        background: hexToRgba(t.bgPage, t.isDark ? 0.5 : 0.6), 
                        border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}`,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)"
                      }}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: t.txtSecondary }}>
                        {m.label}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold" style={{ fontFamily: "'Fraunces', serif", color: m.color }}>
                          {formattedVal !== null ? formattedVal : "--"}
                        </span>
                        {formattedVal !== null && (
                          <span className="text-xs font-semibold" style={{ color: t.txtMuted }}>/100</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Summary Assessment */}
              {inspectingCandidate.evaluation?.summary && (
                <div className="p-5 rounded-2xl" style={{ background: hexToRgba(t.accentPrimary, 0.05), border: `1px solid ${hexToRgba(t.accentPrimary, 0.2)}` }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: t.accentPrimary }}>
                    <Brain size={15} /> AI Evaluator Assessment
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed font-normal" style={{ color: t.txtPrimary }}>
                    {inspectingCandidate.evaluation.summary}
                  </p>
                </div>
              )}

              {/* Strengths & Concerns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Technical Strengths */}
                <div className="p-5 rounded-2xl flex flex-col" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.numPos, 0.25)}` }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: t.numPos }}>
                    <ThumbsUp size={15} /> Technical Strengths
                  </div>
                  {inspectingCandidate.evaluation?.strengths && inspectingCandidate.evaluation.strengths.length > 0 ? (
                    <ul className="space-y-2 text-xs md:text-sm" style={{ color: t.txtPrimary }}>
                      {inspectingCandidate.evaluation.strengths.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="font-bold text-base leading-none" style={{ color: t.numPos }}>✓</span>
                          <span className="leading-snug">{s}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs italic" style={{ color: t.txtMuted }}>No specific strengths highlighted.</p>
                  )}
                </div>

                {/* Key Concerns */}
                <div className="p-5 rounded-2xl flex flex-col" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.5), border: `1px solid ${hexToRgba(t.numNeg, 0.25)}` }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: t.numNeg }}>
                    <ThumbsDown size={15} /> Key Concerns
                  </div>
                  {inspectingCandidate.evaluation?.concerns && inspectingCandidate.evaluation.concerns.length > 0 ? (
                    <ul className="space-y-2 text-xs md:text-sm" style={{ color: t.txtPrimary }}>
                      {inspectingCandidate.evaluation.concerns.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="font-bold text-base leading-none" style={{ color: t.numNeg }}>⚠</span>
                          <span className="leading-snug">{c}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs italic" style={{ color: t.txtMuted }}>No major concerns recorded.</p>
                  )}
                </div>
              </div>

              {/* Transcript Log */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: t.txtPrimary }}>
                  <MessageSquare size={15} style={{ color: t.accentPrimary }} /> Live Interview Q&A Transcript
                </div>
                <div className="p-4 rounded-2xl max-h-80 overflow-y-auto space-y-3" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.6 : 0.7), border: `1px solid ${hexToRgba(t.txtPrimary, 0.1)}` }}>
                  {inspectingCandidate.evaluation?.interviewTranscript && inspectingCandidate.evaluation.interviewTranscript.length > 0 ? (
                    inspectingCandidate.evaluation.interviewTranscript.map((turn, idx) => {
                      const isAi = turn.role === "ai" || turn.role === "interviewer";
                      return (
                        <div key={idx} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                          <div
                            className="max-w-[85%] p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm"
                            style={{
                              background: isAi ? hexToRgba(t.accentPrimary, 0.12) : hexToRgba(t.bgCard, t.isDark ? 0.8 : 1),
                              border: `1px solid ${hexToRgba(isAi ? t.accentPrimary : t.txtPrimary, 0.2)}`,
                              color: t.txtPrimary,
                            }}
                          >
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: isAi ? t.accentPrimary : t.numPos }}>
                              {isAi ? "🤖 AI Technical Interviewer" : `👤 ${inspectingCandidate.name}`}
                            </div>
                            <p className="font-normal">{turn.message}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-center py-8" style={{ color: t.txtMuted }}>
                      No interview transcript recorded yet for this candidate.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Recruiter Action Footer */}
            <div 
              className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t z-10" 
              style={{ 
                borderColor: hexToRgba(t.txtPrimary, 0.1),
                background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
                backdropFilter: "blur(8px)"
              }}
            >
              <div className="text-xs font-medium" style={{ color: t.txtSecondary }}>
                Final Decision: <span className="font-bold text-sm uppercase ml-1" style={{ color: t.txtPrimary }}>{inspectingCandidate.status}</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => handleRecruiterReview(inspectingCandidate.id, "hold")}
                  disabled={reviewingAction !== null}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: hexToRgba(t.txtPrimary, 0.08), color: t.txtPrimary, border: `1px solid ${hexToRgba(t.txtPrimary, 0.18)}` }}
                >
                  {reviewingAction === "hold" ? <Loader2 size={14} className="animate-spin" /> : null}
                  Hold
                </button>
                <button
                  onClick={() => handleRecruiterReview(inspectingCandidate.id, "reject")}
                  disabled={reviewingAction !== null}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: hexToRgba(t.numNeg, 0.15), color: t.numNeg, border: `1px solid ${hexToRgba(t.numNeg, 0.4)}` }}
                >
                  {reviewingAction === "reject" ? <Loader2 size={14} className="animate-spin" /> : null}
                  Reject Candidate
                </button>
                <button
                  onClick={() => handleRecruiterReview(inspectingCandidate.id, "approve")}
                  disabled={reviewingAction !== null}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: t.accentPrimary, color: t.accentText, boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.35)}` }}
                >
                  {reviewingAction === "approve" ? <Loader2 size={14} className="animate-spin" /> : null}
                  Approve Candidate
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Campaign-Specific Interview Configuration Modal */}
      {isConfigModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
          style={{ background: t.isDark ? "rgba(3, 3, 7, 0.82)" : "rgba(15, 15, 25, 0.6)", backdropFilter: "blur(12px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="config-modal-title"
          onClick={() => setIsConfigModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: t.isDark ? t.bgSurface : t.bgCard,
              border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
              boxShadow: t.isDark ? `0 20px 50px rgba(0,0,0,0.6), 0 0 30px ${hexToRgba(t.accentPrimary, 0.15)}` : "0 20px 50px rgba(0,0,0,0.15)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header Bar */}
            <div
              className="shrink-0 flex items-center justify-between p-6 border-b z-10"
              style={{
                borderColor: hexToRgba(t.txtPrimary, 0.1),
                background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
                backdropFilter: "blur(8px)"
              }}
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: t.accentPrimary }}>
                  <Sliders size={14} /> Campaign Settings
                </div>
                <h2 id="config-modal-title" className="text-xl md:text-2xl font-bold" style={{ color: t.txtPrimary, fontFamily: "'Fraunces', serif" }}>
                  Interview Focus & Custom Questions
                </h2>
                <p className="text-xs font-medium mt-0.5" style={{ color: t.txtSecondary }}>
                  Specify topics or specific questions for candidate technical interviews on the /interviews portal
                </p>
              </div>

              {/* Close Button - Always Visible at Top Right */}
              <button
                onClick={() => setIsConfigModalOpen(false)}
                aria-label="Close configuration modal"
                className="p-2.5 rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                style={{ color: t.txtSecondary, background: hexToRgba(t.txtPrimary, 0.08), border: `1px solid ${hexToRgba(t.txtPrimary, 0.12)}` }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Campaign Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: t.txtPrimary }}>
                  Select Campaign
                </label>
                <select
                  value={configCampaignId}
                  onChange={(e) => handleSelectConfigCampaign(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer"
                  style={{
                    background: hexToRgba(t.bgPage, t.isDark ? 0.5 : 0.8),
                    border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
                    color: t.txtPrimary
                  }}
                >
                  {campaigns.length === 0 ? (
                    <option value="">No campaigns available</option>
                  ) : (
                    campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} {c.interviewConfig ? "✓ (Configured)" : "(Default)"}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Quick Preset Focus Templates */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between" style={{ color: t.txtSecondary }}>
                  <span>Quick Focus Presets</span>
                  <span className="text-[10px] lowercase font-normal" style={{ color: t.txtMuted }}>click to append template</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_FOCUS_TEMPLATES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setConfigText((prev) => (prev ? `${prev.trim()}\n${preset.text}` : preset.text));
                      }}
                      className="text-left p-3 rounded-xl border text-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      style={{
                        background: hexToRgba(t.accentPrimary, 0.06),
                        borderColor: hexToRgba(t.accentPrimary, 0.2),
                        color: t.txtPrimary
                      }}
                    >
                      <div className="font-semibold mb-0.5" style={{ color: t.accentPrimary }}>+ {preset.label}</div>
                      <div className="text-[10px] line-clamp-1 opacity-75" style={{ color: t.txtSecondary }}>{preset.text}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea for Interview Focus & Custom Questions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: t.txtPrimary }}>
                    Interview Focus & Custom Questions (Optional)
                  </label>
                  <span className="text-[10px] font-medium" style={{ color: t.txtMuted }}>
                    {configText.length} characters
                  </span>
                </div>
                <textarea
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  rows={5}
                  placeholder="e.g. Ask the candidate to explain their most complex React project. Focus heavily on system design and cultural fit..."
                  className="w-full rounded-2xl p-4 text-xs md:text-sm focus:outline-none resize-none leading-relaxed"
                  style={{
                    background: hexToRgba(t.bgPage, t.isDark ? 0.6 : 0.9),
                    border: `1px solid ${hexToRgba(t.txtPrimary, 0.15)}`,
                    color: t.txtPrimary
                  }}
                />
              </div>

              {/* Information Note */}
              <div className="p-4 rounded-xl text-xs flex items-start gap-3" style={{ background: hexToRgba(t.accentPrimary, 0.08), border: `1px solid ${hexToRgba(t.accentPrimary, 0.2)}` }}>
                <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: t.accentPrimary }} />
                <p style={{ color: t.txtSecondary }}>
                  When candidates belonging to this campaign initiate their technical interview, the AI Question Generator will prioritize these focus areas and custom topics.
                </p>
              </div>
            </div>

            {/* Sticky Recruiter Action Footer */}
            <div
              className="shrink-0 flex items-center justify-between p-5 border-t z-10"
              style={{
                borderColor: hexToRgba(t.txtPrimary, 0.1),
                background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
                backdropFilter: "blur(8px)"
              }}
            >
              <button
                onClick={() => setConfigText("")}
                type="button"
                className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer hover:opacity-80"
                style={{ color: t.txtMuted }}
              >
                Clear Rules
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  disabled={savingConfig}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90"
                  style={{ background: hexToRgba(t.txtPrimary, 0.08), color: t.txtPrimary, border: `1px solid ${hexToRgba(t.txtPrimary, 0.18)}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInterviewConfig}
                  disabled={savingConfig || !configCampaignId}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: t.accentPrimary, color: t.accentText, boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.35)}` }}
                >
                  {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <Sliders size={14} />}
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

