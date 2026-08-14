import { useState } from "react";
import { DollarSign, ChevronDown, ChevronUp, Layers, Cpu } from "lucide-react";
import { Candidate, Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

const STAGE_META: Record<string, { title: string; defaultModel: string; icon: string; color: string }> = {
  jd_extraction: { title: "JD Extraction & Spec Distillation", defaultModel: "google/gemini-3.1-flash-lite", icon: "📑", color: "#6366F1" },
  jd_embedding: { title: "JD Vector Embedding", defaultModel: "text-embedding-3-small", icon: "⚡", color: "#059669" },
  cv_parser: { title: "CV Parser & Extraction", defaultModel: "google/gemini-3.1-flash-lite", icon: "📄", color: "#3B82F6" },
  jd_matcher: { title: "JD Screening & Scoring", defaultModel: "google/gemini-3.1-flash-lite", icon: "🎯", color: "#10B981" },
  question_generator: { title: "Question Generator", defaultModel: "google/gemini-3.1-flash-lite", icon: "❓", color: "#8B5CF6" },
  interviewer_probe: { title: "Adaptive Interview Probe", defaultModel: "google/gemini-3.1-flash-lite", icon: "💬", color: "#F59E0B" },
  evaluator: { title: "Evaluation Engine", defaultModel: "google/gemini-3.1-flash-lite", icon: "📊", color: "#EC4899" },
  embedding_matcher: { title: "PGVector Embedding", defaultModel: "text-embedding-3-small", icon: "🔍", color: "#06B6D4" },
};

export function CostBreakdownCard({ candidate, theme: t }: { candidate: Candidate; theme: Theme }) {
  const G = getGlass(t);
  const [isExpanded, setIsExpanded] = useState(false);

  const costBreakdown: Record<string, any> = candidate.costBreakdown || {};
  const apiCost = candidate.apiCost || 0;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;

  Object.values(costBreakdown).forEach((stage: any) => {
    if (stage?.tokens) {
      totalInputTokens += stage.tokens.input_tokens || 0;
      totalOutputTokens += stage.tokens.output_tokens || 0;
      totalTokens += stage.tokens.total_tokens || 0;
    }
  });

  return (
    <div
      className="rounded-3xl p-6 transition-all border"
      style={{
        ...G.card,
        borderColor: hexToRgba(t.accentPrimary, 0.25),
      }}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg"
            style={{
              background: hexToRgba(t.numNeg, 0.15),
              color: t.numNeg,
              border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`,
            }}
          >
            <DollarSign size={20} />
          </div>
          <div>
            <h4 className="text-lg font-bold flex items-center gap-2" style={{ color: t.txtPrimary }}>
              API Cost & Model Telemetry Analysis
            </h4>
            <p className="text-xs" style={{ color: t.txtMuted }}>
              Total Candidate API Consumption: <span className="font-bold" style={{ color: t.numNeg }}>${apiCost.toFixed(6)}</span> ({totalTokens.toLocaleString()} tokens)
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          style={{
            background: hexToRgba(t.accentPrimary, 0.15),
            color: t.accentPrimary,
            border: `1px solid ${hexToRgba(t.accentPrimary, 0.25)}`,
          }}
        >
          {isExpanded ? "Collapse" : "Inspect Breakdown"}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded Stage Breakdown */}
      {isExpanded && (
        <div className="mt-5 pt-5 border-t space-y-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-2xl text-xs" style={{ background: hexToRgba(t.bgPage, t.isDark ? 0.3 : 0.6) }}>
            <div>
              <div style={{ color: t.txtGhost }}>Prompt Input Tokens</div>
              <div className="text-sm font-bold font-mono" style={{ color: t.txtPrimary }}>{totalInputTokens.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: t.txtGhost }}>Completion Output Tokens</div>
              <div className="text-sm font-bold font-mono" style={{ color: t.txtPrimary }}>{totalOutputTokens.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: t.txtGhost }}>Total Stage Cost</div>
              <div className="text-sm font-bold font-mono" style={{ color: t.numNeg }}>${apiCost.toFixed(6)}</div>
            </div>
          </div>

          <div className="space-y-2.5">
            {Object.keys(STAGE_META).map((stageKey) => {
              const meta = STAGE_META[stageKey];
              const stageData = costBreakdown[stageKey];
              const hasRun = Boolean(stageData);
              const stageCost = stageData?.cost || 0;
              const tokens = stageData?.tokens || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
              const modelName = stageData?.model || meta.defaultModel;

              return (
                <div
                  key={stageKey}
                  className="p-3.5 rounded-2xl border text-xs flex items-center justify-between"
                  style={{
                    background: hasRun
                      ? hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.7)
                      : hexToRgba(t.bgPage, 0.1),
                    borderColor: hasRun
                      ? hexToRgba(meta.color, 0.25)
                      : hexToRgba(t.txtGhost, 0.1),
                    opacity: hasRun ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{meta.icon}</span>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2" style={{ color: t.txtPrimary }}>
                        {meta.title}
                        <span
                          className="px-2 py-0.2 text-[10px] font-mono font-semibold rounded"
                          style={{
                            background: hexToRgba(meta.color, 0.15),
                            color: meta.color,
                          }}
                        >
                          {modelName}
                        </span>
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: t.txtGhost }}>
                        Input: {tokens.input_tokens?.toLocaleString() || 0} • Output: {tokens.output_tokens?.toLocaleString() || 0}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-sm font-mono" style={{ color: hasRun ? t.numNeg : t.txtGhost }}>
                      ${stageCost.toFixed(6)}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: hasRun ? meta.color : t.txtGhost }}>
                      {hasRun ? "Executed" : "Skipped"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
