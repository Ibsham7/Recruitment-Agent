import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { HardFilter } from "./types";

interface Step1SidebarProps {
  theme: Theme;
  title: string;
  wordCount: number;
  strictness: string;
  hardFilters: HardFilter[];
}

export default function Step1Sidebar({
  theme: t,
  title,
  wordCount,
  strictness,
  hardFilters = []
}: Step1SidebarProps) {
  const G = getGlass(t);

  return (
    <div className="lg:col-span-5 xl:col-span-4 space-y-6">
      {/* Live Campaign Preview Card */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
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

      {/* AI Screening Engine Capabilities */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
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
  );
}
