import { useEffect, useState, useRef } from "react";
import { Theme } from "../../lib/types";
import { getGlass, hexToRgba, hexToRgb } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { Mail, CheckCircle2, Clock, Loader2, Filter, Search, Send, ShieldAlert, Sparkles, UserCheck } from "lucide-react";
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
}

export default function InterviewsPage({ theme: t }: { theme: Theme }) {
  const G = getGlass(t);
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);

  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sending state
  const [sending, setSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/interviews/candidates`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);

        // Extract unique campaigns
        const campMap = new Map<string, string>();
        data.forEach((c: InterviewCandidate) => {
          if (c.campaignId && c.campaignTitle) {
            campMap.set(c.campaignId, c.campaignTitle);
          }
        });
        setCampaigns(Array.from(campMap.entries()).map(([id, title]) => ({ id, title })));
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
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const statusBadges: Record<string, { label: string; bg: string; fg: string }> = {
    shortlisted: { label: "Ready to Invite", bg: hexToRgba(t.accentPrimary, 0.15), fg: t.accentPrimary },
    invited: { label: "Invitation Sent", bg: hexToRgba("#eab308", 0.15), fg: "#eab308" },
    interviewing: { label: "Interview In Progress", bg: hexToRgba("#3b82f6", 0.15), fg: "#3b82f6" },
    review: { label: "Awaiting Review", bg: hexToRgba("#a855f7", 0.15), fg: "#a855f7" },
    complete: { label: "Completed", bg: hexToRgba(t.numPos, 0.15), fg: t.numPos },
    finalized: { label: "Finalized", bg: hexToRgba(t.numPos, 0.2), fg: t.numPos },
  };

  const countShortlisted = candidates.filter((c) => c.status === "shortlisted").length;
  const countInvited = candidates.filter((c) => c.status === "invited").length;
  const countInterviewing = candidates.filter((c) => c.status === "interviewing").length;
  const countCompleted = candidates.filter((c) => ["review", "complete", "finalized"].includes(c.status)).length;

  return (
    <div ref={gridRef} className="bento-section p-8 min-h-screen">
      <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={t.isDark} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: t.accentPrimary }}>
            <Sparkles size={14} /> Automated & Protected Interview Workflow
          </div>
          <h1 className="text-2xl font-bold" style={{ color: t.txtPrimary, fontFamily: "'Fraunces', serif" }}>
            Candidate Interview Portal
          </h1>
          <p className="text-xs" style={{ color: t.txtMuted }}>
            Filter candidates, issue email invitation tokens, and manage technical AI evaluations on-demand.
          </p>
        </div>

        {/* Action Button */}
        {selectedIds.length > 0 && (
          <button
            onClick={() => handleSendInvitations()}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold transition-all shadow-lg"
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
          <button onClick={() => setToastMessage(null)} className="text-xs font-bold opacity-70 hover:opacity-100">
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
            style={{
              background: hexToRgba(t.accentPrimary, 0.15),
              border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
              color: t.accentPrimary,
            }}
          >
            <Mail size={14} /> Invite All Shortlisted ({filteredCandidates.filter((c) => c.status === "shortlisted").length})
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
                <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Campaign / Role</th>
                <th className="p-4 text-xs font-semibold text-center" style={{ color: t.txtMuted }}>CV Fit Score</th>
                <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Status</th>
                <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Invitation Date</th>
                <th className="p-4 text-xs font-semibold text-right" style={{ color: t.txtMuted }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const badge = statusBadges[c.status] || { label: c.status, bg: hexToRgba(t.bgCard, 0.3), fg: t.txtMuted };

                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.15)}`,
                      background: isSelected ? hexToRgba(t.accentPrimary, 0.06) : "transparent",
                    }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4 text-center">
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
                      <span className="text-xs font-bold" style={{ color: (c.fitScore || 0) >= 80 ? t.numPos : t.txtPrimary }}>
                        {c.fitScore ? `${Math.round(c.fitScore)}/100` : "--"}
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
                    <td className="p-4 text-right">
                      {c.status === "shortlisted" || c.status === "invited" ? (
                        <button
                          onClick={() => handleSendInvitations([c.id])}
                          disabled={sending}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                          style={{
                            background: hexToRgba(t.accentPrimary, 0.15),
                            border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
                            color: t.accentPrimary,
                          }}
                        >
                          {c.status === "invited" ? "Resend Invite" : "Send Invite"}
                        </button>
                      ) : (
                        <span className="text-[11px] italic" style={{ color: t.txtGhost }}>No action needed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
