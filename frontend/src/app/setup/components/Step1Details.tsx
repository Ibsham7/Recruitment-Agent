import React from "react";
import { RotateCcw, Plus, ArrowRight } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { HardFilter, DEFAULT_TITLE, DEFAULT_JD, getPenaltyInfo } from "./types";

interface Step1DetailsProps {
  theme: Theme;
  title: string;
  setTitle: (val: string) => void;
  jd: string;
  setJd: (val: string) => void;
  strictness: "lenient" | "moderate" | "strict";
  setStrictness: (val: "lenient" | "moderate" | "strict") => void;
  hardFilters: HardFilter[];
  setShowFiltersModal: (show: boolean) => void;
  onContinue: () => void;
}

export default function Step1Details({
  theme: t,
  title,
  setTitle,
  jd,
  setJd,
  strictness,
  setStrictness,
  hardFilters = [],
  setShowFiltersModal,
  onContinue
}: Step1DetailsProps) {
  const G = getGlass(t);

  const wordCount = jd.trim() ? jd.trim().split(/\s+/).length : 0;

  const fieldStyle: React.CSSProperties = { 
    color: t.txtPrimary, 
    background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.55), 
    border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.75)}`, 
    backdropFilter: "blur(12px)", 
    WebkitBackdropFilter: "blur(12px)",
    transition: "all 0.2s ease"
  };

  return (
    <div className="lg:col-span-7 xl:col-span-8 space-y-6">
      {/* Main Form Box */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-6" style={G.card}>
        {/* Job Title Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: t.txtMuted }}>
              Job Title
            </label>
            <span 
              className="text-[10px] font-bold px-2 py-0.5 rounded" 
              style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
            >
              Required
            </span>
          </div>
          <input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="e.g. Senior Frontend Engineer (React & TypeScript)" 
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-1" 
            style={{ 
              ...fieldStyle,
              borderColor: title ? hexToRgba(t.accentPrimary, 0.4) : fieldStyle.borderColor
            }} 
          />
        </div>

        {/* Job Description Textarea */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: t.txtMuted }}>
              Job Description & Role Requirements
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium" style={{ color: t.txtMuted }}>
                {wordCount} words | {jd.length} chars
              </span>
              <button 
                onClick={() => { setTitle(DEFAULT_TITLE); setJd(DEFAULT_JD); }} 
                className="text-xs font-semibold flex items-center gap-1 hover:underline transition-all" 
                style={{ color: t.accentPrimary }}
              >
                <RotateCcw size={11} /> Reset Sample
              </button>
            </div>
          </div>
          <textarea 
            value={jd} 
            onChange={(e) => setJd(e.target.value)} 
            rows={10} 
            placeholder="Paste role requirements, responsibilities, technical stack, qualifications..."
            className="w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none resize-y leading-relaxed font-sans" 
            style={fieldStyle} 
          />
        </div>

        {/* Evaluation Strictness */}
        <div className="pt-3 border-t space-y-3" style={{ borderColor: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.35) }}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: t.txtMuted }}>
              Evaluation Strictness Level
            </label>
            <span 
              className="text-xs capitalize font-bold px-2.5 py-0.5 rounded-full" 
              style={{ background: hexToRgba(t.accentPrimary, 0.18), color: t.accentPrimary }}
            >
              {strictness} Mode
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2.5 p-1.5 rounded-xl" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6) }}>
            {(["lenient", "moderate", "strict"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setStrictness(level)}
                className="py-2.5 px-3 rounded-lg text-xs font-bold capitalize transition-all flex items-center justify-center"
                style={{
                  background: strictness === level ? t.accentPrimary : "transparent",
                  color: strictness === level ? t.accentText : t.txtSecondary,
                  boxShadow: strictness === level ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.35)}` : "none"
                }}
              >
                <span>{level}</span>
              </button>
            ))}
          </div>
          <p className="text-xs leading-normal font-medium" style={{ color: t.txtMuted }}>
            {strictness === "lenient" && "Lenient: Broader requirement matching with higher candidate inclusion and flexible skill overlap."}
            {strictness === "moderate" && "Moderate: Balanced scoring based on core technical skills and experience overlap."}
            {strictness === "strict" && "Strict: Uncompromising evaluation against all specified qualifications and experience thresholds."}
          </p>
        </div>

        {/* Hard Filters Section */}
        <div className="pt-3 border-t space-y-3" style={{ borderColor: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.35) }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider block" style={{ color: t.txtMuted }}>
                Hard Filters & Score Deductions
              </div>
              <div className="text-xs mt-0.5 font-medium" style={{ color: t.txtSecondary }}>
                {hardFilters.length === 0 ? "No hard filters defined (Optional)" : `${hardFilters.length} rule${hardFilters.length === 1 ? '' : 's'} active`}
              </div>
            </div>
            <button 
              onClick={() => setShowFiltersModal(true)} 
              className="text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 hover:opacity-90 shadow-sm" 
              style={{ background: hexToRgba(t.accentPrimary, 0.18), color: t.accentPrimary }}
            >
              <Plus size={14} />
              <span>Configure Rules</span>
            </button>
          </div>

          {hardFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {hardFilters.map((hf, i) => {
                const penInfo = getPenaltyInfo(hf.penalty, t);
                return (
                  <div 
                    key={i} 
                    className="text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-2 border"
                    style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.8), borderColor: hexToRgba(t.txtGhost, 0.2), color: t.txtPrimary }}
                  >
                    <span>{hf.type === "skill" ? `Skill: ${hf.value || 'Unspecified'}` : `Min Exp: ${hf.value || '0'} yrs`}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: penInfo.bg, color: penInfo.color }}>
                      {penInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Step 1 Continue Button */}
      <button 
        onClick={onContinue} 
        disabled={!title || !jd} 
        className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-[1.005]"
        style={{ 
          background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`, 
          color: t.accentText, 
          boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` 
        }}
      >
        <span>Continue to Resume Upload</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
