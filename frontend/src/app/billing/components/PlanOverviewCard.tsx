import React, { useState } from "react";
import { Zap, Coins, AlertTriangle, RefreshCw, ArrowUpRight, CheckCircle2, FileText, UserCheck, Send, Cpu } from "lucide-react";
import { Theme, UserProfile } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export interface PlanOverviewCardProps {
  theme: Theme;
  profile: UserProfile;
  onOpenUpgradeModal: (initialAmount?: number) => void;
  onRefreshProfile: () => Promise<void>;
}

export function PlanOverviewCard({
  theme: t,
  profile,
  onOpenUpgradeModal,
  onRefreshProfile,
}: PlanOverviewCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const G = getGlass(t);

  const isFree = profile.plan === "free";
  const campaignLimit = 5;
  const cvLimit = 100;
  const interviewLimit = 5;

  const campaignsUsed = profile.totalCampaignsCreated || 0;
  const cvsUsed = profile.totalCvsProcessed || 0;
  const interviewsUsed = profile.totalInterviewsSent || 0;

  const isCampaignLimitReached = campaignsUsed >= campaignLimit;
  const isCvLimitReached = cvsUsed >= cvLimit;
  const isInterviewLimitReached = interviewsUsed >= interviewLimit;
  const isAnyLimitReached = isCampaignLimitReached || isCvLimitReached || isInterviewLimitReached;

  const balance = profile.creditBalance ?? 0;
  const balanceInUsd = (balance / 100).toFixed(2);

  // Real capacity calculations based on balance
  const cvCapacity = Math.floor(balance / 1);
  const evalCapacity = Math.floor(balance / 2);
  const inviteCapacity = Math.floor(balance / 1);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      className="rounded-2xl sm:rounded-3xl p-4 sm:p-8 w-full border relative overflow-hidden shadow-xl"
      style={{
        ...G.cardWarm,
        borderColor: isFree
          ? isAnyLimitReached
            ? hexToRgba(t.numNeg, 0.35)
            : hexToRgba(t.accentPrimary, 0.25)
          : hexToRgba(t.accentBadge, 0.3),
      }}
    >
      {/* Top Bar: Plan Tag & Balance Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-2 shadow-sm"
            style={{
              background: isFree ? hexToRgba(t.txtMuted, 0.18) : hexToRgba(t.numPos, 0.14),
              color: isFree ? t.txtSecondary : t.numPos,
              border: `1px solid ${isFree ? hexToRgba(t.txtMuted, 0.3) : hexToRgba(t.numPos, 0.3)}`,
            }}
          >
            {isFree ? (
              <Zap size={13} />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
            {isFree ? "Free Tier Account" : "Paid Tier Pro Account"}
          </span>

          {isFree && isAnyLimitReached && (
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5"
              style={{
                background: hexToRgba(t.numNeg, 0.12),
                color: t.numNeg,
                border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`,
              }}
            >
              <AlertTriangle size={11} />
              Free Quota Exhausted
            </span>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          style={{
            background: hexToRgba(t.bgPage, 0.6),
            borderColor: hexToRgba(t.txtMuted, 0.2),
            color: t.txtSecondary,
          }}
          title="Refresh current balance"
        >
          <RefreshCw size={12} className={isRefreshing ? "animate-spin text-emerald-500" : ""} />
          <span>{isRefreshing ? "Refreshing..." : "Refresh Balance"}</span>
        </button>
      </div>

      {/* Main Body: Asymmetric Grid */}
      {isFree ? (
        /* Free Tier State */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-3.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: t.txtPrimary }}>
              Free Starter Quota
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: t.txtMuted }}>
              Free accounts receive a starter allowance of 5 campaigns, 100 CV parses, and 5 interviews (valid for 1 year). Upgrade to Paid Credits for scalable candidate screening.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onOpenUpgradeModal(10)}
                className="px-5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${t.accentBadge}, ${hexToRgba(t.accentBadge, 0.85)})`,
                  color: "#ffffff",
                  boxShadow: `0 4px 16px ${hexToRgba(t.accentBadge, 0.35)}`,
                }}
              >
                <span>Upgrade to Paid Credits ($10 = 1,000 Credits)</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* Quota Progress Meters */}
          <div className="lg:col-span-6 space-y-3.5">
            {/* Campaigns Quota */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: hexToRgba(t.bgPage, 0.5),
                borderColor: isCampaignLimitReached ? hexToRgba(t.numNeg, 0.4) : hexToRgba(t.txtMuted, 0.2),
              }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: t.txtSecondary }}>Campaigns Created</span>
                <span className="font-bold font-mono" style={{ color: isCampaignLimitReached ? t.numNeg : t.txtPrimary }}>
                  {campaignsUsed} / {campaignLimit}
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (campaignsUsed / campaignLimit) * 100)}%`,
                    background: isCampaignLimitReached ? t.numNeg : t.accentPrimary,
                  }}
                />
              </div>
            </div>

            {/* CV Parsing Quota */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: hexToRgba(t.bgPage, 0.5),
                borderColor: isCvLimitReached ? hexToRgba(t.numNeg, 0.4) : hexToRgba(t.txtMuted, 0.2),
              }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: t.txtSecondary }}>CV Uploads & Parsing</span>
                <span className="font-bold font-mono" style={{ color: isCvLimitReached ? t.numNeg : t.txtPrimary }}>
                  {cvsUsed} / {cvLimit}
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (cvsUsed / cvLimit) * 100)}%`,
                    background: isCvLimitReached ? t.numNeg : t.accentPrimary,
                  }}
                />
              </div>
            </div>

            {/* Interviews Quota */}
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                background: hexToRgba(t.bgPage, 0.5),
                borderColor: isInterviewLimitReached ? hexToRgba(t.numNeg, 0.4) : hexToRgba(t.txtMuted, 0.2),
              }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: t.txtSecondary }}>AI Interviews Conducted</span>
                <span className="font-bold font-mono" style={{ color: isInterviewLimitReached ? t.numNeg : t.txtPrimary }}>
                  {interviewsUsed} / {interviewLimit}
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (interviewsUsed / interviewLimit) * 100)}%`,
                    background: isInterviewLimitReached ? t.numNeg : t.accentPrimary,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Paid Tier State: Asymmetric Hero Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Credit Vault & Quick Top-Up (Col Span 7) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>
                Available Usable Balance
              </div>

              <div className="flex items-baseline gap-3">
                <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight" style={{ color: t.numHero }}>
                  {balance.toLocaleString()}
                </div>
                <span className="text-xl font-bold" style={{ color: t.txtPrimary }}>
                  Credits
                </span>
              </div>

              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold"
                style={{ background: hexToRgba(t.numPos, 0.12), color: t.numPos }}
              >
                <CheckCircle2 size={13} />
                <span>≈ ${balanceInUsd} USD in AI processing & infrastructure power</span>
              </div>
            </div>

            {/* Quick Top-Up Action Strip */}
            <div
              className="pt-4 border-t space-y-2.5"
              style={{ borderColor: hexToRgba(t.txtMuted, 0.15) }}
            >
              <div className="flex items-center justify-between text-xs font-semibold" style={{ color: t.txtMuted }}>
                <span>Instant Top-Up Tiers ($10 = 1,000 Credits)</span>
                <span style={{ color: t.accentBadge }}>Direct Activation</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenUpgradeModal(10)}
                  className="flex-1 min-w-[70px] min-h-[44px] p-2 sm:p-2.5 rounded-xl border text-center transition-all hover:scale-105 active:scale-95 flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    background: hexToRgba(t.bgPage, 0.6),
                    borderColor: hexToRgba(t.txtMuted, 0.2),
                    color: t.txtPrimary,
                  }}
                >
                  <div className="text-xs font-bold font-mono">$10</div>
                  <div className="text-[10px]" style={{ color: t.txtMuted }}>+1,000 Cr</div>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenUpgradeModal(20)}
                  className="flex-1 min-w-[70px] min-h-[44px] p-2 sm:p-2.5 rounded-xl border text-center transition-all hover:scale-105 active:scale-95 flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    background: hexToRgba(t.bgPage, 0.6),
                    borderColor: hexToRgba(t.txtMuted, 0.2),
                    color: t.txtPrimary,
                  }}
                >
                  <div className="text-xs font-bold font-mono">$20</div>
                  <div className="text-[10px]" style={{ color: t.txtMuted }}>+2,000 Cr</div>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenUpgradeModal(50)}
                  className="flex-1 min-w-[70px] min-h-[44px] p-2 sm:p-2.5 rounded-xl border text-center transition-all hover:scale-105 active:scale-95 flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    background: hexToRgba(t.bgPage, 0.6),
                    borderColor: hexToRgba(t.txtMuted, 0.2),
                    color: t.txtPrimary,
                  }}
                >
                  <div className="text-xs font-bold font-mono">$50</div>
                  <div className="text-[10px]" style={{ color: t.txtMuted }}>+5,000 Cr</div>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenUpgradeModal(10)}
                  className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentBadge}, ${hexToRgba(t.accentBadge, 0.85)})`,
                    color: "#ffffff",
                    boxShadow: `0 4px 16px ${hexToRgba(t.accentBadge, 0.35)}`,
                  }}
                >
                  <Coins size={14} />
                  <span>Buy Credits</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: AI Capacity Runway & Lifetime Stats (Col Span 5) */}
          <div
            className="lg:col-span-5 p-5 rounded-2xl border flex flex-col justify-between space-y-4"
            style={{
              background: hexToRgba(t.bgPage, 0.4),
              borderColor: hexToRgba(t.txtMuted, 0.18),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                <Cpu size={14} style={{ color: t.accentBadge }} />
                <span>AI Capacity Runway</span>
              </div>
              <span className="text-[11px] font-mono" style={{ color: t.txtMuted }}>
                {balance.toLocaleString()} Cr Available
              </span>
            </div>

            {/* Capacity Rows */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium" style={{ color: t.txtSecondary }}>
                    <FileText size={12} className="text-blue-500" />
                    <span>CV Screenings</span>
                  </span>
                  <span className="font-bold font-mono" style={{ color: t.txtPrimary }}>
                    {cvCapacity.toLocaleString()} Parses
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                  <div className="h-full rounded-full bg-blue-500" style={{ width: "100%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium" style={{ color: t.txtSecondary }}>
                    <UserCheck size={12} className="text-purple-500" />
                    <span>AI Text Interview</span>
                  </span>
                  <span className="font-bold font-mono" style={{ color: t.txtPrimary }}>
                    {evalCapacity.toLocaleString()} Evals
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                  <div className="h-full rounded-full bg-purple-500" style={{ width: "80%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium" style={{ color: t.txtSecondary }}>
                    <Send size={12} className="text-amber-500" />
                    <span>Candidate Invites</span>
                  </span>
                  <span className="font-bold font-mono" style={{ color: t.txtPrimary }}>
                    {inviteCapacity.toLocaleString()} Emails
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                  <div className="h-full rounded-full bg-amber-500" style={{ width: "90%" }} />
                </div>
              </div>
            </div>

            {/* Lifetime Activity Summary Chips */}
            <div
              className="pt-3 border-t grid grid-cols-3 gap-2 text-center"
              style={{ borderColor: hexToRgba(t.txtMuted, 0.15) }}
            >
              <div
                className="p-2 rounded-xl border"
                style={{ background: hexToRgba(t.bgSurface, 0.4), borderColor: hexToRgba(t.txtMuted, 0.12) }}
              >
                <div className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>
                  {(profile.totalCampaignsCreated ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px]" style={{ color: t.txtMuted }}>Campaigns</div>
              </div>

              <div
                className="p-2 rounded-xl border"
                style={{ background: hexToRgba(t.bgSurface, 0.4), borderColor: hexToRgba(t.txtMuted, 0.12) }}
              >
                <div className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>
                  {(profile.totalCvsProcessed ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px]" style={{ color: t.txtMuted }}>CVs Parsed</div>
              </div>

              <div
                className="p-2 rounded-xl border"
                style={{ background: hexToRgba(t.bgSurface, 0.4), borderColor: hexToRgba(t.txtMuted, 0.12) }}
              >
                <div className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>
                  {(profile.totalInterviewsSent ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px]" style={{ color: t.txtMuted }}>Interviews</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
