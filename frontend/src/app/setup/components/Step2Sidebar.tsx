import { useState } from "react";
import { Theme, UserProfile } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { UploadTask, formatFileSize } from "./types";
import { CreditCard, ChevronDown } from "lucide-react";

interface Step2SidebarProps {
  theme: Theme;
  uploadTasks: UploadTask[];
  profile?: UserProfile | null;
  onOpenUpgradeModal?: () => void;
}

export default function Step2Sidebar({ 
  theme: t, 
  uploadTasks, 
  profile, 
  onOpenUpgradeModal 
}: Step2SidebarProps) {
  const G = getGlass(t);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);

  const totalFileSize = uploadTasks.reduce((acc, task) => acc + task.file.size, 0);
  const validCount = uploadTasks.filter(t => t.status !== 'error' && t.file.size > 0).length;

  const isFree = profile?.plan === "free";
  const totalUpfrontCost = 1 + validCount; // 1 credit base + 1 credit per valid CV

  // Free Tier Quota
  const campaignsRemaining = Math.max(0, 5 - (profile?.totalCampaignsCreated ?? 0));
  const cvsRemaining = Math.max(0, 100 - (profile?.totalCvsProcessed ?? 0));
  const isFreeQuotaExceeded = isFree && (campaignsRemaining <= 0 || cvsRemaining < validCount);

  // Paid Tier Credits
  const currentBalance = profile?.creditBalance ?? 0;
  const projectedBalance = currentBalance - totalUpfrontCost;
  const isInsufficientCredits = !isFree && currentBalance < totalUpfrontCost;
  const deficit = Math.max(0, totalUpfrontCost - currentBalance);

  return (
    <div className="lg:col-span-5 xl:col-span-4 space-y-6">
      {/* Campaign Cost Breakdown Card */}
      <div className="rounded-2xl p-4 sm:p-6 space-y-4 border" style={G.card}>
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <h3 className="text-sm font-bold tracking-wide uppercase" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
            Estimated Campaign Cost
          </h3>
          <span 
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ 
              background: !isFree ? t.accentBadge : hexToRgba(t.txtMuted, 0.2), 
              color: !isFree ? '#ffffff' : t.txtSecondary 
            }}
          >
            {!isFree ? "Paid Tier" : "Free Tier"}
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center py-0.5">
            <span style={{ color: t.txtSecondary }}>Base Campaign Setup</span>
            <span className="font-semibold" style={{ color: t.txtPrimary }}>1 Credit</span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span style={{ color: t.txtSecondary }}>Candidate Screening ({validCount} CVs × 1 Credit)</span>
            <span className="font-semibold" style={{ color: t.txtPrimary }}>{validCount} Credits</span>
          </div>

          <div 
            className="flex justify-between items-center p-3 rounded-xl border mt-2" 
            style={{ 
              background: hexToRgba(t.accentPrimary, 0.1), 
              borderColor: hexToRgba(t.accentPrimary, 0.25) 
            }}
          >
            <span className="font-bold uppercase tracking-wider text-[11px]" style={{ color: t.accentPrimary }}>Total Upfront Cost</span>
            <span className="font-extrabold text-sm" style={{ color: t.accentPrimary }}>{totalUpfrontCost} Credits</span>
          </div>

          {/* Account Tier Impact */}
          {isFree ? (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.35) }}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold" style={{ color: t.txtMuted }}>Free Campaigns Remaining:</span>
                <span className="font-bold text-xs" style={{ color: campaignsRemaining <= 0 ? t.numNeg : t.numPos }}>
                  {campaignsRemaining} / 5
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold" style={{ color: t.txtMuted }}>Free CVs Remaining:</span>
                <span className="font-bold text-xs" style={{ color: cvsRemaining < validCount ? t.numNeg : t.numPos }}>
                  {cvsRemaining} / 100 {validCount > 0 ? `(using ${validCount})` : ''}
                </span>
              </div>

              {isFreeQuotaExceeded && onOpenUpgradeModal && (
                <button
                  type="button"
                  onClick={onOpenUpgradeModal}
                  className="w-full mt-2 min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`,
                    color: t.accentText,
                  }}
                >
                  <span>Upgrade to Paid Credits ($10)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.35) }}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold" style={{ color: t.txtMuted }}>Current Balance:</span>
                <span className="font-bold text-xs" style={{ color: currentBalance >= totalUpfrontCost ? t.numPos : t.numNeg }}>
                  {currentBalance} Credits
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold" style={{ color: t.txtMuted }}>Projected Balance:</span>
                <span className="font-bold text-xs" style={{ color: projectedBalance >= 0 ? t.numPos : t.numNeg }}>
                  {projectedBalance} Credits
                </span>
              </div>

              {isInsufficientCredits && onOpenUpgradeModal && (
                <button
                  type="button"
                  onClick={onOpenUpgradeModal}
                  className="w-full mt-2 min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`,
                    color: t.accentText,
                  }}
                >
                  <span>Top Up {deficit} Credits (${(deficit / 100).toFixed(2)})</span>
                </button>
              )}
            </div>
          )}

          <p className="text-[10px] leading-relaxed pt-1" style={{ color: t.txtMuted }}>
            Note: Downstream interview invites (1 credit) and candidate evaluations (2 credits) are deducted dynamically upon execution.
          </p>
        </div>
      </div>
      {/* Batch Upload Summary Card */}
      <div className="rounded-2xl p-4 sm:p-6 space-y-4 border" style={G.card}>
        <div className="border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <h3 className="text-sm font-bold tracking-wide uppercase" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
            Batch Upload Status
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <div 
            className="flex justify-between items-center p-3 rounded-xl border" 
            style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}
          >
            <span className="font-semibold" style={{ color: t.txtMuted }}>Total Resumes Queued</span>
            <span className="font-bold text-sm" style={{ color: t.accentPrimary }}>{uploadTasks.length} CVs</span>
          </div>

          <div 
            className="flex justify-between items-center p-3 rounded-xl border" 
            style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}
          >
            <span className="font-semibold" style={{ color: t.txtMuted }}>Combined File Payload</span>
            <span className="font-bold" style={{ color: t.txtPrimary }}>{formatFileSize(totalFileSize)}</span>
          </div>

          <div 
            className="flex justify-between items-center p-3 rounded-xl border" 
            style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}
          >
            <span className="font-semibold" style={{ color: t.txtMuted }}>Estimated AI Evaluation</span>
            <span className="font-bold" style={{ color: t.txtPrimary }}>~{Math.max(1, Math.ceil(uploadTasks.length * 2.5))} seconds</span>
          </div>
        </div>
      </div>

      {/* Mobile Next Steps Accordion Trigger (< 1024px) */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setNextStepsOpen(!nextStepsOpen)}
          className="w-full rounded-2xl p-4 border flex items-center justify-between transition-all min-h-[44px]"
          style={G.card}
        >
          <div className="flex items-center gap-2.5 text-left">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.txtPrimary }}>
              What Happens Next? (Pipeline Guide)
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>
              {nextStepsOpen ? "Hide" : "Show"}
            </span>
          </div>
          <ChevronDown 
            size={18} 
            className={`transition-transform duration-200 ${nextStepsOpen ? 'rotate-180' : ''}`}
            style={{ color: t.txtMuted }} 
          />
        </button>
      </div>

      {/* AI Evaluation Pipeline Card: Always open on desktop (lg:block), collapsible on mobile */}
      <div className={`${nextStepsOpen ? 'block' : 'hidden'} lg:block`}>
        <div className="rounded-2xl p-4 sm:p-6 space-y-4 border" style={G.card}>
          <div className="border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
            <h3 className="text-sm font-bold tracking-wide uppercase" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
              What Happens Next?
            </h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-start gap-3">
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
                style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
              >
                1
              </div>
              <div>
                <div className="font-bold" style={{ color: t.txtPrimary }}>Resume Storage & Parsing</div>
                <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                  Resumes are uploaded to encrypted cloud storage and extracted into structured candidate profiles.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
                style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
              >
                2
              </div>
              <div>
                <div className="font-bold" style={{ color: t.txtPrimary }}>Hard Filter Verification</div>
                <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                  Candidate profiles are evaluated against configured mandatory skills and experience limits.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
                style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
              >
                3
              </div>
              <div>
                <div className="font-bold" style={{ color: t.txtPrimary }}>LLM Candidate Scoring</div>
                <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                  AI reasoning model generates detailed candidate breakdown, skill overlap scores, and interview question suggestions.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
