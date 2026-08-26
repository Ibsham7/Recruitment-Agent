import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  Users,
  Clock,
  Briefcase,
  FileText,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Coins,
  BarChart3,
} from "lucide-react";
import { Theme, AdminStats } from "../../../lib/types";
import { hexToRgba, hexToRgb, getGlass } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";
import { supabase } from "../../../lib/supabase";
import { ParticleCard } from "../../../components/common/MagicBento";

export interface AdminStatsTabProps {
  theme: Theme;
  onNavigateTab?: (tab: "users" | "requests" | "stats") => void;
}

export function AdminStatsTab({ theme: t, onNavigateTab }: AdminStatsTabProps) {
  const G = getGlass(t);
  const glow = hexToRgb(t.accentPrimary);
  const queryClient = useQueryClient();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // TanStack Query: Fetch Platform Stats
  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/stats');
      if (!res.ok) {
        throw new Error(`Failed to load admin stats (HTTP ${res.status})`);
      }
      return res.json();
    },
    staleTime: 15_000,
  });

  // Supabase Realtime Subscription for Live Invalidation
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const channel = supabase
      .channel("admin-stats-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "CreditRequest" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        }, 800);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "UserProfile" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        }, 800);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 400);
    }
  };

  // Calculated Ratios & Metrics
  const metrics = useMemo(() => {
    if (!stats) return null;
    const totalUsers = stats.totalUsers || 0;
    const paidUsers = stats.planBreakdown?.paid || 0;
    const freeUsers = stats.planBreakdown?.free || 0;
    const totalCampaigns = stats.totalCampaignsCreated || 0;
    const totalCvs = stats.totalCvsProcessed || 0;
    const totalInterviews = stats.totalInterviewsSent || 0;
    const totalRevenue = stats.totalRevenue || 0;

    const paidPercentage = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;
    const freePercentage = totalUsers > 0 ? (freeUsers / totalUsers) * 100 : 0;
    const avgCvsPerUser = totalUsers > 0 ? (totalCvs / totalUsers).toFixed(1) : "0.0";
    const avgCampaignsPerUser = totalUsers > 0 ? (totalCampaigns / totalUsers).toFixed(1) : "0.0";
    const avgCvsPerCampaign = totalCampaigns > 0 ? (totalCvs / totalCampaigns).toFixed(1) : "0.0";
    const avgInterviewsPerCampaign = totalCampaigns > 0 ? (totalInterviews / totalCampaigns).toFixed(1) : "0.0";
    const arpu = totalUsers > 0 ? (totalRevenue / totalUsers).toFixed(2) : "0.00";
    const arppu = paidUsers > 0 ? (totalRevenue / paidUsers).toFixed(2) : "0.00";

    return {
      paidPercentage,
      freePercentage,
      avgCvsPerUser,
      avgCampaignsPerUser,
      avgCvsPerCampaign,
      avgInterviewsPerCampaign,
      arpu,
      arppu,
    };
  }, [stats]);

  // Loading Skeleton State
  if (isLoading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 rounded-2xl bg-white/5 border border-white/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-8 w-20 bg-white/15 rounded" />
              <div className="h-3 w-32 bg-white/10 rounded" />
            </div>
          ))}
        </div>
        <div className="h-48 rounded-2xl bg-white/5 border border-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/5 border border-white/10" />
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (isError || !stats) {
    return (
      <div
        className="rounded-2xl p-8 border text-center space-y-4 max-w-lg mx-auto my-12"
        style={{
          background: hexToRgba(t.numNeg, 0.08),
          borderColor: hexToRgba(t.numNeg, 0.25),
        }}
      >
        <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-red-500/20 text-red-400">
          <AlertCircle size={24} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: t.txtPrimary }}>
            Failed to Load System Statistics
          </h3>
          <p className="text-xs mt-1" style={{ color: t.txtMuted }}>
            {error instanceof Error ? error.message : "An unexpected server error occurred."}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 mx-auto transition-all active:scale-95 shadow-md"
          style={{
            background: t.accentPrimary,
            color: t.accentText,
          }}
        >
          <RefreshCw size={14} />
          Retry Request
        </button>
      </div>
    );
  }

  const hasPending = stats.pendingRequestsCount > 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: t.txtPrimary }}>
            System Telemetry & Platform Analytics
          </h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: t.txtMuted }}>
            Real-time platform aggregation across registered accounts, compute operations, and payment ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-[11px] hidden sm:inline-block" style={{ color: t.txtMuted }}>
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={isManualRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm"
            style={{
              background: hexToRgba(t.bgPage, 0.6),
              borderColor: hexToRgba(t.txtMuted, 0.25),
              color: t.txtSecondary,
            }}
            title="Refresh telemetry data"
          >
            <RefreshCw size={13} className={isManualRefreshing ? "animate-spin text-emerald-400" : ""} />
            <span>{isManualRefreshing ? "Refreshing..." : "Refresh Metrics"}</span>
          </button>
        </div>
      </div>

      {/* Actionable Pending Reviews Banner */}
      {hasPending ? (
        <div
          className="rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg transition-all"
          style={{
            background: `linear-gradient(135deg, ${hexToRgba(t.numMid, 0.14)}, ${hexToRgba(t.bgCard, 0.7)})`,
            borderColor: hexToRgba(t.numMid, 0.45),
          }}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className="p-2.5 rounded-xl shrink-0 flex items-center justify-center"
              style={{
                background: hexToRgba(t.numMid, 0.22),
                color: t.numMid,
              }}
            >
              <Clock size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: hexToRgba(t.numMid, 0.25), color: t.numMid }}>
                  Action Required
                </span>
                <span className="text-sm font-semibold" style={{ color: t.txtPrimary }}>
                  {stats.pendingRequestsCount} Payment Proof {stats.pendingRequestsCount === 1 ? "Request" : "Requests"} Pending
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: t.txtSecondary }}>
                Users have submitted payment screenshots awaiting admin verification and credit allocation ($1 = 100 credits).
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab?.("requests")}
            className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 self-start sm:self-center transition-all hover:scale-105 active:scale-95 shadow-md"
            style={{
              background: t.numMid,
              color: "#000000",
            }}
          >
            <span>Review Requests</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl p-3.5 px-4.5 border flex items-center justify-between gap-3"
          style={{
            background: hexToRgba(t.numPos, 0.07),
            borderColor: hexToRgba(t.numPos, 0.22),
          }}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} style={{ color: t.numPos }} />
            <span className="text-xs font-medium" style={{ color: t.txtPrimary }}>
              Billing queue is up to date. Zero pending credit purchase requests.
            </span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: hexToRgba(t.numPos, 0.15), color: t.numPos }}>
            All Cleared
          </span>
        </div>
      )}

      {/* Top-Level KPI Metric Cards (4 Bento Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Platform Revenue */}
        <ParticleCard
          className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5 border relative overflow-hidden"
          style={{
            "--glow-color": glow,
            ...G.cardWarm,
            borderColor: hexToRgba(t.numHero, 0.3),
          } as React.CSSProperties}
          glowColor={glow}
          particleCount={8}
          enableTilt={true}
          clickEffect={true}
          enableMagnetism={true}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              Platform Revenue
            </div>
            <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.numHero, 0.15), color: t.numHero }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold leading-none mb-1.5 font-sans" style={{ color: t.numHero }}>
            ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] flex items-center justify-between" style={{ color: t.txtGhost }}>
            <span>Approved Purchases</span>
            <span className="font-semibold" style={{ color: t.txtSecondary }}>
              ${metrics?.arppu} / paid user
            </span>
          </div>
        </ParticleCard>

        {/* Total Registered Users */}
        <ParticleCard
          className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5 border relative overflow-hidden"
          style={{
            "--glow-color": glow,
            ...G.cardWarm,
            borderColor: hexToRgba(t.accentPrimary, 0.3),
          } as React.CSSProperties}
          glowColor={glow}
          particleCount={8}
          enableTilt={true}
          clickEffect={true}
          enableMagnetism={true}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              Total Users
            </div>
            <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentBadge }}>
              <Users size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold leading-none mb-1.5 font-sans" style={{ color: t.txtPrimary }}>
            {stats.totalUsers.toLocaleString()}
          </div>
          <div className="text-[11px] flex items-center justify-between" style={{ color: t.txtGhost }}>
            <span>{stats.planBreakdown.paid} Paid · {stats.planBreakdown.free} Free</span>
            <span className="font-semibold" style={{ color: t.accentBadge }}>
              {metrics?.paidPercentage.toFixed(0)}% Paid
            </span>
          </div>
        </ParticleCard>

        {/* Total Credits Allocated */}
        <ParticleCard
          className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5 border relative overflow-hidden"
          style={{
            "--glow-color": glow,
            ...G.cardWarm,
            borderColor: hexToRgba(t.accentBadge, 0.25),
          } as React.CSSProperties}
          glowColor={glow}
          particleCount={8}
          enableTilt={true}
          clickEffect={true}
          enableMagnetism={true}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              Credits Allocated
            </div>
            <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}>
              <Coins size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold leading-none mb-1.5 font-sans" style={{ color: t.txtPrimary }}>
            {stats.totalCreditsAllocated.toLocaleString()}
          </div>
          <div className="text-[11px] flex items-center justify-between" style={{ color: t.txtGhost }}>
            <span>$1 = 100 Credits Rubric</span>
            <span className="font-semibold" style={{ color: t.txtSecondary }}>Top-up Ledger</span>
          </div>
        </ParticleCard>

        {/* Pending Requests Backlog */}
        <ParticleCard
          className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5 border relative overflow-hidden"
          style={{
            "--glow-color": glow,
            ...G.cardWarm,
            borderColor: hasPending ? hexToRgba(t.numMid, 0.4) : hexToRgba(t.txtMuted, 0.25),
          } as React.CSSProperties}
          glowColor={glow}
          particleCount={8}
          enableTilt={true}
          clickEffect={true}
          enableMagnetism={true}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              Review Backlog
            </div>
            <div
              className="p-1.5 rounded-lg"
              style={{
                background: hasPending ? hexToRgba(t.numMid, 0.15) : hexToRgba(t.numPos, 0.15),
                color: hasPending ? t.numMid : t.numPos,
              }}
            >
              <Clock size={16} />
            </div>
          </div>
          <div
            className="text-3xl font-bold leading-none mb-1.5 font-sans"
            style={{ color: hasPending ? t.numMid : t.numPos }}
          >
            {stats.pendingRequestsCount}
          </div>
          <div className="text-[11px] flex items-center justify-between" style={{ color: t.txtGhost }}>
            <span>{hasPending ? "Awaiting verification" : "Queue fully cleared"}</span>
            {hasPending && (
              <button
                onClick={() => onNavigateTab?.("requests")}
                className="font-bold underline hover:opacity-80"
                style={{ color: t.numMid }}
              >
                Review &rarr;
              </button>
            )}
          </div>
        </ParticleCard>
      </div>

      {/* Subscription Plan Distribution Visualizer */}
      <div
        className="rounded-3xl p-6 sm:p-7 border relative overflow-hidden shadow-xl"
        style={{
          ...G.cardWarm,
          borderColor: hexToRgba(t.accentPrimary, 0.25),
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={18} style={{ color: t.accentBadge }} />
              <h3 className="text-base sm:text-lg font-bold tracking-tight" style={{ color: t.txtPrimary }}>
                Subscription Tier Distribution
              </h3>
            </div>
            <p className="text-xs" style={{ color: t.txtMuted }}>
              Proportional distribution of registered users on Free Tier lifetime quotas versus Paid Credit accounts.
            </p>
          </div>

          {/* Conversion Metric Badge */}
          <div
            className="px-4 py-2 rounded-2xl border flex items-center gap-3 self-start md:self-auto"
            style={{
              background: hexToRgba(t.bgPage, 0.6),
              borderColor: hexToRgba(t.txtMuted, 0.2),
            }}
          >
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: t.txtMuted }}>
                Paid Conversion
              </div>
              <div className="text-sm font-extrabold" style={{ color: t.numHero }}>
                {metrics?.paidPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="h-7 w-[1px] bg-white/10" />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: t.txtMuted }}>
                Avg Rev / User
              </div>
              <div className="text-sm font-extrabold" style={{ color: t.txtPrimary }}>
                ${metrics?.arpu}
              </div>
            </div>
          </div>
        </div>

        {/* Proportional Segmented Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-white/5 p-0.5 border border-white/10">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(metrics?.paidPercentage || 0, stats.totalUsers === 0 ? 0 : 2)}%`,
                background: `linear-gradient(90deg, ${t.accentBadge}, ${t.accentPrimary})`,
                boxShadow: `0 0 12px ${hexToRgba(t.accentBadge, 0.5)}`,
              }}
              title={`Paid Tier: ${stats.planBreakdown.paid} users (${metrics?.paidPercentage.toFixed(1)}%)`}
            />
            <div
              className="h-full rounded-full transition-all duration-700 ease-out opacity-40 ml-0.5"
              style={{
                width: `${Math.max(metrics?.freePercentage || 0, stats.totalUsers === 0 ? 0 : 2)}%`,
                background: t.txtSecondary,
              }}
              title={`Free Tier: ${stats.planBreakdown.free} users (${metrics?.freePercentage.toFixed(1)}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-semibold px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.accentBadge }} />
              <span style={{ color: t.txtPrimary }}>
                Paid Tier: <span className="font-extrabold">{stats.planBreakdown.paid}</span> ({metrics?.paidPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full opacity-60" style={{ background: t.txtSecondary }} />
              <span style={{ color: t.txtSecondary }}>
                Free Tier: <span className="font-extrabold">{stats.planBreakdown.free}</span> ({metrics?.freePercentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Comparison Subcards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Paid Tier Card */}
          <div
            className="p-4 rounded-2xl border space-y-2"
            style={{
              background: hexToRgba(t.bgPage, 0.5),
              borderColor: hexToRgba(t.accentBadge, 0.3),
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: t.accentBadge }}>
                <Coins size={14} /> Paid Pro Accounts
              </span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-md" style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}>
                {stats.planBreakdown.paid} Users
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>
              Accounts operating on the pay-as-you-go credit model ($1 = 100 credits). Enjoy unlimited campaigns, batch CV evaluations (1 credit/CV), and candidate interviews (1 credit/invite, 2 credits/eval).
            </p>
            <div className="text-[11px] pt-1 flex items-center justify-between border-t border-white/5" style={{ color: t.txtMuted }}>
              <span>Total Revenue Generated</span>
              <span className="font-bold" style={{ color: t.numHero }}>${stats.totalRevenue.toFixed(2)}</span>
            </div>
          </div>

          {/* Free Tier Card */}
          <div
            className="p-4 rounded-2xl border space-y-2"
            style={{
              background: hexToRgba(t.bgPage, 0.5),
              borderColor: hexToRgba(t.txtMuted, 0.25),
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: t.txtSecondary }}>
                <Zap size={14} /> Free Tier Accounts
              </span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-md" style={{ background: hexToRgba(t.txtMuted, 0.18), color: t.txtSecondary }}>
                {stats.planBreakdown.free} Users
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>
              Accounts operating on fixed lifetime quotas (5 campaigns, 100 CV parses, 5 interviews). Automatically prompted to upgrade to Paid Credits when limits are exhausted.
            </p>
            <div className="text-[11px] pt-1 flex items-center justify-between border-t border-white/5" style={{ color: t.txtMuted }}>
              <span>Upgrade Pipeline</span>
              <span className="font-bold" style={{ color: t.txtSecondary }}>{stats.planBreakdown.free} Potential Conversions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Compute Volume & Usage Telemetry (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CV / Resume Ingestion */}
        <div
          className="rounded-2xl p-5 border space-y-3 shadow-md relative overflow-hidden"
          style={{
            ...G.cardWarm,
            borderColor: hexToRgba(t.accentPrimary, 0.2),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              CV / Resume Ingestion
            </span>
            <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentBadge }}>
              <FileText size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-sans" style={{ color: t.txtPrimary }}>
            {stats.totalCvsProcessed.toLocaleString()}
          </div>
          <p className="text-xs" style={{ color: t.txtSecondary }}>
            Total candidate CVs parsed and evaluated across all pipelines.
          </p>
          <div className="pt-2 border-t border-white/5 space-y-1 text-xs">
            <div className="flex items-center justify-between" style={{ color: t.txtMuted }}>
              <span>Avg per User:</span>
              <span className="font-bold" style={{ color: t.txtPrimary }}>{metrics?.avgCvsPerUser} CVs</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: t.txtMuted }}>
              <span>Avg per Campaign:</span>
              <span className="font-bold" style={{ color: t.txtPrimary }}>{metrics?.avgCvsPerCampaign} CVs</span>
            </div>
          </div>
        </div>

        {/* Campaign Orchestration */}
        <div
          className="rounded-2xl p-5 border space-y-3 shadow-md relative overflow-hidden"
          style={{
            ...G.cardWarm,
            borderColor: hexToRgba(t.accentPrimary, 0.2),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              Hiring Campaigns
            </span>
            <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentBadge }}>
              <Briefcase size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-sans" style={{ color: t.txtPrimary }}>
            {stats.totalCampaignsCreated.toLocaleString()}
          </div>
          <p className="text-xs" style={{ color: t.txtSecondary }}>
            Total job recruitment campaigns orchestrated platform-wide.
          </p>
          <div className="pt-2 border-t border-white/5 space-y-1 text-xs">
            <div className="flex items-center justify-between" style={{ color: t.txtMuted }}>
              <span>Avg per User:</span>
              <span className="font-bold" style={{ color: t.txtPrimary }}>{metrics?.avgCampaignsPerUser} Campaigns</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: t.txtMuted }}>
              <span>Campaign Cost:</span>
              <span className="font-bold" style={{ color: t.accentBadge }}>1 Credit Upfront</span>
            </div>
          </div>
        </div>

        {/* Candidate Interview Delivery */}
        <div
          className="rounded-2xl p-5 border space-y-3 shadow-md relative overflow-hidden"
          style={{
            ...G.cardWarm,
            borderColor: hexToRgba(t.accentPrimary, 0.2),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              AI Interview Invitations
            </span>
            <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentBadge }}>
              <Send size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-sans" style={{ color: t.txtPrimary }}>
            {stats.totalInterviewsSent.toLocaleString()}
          </div>
          <p className="text-xs" style={{ color: t.txtSecondary }}>
            Candidate interview invitations dispatched across all roles.
          </p>
          <div className="pt-2 border-t border-white/5 space-y-1 text-xs">
            <div className="flex items-center justify-between" style={{ color: t.txtMuted }}>
              <span>Avg per Campaign:</span>
              <span className="font-bold" style={{ color: t.txtPrimary }}>{metrics?.avgInterviewsPerCampaign} Invites</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: t.txtMuted }}>
              <span>Rubric Rate:</span>
              <span className="font-bold" style={{ color: t.accentBadge }}>1 credit / invite</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Economics & Ratio Summary */}
      <div
        className="rounded-2xl p-5 border flex flex-wrap items-center justify-between gap-4"
        style={{
          background: hexToRgba(t.bgPage, 0.4),
          borderColor: hexToRgba(t.txtMuted, 0.2),
        }}
      >
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} style={{ color: t.numHero }} />
          <div>
            <div className="text-xs font-bold" style={{ color: t.txtPrimary }}>
              Platform Unit Economics Overview
            </div>
            <div className="text-[11px]" style={{ color: t.txtMuted }}>
              Financial and compute metrics derived directly from immutable database records.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span style={{ color: t.txtMuted }}>Gross Revenue: </span>
            <span className="font-bold" style={{ color: t.numHero }}>${stats.totalRevenue.toFixed(2)}</span>
          </div>
          <div className="hidden sm:block h-3.5 w-[1px] bg-white/10" />
          <div>
            <span style={{ color: t.txtMuted }}>Credits Minted: </span>
            <span className="font-bold" style={{ color: t.txtPrimary }}>{stats.totalCreditsAllocated.toLocaleString()}</span>
          </div>
          <div className="hidden sm:block h-3.5 w-[1px] bg-white/10" />
          <div>
            <span style={{ color: t.txtMuted }}>ARPPU: </span>
            <span className="font-bold" style={{ color: t.accentBadge }}>${metrics?.arppu}</span>
          </div>
          <div className="hidden sm:block h-3.5 w-[1px] bg-white/10" />
          <div>
            <span style={{ color: t.txtMuted }}>Pending Backlog: </span>
            <span className="font-bold" style={{ color: hasPending ? t.numMid : t.numPos }}>
              {stats.pendingRequestsCount} {stats.pendingRequestsCount === 1 ? "request" : "requests"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
