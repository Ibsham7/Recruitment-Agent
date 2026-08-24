import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditRequest, Theme } from "../../../lib/types";
import { getGlass, hexToRgba } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Receipt,
  RefreshCw,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { ImagePreviewModal } from "../../components/ImagePreviewModal";

export interface CreditRequestsTableProps {
  theme: Theme;
  requests?: CreditRequest[];
  loading?: boolean;
  error?: string | null;
  searchQuery?: string;
  onRefresh?: () => void;
  onOpenUpgrade?: () => void;
}

export function CreditRequestsTable({
  theme: t,
  requests: propRequests,
  loading: propLoading,
  error: propError,
  searchQuery = "",
  onRefresh,
  onOpenUpgrade,
}: CreditRequestsTableProps) {
  const G = getGlass(t);
  const queryClient = useQueryClient();

  // Internal TanStack Query when propRequests is not passed directly
  const {
    data: fetchedRequests,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
  } = useQuery<CreditRequest[]>({
    queryKey: ["user", "credit-requests"],
    queryFn: async () => {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await apiFetch(`${apiBase}/api/user/credit-requests`);
      if (!res.ok) {
        throw new Error(`Failed to fetch credit requests (${res.status})`);
      }
      return res.json();
    },
    enabled: propRequests === undefined,
    staleTime: 15_000,
  });

  const requests = propRequests !== undefined ? propRequests : fetchedRequests || [];
  const loading = propLoading !== undefined ? propLoading : isQueryLoading;
  const error = propError !== undefined ? propError : queryError ? (queryError as Error).message : null;

  const [selectedStatus, setSelectedStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [previewData, setPreviewData] = useState<{
    url: string;
    title: string;
    metadata?: {
      amount?: number;
      date?: string;
      status?: "pending" | "approved" | "rejected";
      requestId?: string;
    };
  } | null>(null);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["user", "credit-requests"] });
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (selectedStatus !== "all" && req.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = req.id.toLowerCase().includes(q);
        const amountMatch = String(req.amount).includes(q);
        const reasonMatch = (req.rejectionReason || "").toLowerCase().includes(q);
        const statusMatch = req.status.toLowerCase().includes(q);
        return idMatch || amountMatch || reasonMatch || statusMatch;
      }
      return true;
    });
  }, [requests, selectedStatus, searchQuery]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: "pending" | "approved" | "rejected") => {
    if (status === "approved") {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
          style={{
            backgroundColor: hexToRgba(t.numPos, 0.15),
            color: t.numPos,
            border: `1px solid ${hexToRgba(t.numPos, 0.35)}`,
          }}
        >
          <CheckCircle2 size={12} className="shrink-0" />
          Approved
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
          style={{
            backgroundColor: hexToRgba(t.numNeg, 0.15),
            color: t.numNeg,
            border: `1px solid ${hexToRgba(t.numNeg, 0.35)}`,
          }}
        >
          <XCircle size={12} className="shrink-0" />
          Rejected
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
        style={{
          backgroundColor: hexToRgba(t.numMid, 0.15),
          color: t.numMid,
          border: `1px solid ${hexToRgba(t.numMid, 0.35)}`,
        }}
      >
        <Clock size={12} className="shrink-0 animate-pulse" />
        Pending Review
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: t.txtPrimary }}>
            <Receipt size={16} style={{ color: t.accentPrimary }} />
            Credit Purchase Requests
          </h2>
          <p className="text-xs" style={{ color: t.txtMuted }}>
            History of proof-of-payment submissions and administrator verification status
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Tabs */}
          <div
            className="flex items-center p-1 rounded-xl border text-xs"
            style={{
              background: hexToRgba(t.bgSurface, 0.5),
              borderColor: hexToRgba(t.txtMuted, 0.2),
            }}
          >
            {(["all", "pending", "approved", "rejected"] as const).map((st) => {
              const active = selectedStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className="px-2.5 py-1 rounded-lg capitalize transition-all text-[11px] font-medium"
                  style={{
                    background: active ? hexToRgba(t.accentBadge, 0.15) : "transparent",
                    color: active ? t.accentBadge : t.txtMuted,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {st}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-xl border transition-colors hover:bg-white/5"
            style={{ borderColor: hexToRgba(t.txtMuted, 0.2), color: t.txtSecondary }}
            title="Refresh requests"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-4 rounded-xl border flex items-center justify-between text-xs"
          style={{
            background: hexToRgba(t.numNeg, 0.1),
            borderColor: hexToRgba(t.numNeg, 0.25),
            color: t.numNeg,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button onClick={handleRefresh} className="underline font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="rounded-2xl overflow-hidden border p-6 space-y-3" style={G.card}>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-12 rounded-xl animate-pulse"
              style={{ background: hexToRgba(t.bgSurface, 0.6) }}
            />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        /* Empty State */
        <div
          className="p-12 text-center rounded-2xl border flex flex-col items-center justify-center space-y-3 shadow-md"
          style={G.card}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}
          >
            <Receipt size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold" style={{ color: t.txtPrimary }}>
              {selectedStatus === "all" && !searchQuery
                ? "No Credit Requests Submitted"
                : searchQuery
                ? "No requests matching your search"
                : `No ${selectedStatus} requests found`}
            </h3>
            <p className="text-xs max-w-sm" style={{ color: t.txtMuted }}>
              {selectedStatus === "all" && !searchQuery
                ? "When you purchase credits and upload a payment receipt screenshot, your transaction review records will appear here."
                : "Try resetting your filter or search criteria to view all submitted payment proofs."}
            </p>
          </div>

          {onOpenUpgrade && selectedStatus === "all" && !searchQuery ? (
            <button
              onClick={onOpenUpgrade}
              className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-transform active:scale-95 shadow-md"
              style={{
                background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
                color: t.accentText,
              }}
            >
              Purchase Credits
            </button>
          ) : (selectedStatus !== "all" || searchQuery) && (
            <button
              onClick={() => setSelectedStatus("all")}
              className="mt-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors inline-flex items-center gap-1.5"
              style={{
                background: hexToRgba(t.bgSurface, 0.6),
                borderColor: hexToRgba(t.txtMuted, 0.25),
                color: t.txtSecondary,
              }}
            >
              <RotateCcw size={12} />
              Show All Requests
            </button>
          )}
        </div>
      ) : (
        /* Data Table */
        <div className="rounded-2xl overflow-hidden shadow-xl border" style={G.card}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr
                  style={{
                    background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6),
                    borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.3)}`,
                  }}
                >
                  <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Date & ID</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Amount</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Credits</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Receipt Proof</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Status</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Reviewed Date</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Notes / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const creditsEarned = req.creditsAllocated || Math.floor(req.amount * 100);

                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.15)}`,
                      }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {/* Date & Request ID */}
                      <td className="p-4">
                        <div className="text-xs font-medium" style={{ color: t.txtPrimary }}>
                          {formatDate(req.createdAt)}
                        </div>
                        <div className="text-[10px] font-mono" style={{ color: t.txtMuted }}>
                          #{req.id.slice(0, 8)}
                        </div>
                      </td>

                      {/* USD Amount */}
                      <td className="p-4">
                        <span className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>
                          ${req.amount.toFixed(2)}
                        </span>
                      </td>

                      {/* Credits */}
                      <td className="p-4">
                        <span
                          className="text-xs font-semibold font-mono"
                          style={{
                            color: req.status === "rejected" ? t.txtMuted : t.numPos,
                          }}
                        >
                          +{creditsEarned.toLocaleString()} credits
                        </span>
                      </td>

                      {/* Receipt Proof Preview Button */}
                      <td className="p-4">
                        {req.screenshotUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewData({
                                url: req.screenshotUrl,
                                title: `Payment Receipt — $${req.amount.toFixed(2)}`,
                                metadata: {
                                  amount: req.amount,
                                  date: formatDate(req.createdAt),
                                  status: req.status,
                                  requestId: req.id,
                                },
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-white/10 group"
                            style={{
                              borderColor: hexToRgba(t.accentBadge, 0.3),
                              background: hexToRgba(t.accentBadge, 0.08),
                              color: t.accentBadge,
                            }}
                            title="Preview payment receipt"
                          >
                            <Eye size={13} className="group-hover:scale-110 transition-transform" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: t.txtGhost }}>
                            No image
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-4">
                        {renderStatusBadge(req.status)}
                      </td>

                      {/* Reviewed Date */}
                      <td className="p-4">
                        {req.reviewedAt ? (
                          <span className="text-xs" style={{ color: t.txtSecondary }}>
                            {formatDate(req.reviewedAt)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: t.txtGhost }}>
                            —
                          </span>
                        )}
                      </td>

                      {/* Notes / Rejection Reason */}
                      <td className="p-4 max-w-xs">
                        {req.status === "rejected" ? (
                          <div
                            className="p-2 rounded-lg text-[11px] leading-snug border"
                            style={{
                              background: hexToRgba(t.numNeg, 0.1),
                              borderColor: hexToRgba(t.numNeg, 0.25),
                              color: t.numNeg,
                            }}
                          >
                            <span className="font-semibold block">Rejected:</span>
                            {req.rejectionReason || "Payment proof could not be verified."}
                          </div>
                        ) : req.status === "approved" ? (
                          <span className="text-[11px]" style={{ color: t.txtMuted }}>
                            {req.creditsAllocated
                              ? `Added ${req.creditsAllocated.toLocaleString()} credits`
                              : "Credits added to balance"}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: t.txtMuted }}>
                            Awaiting admin review
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image Preview Modal Instance */}
      {previewData && (
        <ImagePreviewModal
          isOpen={Boolean(previewData)}
          onClose={() => setPreviewData(null)}
          imageUrl={previewData.url}
          title={previewData.title}
          theme={t}
          metadata={previewData.metadata}
        />
      )}
    </div>
  );
}
