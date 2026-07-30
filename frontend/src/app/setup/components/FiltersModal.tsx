import React, { useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { HardFilter } from "./types";

interface FiltersModalProps {
  theme: Theme;
  showFiltersModal: boolean;
  setShowFiltersModal: (show: boolean) => void;
  hardFilters: HardFilter[];
  setHardFilters: React.Dispatch<React.SetStateAction<HardFilter[]>>;
}

export default function FiltersModal({
  theme: t,
  showFiltersModal,
  setShowFiltersModal,
  hardFilters,
  setHardFilters
}: FiltersModalProps) {
  // Modal Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showFiltersModal) {
        setShowFiltersModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFiltersModal, setShowFiltersModal]);

  if (!showFiltersModal) return null;

  const fieldStyle: React.CSSProperties = { 
    color: t.txtPrimary, 
    background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.55), 
    border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.75)}`, 
    backdropFilter: "blur(12px)", 
    WebkitBackdropFilter: "blur(12px)",
    transition: "all 0.2s ease"
  };

  return (
    <div 
      onClick={() => setShowFiltersModal(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      style={{ background: hexToRgba("#000", 0.6), backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl max-w-md w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden relative border" 
        style={{ background: t.bgCard, borderColor: hexToRgba(t.txtGhost, 0.2) }}
      >
        {/* Sticky Header */}
        <div className="shrink-0 z-10 p-5 border-b flex items-center justify-between" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: t.txtPrimary }}>Hard Filters & Penalties</h3>
            <p className="text-xs mt-0.5" style={{ color: t.txtSecondary }}>Define mandatory requirements and score deductions.</p>
          </div>
          <button 
            onClick={() => setShowFiltersModal(false)} 
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors" 
            style={{ color: t.txtMuted }}
          >
            ✕
          </button>
        </div>
        
        {/* Independent Scroll Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {hardFilters.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <div className="text-xs font-medium" style={{ color: t.txtSecondary }}>No filters configured.</div>
              <p className="text-[11px] max-w-xs mx-auto leading-normal" style={{ color: t.txtMuted }}>
                Define mandatory skills or min experience thresholds to penalize or reject unqualified applicants automatically.
              </p>
            </div>
          ) : (
            hardFilters.map((hf, i) => (
              <div 
                key={i} 
                className="p-3.5 rounded-xl space-y-2.5 border" 
                style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtGhost, 0.15) }}
              >
                <div className="flex items-center justify-between gap-2">
                  <select 
                    value={hf.type} 
                    onChange={e => { const newHf = [...hardFilters]; newHf[i].type = e.target.value; setHardFilters(newHf); }} 
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none" 
                    style={{ ...fieldStyle, flex: 1 }}
                  >
                    <option value="skill">Mandatory Skill</option>
                    <option value="experience">Min Experience (Years)</option>
                  </select>

                  <button 
                    onClick={() => { const newHf = [...hardFilters]; newHf.splice(i, 1); setHardFilters(newHf); }} 
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input 
                    value={hf.value} 
                    onChange={e => { const newHf = [...hardFilters]; newHf[i].value = e.target.value; setHardFilters(newHf); }} 
                    placeholder={hf.type === "experience" ? "e.g. 3" : "e.g. Python, React"} 
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none flex-1" 
                    style={fieldStyle} 
                  />
                  <select 
                    value={hf.penalty} 
                    onChange={e => { const newHf = [...hardFilters]; newHf[i].penalty = e.target.value; setHardFilters(newHf); }} 
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none" 
                    style={{ ...fieldStyle, flex: 1.3 }}
                  >
                    <option value="reject">Completely Reject</option>
                    <option value="hard_penalize">Hard Penalize (-30)</option>
                    <option value="intermediate_penalize">Intermediate (-20)</option>
                    <option value="slight_penalize">Slight Penalize (-10)</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Fixed Footer */}
        <div className="shrink-0 z-10 p-4 border-t flex gap-2.5" style={{ borderColor: hexToRgba(t.txtGhost, 0.15), background: t.bgCard }}>
          <button 
            onClick={() => setHardFilters([...hardFilters, { type: "skill", value: "", penalty: "reject" }])} 
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1" 
            style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
          >
            <Plus size={14} />
            <span>Add Filter</span>
          </button>
          <button 
            onClick={() => setShowFiltersModal(false)} 
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all" 
            style={{ background: t.accentPrimary, color: t.accentText }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
