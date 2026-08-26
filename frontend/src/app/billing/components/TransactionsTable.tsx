import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  History,
  ArrowDownLeft,
  Briefcase,
  FileText,
  Mail,
  UserCheck,
  Sliders,
  RotateCcw,
  Activity,
  Copy,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Theme, CreditTransaction } from "../../../lib/types";
import { getGlass, hexToRgba } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";

export interface TransactionsTableProps {
  theme: Theme;
  transactions?: CreditTransaction[];
  loading?: boolean;
  error?: string | null;
  searchQuery?: string;
  onRetry?: () => void;
}

type FilterCategory = "all" | "inflow" | "outflow" | "adjustments";

export function TransactionsTable({
  theme: t,
  transactions: propTransactions,
  loading: propLoading,
  error: propError,
  searchQuery: externalSearchQuery = "",
  onRetry,
}: TransactionsTableProps) {
  const G = getGlass(t);
  const queryClient = useQueryClient();

  // Internal TanStack Query when transactions is not passed as prop
  const {
    data: fetchedTransactions,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
  } = useQuery<CreditTransaction[]>({
    queryKey: ["user", "transactions"],
    queryFn: async () => {
      const res = await apiFetch('/api/user/transactions');
      if (!res.ok) {
        throw new Error(`Failed to fetch transactions (${res.status})`);
      }
      return res.json();
    },
    enabled: propTransactions === undefined,
    staleTime: 15_000,
  });

  const transactions = propTransactions !== undefined ? propTransactions : fetchedTransactions || [];
  const loading = propLoading !== undefined ? propLoading : isQueryLoading;
  const error = propError !== undefined ? propError : queryError ? (queryError as Error).message : null;

  // Local State
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pageSize = 10;
  const effectiveSearchQuery = externalSearchQuery || internalSearchQuery;

  // Copy helper
  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = () => {
    if (onRetry) {
      onRetry();
    } else {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["user", "transactions"] });
    }
  };

  // Helper for Type Badges
  const renderTypeBadge = (type: CreditTransaction["type"]) => {
    switch (type) {
      case "purchase":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: hexToRgba(t.numPos, 0.14),
              color: t.numPos,
              border: `1px solid ${hexToRgba(t.numPos, 0.28)}`,
            }}
          >
            <ArrowDownLeft size={12} className="shrink-0" />
            Purchase
          </span>
        );
      case "debit_campaign":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: "rgba(59, 130, 246, 0.12)",
              color: "#3B82F6",
              border: "1px solid rgba(59, 130, 246, 0.25)",
            }}
          >
            <Briefcase size={12} className="shrink-0" />
            Campaign Launch
          </span>
        );
      case "debit_cv":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: "rgba(139, 92, 246, 0.12)",
              color: "#8B5CF6",
              border: "1px solid rgba(139, 92, 246, 0.25)",
            }}
          >
            <FileText size={12} className="shrink-0" />
            CV Parsing
          </span>
        );
      case "debit_invite":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              color: "#F59E0B",
              border: "1px solid rgba(245, 158, 11, 0.25)",
            }}
          >
            <Mail size={12} className="shrink-0" />
            Interview Invite
          </span>
        );
      case "debit_evaluation":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: "rgba(20, 184, 166, 0.12)",
              color: "#14B8A6",
              border: "1px solid rgba(20, 184, 166, 0.25)",
            }}
          >
            <UserCheck size={12} className="shrink-0" />
            AI Evaluation
          </span>
        );
      case "admin_adjustment":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: "rgba(168, 85, 247, 0.12)",
              color: "#A855F7",
              border: "1px solid rgba(168, 85, 247, 0.25)",
            }}
          >
            <Sliders size={12} className="shrink-0" />
            Adjustment
          </span>
        );
      case "refund":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: hexToRgba(t.numPos, 0.14),
              color: t.numPos,
              border: `1px solid ${hexToRgba(t.numPos, 0.28)}`,
            }}
          >
            <RotateCcw size={12} className="shrink-0" />
            Refund
          </span>
        );
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: hexToRgba(t.txtMuted, 0.12),
              color: t.txtSecondary,
              border: `1px solid ${hexToRgba(t.txtMuted, 0.2)}`,
            }}
          >
            <Activity size={12} className="shrink-0" />
            {String(type)}
          </span>
        );
    }
  };

  // Helper for Date formatting
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const datePart = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return { datePart, timePart };
    } catch {
      return { datePart: isoString, timePart: "" };
    }
  };

  // Filter & Search computation
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Category filter
      if (filterCategory === "inflow") {
        if (tx.type !== "purchase" && tx.type !== "refund" && tx.credits <= 0) {
          return false;
        }
      } else if (filterCategory === "outflow") {
        if (!tx.type.startsWith("debit_") && tx.credits >= 0) {
          return false;
        }
      } else if (filterCategory === "adjustments") {
        if (tx.type !== "admin_adjustment") {
          return false;
        }
      }

      // Search query
      if (effectiveSearchQuery.trim()) {
        const q = effectiveSearchQuery.toLowerCase();
        const descMatch = (tx.description || "").toLowerCase().includes(q);
        const typeMatch = (tx.type || "").toLowerCase().includes(q);
        const entityMatch = (tx.relatedEntityId || "").toLowerCase().includes(q);
        const amountMatch = String(tx.credits).includes(q);
        return descMatch || typeMatch || entityMatch || amountMatch;
      }

      return true;
    });
  }, [transactions, filterCategory, effectiveSearchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Handle page reset if filter shrinks list
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, effectiveSearchQuery]);

  return (
    <div className="rounded-2xl border overflow-hidden shadow-xl" style={G.card}>
      {/* Table Header & Controls Bar */}
      <div
        className="p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6),
          borderColor: hexToRgba(t.bgCard, 0.25),
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0"
            style={{
              background: hexToRgba(t.accentPrimary, 0.15),
              color: t.accentPrimary,
            }}
          >
            <History size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: t.txtPrimary }}>
              Transaction Audit Ledger
            </h3>
            <p className="text-xs" style={{ color: t.txtMuted }}>
              Immutable audit history of all credit purchases, automated deductions, and adjustments
            </p>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!externalSearchQuery && (
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: t.txtMuted }}
              />
              <input
                type="text"
                placeholder="Search description, ID..."
                value={internalSearchQuery}
                onChange={(e) => setInternalSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs border outline-none transition-all w-44 sm:w-52"
                style={{
                  background: hexToRgba(t.bgSurface, 0.6),
                  borderColor: hexToRgba(t.txtMuted, 0.2),
                  color: t.txtPrimary,
                }}
              />
            </div>
          )}

          {/* Filter Tabs */}
          <div
            className="flex items-center p-1 rounded-xl border text-xs"
            style={{
              background: hexToRgba(t.bgSurface, 0.4),
              borderColor: hexToRgba(t.txtMuted, 0.2),
            }}
          >
            {(
              [
                { key: "all", label: "All" },
                { key: "inflow", label: "Credits Added" },
                { key: "outflow", label: "Deductions" },
                { key: "adjustments", label: "Adjustments" },
              ] as const
            ).map(({ key, label }) => {
              const active = filterCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilterCategory(key)}
                  className="px-2.5 py-1 rounded-lg font-medium transition-all text-[11px]"
                  style={{
                    background: active ? hexToRgba(t.accentBadge, 0.2) : "transparent",
                    color: active ? t.accentBadge : t.txtMuted,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-xl border transition-colors hover:bg-white/5"
            style={{ borderColor: hexToRgba(t.txtMuted, 0.2), color: t.txtSecondary }}
            title="Refresh transactions"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div
          className="m-4 p-4 rounded-xl border flex items-center justify-between gap-3 text-xs"
          style={{
            background: hexToRgba(t.numNeg, 0.1),
            borderColor: hexToRgba(t.numNeg, 0.25),
            color: t.numNeg,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>Failed to load transaction history: {error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-transform active:scale-95"
            style={{
              background: hexToRgba(t.numNeg, 0.2),
              border: `1px solid ${hexToRgba(t.numNeg, 0.35)}`,
              color: t.numNeg,
            }}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Main Table Content */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.45),
                borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.25)}`,
              }}
            >
              <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>
                Date & Time
              </th>
              <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>
                Category
              </th>
              <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>
                Credits
              </th>
              <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>
                Description
              </th>
              <th className="p-4 text-xs font-semibold text-right" style={{ color: t.txtMuted }}>
                Entity ID / Ref
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loading Skeleton Rows
              Array.from({ length: 5 }).map((_, idx) => (
                <tr
                  key={idx}
                  style={{ borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.12)}` }}
                  className="animate-pulse"
                >
                  <td className="p-4">
                    <div
                      className="h-3.5 w-24 rounded mb-1"
                      style={{ background: hexToRgba(t.txtMuted, 0.18) }}
                    />
                    <div
                      className="h-2.5 w-16 rounded"
                      style={{ background: hexToRgba(t.txtMuted, 0.1) }}
                    />
                  </td>
                  <td className="p-4">
                    <div
                      className="h-6 w-28 rounded-lg"
                      style={{ background: hexToRgba(t.txtMuted, 0.18) }}
                    />
                  </td>
                  <td className="p-4">
                    <div
                      className="h-4 w-16 rounded font-mono"
                      style={{ background: hexToRgba(t.txtMuted, 0.18) }}
                    />
                  </td>
                  <td className="p-4">
                    <div
                      className="h-3.5 w-64 rounded"
                      style={{ background: hexToRgba(t.txtMuted, 0.18) }}
                    />
                  </td>
                  <td className="p-4 text-right">
                    <div
                      className="h-3.5 w-20 rounded ml-auto"
                      style={{ background: hexToRgba(t.txtMuted, 0.12) }}
                    />
                  </td>
                </tr>
              ))
            ) : paginatedTransactions.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <div className="max-w-sm mx-auto space-y-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                      style={{
                        background: hexToRgba(t.txtMuted, 0.12),
                        color: t.txtMuted,
                      }}
                    >
                      <History size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
                        {effectiveSearchQuery || filterCategory !== "all"
                          ? "No matching transactions found"
                          : "No transactions recorded yet"}
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: t.txtMuted }}>
                        {effectiveSearchQuery || filterCategory !== "all"
                          ? "Try adjusting your search terms or category filter selection."
                          : "Your credit purchases, campaign setups, and automated parsing deductions will appear here."}
                      </p>
                    </div>
                    {(effectiveSearchQuery || filterCategory !== "all") && (
                      <button
                        onClick={() => {
                          setInternalSearchQuery("");
                          setFilterCategory("all");
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors inline-flex items-center gap-1.5"
                        style={{
                          background: hexToRgba(t.bgSurface, 0.6),
                          borderColor: hexToRgba(t.txtMuted, 0.25),
                          color: t.txtSecondary,
                        }}
                      >
                        <RotateCcw size={11} />
                        Reset Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              // Populated Table Rows
              paginatedTransactions.map((tx) => {
                const { datePart, timePart } = formatDate(tx.createdAt);
                const isPositive = tx.credits > 0;
                const isNegative = tx.credits < 0;
                const formattedCredits = isPositive
                  ? `+${tx.credits.toLocaleString()}`
                  : tx.credits.toLocaleString();

                return (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.12)}`,
                    }}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Date & Time */}
                    <td className="p-4">
                      <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
                        {datePart}
                      </div>
                      <div className="text-[10px]" style={{ color: t.txtMuted }}>
                        {timePart}
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="p-4">{renderTypeBadge(tx.type)}</td>

                    {/* Credits (+/-) */}
                    <td className="p-4">
                      <span
                        className="text-xs font-bold font-mono inline-flex items-center gap-1"
                        style={{
                          color: isPositive
                            ? t.numPos
                            : isNegative
                            ? t.numNeg
                            : t.txtSecondary,
                        }}
                      >
                        {formattedCredits}
                        <span className="text-[10px] font-normal opacity-80 font-sans">
                          {Math.abs(tx.credits) === 1 ? "credit" : "credits"}
                        </span>
                      </span>
                    </td>

                    {/* Description */}
                    <td className="p-4 max-w-md">
                      <div
                        className="text-xs font-medium leading-snug line-clamp-2"
                        style={{ color: t.txtBody }}
                        title={tx.description}
                      >
                        {tx.description}
                      </div>
                    </td>

                    {/* Related Entity ID */}
                    <td className="p-4 text-right">
                      {tx.relatedEntityId ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span
                            className="text-[11px] font-mono px-2 py-0.5 rounded-md border"
                            style={{
                              background: hexToRgba(t.bgSurface, 0.6),
                              borderColor: hexToRgba(t.txtMuted, 0.2),
                              color: t.txtSecondary,
                            }}
                            title={`Full Entity ID: ${tx.relatedEntityId}`}
                          >
                            {tx.relatedEntityId.length > 12
                              ? `${tx.relatedEntityId.substring(0, 6)}...${tx.relatedEntityId.substring(
                                  tx.relatedEntityId.length - 4
                                )}`
                              : tx.relatedEntityId}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(tx.relatedEntityId!, e)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            style={{ color: copiedId === tx.relatedEntityId ? t.numPos : t.txtMuted }}
                            title="Copy Entity ID"
                          >
                            {copiedId === tx.relatedEntityId ? (
                              <Check size={12} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: t.txtGhost }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && filteredTransactions.length > 0 && (
        <div
          className="px-5 py-3.5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.1 : 0.35),
            borderColor: hexToRgba(t.bgCard, 0.2),
            color: t.txtMuted,
          }}
        >
          <div>
            Showing{" "}
            <strong style={{ color: t.txtPrimary }}>
              {(currentPage - 1) * pageSize + 1}
            </strong>{" "}
            to{" "}
            <strong style={{ color: t.txtPrimary }}>
              {Math.min(currentPage * pageSize, filteredTransactions.length)}
            </strong>{" "}
            of{" "}
            <strong style={{ color: t.txtPrimary }}>
              {filteredTransactions.length}
            </strong>{" "}
            transactions
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: hexToRgba(t.bgSurface, 0.6),
                borderColor: hexToRgba(t.txtMuted, 0.2),
                color: t.txtPrimary,
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2.5 py-1 text-xs font-semibold" style={{ color: t.txtPrimary }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: hexToRgba(t.bgSurface, 0.6),
                borderColor: hexToRgba(t.txtMuted, 0.2),
                color: t.txtPrimary,
              }}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
