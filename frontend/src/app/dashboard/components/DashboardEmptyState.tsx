import { Filter } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface DashboardEmptyStateProps {
  theme: Theme;
  searchQuery: string;
  statusFilter: string;
  onClearFilters: () => void;
  onNavigateSetup: () => void;
}

export function DashboardEmptyState({
  theme: t,
  searchQuery,
  statusFilter,
  onClearFilters,
  onNavigateSetup,
}: DashboardEmptyStateProps) {
  const hasFilters = Boolean(searchQuery || statusFilter !== "all");

  return (
    <div 
      className="rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3"
      style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.05 : 0.25), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.40)}` }}
    >
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: hexToRgba(t.accentPrimary, 0.12), color: t.accentPrimary }}>
        <Filter size={24} />
      </div>
      <h3 className="text-base font-semibold" style={{ color: t.txtPrimary }}>
        {hasFilters ? "No matching campaigns found" : "No campaigns created yet"}
      </h3>
      <p className="text-xs max-w-sm" style={{ color: t.txtMuted }}>
        {hasFilters
          ? "Try adjusting your search criteria or clearing filters to see results."
          : "Launch your first AI recruitment campaign to screen CVs and rank top candidates automatically."}
      </p>
      {hasFilters ? (
        <button
          onClick={onClearFilters}
          className="px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all"
          style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary, border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}` }}
        >
          Clear Filters
        </button>
      ) : (
        <button
          onClick={onNavigateSetup}
          className="px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all"
          style={{ background: t.accentPrimary, color: t.accentText }}
        >
          + Create Campaign
        </button>
      )}
    </div>
  );
}
