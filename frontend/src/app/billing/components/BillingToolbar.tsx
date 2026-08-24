import { Search, X, Receipt, History } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface BillingToolbarProps {
  theme: Theme;
  activeTab: "requests" | "transactions";
  setActiveTab: (tab: "requests" | "transactions") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export function BillingToolbar({
  theme: t,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
}: BillingToolbarProps) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4"
      style={{
        background: hexToRgba(t.bgCard, t.isDark ? 0.08 : 0.35),
        border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.5)}`,
      }}
    >
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 w-full md:w-auto">
        <button
          onClick={() => setActiveTab("requests")}
          className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          style={{
            background: activeTab === "requests" ? hexToRgba(t.accentPrimary, 0.2) : "transparent",
            color: activeTab === "requests" ? t.accentPrimary : t.txtMuted,
            border: activeTab === "requests" ? `1px solid ${hexToRgba(t.accentPrimary, 0.35)}` : "1px solid transparent",
          }}
        >
          <Receipt size={14} />
          <span>Credit Purchase Requests</span>
        </button>

        <button
          onClick={() => setActiveTab("transactions")}
          className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          style={{
            background: activeTab === "transactions" ? hexToRgba(t.accentPrimary, 0.2) : "transparent",
            color: activeTab === "transactions" ? t.accentPrimary : t.txtMuted,
            border: activeTab === "transactions" ? `1px solid ${hexToRgba(t.accentPrimary, 0.35)}` : "1px solid transparent",
          }}
        >
          <History size={14} />
          <span>Transaction Audit Ledger</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative w-full md:w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtMuted }} />
        <input
          type="text"
          placeholder="Search history, description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-xl text-xs outline-none transition-all"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.6),
            color: t.txtPrimary,
            border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.7)}`,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/10 transition-colors"
            style={{ color: t.txtMuted }}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
