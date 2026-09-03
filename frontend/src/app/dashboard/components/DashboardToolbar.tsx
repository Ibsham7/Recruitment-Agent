import { Search, X, ArrowUpDown } from "lucide-react";
import { Theme, CampaignStatus } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface DashboardToolbarProps {
  theme: Theme;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: "all" | CampaignStatus;
  setStatusFilter: (status: "all" | CampaignStatus) => void;
  sortBy: "newest" | "oldest" | "candidates" | "match";
  setSortBy: (sort: "newest" | "oldest" | "candidates" | "match") => void;
  totalCampaigns: number;
  activeCount: number;
  pausedCount: number;
  completedCount: number;
}

export function DashboardToolbar({
  theme: t,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  totalCampaigns,
  activeCount,
  pausedCount,
  completedCount,
}: DashboardToolbarProps) {
  return (
    <div 
      className="rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4"
      style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.08 : 0.35), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.50)}` }}
    >
      {/* Search Input */}
      <div className="relative w-full md:w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtMuted }} />
        <input
          type="text"
          placeholder="Search campaigns, roles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs outline-none transition-all"
          style={{ 
            background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.6), 
            color: t.txtPrimary, 
            border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.70)}` 
          }}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md"
            style={{ color: t.txtMuted }}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div 
        className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0 scroll-smooth -mx-0.5 px-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {[
          { id: "all", label: `All (${totalCampaigns})` },
          { id: "active", label: `Active (${activeCount})` },
          { id: "paused", label: `Paused (${pausedCount})` },
          { id: "completed", label: `Completed (${completedCount})` },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className="px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center justify-center shrink-0 active:scale-95"
              style={{
                background: isActive ? hexToRgba(t.accentPrimary, 0.18) : "transparent",
                color: isActive ? t.accentPrimary : t.txtMuted,
                border: isActive ? `1px solid ${hexToRgba(t.accentPrimary, 0.35)}` : "1px solid transparent"
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sort Selector */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
        <ArrowUpDown size={13} style={{ color: t.txtMuted }} className="shrink-0" />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="w-full md:w-auto min-h-[44px] py-2 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
          style={{ 
            background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.6), 
            color: t.txtSecondary,
            border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.70)}` 
          }}
        >
          <option value="newest" style={{ background: t.bgPage, color: t.txtPrimary }}>Newest First</option>
          <option value="oldest" style={{ background: t.bgPage, color: t.txtPrimary }}>Oldest First</option>
          <option value="candidates" style={{ background: t.bgPage, color: t.txtPrimary }}>Most Candidates</option>
          <option value="match" style={{ background: t.bgPage, color: t.txtPrimary }}>Highest Match Score</option>
        </select>
      </div>
    </div>
  );
}
