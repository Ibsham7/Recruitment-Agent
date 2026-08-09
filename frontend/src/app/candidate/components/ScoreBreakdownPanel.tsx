import { useState, useEffect } from "react";
import { BarChart2, Info, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle, Calculator, ShieldAlert, FileText } from "lucide-react";
import { Theme, Candidate, RequirementItemBreakdown, ExperienceBreakdown, TrajectoryBreakdown, PenaltyBreakdownItem } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export interface ScoreBreakdownPanelProps {
  candidate: Candidate;
  theme: Theme;
}

export function ScoreBreakdownPanel({ candidate, theme: t }: ScoreBreakdownPanelProps) {
  const G = getGlass(t);
  const evalData = candidate.evaluation;
  const breakdown = candidate.scoreBreakdown || evalData?.scoreBreakdown;

  // Track expanded state for each breakdown section
  const [expandedSection, setExpandedSection] = useState<string | null>("skills");
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Esc key listener for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowFormulaModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isStage3Exit = Boolean(
    breakdown?.formula_summary?.includes("Stage 3") ||
    (candidate.fitScore !== null && candidate.fitScore !== undefined && candidate.fitScore < 1.0 && (breakdown?.must_have_breakdown || []).length === 0) ||
    (candidate.score !== undefined && candidate.score < 1.0 && (breakdown?.must_have_breakdown || []).length === 0)
  );

  if (isStage3Exit) {
    return null;
  }

  const reqSkillScore = breakdown?.required_skills_score ?? (candidate.score ?? 50);
  const expScore = breakdown?.experience_score ?? (isStage3Exit ? 0 : (candidate.score ?? 50));
  const niceScore = breakdown?.nice_to_have_score ?? (isStage3Exit ? 0 : (candidate.score ?? 50));
  const trajScore = breakdown?.trajectory_score ?? (isStage3Exit ? 0 : (candidate.score ?? 50));

  const weights = breakdown?.weights || { skills: 0.50, exp: 0.25, nice: 0.15, traj: 0.10 };
  const reqContrib = Number((reqSkillScore * weights.skills).toFixed(1));
  const expContrib = Number((expScore * weights.exp).toFixed(1));
  const niceContrib = Number((niceScore * weights.nice).toFixed(1));
  const trajContrib = Number((trajScore * weights.traj).toFixed(1));

  const rawSum = Number((reqContrib + expContrib + niceContrib + trajContrib).toFixed(1));
  const totalScore = candidate.score ?? Math.round(rawSum);
  const pointsLost = Number((100 - totalScore).toFixed(1));

  // Synthesize requirement items for backward compatibility if backend hasn't stored must_have_breakdown
  let mustHaveItems: RequirementItemBreakdown[] = breakdown?.must_have_breakdown || [];
  let niceHaveItems: RequirementItemBreakdown[] = breakdown?.nice_to_have_breakdown || [];
  const expBreakdown: ExperienceBreakdown | undefined = breakdown?.experience_breakdown;
  const trajBreakdown: TrajectoryBreakdown | undefined = breakdown?.trajectory_breakdown;
  const penalties: PenaltyBreakdownItem[] = breakdown?.penalties_breakdown || [];

  if (!isStage3Exit && mustHaveItems.length === 0 && candidate.strengths && candidate.concerns) {
    const strengths = candidate.strengths.filter((s) => s !== "Strong foundational qualifications" && !s.startsWith("No key"));
    const concerns = candidate.concerns;
    // Derive items from strengths and concerns for older candidate records
    const synthesizedMust: RequirementItemBreakdown[] = [];
    strengths.forEach((s) => {
      synthesizedMust.push({
        requirement: s.split("(")[0].trim(),
        match: "full",
        points_earned: Number((50 / Math.max(1, strengths.length)).toFixed(1)),
        max_points: Number((50 / Math.max(1, strengths.length)).toFixed(1)),
        percentage: 100,
        evidence: s.includes("(") ? s.substring(s.indexOf("(") + 1, s.lastIndexOf(")")) : "Matches JD requirement",
        deduction_reason: "Full credit awarded"
      });
    });
    concerns.forEach((c) => {
      const isCritical = c.includes("[CRITICAL GAP]") || c.includes("Missing Must-Have");
      const isModerate = c.includes("[MODERATE GAP]") || c.includes("Partial Skill Match");
      if (isCritical || isModerate) {
        synthesizedMust.push({
          requirement: c.replace(/\[.*?\]/, "").replace("Missing Must-Have:", "").replace("Partial Skill Match:", "").trim(),
          match: isModerate ? "partial" : "none",
          points_earned: isModerate ? Number((25 / Math.max(1, concerns.length)).toFixed(1)) : 0,
          max_points: Number((50 / Math.max(1, concerns.length)).toFixed(1)),
          percentage: isModerate ? 50 : 0,
          evidence: "Extracted from candidate evaluation gap analysis",
          deduction_reason: isModerate ? "Partial evidence in CV (-50% deduction)" : "Requirement missing in candidate CV (-100% deduction)"
        });
      }
    });
    if (synthesizedMust.length > 0) {
      mustHaveItems = synthesizedMust;
    }
  }

  const items = [
    { id: "skills", label: "Required Skills", weight: `${Math.round(weights.skills * 100)}%`, score: reqSkillScore, contrib: reqContrib, maxContrib: Math.round(weights.skills * 100), color: t.accentPrimary, count: mustHaveItems.length },
    { id: "exp", label: "Experience & Tenure", weight: `${Math.round(weights.exp * 100)}%`, score: expScore, contrib: expContrib, maxContrib: Math.round(weights.exp * 100), color: expScore < 60 ? "#f59e0b" : t.numPos, count: expBreakdown ? 1 : 0 },
    { id: "nice", label: "Nice-to-Have Skills", weight: `${Math.round(weights.nice * 100)}%`, score: niceScore, contrib: niceContrib, maxContrib: Math.round(weights.nice * 100), color: t.numMid, count: niceHaveItems.length },
    { id: "traj", label: "Growth Trajectory", weight: `${Math.round(weights.traj * 100)}%`, score: trajScore, contrib: trajContrib, maxContrib: Math.round(weights.traj * 100), color: t.accentBadge, count: trajBreakdown ? 1 : 0 },
  ];

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="rounded-2xl p-5 relative transition-all" style={G.card}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.4)}` }}>
        <div className="flex items-center gap-2">
          <BarChart2 size={16} style={{ color: t.accentBadge }} />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: t.txtPrimary }}>
              Transparent XAI Scoring Audit
              <span className="text-[9px] px-2 py-0.5 rounded-md font-mono uppercase font-semibold" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>
                100% Explained
              </span>
            </div>
            <p className="text-[10px]" style={{ color: t.txtMuted }}>
              Granular point-by-point breakdown & mathematical attribution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFormulaModal(true)}
            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all hover:opacity-80 cursor-pointer"
            style={{
              background: hexToRgba(t.accentBadge, 0.12),
              color: t.accentBadge,
              border: `1px solid ${hexToRgba(t.accentBadge, 0.25)}`,
            }}
            title="Click to inspect exact mathematical formula"
          >
            <Calculator size={12} />
            <span>Formula</span>
          </button>

          <div
            className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg"
            style={{
              background: hexToRgba(t.numNeg, 0.12),
              color: t.numNeg,
              border: `1px solid ${hexToRgba(t.numNeg, 0.25)}`,
            }}
          >
            <span>-{pointsLost} Pts Deducted</span>
          </div>
        </div>
      </div>

      {/* Mathematical Formula Summary Bar */}
      <div
        className="mb-4 p-3 rounded-xl flex items-center justify-between text-[10px] font-mono"
        style={{
          background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.6),
          border: `1px solid ${hexToRgba(t.bgCard, 0.5)}`,
          color: t.txtSecondary,
        }}
      >
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-semibold" style={{ color: t.txtPrimary }}>Equation:</span>
          {isStage3Exit ? (
            <span>
              Fit Score ({totalScore}) = <span style={{ color: t.numNeg }}>{totalScore}</span> (Semantic Similarity Vector Match) — Filtered at Stage 3 Early Exit
            </span>
          ) : (
            <span>
              Fit Score ({totalScore}) = <span style={{ color: t.accentPrimary }}>{reqContrib}</span> (Skills) +{" "}
              <span style={{ color: expScore < 60 ? "#f59e0b" : t.numPos }}>{expContrib}</span> (Exp) +{" "}
              <span style={{ color: t.numMid }}>{niceContrib}</span> (Nice) +{" "}
              <span style={{ color: t.accentBadge }}>{trajContrib}</span> (Traj)
              {penalties.length > 0 && <span style={{ color: t.numNeg }}> - {penalties.reduce((sum, p) => sum + p.points_deducted, 0)} (Penalties)</span>}
            </span>
          )}
        </div>
      </div>

      {/* Category Progress Bars with Expanders */}
      <div className="space-y-3">
        {items.map((item) => {
          const isExpanded = expandedSection === item.id;

          return (
            <div
              key={item.id}
              className="rounded-xl transition-all overflow-hidden"
              style={{
                background: isExpanded ? hexToRgba(t.bgPage, 0.3) : "transparent",
                border: `1px solid ${isExpanded ? hexToRgba(item.color, 0.3) : hexToRgba(t.bgCard, 0.2)}`,
              }}
            >
              {/* Header Bar Clickable */}
              <button
                onClick={() => toggleSection(item.id)}
                className="w-full p-3 flex flex-col gap-1.5 text-left cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center justify-between text-[11px]" style={{ color: t.txtBody }}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: t.txtPrimary }}>{item.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded" style={{ background: hexToRgba(t.bgCard, 0.5), color: t.txtMuted }}>
                      {item.weight} weight
                    </span>
                    {item.count > 0 && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono" style={{ background: hexToRgba(item.color, 0.15), color: item.color }}>
                        {item.count} criteria
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px]">
                      <span className="font-bold" style={{ color: item.color }}>{item.contrib}</span> / {item.maxContrib} pts
                      <span className="text-[10px] ml-1.5 opacity-70">({item.score}/100)</span>
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={14} style={{ color: t.txtMuted }} />
                    ) : (
                      <ChevronDown size={14} style={{ color: t.txtMuted }} />
                    )}
                  </div>
                </div>

                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: hexToRgba(t.bgCard, 0.6) }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.score))}%`,
                      backgroundColor: item.color,
                      boxShadow: `0 0 8px ${hexToRgba(item.color, 0.5)}`,
                    }}
                  />
                </div>
              </button>

              {/* Itemized Granular Content Drawer */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t" style={{ borderColor: hexToRgba(t.bgCard, 0.3) }}>
                  {/* Required Skills Expanded */}
                  {item.id === "skills" && (
                    <div className="space-y-2">
                      {mustHaveItems.length === 0 ? (
                        <p className="text-[11px] italic p-2" style={{ color: t.txtMuted }}>
                          {isStage3Exit
                            ? "Qualitative LLM requirement breakdown was bypassed due to Stage 3 domain semantic similarity threshold filtering."
                            : "No specific must-have requirement breakdown stored."}
                        </p>
                      ) : (
                        mustHaveItems.map((req, idx) => {
                          const isFull = req.match === "full";
                          const isPartial = req.match === "partial";
                          const badgeColor = isFull ? t.numPos : isPartial ? "#f59e0b" : t.numNeg;
                          const IconComp = isFull ? CheckCircle2 : isPartial ? AlertTriangle : XCircle;

                          return (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg space-y-1.5 transition-all text-[11px]"
                              style={{
                                background: hexToRgba(badgeColor, 0.06),
                                border: `1px solid ${hexToRgba(badgeColor, 0.2)}`,
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-medium" style={{ color: t.txtPrimary }}>
                                  <IconComp size={13} style={{ color: badgeColor }} />
                                  <span>{req.requirement}</span>
                                </div>

                                <div className="flex items-center gap-2 font-mono">
                                  <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold" style={{ background: hexToRgba(badgeColor, 0.18), color: badgeColor }}>
                                    {req.match} ({req.percentage}%)
                                  </span>
                                  <span className="font-semibold" style={{ color: badgeColor }}>
                                    +{req.points_earned} / {req.max_points} pts
                                  </span>
                                </div>
                              </div>

                              {req.evidence && (
                                <div className="flex items-start gap-1 text-[10px] pl-5 italic" style={{ color: t.txtBody }}>
                                  <FileText size={11} className="flex-shrink-0 mt-0.5 opacity-70" />
                                  <span>"{req.evidence}"</span>
                                </div>
                              )}

                              {req.deduction_reason && !isFull && (
                                <div className="text-[10px] pl-5 font-mono" style={{ color: t.numNeg }}>
                                  ⚠️ {req.deduction_reason}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Experience & Tenure Expanded */}
                  {item.id === "exp" && (
                    <div className="p-3 rounded-lg space-y-2 text-[11px]" style={{ background: hexToRgba(t.bgCard, 0.2), border: `1px solid ${hexToRgba(t.bgCard, 0.4)}` }}>
                      <div className="flex items-center justify-between font-mono">
                        <span style={{ color: t.txtMuted }}>Total Evaluated Tenure:</span>
                        <span className="font-bold" style={{ color: t.txtPrimary }}>
                          {expBreakdown?.candidate_years !== undefined && expBreakdown.candidate_years !== null
                            ? `${expBreakdown.candidate_years} Years`
                            : candidate.experience || "Extracted from CV"}
                        </span>
                      </div>

                      {expBreakdown?.calculation && (
                        <div className="p-2 rounded bg-black/10 font-mono text-[10px] space-y-1" style={{ color: t.txtSecondary }}>
                          <span className="font-semibold block text-white/80">Tenure Calculation:</span>
                          <p>{expBreakdown.calculation}</p>
                        </div>
                      )}

                      <div className="text-[11px] leading-relaxed" style={{ color: t.txtBody }}>
                        <strong>Assessment Rationale:</strong>{" "}
                        {expBreakdown?.assessment || evalData?.summary || "Experience evaluated against JD target seniority requirements."}
                      </div>
                    </div>
                  )}

                  {/* Nice-to-Have Skills Expanded */}
                  {item.id === "nice" && (
                    <div className="space-y-2">
                      {niceHaveItems.length === 0 ? (
                        <p className="text-[11px] italic p-2" style={{ color: t.txtMuted }}>No preferred nice-to-have requirements specified in JD.</p>
                      ) : (
                        niceHaveItems.map((req, idx) => {
                          const isFull = req.match === "full";
                          const isPartial = req.match === "partial";
                          const badgeColor = isFull ? t.numPos : isPartial ? "#f59e0b" : t.txtMuted;

                          return (
                            <div key={idx} className="p-2.5 rounded-lg flex items-center justify-between text-[11px]" style={{ background: hexToRgba(badgeColor, 0.05), border: `1px solid ${hexToRgba(badgeColor, 0.15)}` }}>
                              <div className="space-y-0.5">
                                <span className="font-medium block" style={{ color: t.txtPrimary }}>{req.requirement}</span>
                                {req.evidence && <span className="text-[10px] italic block" style={{ color: t.txtMuted }}>"{req.evidence}"</span>}
                              </div>
                              <div className="font-mono text-right">
                                <span className="font-semibold block" style={{ color: badgeColor }}>+{req.points_earned} / {req.max_points} pts</span>
                                <span className="text-[9px] uppercase font-semibold" style={{ color: badgeColor }}>{req.match}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Growth Trajectory Expanded */}
                  {item.id === "traj" && (
                    <div className="p-3 rounded-lg space-y-3 text-[11px]" style={{ background: hexToRgba(t.accentBadge, 0.06), border: `1px solid ${hexToRgba(t.accentBadge, 0.2)}` }}>
                      <div className="flex items-center justify-between font-mono">
                        <span style={{ color: t.txtMuted }}>Trajectory Score:</span>
                        <span className="font-bold" style={{ color: t.accentBadge }}>{trajScore} / 100 ({trajContrib} pts earned)</span>
                      </div>

                      {/* Explanation & Rubric Info Banner */}
                      <div className="p-2.5 rounded bg-black/20 space-y-1.5 border border-white/10 text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider" style={{ color: t.accentBadge }}>
                          <Info size={12} />
                          <span>How Growth Trajectory is Scored</span>
                        </div>
                        <p style={{ color: t.txtSecondary }}>
                          Growth Trajectory evaluates verifiable historical profile signals (0-100 pts) across 4 dimensions:
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-[10px]" style={{ color: t.txtMuted }}>
                          <li><strong>Career Progression (25 pts):</strong> ≥3 titles (25 pts), 2 titles (15 pts), 1 title (7 pts)</li>
                          <li><strong>Skill Breadth (25 pts):</strong> ≥8 skills (25 pts), 4-7 skills (15 pts), 1-3 skills (7 pts)</li>
                          <li><strong>Proven Deliverables (25 pts):</strong> ≥3 projects/achievements (25 pts), 1-2 projects (12 pts)</li>
                          <li><strong>Degree Relevance Guardrail (25 pts):</strong> Domain-relevant (18-25 pts), Adjacent/STEM (10-14 pts), Unrelated (5 pts)</li>
                        </ul>
                      </div>

                      {/* Itemized Sub-Criteria Breakdown */}
                      {trajBreakdown?.sub_criteria && trajBreakdown.sub_criteria.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="font-semibold block text-white/90 text-[11px]">Sub-Criteria Breakdown & CV Evidence:</span>
                          {trajBreakdown.sub_criteria.map((sub, idx) => {
                            const badgeColor = sub.status === "full" ? t.numPos : sub.status === "partial" ? "#f59e0b" : t.txtMuted;
                            return (
                              <div key={idx} className="p-2.5 rounded-lg space-y-1" style={{ background: hexToRgba(badgeColor, 0.05), border: `1px solid ${hexToRgba(badgeColor, 0.15)}` }}>
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white/90">{sub.criterion_name}</span>
                                  <span className="font-mono font-bold" style={{ color: badgeColor }}>+{sub.points_earned} / {sub.max_points} pts</span>
                                </div>
                                <div className="text-[10px] font-mono text-white/60">
                                  Rule: {sub.rubric_rule}
                                </div>
                                {sub.evidence && (
                                  <div className="text-[10px] italic p-1.5 rounded bg-black/20 text-white/80">
                                    "{sub.evidence}"
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Formula Summary Banner */}
                      {trajBreakdown?.calculation_summary && (
                        <div className="p-2 rounded bg-black/10 font-mono text-[10px] space-y-0.5" style={{ color: t.txtSecondary }}>
                          <span className="font-semibold block text-white/80">Trajectory Formula:</span>
                          <p>{trajBreakdown.calculation_summary}</p>
                        </div>
                      )}

                      <div className="text-[10px] leading-relaxed pt-1" style={{ color: t.txtBody }}>
                        <strong>Assessment Rationale:</strong>{" "}
                        {trajBreakdown?.assessment || "High growth signal evaluated from academic rigor, project complexity, and rapid technology adoption rate."}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Applied Penalties Section if present */}
      {penalties.length > 0 && (
        <div className="mt-4 p-3 rounded-xl space-y-2 text-[11px]" style={{ background: hexToRgba(t.numNeg, 0.08), border: `1px solid ${hexToRgba(t.numNeg, 0.3)}` }}>
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]" style={{ color: t.numNeg }}>
            <ShieldAlert size={14} />
            <span>Hard Penalties & Hard Filter Deductions</span>
          </div>
          {penalties.map((pen, idx) => (
            <div key={idx} className="flex items-center justify-between font-mono text-[10px]">
              <span style={{ color: t.txtBody }}>• {pen.reason}</span>
              <span className="font-bold" style={{ color: t.numNeg }}>-{pen.points_deducted} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-4 pt-3 flex items-start gap-2 text-[10px]" style={{ borderTop: `1px solid ${hexToRgba(t.bgCard, 0.4)}`, color: t.txtMuted }}>
        <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: t.accentBadge }} />
        <span>
          Mathematical attribution: Overall Fit Score ({totalScore}/100) is deterministically computed from per-item match criteria and tenure depth formulas with zero LLM math variance.
        </span>
      </div>

      {/* Formula & Calculator Modal */}
      {showFormulaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowFormulaModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            style={{ ...G.card, background: t.bgSurface, border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="flex items-center justify-between pb-4 border-b shrink-0 z-10" style={{ borderColor: hexToRgba(t.bgCard, 0.4) }}>
              <div className="flex items-center gap-2">
                <Calculator size={18} style={{ color: t.accentPrimary }} />
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: t.txtPrimary }}>
                  Scoring Engine Formula & Weights
                </h3>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="text-[12px] font-mono px-2 py-1 rounded cursor-pointer hover:opacity-80"
                style={{ background: hexToRgba(t.numNeg, 0.15), color: t.numNeg }}
              >
                ✕ Close
              </button>
            </div>

            {/* Independent Scroll Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-[11px]" style={{ color: t.txtBody }}>
              <div className="p-3 rounded-xl space-y-2 font-mono text-[10px]" style={{ background: hexToRgba(t.accentPrimary, 0.08), border: `1px solid ${hexToRgba(t.accentPrimary, 0.2)}` }}>
                <span className="font-bold block" style={{ color: t.accentPrimary }}>Formula Breakdown Equation:</span>
                <p>Fit Score = (Required Skills × {weights.skills}) + (Experience × {weights.exp}) + (Nice-to-Have × {weights.nice}) + (Trajectory × {weights.traj}) - Hard Penalties</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: t.txtMuted }}>Sub-Component Weight Allocations:</h4>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="p-2.5 rounded-lg border" style={{ borderColor: hexToRgba(t.accentPrimary, 0.3) }}>
                    <span className="block font-bold" style={{ color: t.accentPrimary }}>Required Skills ({Math.round(weights.skills * 100)}%)</span>
                    <span>Max {Math.round(weights.skills * 100)} pts allocation across all mandatory JD requirements.</span>
                  </div>

                  <div className="p-2.5 rounded-lg border" style={{ borderColor: hexToRgba(t.numPos, 0.3) }}>
                    <span className="block font-bold" style={{ color: expScore < 60 ? "#f59e0b" : t.numPos }}>Experience ({Math.round(weights.exp * 100)}%)</span>
                    <span>Max {Math.round(weights.exp * 100)} pts allocation based on candidate years vs required target years.</span>
                  </div>

                  <div className="p-2.5 rounded-lg border" style={{ borderColor: hexToRgba(t.numMid, 0.3) }}>
                    <span className="block font-bold" style={{ color: t.numMid }}>Nice-to-Have ({Math.round(weights.nice * 100)}%)</span>
                    <span>Max {Math.round(weights.nice * 100)} pts allocation for optional preferred skills.</span>
                  </div>

                  <div className="p-2.5 rounded-lg border" style={{ borderColor: hexToRgba(t.accentBadge, 0.3) }}>
                    <span className="block font-bold" style={{ color: t.accentBadge }}>Trajectory ({Math.round(weights.traj * 100)}%)</span>
                    <span>Max {Math.round(weights.traj * 100)} pts allocation for growth velocity and learning capacity.</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl space-y-1 text-[10px]" style={{ background: hexToRgba(t.bgPage, 0.4), border: `1px solid ${hexToRgba(t.bgCard, 0.4)}` }}>
                <span className="font-bold block" style={{ color: t.txtPrimary }}>Strictness Mode: {breakdown?.eval_mode ? (breakdown.eval_mode.charAt(0).toUpperCase() + breakdown.eval_mode.slice(1)) : "Moderate"}</span>
                <p style={{ color: t.txtMuted }}>
                  {breakdown?.eval_mode === "strict"
                    ? "Strict mode: requires exact direct evidence. Partial matches get 25% credit max, growth trajectory is strictly capped (0-50), and penalties scale by 1.5x."
                    : breakdown?.eval_mode === "lenient"
                    ? "Lenient mode: values transferable skills and growth potential. Partial matches get 75-80% credit, growth trajectory gets 80-100 credit, and penalties scale by 0.5x."
                    : "Moderate mode: balanced matching where full matches receive 100% and partial matches receive 50% credit with standard 1.0x penalty scaling."}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t flex justify-end shrink-0 z-10" style={{ borderColor: hexToRgba(t.bgCard, 0.4) }}>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
                style={{ background: t.accentPrimary, color: "#ffffff" }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
