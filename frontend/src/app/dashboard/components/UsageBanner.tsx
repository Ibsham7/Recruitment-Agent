import { useState } from "react";
import { Zap, AlertTriangle, Coins } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { useAuth } from "../../../lib/AuthContext";
import { useNavigate } from "react-router";
import { UpgradeModal } from "./UpgradeModal";

interface UsageBannerProps {
  theme: Theme;
}

export function UsageBanner({ theme: t }: UsageBannerProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  if (!profile) return null;

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

  return (
    <>
      <div
        className="w-full rounded-2xl p-4 sm:p-5 border relative overflow-hidden transition-all shadow-sm"
        style={{
          background: isFree
            ? isAnyLimitReached
              ? `linear-gradient(135deg, ${hexToRgba(t.numNeg, 0.08)}, ${hexToRgba(t.bgCard, 0.85)})`
              : `linear-gradient(135deg, ${hexToRgba(t.accentPrimary, 0.08)}, ${hexToRgba(t.bgCard, 0.85)})`
            : `linear-gradient(135deg, ${hexToRgba(t.accentBadge, 0.08)}, ${hexToRgba(t.bgCard, 0.85)})`,
          borderColor: isFree
            ? isAnyLimitReached
              ? hexToRgba(t.numNeg, 0.3)
              : hexToRgba(t.accentPrimary, 0.22)
            : hexToRgba(t.accentBadge, 0.22),
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Info Column */}
          <div className="space-y-1.5 min-w-0 sm:min-w-[240px] w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1"
                style={{
                  background: isFree ? hexToRgba(t.txtMuted, 0.15) : hexToRgba(t.accentBadge, 0.18),
                  color: isFree ? t.txtSecondary : t.accentBadge,
                  border: `1px solid ${isFree ? hexToRgba(t.txtMuted, 0.25) : hexToRgba(t.accentBadge, 0.3)}`,
                }}
              >
                {isFree ? <Zap size={10} /> : <Coins size={10} />}
                {isFree ? "Free Tier" : "Paid Tier"}
              </span>

              {isFree && isAnyLimitReached && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1"
                  style={{
                    background: hexToRgba(t.numNeg, 0.15),
                    color: t.numNeg,
                  }}
                >
                  <AlertTriangle size={10} />
                  Limit Reached
                </span>
              )}
            </div>

            <h3 className="text-sm font-semibold" style={{ color: t.txtPrimary }}>
              {isFree ? "Free Starter Quota Usage" : "Credit Balance & Resource Usage"}
            </h3>
            <p className="text-xs max-w-md" style={{ color: t.txtMuted }}>
              {isFree
                ? "You have access to 5 campaigns, 100 CV parsing runs, and 5 interviews on the free plan."
                : `Active balance: ${(profile.creditBalance ?? 0).toLocaleString()} Credits. 1 credit = 1 CV parse, 1 campaign, or 1 invite.`}
            </p>
          </div>

          {/* Center Usage Indicators */}
          {isFree ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1 w-full max-w-2xl">
              {/* Campaigns Quota */}
              <div
                className="p-2.5 rounded-xl border space-y-1"
                style={{
                  background: hexToRgba(t.bgPage, 0.5),
                  borderColor: isCampaignLimitReached ? hexToRgba(t.numNeg, 0.35) : hexToRgba(t.txtMuted, 0.15),
                }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: t.txtSecondary }}>Campaigns</span>
                  <span
                    className="font-bold"
                    style={{ color: isCampaignLimitReached ? t.numNeg : t.txtPrimary }}
                  >
                    {campaignsUsed} / {campaignLimit}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (campaignsUsed / campaignLimit) * 100)}%`,
                      background: isCampaignLimitReached ? t.numNeg : t.accentPrimary,
                    }}
                  />
                </div>
              </div>

              {/* CV Parsing Quota */}
              <div
                className="p-2.5 rounded-xl border space-y-1"
                style={{
                  background: hexToRgba(t.bgPage, 0.5),
                  borderColor: isCvLimitReached ? hexToRgba(t.numNeg, 0.35) : hexToRgba(t.txtMuted, 0.15),
                }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: t.txtSecondary }}>CV Uploads</span>
                  <span
                    className="font-bold"
                    style={{ color: isCvLimitReached ? t.numNeg : t.txtPrimary }}
                  >
                    {cvsUsed} / {cvLimit}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (cvsUsed / cvLimit) * 100)}%`,
                      background: isCvLimitReached ? t.numNeg : t.accentPrimary,
                    }}
                  />
                </div>
              </div>

              {/* Interview Quota */}
              <div
                className="p-2.5 rounded-xl border space-y-1"
                style={{
                  background: hexToRgba(t.bgPage, 0.5),
                  borderColor: isInterviewLimitReached ? hexToRgba(t.numNeg, 0.35) : hexToRgba(t.txtMuted, 0.15),
                }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: t.txtSecondary }}>Interviews</span>
                  <span
                    className="font-bold"
                    style={{ color: isInterviewLimitReached ? t.numNeg : t.txtPrimary }}
                  >
                    {interviewsUsed} / {interviewLimit}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.txtMuted, 0.15) }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (interviewsUsed / interviewLimit) * 100)}%`,
                      background: isInterviewLimitReached ? t.numNeg : t.accentPrimary,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 flex-1 justify-start lg:justify-center w-full lg:w-auto">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0"
                  style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}
                >
                  <Coins size={20} />
                </div>
                <div>
                  <div className="text-base font-bold" style={{ color: t.txtPrimary }}>
                    {(profile.creditBalance ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px]" style={{ color: t.txtMuted }}>
                    Available Credits
                  </div>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px" style={{ background: hexToRgba(t.txtMuted, 0.15) }} />

              <div>
                <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
                  {(profile.totalCvsProcessed ?? 0).toLocaleString()} CVs
                </div>
                <div className="text-[11px]" style={{ color: t.txtMuted }}>
                  Total Lifetime Processed
                </div>
              </div>
            </div>
          )}

          {/* Right Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            {isFree ? (
              <button
                onClick={() => setModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
                  color: t.accentText,
                  boxShadow: `0 2px 10px ${hexToRgba(t.accentPrimary, 0.25)}`,
                }}
              >
                <Zap size={13} />
                <span>Upgrade / Buy Credits</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/billing")}
                  className="w-full sm:w-auto px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-medium border transition-colors flex items-center justify-center"
                  style={{
                    background: hexToRgba(t.bgPage, 0.6),
                    borderColor: hexToRgba(t.txtMuted, 0.2),
                    color: t.txtSecondary,
                  }}
                >
                  Billing History
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentBadge}, ${hexToRgba(t.accentBadge, 0.85)})`,
                    color: "#ffffff",
                    boxShadow: `0 2px 10px ${hexToRgba(t.accentBadge, 0.25)}`,
                  }}
                >
                  <Coins size={13} />
                  <span>Buy More Credits</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        theme={t}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
