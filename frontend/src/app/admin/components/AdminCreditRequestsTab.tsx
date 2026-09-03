import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  AlertCircle,
  Coins,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  Ban,
  Loader2,
  Calendar,
} from "lucide-react";
import { Theme, CreditRequest, UserProfile } from "../../../lib/types";
import { getGlass, hexToRgba } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";
import { ImagePreviewModal } from "../../components/ImagePreviewModal";
import { AdminRejectReasonModal } from "./AdminRejectReasonModal";

export type AdminCreditRequestWithUser = CreditRequest & {
  user?: UserProfile;
};

export interface AdminCreditRequestsTabProps {
  theme: Theme;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function AdminCreditRequestsTab({
  theme: t,
  searchQuery: propSearchQuery,
  onSearchChange,
}: AdminCreditRequestsTabProps) {
  const G = getGlass(t);
  const queryClient = useQueryClient();

  // Internal states
  const [internalSearch, setInternalSearch] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal interaction states
  const [rejectingRequest, setRejectingRequest] = useState<AdminCreditRequestWithUser | null>(null);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    title: string;
    description: string;
  } | null>(null);

  // Receipt preview modal state
  const [previewReceipt, setPreviewReceipt] = useState<{
    url: string;
    title: string;
    metadata?: {
      amount?: number;
      date?: string;
      status?: "pending" | "approved" | "rejected";
      requestId?: string;
    };
  } | null>(null);

  const activeSearch = propSearchQuery !== undefined ? propSearchQuery : internalSearch;
  const handleSearchChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalSearch(val);
    }
  };

  // Fetch admin credit requests with TanStack Query
  const {
    data: allRequests = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<AdminCreditRequestWithUser[]>({
    queryKey: ["admin", "credit-requests"],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/credit-requests');
      if (!res.ok) {
        throw new Error(`Failed to load credit requests (${res.status})`);
      }
      return res.json();
    },
    staleTime: 10_000,
  });

  // Calculate high-level summary KPIs
  const stats = useMemo(() => {
    const pendingList = allRequests.filter((r) => r.status === "pending");
    const approvedList = allRequests.filter((r) => r.status === "approved");
    const rejectedList = allRequests.filter((r) => r.status === "rejected");

    const pendingTotalUsd = pendingList.reduce((acc, r) => acc + (r.amount || 0), 0);
    const approvedTotalCredits = approvedList.reduce(
      (acc, r) => acc + (r.creditsAllocated || Math.round((r.amount || 0) * 100)),
      0
    );

    return {
      pendingCount: pendingList.length,
      pendingUsd: pendingTotalUsd,
      approvedCount: approvedList.length,
      approvedCredits: approvedTotalCredits,
      rejectedCount: rejectedList.length,
      totalCount: allRequests.length,
    };
  }, [allRequests]);

  // Filter requests by status tab and search query
  const filteredRequests = useMemo(() => {
    return allRequests.filter((req) => {
      // 1. Status filter
      if (selectedStatus !== "all" && req.status !== selectedStatus) {
        return false;
      }
      // 2. Search query filter
      if (activeSearch.trim()) {
        const q = activeSearch.toLowerCase().trim();
        const idMatch = req.id.toLowerCase().includes(q);
        const emailMatch = (req.user?.email || "").toLowerCase().includes(q);
        const userIdMatch = req.userId.toLowerCase().includes(q);
        const amountMatch = String(req.amount).includes(q);
        const reasonMatch = (req.rejectionReason || "").toLowerCase().includes(q);
        const reviewerMatch = (req.reviewedBy || "").toLowerCase().includes(q);
        return idMatch || emailMatch || userIdMatch || amountMatch || reasonMatch || reviewerMatch;
      }
      return true;
    });
  }, [allRequests, selectedStatus, activeSearch]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Action: Approve Credit Request
  const handleApproveRequest = async (req: AdminCreditRequestWithUser) => {
    try {
      setIsApprovingId(req.id);
      setFeedbackMessage(null);

      const res = await apiFetch(`/api/admin/credit-requests/${req.id}/approve`, {
        method: "POST",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to approve credit request (${res.status})`);
      }

      const data = await res.json();
      const creditsAllocated = data.creditsAllocated || Math.round(req.amount * 100);

      // Invalidate relevant caches across admin and user queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "credit-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["user", "profile"] }),
      ]);

      setFeedbackMessage({
        type: "success",
        title: "Credit Request Approved",
        description: `Successfully allocated +${creditsAllocated.toLocaleString()} credits ($${req.amount.toFixed(
          2
        )} USD) to ${req.user?.email || req.userId}. New balance: ${data.newBalance ?? "updated"}.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        title: "Approval Failed",
        description: err.message || "An unexpected error occurred while approving request.",
      });
    } finally {
      setIsApprovingId(null);
    }
  };

  // Action: Handle Successful Rejection from Modal
  const handleRejectSuccess = async (requestId: string, reason: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "credit-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] }),
    ]);

    setFeedbackMessage({
      type: "success",
      title: "Credit Request Rejected",
      description: `Request #${requestId.slice(0, 8)} has been rejected with reason: "${reason}".`,
    });
  };

  const openPreview = (req: AdminCreditRequestWithUser) => {
    setPreviewReceipt({
      url: req.screenshotUrl,
      title: `Payment Receipt Proof — ${req.user?.email || req.userId}`,
      metadata: {
        amount: req.amount,
        date: formatDate(req.createdAt),
        status: req.status,
        requestId: req.id,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Summary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Card */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            ...G.card,
            borderColor: stats.pendingCount > 0 ? hexToRgba(t.numMid, 0.4) : hexToRgba(t.txtMuted, 0.15),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.txtSecondary }}>
              Pending Review
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: hexToRgba(t.numMid, 0.15),
                color: t.numMid,
              }}
            >
              <Clock size={16} className={stats.pendingCount > 0 ? "animate-pulse" : ""} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono" style={{ color: t.txtPrimary }}>
              {stats.pendingCount}
            </span>
            <span className="text-xs font-medium" style={{ color: t.numMid }}>
              (${stats.pendingUsd.toFixed(2)} USD)
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: t.txtMuted }}>
            {stats.pendingCount === 0 ? "All requests processed!" : "Awaiting administrator action"}
          </p>
        </div>

        {/* Approved Card */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            ...G.card,
            borderColor: hexToRgba(t.numPos, 0.2),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.txtSecondary }}>
              Total Approved
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: hexToRgba(t.numPos, 0.15),
                color: t.numPos,
              }}
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono" style={{ color: t.txtPrimary }}>
              {stats.approvedCount}
            </span>
            <span className="text-xs font-medium" style={{ color: t.numPos }}>
              (+{stats.approvedCredits.toLocaleString()} cr)
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: t.txtMuted }}>
            Successfully allocated credits
          </p>
        </div>

        {/* Rejected Card */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            ...G.card,
            borderColor: hexToRgba(t.numNeg, 0.2),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.txtSecondary }}>
              Total Rejected
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: hexToRgba(t.numNeg, 0.15),
                color: t.numNeg,
              }}
            >
              <XCircle size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono" style={{ color: t.txtPrimary }}>
              {stats.rejectedCount}
            </span>
            <span className="text-xs font-medium" style={{ color: t.txtMuted }}>
              recorded
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: t.txtMuted }}>
            Invalid or unreadable receipts
          </p>
        </div>

        {/* Rate Conversion Card */}
        <div
          className="p-5 rounded-2xl border transition-all"
          style={{
            ...G.card,
            borderColor: hexToRgba(t.accentPrimary, 0.2),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.txtSecondary }}>
              Standard Rate
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: hexToRgba(t.accentPrimary, 0.15),
                color: t.accentPrimary,
              }}
            >
              <Coins size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono" style={{ color: t.accentPrimary }}>
              $1.00 = 100
            </span>
            <span className="text-xs font-medium" style={{ color: t.txtMuted }}>
              Credits
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: t.txtMuted }}>
            Auto-upgrades users to paid tier
          </p>
        </div>
      </div>

      {/* 2. Feedback Notification Toast / Alert */}
      {feedbackMessage && (
        <div
          className="p-4 rounded-2xl border flex items-start justify-between gap-3 animate-in fade-in duration-200"
          style={{
            background:
              feedbackMessage.type === "success"
                ? hexToRgba(t.numPos, 0.12)
                : hexToRgba(t.numNeg, 0.12),
            borderColor:
              feedbackMessage.type === "success"
                ? hexToRgba(t.numPos, 0.3)
                : hexToRgba(t.numNeg, 0.3),
          }}
        >
          <div className="flex items-start gap-3">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: t.numPos }} />
            ) : (
              <AlertCircle size={18} className="shrink-0 mt-0.5" style={{ color: t.numNeg }} />
            )}
            <div>
              <h4
                className="text-xs font-bold"
                style={{
                  color: feedbackMessage.type === "success" ? t.numPos : t.numNeg,
                }}
              >
                {feedbackMessage.title}
              </h4>
              <p className="text-xs mt-0.5" style={{ color: t.txtPrimary }}>
                {feedbackMessage.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="p-1 rounded-lg transition-colors"
            style={{ color: t.txtMuted }}
          >
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* 3. Toolbar: Search, Status Filter Tabs, Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Buttons */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl border self-start"
          style={{
            background: hexToRgba(t.bgSurface, 0.6),
            borderColor: hexToRgba(t.txtMuted, 0.2),
          }}
        >
          {(
            [
              { key: "all", label: "All Requests", count: stats.totalCount, alert: false },
              { key: "pending", label: "Pending", count: stats.pendingCount, alert: stats.pendingCount > 0 },
              { key: "approved", label: "Approved", count: stats.approvedCount, alert: false },
              { key: "rejected", label: "Rejected", count: stats.rejectedCount, alert: false },
            ] as const
          ).map((tab) => {
            const isSelected = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  background: isSelected ? t.bgCard : "transparent",
                  color: isSelected ? t.txtPrimary : t.txtMuted,
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                  border: isSelected ? `1px solid ${hexToRgba(t.txtMuted, 0.2)}` : "1px solid transparent",
                }}
              >
                <span>{tab.label}</span>
                <span
                  className="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
                  style={{
                    background:
                      tab.alert && !isSelected
                        ? hexToRgba(t.numMid, 0.2)
                        : hexToRgba(t.txtMuted, 0.15),
                    color: tab.alert && !isSelected ? t.numMid : t.txtSecondary,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search and Action Bar */}
        <div className="flex items-center gap-2">
          <div
            className="relative flex items-center rounded-xl border px-3 py-1.5 w-full sm:w-72 transition-all"
            style={{
              background: hexToRgba(t.bgSurface, 0.6),
              borderColor: hexToRgba(t.txtMuted, 0.2),
            }}
          >
            <Search size={14} className="shrink-0 mr-2" style={{ color: t.txtMuted }} />
            <input
              type="text"
              placeholder="Search by email, amount, ID..."
              value={activeSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-transparent text-xs w-full focus:outline-none"
              style={{ color: t.txtPrimary }}
            />
            {activeSearch && (
              <button
                onClick={() => handleSearchChange("")}
                className="text-[10px] p-0.5 rounded transition-colors"
                style={{ color: t.txtMuted }}
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="p-2 rounded-xl border flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              background: hexToRgba(t.bgSurface, 0.6),
              borderColor: hexToRgba(t.txtMuted, 0.2),
              color: t.txtSecondary,
            }}
            title="Refresh requests"
          >
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 4. Requests Table Container */}
      <div
        className="rounded-2xl border overflow-hidden shadow-sm transition-all"
        style={{
          ...G.card,
          borderColor: hexToRgba(t.txtMuted, 0.15),
        }}
      >
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 size={28} className="animate-spin" style={{ color: t.accentPrimary }} />
            <p className="text-xs font-medium" style={{ color: t.txtMuted }}>
              Loading credit purchase requests…
            </p>
          </div>
        ) : error ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle size={28} style={{ color: t.numNeg }} />
            <div className="space-y-1">
              <h3 className="text-sm font-bold" style={{ color: t.txtPrimary }}>
                Failed to Load Credit Requests
              </h3>
              <p className="text-xs max-w-sm" style={{ color: t.txtMuted }}>
                {(error as Error).message || "An unexpected error occurred while contacting the server."}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
              style={{
                borderColor: hexToRgba(t.txtMuted, 0.3),
                color: t.txtPrimary,
                background: hexToRgba(t.bgSurface, 0.6),
              }}
            >
              Retry Loading
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: hexToRgba(t.accentPrimary, 0.12), color: t.accentPrimary }}
            >
              <Receipt size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold" style={{ color: t.txtPrimary }}>
                {activeSearch
                  ? "No matching credit requests found"
                  : selectedStatus === "pending"
                  ? "All Pending Requests Processed"
                  : "No credit purchase requests recorded"}
              </h3>
              <p className="text-xs max-w-sm" style={{ color: t.txtMuted }}>
                {activeSearch
                  ? "Try adjusting your search criteria or clearing filters."
                  : selectedStatus === "pending"
                  ? "Great job! All submitted payment proofs have been reviewed."
                  : "User submitted payment screenshot proofs will appear here for review."}
              </p>
            </div>
            {activeSearch && (
              <button
                onClick={() => {
                  handleSearchChange("");
                  setSelectedStatus("all");
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-medium border transition-colors"
                style={{ borderColor: hexToRgba(t.txtMuted, 0.3), color: t.txtPrimary }}
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Mobile Request Cards (md:hidden) */}
            <div className="md:hidden p-3 sm:p-4 space-y-3">
              {filteredRequests.map((req) => {
                const creditsExpected = Math.round(req.amount * 100);
                const isApproving = isApprovingId === req.id;
                const isPdf = req.screenshotUrl?.toLowerCase().includes(".pdf");

                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border space-y-3 shadow-md"
                    style={{
                      background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6),
                      borderColor: hexToRgba(t.bgCard, 0.3),
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs truncate" style={{ color: t.txtPrimary }}>
                          {req.user?.email || "Unknown Email"}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: t.txtMuted }}>
                          #{req.id.slice(0, 8)} · {formatDate(req.createdAt)}
                        </div>
                      </div>
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0"
                        style={{
                          background:
                            req.user?.plan === "paid"
                              ? hexToRgba(t.accentPrimary, 0.15)
                              : hexToRgba(t.txtMuted, 0.15),
                          color: req.user?.plan === "paid" ? t.accentPrimary : t.txtMuted,
                        }}
                      >
                        {req.user?.plan || "free"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/15">
                      <div>
                        <span className="text-[10px] uppercase block" style={{ color: t.txtGhost }}>Amount</span>
                        <span className="font-bold font-mono text-sm" style={{ color: t.numPos }}>
                          ${req.amount.toFixed(2)} USD
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase block" style={{ color: t.txtGhost }}>Credits</span>
                        <span className="font-bold font-mono text-sm" style={{ color: t.txtPrimary }}>
                          +{creditsExpected.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {req.screenshotUrl && (
                      <button
                        onClick={() => openPreview(req)}
                        className="min-h-[44px] w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                        style={{
                          background: hexToRgba(t.bgSurface, 0.6),
                          borderColor: hexToRgba(t.accentPrimary, 0.35),
                          color: t.accentPrimary,
                        }}
                      >
                        {isPdf ? <FileText size={14} /> : <ImageIcon size={14} />}
                        <span>View Payment Receipt</span>
                        <Eye size={12} className="opacity-75" />
                      </button>
                    )}

                    {req.status === "pending" ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          disabled={isApproving}
                          className="min-h-[44px] flex-1 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                          style={{
                            background: `linear-gradient(135deg, ${t.numPos}, ${hexToRgba(t.numPos, 0.85)})`,
                            color: "#FFFFFF",
                          }}
                        >
                          {isApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={() => setRejectingRequest(req)}
                          disabled={isApproving}
                          className="min-h-[44px] flex-1 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border active:scale-95 disabled:opacity-50 cursor-pointer"
                          style={{
                            borderColor: hexToRgba(t.numNeg, 0.4),
                            color: t.numNeg,
                            background: hexToRgba(t.numNeg, 0.08),
                          }}
                        >
                          <Ban size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <div className="pt-1 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                          style={{
                            background:
                              req.status === "approved"
                                ? hexToRgba(t.numPos, 0.15)
                                : hexToRgba(t.numNeg, 0.15),
                            color: req.status === "approved" ? t.numPos : t.numNeg,
                            border: `1px solid ${
                              req.status === "approved"
                                ? hexToRgba(t.numPos, 0.3)
                                : hexToRgba(t.numNeg, 0.3)
                            }`,
                          }}
                        >
                          {req.status === "approved" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          <span className="capitalize">{req.status}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr
                    className="border-b text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      background: hexToRgba(t.bgSurface, 0.7),
                      borderColor: hexToRgba(t.txtMuted, 0.15),
                      color: t.txtSecondary,
                    }}
                  >
                  <th className="py-3.5 px-4">User / Account</th>
                  <th className="py-3.5 px-4">Amount & Credits</th>
                  <th className="py-3.5 px-4">Payment Proof</th>
                  <th className="py-3.5 px-4">Date Submitted</th>
                  <th className="py-3.5 px-4">Status & Audit</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody
                className="divide-y text-xs"
                style={{ borderColor: hexToRgba(t.txtMuted, 0.1) }}
              >
                {filteredRequests.map((req) => {
                  const isPdf = req.screenshotUrl?.toLowerCase().includes(".pdf");
                  const creditsExpected = Math.round(req.amount * 100);
                  const isApproving = isApprovingId === req.id;

                  return (
                    <tr
                      key={req.id}
                      className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      {/* User Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold" style={{ color: t.txtPrimary }}>
                              {req.user?.email || "Unknown Email"}
                            </span>
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                              style={{
                                background:
                                  req.user?.plan === "paid"
                                    ? hexToRgba(t.accentPrimary, 0.15)
                                    : hexToRgba(t.txtMuted, 0.15),
                                color: req.user?.plan === "paid" ? t.accentPrimary : t.txtMuted,
                              }}
                            >
                              {req.user?.plan || "free"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]" style={{ color: t.txtMuted }}>
                            <span>
                              Bal:{" "}
                              <strong style={{ color: t.txtPrimary }}>
                                {req.user?.creditBalance ?? 0}
                              </strong>{" "}
                              credits
                            </span>
                            <span>·</span>
                            <span className="font-mono">#{req.id.slice(0, 8)}</span>
                            <button
                              onClick={() => handleCopyId(req.id)}
                              className="p-0.5 hover:opacity-100 opacity-60 transition-opacity"
                              title="Copy full Request ID"
                            >
                              {copiedId === req.id ? (
                                <Check size={11} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Amount & Credits Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-sm font-mono" style={{ color: t.numPos }}>
                            ${req.amount.toFixed(2)}{" "}
                            <span className="text-[10px] font-sans font-normal" style={{ color: t.txtMuted }}>
                              USD
                            </span>
                          </div>
                          <div className="text-[11px] font-medium" style={{ color: t.txtSecondary }}>
                            +{creditsExpected.toLocaleString()} credits
                          </div>
                        </div>
                      </td>

                      {/* Payment Proof (Receipt) Column */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => openPreview(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all hover:scale-105 shadow-sm"
                          style={{
                            background: hexToRgba(t.bgSurface, 0.6),
                            borderColor: hexToRgba(t.accentPrimary, 0.3),
                            color: t.accentPrimary,
                          }}
                          title="Click to view payment receipt in modal"
                        >
                          {isPdf ? <FileText size={13} /> : <ImageIcon size={13} />}
                          <span>View Proof</span>
                          <Eye size={12} className="opacity-75" />
                        </button>
                      </td>

                      {/* Date Submitted Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: t.txtSecondary }}>
                          <Calendar size={13} className="shrink-0" style={{ color: t.txtMuted }} />
                          <span>{formatDate(req.createdAt)}</span>
                        </div>
                      </td>

                      {/* Status & Audit Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {req.status === "approved" ? (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                                style={{
                                  background: hexToRgba(t.numPos, 0.15),
                                  color: t.numPos,
                                  border: `1px solid ${hexToRgba(t.numPos, 0.3)}`,
                                }}
                              >
                                <CheckCircle2 size={12} />
                                Approved
                              </span>
                              {req.reviewedBy && (
                                <p className="text-[10px] mt-1" style={{ color: t.txtMuted }}>
                                  By {req.reviewedBy.split("@")[0]} · {formatDate(req.reviewedAt)}
                                </p>
                              )}
                            </div>
                          ) : req.status === "rejected" ? (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                                style={{
                                  background: hexToRgba(t.numNeg, 0.15),
                                  color: t.numNeg,
                                  border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`,
                                }}
                              >
                                <XCircle size={12} />
                                Rejected
                              </span>
                              {req.rejectionReason && (
                                <p
                                  className="text-[10px] mt-1 italic max-w-xs truncate"
                                  style={{ color: t.numNeg }}
                                  title={req.rejectionReason}
                                >
                                  "{req.rejectionReason}"
                                </p>
                              )}
                              {req.reviewedBy && (
                                <p className="text-[10px]" style={{ color: t.txtMuted }}>
                                  By {req.reviewedBy.split("@")[0]}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                              style={{
                                background: hexToRgba(t.numMid, 0.15),
                                color: t.numMid,
                                border: `1px solid ${hexToRgba(t.numMid, 0.3)}`,
                              }}
                            >
                              <Clock size={12} className="animate-pulse" />
                              Pending Review
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right">
                        {req.status === "pending" ? (
                          <div className="inline-flex items-center gap-2">
                            {/* Approve Button */}
                            <button
                              onClick={() => handleApproveRequest(req)}
                              disabled={isApproving}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                              style={{
                                background: `linear-gradient(135deg, ${t.numPos}, ${hexToRgba(
                                  t.numPos,
                                  0.85
                                )})`,
                                color: "#FFFFFF",
                              }}
                              title="Approve and allocate credits"
                            >
                              {isApproving ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              <span>Approve</span>
                            </button>

                            {/* Reject Button */}
                            <button
                              onClick={() => setRejectingRequest(req)}
                              disabled={isApproving}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border active:scale-95 disabled:opacity-50"
                              style={{
                                borderColor: hexToRgba(t.numNeg, 0.4),
                                color: t.numNeg,
                                background: hexToRgba(t.numNeg, 0.08),
                              }}
                              title="Reject with audit reason"
                            >
                              <Ban size={13} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono" style={{ color: t.txtMuted }}>
                            Completed
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
    </div>

      {/* 5. Image Preview Modal for Receipts */}
      <ImagePreviewModal
        isOpen={previewReceipt !== null}
        onClose={() => setPreviewReceipt(null)}
        imageUrl={previewReceipt?.url || null}
        title={previewReceipt?.title}
        metadata={previewReceipt?.metadata}
        theme={t}
      />

      {/* 6. Admin Rejection Reason Modal */}
      <AdminRejectReasonModal
        isOpen={rejectingRequest !== null}
        onClose={() => setRejectingRequest(null)}
        request={rejectingRequest}
        onRejectSuccess={handleRejectSuccess}
        theme={t}
      />
    </div>
  );
}
