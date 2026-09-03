import { useState } from "react";
import { Theme, UserProfile } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { HardFilter } from "./types";
import { CreditCard, ChevronDown } from "lucide-react";

interface Step1SidebarProps {
  theme: Theme;
  title: string;
  wordCount: number;
  strictness: string;
  hardFilters: HardFilter[];
  profile?: UserProfile | null;
  onOpenUpgradeModal?: () => void;
}

export default function Step1Sidebar({
  theme: t,
  title,
  wordCount,
  strictness,
  hardFilters = [],
  profile,
  onOpenUpgradeModal
}: Step1SidebarProps) {
  const G = getGlass(t);
  const [guidanceOpen, setGuidanceOpen] = useState(false);

  const isFree = profile?.plan === "free";
  const campaignsCount = profile?.totalCampaignsCreated ?? 0;
  const cvsCount = profile?.totalCvsProcessed ?? 0;
  const isFreeExhausted = isFree && campaignsCount >= 5;

  return (
    <div className="lg:col-span-5 xl:col-span-4 space-y-6">
      {/* Account Quota & Tier Card */}
      <div className="rounded-2xl p-4 sm:p-6 space-y-4 border" style={G.card}>
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <h3 className="text-sm font-bold tracking-wide uppercase" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
            Account Tier & Quota
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

        <div className="space-y-3 text-xs">
          {isFree ? (
            <>
              <div className="p-3 rounded-xl border space-y-1.5" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>Lifetime Campaigns</span>
                  <span className="font-bold text-xs" style={{ color: campaignsCount >= 5 ? t.numNeg : t.txtPrimary }}>
                    {campaignsCount} / 5
                  </span>
                </div>
                <div className="w-full bg-black/20 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all" 
                    style={{ 
                      width: `${Math.min(100, (campaignsCount / 5) * 100)}%`,
                      background: campaignsCount >= 5 ? t.numNeg : t.accentPrimary
                    }} 
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border space-y-1.5" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>Lifetime CVs Processed</span>
                  <span className="font-bold text-xs" style={{ color: cvsCount >= 100 ? t.numNeg : t.txtPrimary }}>
                    {cvsCount} / 100
                  </span>
                </div>
                <div className="w-full bg-black/20 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all" 
                    style={{ 
                      width: `${Math.min(100, (cvsCount / 100) * 100)}%`,
                      background: cvsCount >= 100 ? t.numNeg : t.accentPrimary
                    }} 
                  />
                </div>
              </div>

              {onOpenUpgradeModal && (
                <button
                  type="button"
                  onClick={onOpenUpgradeModal}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95"
                  style={{
                    background: isFreeExhausted ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})` : hexToRgba(t.accentPrimary, 0.15),
                    color: isFreeExhausted ? t.accentText : t.accentPrimary,
                  }}
                >
                  <span>{isFreeExhausted ? "Upgrade Plan to Launch" : "Upgrade to Paid Credits ($10)"}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>Available Balance</div>
                  <div className="font-bold text-base mt-0.5" style={{ color: (profile?.creditBalance ?? 0) > 0 ? t.numPos : t.numNeg }}>
                    {profile?.creditBalance ?? 0} Credits
                  </div>
                </div>
                <CreditCard size={20} style={{ color: t.accentBadge }} />
              </div>

              {onOpenUpgradeModal && (
                <button
                  type="button"
                  onClick={onOpenUpgradeModal}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95"
                  style={{
                    background: hexToRgba(t.accentBadge, 0.18),
                    color: t.accentBadge,
                  }}
                >
                  <span>Top Up Credits ($1 = 100)</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {/* Live Campaign Preview Card */}
      <div className="rounded-2xl p-4 sm:p-6 space-y-4 border" style={G.card}>
        <div className="border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <h3 className="text-sm font-bold tracking-wide uppercase" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
            Live Campaign Overview
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.txtMuted }}>Role Title</div>
            <div className="font-bold text-sm mt-0.5 truncate" style={{ color: title ? t.txtPrimary : t.txtGhost }}>
              {title || "Untitled Role"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl border" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>JD Quality</div>
              <div className="font-bold text-xs mt-1" style={{ color: wordCount >= 100 ? t.numPos : '#f59e0b' }}>
                {wordCount >= 100 ? "Comprehensive" : "Brief (<100 words)"}
              </div>
            </div>

            <div className="p-3 rounded-xl border" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>Strictness</div>
              <div className="font-bold text-xs mt-1 capitalize" style={{ color: t.accentPrimary }}>
                {strictness} Mode
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: t.txtMuted }}>Configured Filters</div>
            <div className="font-semibold text-xs" style={{ color: t.txtSecondary }}>
              {hardFilters.length === 0 ? "No hard filters applied" : `${hardFilters.length} filter rule(s) configured`}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Guidance Accordion Trigger (< 1024px) */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setGuidanceOpen(!guidanceOpen)}
          className="w-full rounded-2xl p-4 border flex items-center justify-between transition-all min-h-[44px]"
          style={G.card}
        >
          <div className="flex items-center gap-2.5 text-left">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.txtPrimary }}>
              AI Screening Guidance & Tips
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>
              {guidanceOpen ? "Hide" : "Show"}
            </span>
          </div>
          <ChevronDown 
            size={18} 
            className={`transition-transform duration-200 ${guidanceOpen ? 'rotate-180' : ''}`}
            style={{ color: t.txtMuted }} 
          />
        </button>
      </div>

      {/* Guidance Cards Container: Always open on desktop (lg:block), collapsible on mobile */}
      <div className={`${guidanceOpen ? 'block' : 'hidden'} lg:block space-y-6`}>
        {/* AI Screening Engine Capabilities */}
        <div className="rounded-2xl p-4 sm:p-6 space-y-4 border" style={G.card}>
          <div className="border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
            <h3 className="text-sm font-bold tracking-wide uppercase" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
              AI Screening Workflow
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
                style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
              >
                1
              </div>
              <div>
                <div className="font-bold" style={{ color: t.txtPrimary }}>Deep JD Vectorization</div>
                <div className="text-[11px] mt-0.5" style={{ color: t.txtMuted }}>
                  Extracts required skills, experience thresholds, and domain responsibilities into high-dimensional embeddings.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
                style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
              >
                2
              </div>
              <div>
                <div className="font-bold" style={{ color: t.txtPrimary }}>Hard Rule Enforcement</div>
                <div className="text-[11px] mt-0.5" style={{ color: t.txtMuted }}>
                  Automatically applies instant rejection or score penalties for missing mandatory qualifications.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
                style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
              >
                3
              </div>
              <div>
                <div className="font-bold" style={{ color: t.txtPrimary }}>Multi-Dimensional Scoring</div>
                <div className="text-[11px] mt-0.5" style={{ color: t.txtMuted }}>
                  Evaluates technical alignment, project relevance, and overall role fit on a 0-100 scale.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Best Practices Tip Box */}
        <div 
          className="rounded-2xl p-4 sm:p-5 border space-y-2" 
          style={{ background: hexToRgba(t.accentPrimary, 0.08), borderColor: hexToRgba(t.accentPrimary, 0.25) }}
        >
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: t.accentPrimary }}>
            Tips for High AI Accuracy
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: t.txtSecondary }}>
            Provide clear sections for <strong>Key Responsibilities</strong> and <strong>Required Qualifications</strong> in your JD to help the AI distinguish between mandatory vs. nice-to-have skills.
          </p>
        </div>
      </div>
    </div>
  );
}
