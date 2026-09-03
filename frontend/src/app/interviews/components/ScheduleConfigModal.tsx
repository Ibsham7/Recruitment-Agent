import React, { useEffect } from "react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { Sliders, X, Loader2 } from "lucide-react";
import { CampaignItem, PRESET_FOCUS_TEMPLATES } from "../types";

export interface ScheduleConfigModalProps {
  theme: Theme;
  isOpen: boolean;
  onClose: () => void;
  campaigns: CampaignItem[];
  configCampaignId: string;
  setConfigCampaignId: (campId: string) => void;
  configText: string;
  setConfigText: React.Dispatch<React.SetStateAction<string>>;
  handleSelectConfigCampaign: (campId: string) => void;
  handleSaveInterviewConfig: () => void;
  savingConfig: boolean;
}

export function ScheduleConfigModal({
  theme: t,
  isOpen,
  onClose,
  campaigns,
  configCampaignId,
  configText,
  setConfigText,
  handleSelectConfigCampaign,
  handleSaveInterviewConfig,
  savingConfig,
}: ScheduleConfigModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      style={{ background: t.isDark ? "rgba(3, 3, 7, 0.82)" : "rgba(15, 15, 25, 0.6)", backdropFilter: "blur(12px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: t.isDark ? t.bgSurface : t.bgCard,
          border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
          boxShadow: t.isDark ? `0 20px 50px rgba(0,0,0,0.6), 0 0 30px ${hexToRgba(t.accentPrimary, 0.15)}` : "0 20px 50px rgba(0,0,0,0.15)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header Bar */}
        <div
          className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b z-10"
          style={{
            borderColor: hexToRgba(t.txtPrimary, 0.1),
            background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
            backdropFilter: "blur(8px)"
          }}
        >
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: t.accentPrimary }}>
              <Sliders size={14} /> Campaign Settings
            </div>
            <h2 id="config-modal-title" className="text-lg sm:text-2xl font-bold truncate" style={{ color: t.txtPrimary, fontFamily: "'Fraunces', serif" }}>
              Interview Focus
            </h2>
            <p className="text-xs font-medium mt-0.5 truncate" style={{ color: t.txtSecondary }}>
              Custom questions & topics for candidate interviews
            </p>
          </div>

          {/* Close Button - Always Visible at Top Right */}
          <button
            onClick={onClose}
            aria-label="Close configuration modal"
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0 flex items-center justify-center"
            style={{ color: t.txtSecondary, background: hexToRgba(t.txtPrimary, 0.08), border: `1px solid ${hexToRgba(t.txtPrimary, 0.12)}` }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Campaign Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: t.txtPrimary }}>
              Select Campaign
            </label>
            <select
              value={configCampaignId}
              onChange={(e) => handleSelectConfigCampaign(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer"
              style={{
                background: hexToRgba(t.bgPage, t.isDark ? 0.5 : 0.8),
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
                color: t.txtPrimary
              }}
            >
              {campaigns.length === 0 ? (
                <option value="">No campaigns available</option>
              ) : (
                campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.interviewConfig ? "✓ (Configured)" : "(Default)"}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Quick Preset Focus Templates */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between" style={{ color: t.txtSecondary }}>
              <span>Quick Focus Presets</span>
              <span className="text-[10px] lowercase font-normal" style={{ color: t.txtMuted }}>click to append template</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_FOCUS_TEMPLATES.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setConfigText((prev) => (prev ? `${prev.trim()}\n${preset.text}` : preset.text));
                  }}
                  className="text-left p-3 rounded-xl border text-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  style={{
                    background: hexToRgba(t.accentPrimary, 0.06),
                    borderColor: hexToRgba(t.accentPrimary, 0.2),
                    color: t.txtPrimary
                  }}
                >
                  <div className="font-semibold mb-0.5" style={{ color: t.accentPrimary }}>+ {preset.label}</div>
                  <div className="text-[10px] line-clamp-1 opacity-75" style={{ color: t.txtSecondary }}>{preset.text}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea for Interview Focus & Custom Questions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: t.txtPrimary }}>
                Interview Focus & Custom Questions (Optional)
              </label>
              <span className="text-[10px] font-medium" style={{ color: t.txtMuted }}>
                {configText.length} characters
              </span>
            </div>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={5}
              placeholder="e.g. Ask the candidate to explain their most complex React project. Focus heavily on system design and cultural fit..."
              className="w-full rounded-2xl p-4 text-xs md:text-sm focus:outline-none resize-none leading-relaxed"
              style={{
                background: hexToRgba(t.bgPage, t.isDark ? 0.6 : 0.9),
                border: `1px solid ${hexToRgba(t.txtPrimary, 0.15)}`,
                color: t.txtPrimary
              }}
            />
          </div>

          {/* Information Note */}
          <div className="p-4 rounded-xl text-xs flex items-start gap-3" style={{ background: hexToRgba(t.accentPrimary, 0.08), border: `1px solid ${hexToRgba(t.accentPrimary, 0.2)}` }}>
            <p style={{ color: t.txtSecondary }}>
              When candidates belonging to this campaign initiate their technical interview, the AI Question Generator will prioritize these focus areas and custom topics.
            </p>
          </div>
        </div>

        {/* Sticky Recruiter Action Footer */}
        <div
          className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 sm:p-5 border-t z-10"
          style={{
            borderColor: hexToRgba(t.txtPrimary, 0.1),
            background: hexToRgba(t.isDark ? t.bgSurface : t.bgCard, 0.95),
            backdropFilter: "blur(8px)"
          }}
        >
          <button
            onClick={() => setConfigText("")}
            type="button"
            className="min-h-[44px] sm:min-h-0 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer hover:opacity-80 flex items-center justify-center"
            style={{ color: t.txtMuted }}
          >
            Clear Rules
          </button>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={onClose}
              disabled={savingConfig}
              className="min-h-[44px] flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 flex items-center justify-center"
              style={{ background: hexToRgba(t.txtPrimary, 0.08), color: t.txtPrimary, border: `1px solid ${hexToRgba(t.txtPrimary, 0.18)}` }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveInterviewConfig}
              disabled={savingConfig || !configCampaignId}
              className="min-h-[44px] flex-[1.5] sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              style={{ background: t.accentPrimary, color: t.accentText, boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.35)}` }}
            >
              {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <Sliders size={14} />}
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
