import { useState, useEffect } from "react";
import { X, Search, DollarSign, Layers, ChevronRight, ChevronLeft, FileText } from "lucide-react";
import { Campaign, Candidate, Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { getCandidateDisplayName } from "../../../lib/candidate";

interface CostAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  candidates: Candidate[];
  theme: Theme;
}

const STAGE_META: Record<string, { title: string; defaultModel: string; icon: string; color: string }> = {
  jd_extraction: {
    title: "JD Extraction & Spec Distillation",
    defaultModel: "google/gemini-3.1-flash-lite",
    icon: "📑",
    color: "#6366F1", // indigo
  },
  jd_embedding: {
    title: "JD Vector Embedding",
    defaultModel: "text-embedding-3-small",
    icon: "⚡",
    color: "#059669", // emerald
  },
  cv_parser: {
    title: "CV Parser & Profile Extraction",
    defaultModel: "google/gemini-3.1-flash-lite",
    icon: "📄",
    color: "#3B82F6", // blue
  },
  jd_matcher: {
    title: "JD Matcher & Hard Screening",
    defaultModel: "google/gemini-3.1-flash-lite",
    icon: "🎯",
    color: "#10B981", // green
  },
  question_generator: {
    title: "Resume-Anchored Question Generator",
    defaultModel: "google/gemini-3.1-flash-lite",
    icon: "❓",
    color: "#8B5CF6", // purple
  },
  interviewer_probe: {
    title: "Adaptive Interview Follow-up Probe",
    defaultModel: "google/gemini-3.1-flash-lite",
    icon: "💬",
    color: "#F59E0B", // amber
  },
  evaluator: {
    title: "Final Interview Evaluator Engine",
    defaultModel: "google/gemini-3.1-flash-lite",
    icon: "📊",
    color: "#EC4899", // pink
  },
  embedding_matcher: {
    title: "Semantic PGVector Embedding",
    defaultModel: "text-embedding-3-small",
    icon: "🔍",
    color: "#06B6D4", // cyan
  },
};

export function CostAnalysisModal({ isOpen, onClose, campaign, candidates, theme: t }: CostAnalysisModalProps) {
  const G = getGlass(t);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("campaign_setup");
  const [sortBy, setSortBy] = useState<"cost_desc" | "cost_asc" | "name">("cost_desc");
  const [mobileTab, setMobileTab] = useState<"list" | "detail">("list");

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileTab("detail");
  };

  // Handle ESC key press for modal dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Compute overall campaign telemetry
  const campaignSetupCost = campaign.apiCost || 0;
  const candidatesCost = candidates.reduce((acc, c) => acc + (c.apiCost || 0), 0);
  const totalCampaignCost = campaign.totalCost || (campaignSetupCost + candidatesCost);

  // Filter & sort candidates
  const filteredCandidates = candidates
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = getCandidateDisplayName(c).toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    })
    .sort((a, b) => {
      const costA = a.apiCost || 0;
      const costB = b.apiCost || 0;
      if (sortBy === "cost_desc") return costB - costA;
      if (sortBy === "cost_asc") return costA - costB;
      return getCandidateDisplayName(a).localeCompare(getCandidateDisplayName(b));
    });

  const isCampaignSetupSelected = selectedId === "campaign_setup";
  const selectedCandidate = candidates.find((c) => c.id === selectedId) || null;

  const activeCostBreakdown: Record<string, any> = isCampaignSetupSelected
    ? campaign.costBreakdown || {}
    : selectedCandidate?.costBreakdown || {};

  const activeCost = isCampaignSetupSelected
    ? campaignSetupCost
    : selectedCandidate?.apiCost || 0;

  // Extract total tokens for active selection
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;

  Object.values(activeCostBreakdown).forEach((stage: any) => {
    if (stage?.tokens) {
      totalInputTokens += stage.tokens.input_tokens || 0;
      totalOutputTokens += stage.tokens.output_tokens || 0;
      totalTokens += stage.tokens.total_tokens || 0;
    }
  });

  const visibleStageKeys = isCampaignSetupSelected
    ? ["jd_extraction", "jd_embedding"]
    : ["cv_parser", "jd_matcher", "question_generator", "interviewer_probe", "evaluator", "embedding_matcher"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-8 bg-black/75 backdrop-blur-md transition-opacity animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[92vh] sm:h-[85vh] rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border transition-all"
        style={{
          background: t.bgPage,
          borderColor: hexToRgba(t.accentPrimary, 0.3),
          boxShadow: `0 25px 50px -12px ${hexToRgba(t.accentPrimary, 0.25)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── STICKY HEADER ──────────────────────────────────────────────────────── */}
        <div
          className="px-4 sm:px-6 py-3.5 sm:py-4 flex-shrink-0 z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b"
          style={{
            ...G.bar,
            borderColor: hexToRgba(t.txtGhost, 0.15),
          }}
        >
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-lg shrink-0"
                style={{
                  background: hexToRgba(t.accentPrimary, 0.2),
                  color: t.accentPrimary,
                  border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
                }}
              >
                <DollarSign size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-xl font-bold" style={{ color: t.txtPrimary }}>
                    Campaign Cost Breakdown
                  </h3>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider"
                    style={{
                      background: hexToRgba(t.accentPrimary, 0.15),
                      color: t.accentPrimary,
                    }}
                  >
                    Dev & Analytics
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs truncate max-w-[200px] sm:max-w-none" style={{ color: t.txtMuted }}>
                  {campaign.title} • Setup + {candidates.length} Candidates
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="md:hidden min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer hover:opacity-80 active:scale-95"
              style={{
                background: hexToRgba(t.txtGhost, 0.15),
                color: t.txtPrimary,
              }}
              title="Close (Esc)"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <div
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl flex items-center gap-3 flex-1 md:flex-initial"
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.4 : 0.6),
                border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`,
              }}
            >
              <div className="text-left md:text-right">
                <div className="text-[10px] sm:text-xs uppercase font-medium tracking-wider" style={{ color: t.txtGhost }}>
                  Total Campaign Cost
                </div>
                <div className="text-base sm:text-lg font-bold" style={{ color: t.numNeg, fontFamily: "'Fraunces',serif" }}>
                  ${totalCampaignCost.toFixed(6)}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="hidden md:flex min-w-[44px] min-h-[44px] rounded-full items-center justify-center transition-colors cursor-pointer hover:opacity-80 active:scale-95 shrink-0"
              style={{
                background: hexToRgba(t.txtGhost, 0.15),
                color: t.txtPrimary,
              }}
              title="Close (Esc)"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile view toggle */}
          <div className="flex md:hidden items-center gap-1 p-1 rounded-xl w-full" style={{ background: hexToRgba(t.bgCard, 0.5) }}>
            <button
              onClick={() => setMobileTab("list")}
              className="min-h-[38px] flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={{
                background: mobileTab === "list" ? hexToRgba(t.accentPrimary, 0.25) : "transparent",
                color: mobileTab === "list" ? t.accentPrimary : t.txtMuted,
              }}
            >
              Candidates & Setup
            </button>
            <button
              onClick={() => setMobileTab("detail")}
              className="min-h-[38px] flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={{
                background: mobileTab === "detail" ? hexToRgba(t.accentPrimary, 0.25) : "transparent",
                color: mobileTab === "detail" ? t.accentPrimary : t.txtMuted,
              }}
            >
              Cost Details
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT (INDEPENDENT SCROLL BODY) ──────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── LEFT COLUMN: CAMPAIGN OVERHEAD & CANDIDATE LIST ───────────────── */}
          <div
            className={`${mobileTab === "list" ? "flex" : "hidden md:flex"} w-full md:w-80 lg:w-96 flex-shrink-0 border-r flex-col overflow-hidden`}
            style={{
              borderColor: hexToRgba(t.txtGhost, 0.15),
              background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.4),
            }}
          >
            {/* Pinned Campaign Setup / JD Processing Button */}
            <div className="p-3 border-b" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
              <button
                onClick={() => handleSelect("campaign_setup")}
                className="w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between group"
                style={{
                  background: isCampaignSetupSelected
                    ? hexToRgba("#6366F1", 0.2)
                    : hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.7),
                  border: `1px solid ${
                    isCampaignSetupSelected
                      ? hexToRgba("#6366F1", 0.6)
                      : hexToRgba(t.txtGhost, 0.2)
                  }`,
                }}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-400 flex-shrink-0" />
                    <span
                      className="font-bold text-sm truncate"
                      style={{ color: isCampaignSetupSelected ? "#818CF8" : t.txtPrimary }}
                    >
                      Campaign Setup & JD Processing
                    </span>
                  </div>
                  <div className="text-xs truncate mt-1" style={{ color: t.txtMuted }}>
                    JD Extraction & Vector Embedding
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div
                    className="text-sm font-bold font-mono"
                    style={{ color: isCampaignSetupSelected ? "#818CF8" : t.txtPrimary }}
                  >
                    ${campaignSetupCost.toFixed(6)}
                  </div>
                  <ChevronRight
                    size={14}
                    className={`mt-1 transition-transform ${isCampaignSetupSelected ? "translate-x-0.5 opacity-100" : "opacity-40"}`}
                    style={{ color: isCampaignSetupSelected ? "#818CF8" : t.txtGhost }}
                  />
                </div>
              </button>
            </div>

            {/* Search & Sort Controls for Candidates */}
            <div className="p-4 space-y-3 border-b" style={{ borderColor: hexToRgba(t.txtGhost, 0.1) }}>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3" style={{ color: t.txtGhost }} />
                <input
                  type="text"
                  placeholder="Search candidate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none transition-all"
                  style={{
                    background: hexToRgba(t.bgPage, t.isDark ? 0.5 : 0.8),
                    color: t.txtPrimary,
                    border: `1px solid ${hexToRgba(t.txtGhost, 0.2)}`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs" style={{ color: t.txtMuted }}>
                <span>Sort Candidates:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
                  style={{ color: t.accentPrimary }}
                >
                  <option value="cost_desc">Highest Cost</option>
                  <option value="cost_asc">Lowest Cost</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            {/* Candidate Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredCandidates.length === 0 ? (
                <div className="p-6 text-center text-sm" style={{ color: t.txtMuted }}>
                  No candidates found.
                </div>
              ) : (
                filteredCandidates.map((c) => {
                  const isSelected = c.id === selectedId;
                  const cCost = c.apiCost || 0;
                  const displayName = getCandidateDisplayName(c);
                  const hasOcr = Boolean(c.costBreakdown?.cv_parser?.tokens?.total_tokens > 10000);

                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(c.id)}
                      className="w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                      style={{
                        background: isSelected
                          ? hexToRgba(t.accentPrimary, 0.18)
                          : hexToRgba(t.bgPage, t.isDark ? 0.3 : 0.6),
                        border: `1px solid ${
                          isSelected
                            ? hexToRgba(t.accentPrimary, 0.5)
                            : hexToRgba(t.txtGhost, 0.1)
                        }`,
                      }}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-bold text-sm truncate"
                            style={{ color: isSelected ? t.accentPrimary : t.txtPrimary }}
                          >
                            {displayName}
                          </span>
                          {hasOcr && (
                            <span
                              className="px-1.5 py-0.2 text-[10px] font-bold rounded uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30"
                              title="Vision OCR Fallback Triggered"
                            >
                              OCR
                            </span>
                          )}
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: t.txtMuted }}>
                          {c.stage || c.status}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div
                          className="text-sm font-bold"
                          style={{
                            color: cCost > 0.001 ? t.numNeg : t.txtPrimary,
                            fontFamily: "'Fraunces',serif",
                          }}
                        >
                          ${cCost.toFixed(6)}
                        </div>
                        <ChevronRight
                          size={14}
                          className={`mt-1 transition-transform ${isSelected ? "translate-x-0.5" : "opacity-40"}`}
                          style={{ color: isSelected ? t.accentPrimary : t.txtGhost }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: DETAILED STAGE & MODEL BREAKDOWN ─────────────────── */}
          <div className={`${mobileTab === "detail" ? "flex" : "hidden md:flex"} flex-1 flex-col overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6`}>
            {/* Mobile back to list button */}
            <button
              onClick={() => setMobileTab("list")}
              className="md:hidden self-start min-h-[44px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold active:scale-95 cursor-pointer"
              style={{
                background: hexToRgba(t.bgCard, 0.5),
                color: t.accentPrimary,
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
              }}
            >
              <ChevronLeft size={16} />
              <span>Back to candidates list</span>
            </button>

            {/* Selection Overview Header */}
            <div
              className="p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border"
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.5),
                borderColor: isCampaignSetupSelected
                  ? hexToRgba("#6366F1", 0.4)
                  : hexToRgba(t.accentPrimary, 0.2),
              }}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: t.txtMuted }}>
                  {isCampaignSetupSelected ? "Campaign Setup Overhead Audit" : "Candidate Cost Audit"}
                </div>
                <h4 className="text-2xl font-bold" style={{ color: t.txtPrimary }}>
                  {isCampaignSetupSelected
                    ? "Job Description Extraction & Vector Embedding"
                    : getCandidateDisplayName(selectedCandidate!)}
                </h4>
                <p className="text-xs mt-1" style={{ color: t.txtSecondary }}>
                  {isCampaignSetupSelected ? (
                    <>Campaign: <span className="font-semibold">{campaign.title}</span> • Setup Overhead</>
                  ) : (
                    <>ID: {selectedCandidate?.id} • Status: <span className="font-semibold uppercase" style={{ color: t.accentPrimary }}>{selectedCandidate?.stage || selectedCandidate?.status}</span></>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.txtGhost }}>
                    Input Tokens
                  </div>
                  <div className="text-lg font-bold" style={{ color: t.txtPrimary }}>
                    {totalInputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.txtGhost }}>
                    Output Tokens
                  </div>
                  <div className="text-lg font-bold" style={{ color: t.txtPrimary }}>
                    {totalOutputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="text-center border-l pl-6" style={{ borderColor: hexToRgba(t.txtGhost, 0.2) }}>
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.txtGhost }}>
                    Total Cost
                  </div>
                  <div className="text-2xl font-bold" style={{ color: t.numNeg, fontFamily: "'Fraunces',serif" }}>
                    ${activeCost.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>

            {/* Stage Breakdown Cards */}
            <div className="space-y-4">
              <h5 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: t.txtSecondary }}>
                <Layers size={16} /> Stage & Model Invocations
              </h5>

              {visibleStageKeys.map((stageKey) => {
                const meta = STAGE_META[stageKey];
                const stageData = activeCostBreakdown[stageKey];
                const hasRun = Boolean(stageData);
                const stageCost = stageData?.cost || 0;
                const tokens = stageData?.tokens || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
                const modelName = stageData?.model || meta?.defaultModel || "LLM";

                return (
                  <div
                    key={stageKey}
                    className="p-4 rounded-2xl border transition-all"
                    style={{
                      background: hasRun
                        ? hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.6)
                        : hexToRgba(t.bgPage, t.isDark ? 0.1 : 0.2),
                      borderColor: hasRun
                        ? hexToRgba(meta?.color || t.accentPrimary, 0.3)
                        : hexToRgba(t.txtGhost, 0.1),
                      opacity: hasRun ? 1 : 0.5,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{meta?.icon || "⚙️"}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h6 className="font-bold text-base" style={{ color: t.txtPrimary }}>
                              {meta?.title || stageKey}
                            </h6>
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                              style={{
                                background: hexToRgba(meta?.color || t.accentPrimary, 0.15),
                                color: meta?.color || t.accentPrimary,
                                border: `1px solid ${hexToRgba(meta?.color || t.accentPrimary, 0.3)}`,
                              }}
                            >
                              {modelName}
                            </span>
                          </div>
                          <p className="text-xs mt-1" style={{ color: t.txtMuted }}>
                            Stage Key: <code className="font-mono">{stageKey}</code>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className="text-base font-bold font-mono"
                          style={{ color: hasRun ? t.txtPrimary : t.txtGhost }}
                        >
                          ${stageCost.toFixed(6)}
                        </div>
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider ${
                            hasRun ? "text-emerald-500" : "text-gray-400"
                          }`}
                        >
                          {hasRun ? "✓ Executed" : "Not Triggered"}
                        </span>
                      </div>
                    </div>

                    {/* Token Metrics Sub-Row */}
                    {hasRun && (
                      <div
                        className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-xs"
                        style={{ borderColor: hexToRgba(t.txtGhost, 0.1) }}
                      >
                        <div>
                          <span style={{ color: t.txtGhost }}>Input Tokens: </span>
                          <span className="font-semibold font-mono" style={{ color: t.txtPrimary }}>
                            {tokens.input_tokens?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: t.txtGhost }}>Output Tokens: </span>
                          <span className="font-semibold font-mono" style={{ color: t.txtPrimary }}>
                            {tokens.output_tokens?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: t.txtGhost }}>Total Tokens: </span>
                          <span className="font-semibold font-mono" style={{ color: t.txtPrimary }}>
                            {tokens.total_tokens?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
