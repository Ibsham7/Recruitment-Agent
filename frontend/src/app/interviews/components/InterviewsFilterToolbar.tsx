import { Theme } from "../../../lib/types";
import { getGlass, hexToRgba } from "../../../lib/theme";
import { Search, Filter, Mail, Loader2 } from "lucide-react";
import { CampaignItem, InterviewCandidate } from "../types";

export interface InterviewsFilterToolbarProps {
  theme: Theme;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCampaign: string;
  setSelectedCampaign: (campaignId: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  campaigns: CampaignItem[];
  filteredCandidates: InterviewCandidate[];
  handleSendInvitations: (targetIds?: string[]) => void;
  sending: boolean;
  sendingIds: string[];
}

export function InterviewsFilterToolbar({
  theme: t,
  searchQuery,
  setSearchQuery,
  selectedCampaign,
  setSelectedCampaign,
  selectedStatus,
  setSelectedStatus,
  campaigns,
  filteredCandidates,
  handleSendInvitations,
  sending,
  sendingIds,
}: InterviewsFilterToolbarProps) {
  const G = getGlass(t);
  const shortlistedCandidates = filteredCandidates.filter((c) => c.status === "shortlisted");

  return (
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
      {shortlistedCandidates.length > 0 && (
        <button
          onClick={() => {
            const shortlistedIds = shortlistedCandidates.map((c) => c.id);
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
          {sending && sendingIds.some(id => shortlistedCandidates.some(c => c.id === id)) ? (
            <Loader2 size={14} className="animate-spin text-amber-400" />
          ) : (
            <Mail size={14} />
          )}
          Invite All Shortlisted ({shortlistedCandidates.length})
        </button>
      )}
    </div>
  );
}
