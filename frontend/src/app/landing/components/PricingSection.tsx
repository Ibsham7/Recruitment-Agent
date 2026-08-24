import { useState } from "react";
import { motion } from "motion/react";
import { 
  Zap, 
  Coins, 
  ShieldCheck, 
  Layers, 
  FileText, 
  UserCheck, 
  Send, 
  ArrowUpRight, 
  ArrowRight,
  Check, 
  Cpu, 
  FileSearch,
  SlidersHorizontal,
  Calculator
} from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

interface PricingSectionProps {
  theme: Theme;
  onEnter: () => void;
}

export function PricingSection({ theme: t, onEnter }: PricingSectionProps) {
  const G = getGlass(t);
  const isDark = t.isDark;

  // Mode: "engine" (Preset & Slider) vs "simulator" (Hiring Volume Pipeline ROI)
  const [activeTab, setActiveTab] = useState<"engine" | "simulator">("engine");

  // State for Option 1: Top-Up Engine
  const [depositAmount, setDepositAmount] = useState<number>(10);
  const credits = depositAmount * 100;
  const cvCapacity = credits;
  const evalCapacity = Math.floor(credits / 2);
  const campCapacity = credits;

  // State for Option 2: Pipeline Simulator
  const [simResumes, setSimResumes] = useState<number>(300);
  const [simInterviews, setSimInterviews] = useState<number>(25);

  const simCvCredits = simResumes * 1;
  const simInterviewCredits = simInterviews * 3; // 1 Cr invite + 2 Cr Claude evaluation
  const simCampCredits = 2;
  const simTotalCredits = simCvCredits + simInterviewCredits + simCampCredits;
  const simTotalUsd = (simTotalCredits / 100).toFixed(2);

  return (
    <section id="ha-pricing" className="w-full px-4 sm:px-8 lg:px-12 py-24 max-w-7xl mx-auto overflow-hidden">
      
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <div 
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-3 border"
          style={{ 
            color: t.accentBadge, 
            background: hexToRgba(t.accentBadge, 0.10), 
            borderColor: hexToRgba(t.accentBadge, 0.25), 
            fontFamily: "'DM Mono', monospace" 
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: t.accentBadge }} />
          Credit-Based Unit Economics // $1 = 100 Credits
        </div>

        <h2 
          style={{ 
            fontFamily: "'Fraunces', serif", 
            color: t.txtPrimary, 
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)", 
            fontWeight: 600, 
            lineHeight: 1.15,
            whiteSpace: "pre-line"
          }}
        >
          Pay only for the compute you use.{"\n"}Zero monthly subscription traps.
        </h2>

        <p className="max-w-2xl mx-auto text-xs sm:text-sm mt-3 leading-relaxed" style={{ color: t.txtSecondary }}>
          Generous Free Starter tier included with every account. When you scale, top up credits valid for a full year with 100% transparent unit economics.
        </p>

        {/* Interactive Mode Pill Switcher */}
        <div className="mt-6 inline-flex p-1 rounded-2xl border" style={{ ...G.card, borderColor: hexToRgba(t.txtBody, 0.12) }}>
          <button
            onClick={() => setActiveTab("engine")}
            className="px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: activeTab === "engine" ? t.accentBadge : "transparent",
              color: activeTab === "engine" ? t.accentText : t.txtSecondary,
              boxShadow: activeTab === "engine" ? `0 2px 12px ${hexToRgba(t.accentBadge, 0.35)}` : "none"
            }}
          >
            <Zap size={13} />
            <span>Credit Engine & Capacity</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className="px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: activeTab === "simulator" ? t.accentBadge : "transparent",
              color: activeTab === "simulator" ? t.accentText : t.txtSecondary,
              boxShadow: activeTab === "simulator" ? `0 2px 12px ${hexToRgba(t.accentBadge, 0.35)}` : "none"
            }}
          >
            <Calculator size={13} />
            <span>Pipeline ROI Simulator</span>
          </button>
        </div>
      </motion.div>

      {/* ── TAB 1: ASYMMETRIC CREDIT ENGINE & CAPACITY RUNWAY ──────────────── */}
      {activeTab === "engine" && (
        <motion.div
          key="engine-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* LEFT POD: Free Starter Tier Allowance (Col Span 5) */}
            <div 
              className="lg:col-span-5 rounded-3xl p-6 sm:p-8 flex flex-col justify-between border relative overflow-hidden transition-all duration-300"
              style={{
                ...G.card,
                borderColor: hexToRgba(t.accentPrimary, 0.22)
              }}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span 
                    className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border"
                    style={{
                      background: hexToRgba(t.txtMuted, 0.12),
                      color: t.txtSecondary,
                      borderColor: hexToRgba(t.txtMuted, 0.25)
                    }}
                  >
                    <Zap size={12} />
                    Free Starter Tier
                  </span>
                  <span className="text-xs font-mono font-bold" style={{ color: t.numPos }}>
                    $0.00 / 1-YEAR ACCESS
                  </span>
                </div>

                <div>
                  <div className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
                    $0 <span className="text-xs font-sans font-normal opacity-70">/ no credit card required</span>
                  </div>
                  <p className="text-xs sm:text-sm mt-2 leading-relaxed" style={{ color: t.txtSecondary }}>
                    Every account receives a free starter allowance to launch live campaigns and experience zero-hallucination candidate screening.
                  </p>
                </div>

                {/* Quota Progress Meters */}
                <div className="space-y-3 pt-2">
                  <div 
                    className="p-3.5 rounded-2xl border space-y-1.5"
                    style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtMuted, 0.18) }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                        <Layers size={13} className="text-blue-400" />
                        Campaigns Allowance
                      </span>
                      <span className="font-mono font-bold" style={{ color: t.numPos }}>5 Campaigns</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/20">
                      <div className="h-full rounded-full" style={{ width: "100%", background: t.accentBadge }} />
                    </div>
                    <div className="text-[10px]" style={{ color: t.txtMuted }}>Create job openings and configure screening criteria</div>
                  </div>

                  <div 
                    className="p-3.5 rounded-2xl border space-y-1.5"
                    style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtMuted, 0.18) }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                        <FileText size={13} className="text-emerald-400" />
                        CV Uploads & Screening
                      </span>
                      <span className="font-mono font-bold" style={{ color: t.numPos }}>100 CVs</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/20">
                      <div className="h-full rounded-full" style={{ width: "100%", background: t.accentBadge }} />
                    </div>
                    <div className="text-[10px]" style={{ color: t.txtMuted }}>Upload, score, and rank candidate resumes with quote evidence</div>
                  </div>

                  <div 
                    className="p-3.5 rounded-2xl border space-y-1.5"
                    style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtMuted, 0.18) }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                        <UserCheck size={13} className="text-purple-400" />
                        AI Interview Evaluations
                      </span>
                      <span className="font-mono font-bold" style={{ color: t.numPos }}>5 Candidates</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/20">
                      <div className="h-full rounded-full" style={{ width: "100%", background: t.accentBadge }} />
                    </div>
                    <div className="text-[10px]" style={{ color: t.txtMuted }}>Adaptive interview questions, cheating detection & scorecards</div>
                  </div>
                </div>

                {/* Features Checklist */}
                <div className="pt-2 border-t space-y-2 text-xs" style={{ borderColor: hexToRgba(t.txtBody, 0.08), color: t.txtSecondary }}>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Supports PDF, Word (DOCX), and scanned resumes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Built-in anti-cheat and copy-paste detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>1-Year validity — access full screening features for 12 months</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={onEnter}
                  className="cursor-target w-full py-3.5 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider border transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{
                    background: hexToRgba(t.bgPage, 0.6),
                    borderColor: hexToRgba(t.txtBody, 0.15),
                    color: t.txtPrimary
                  }}
                >
                  <span>Start Free Pipeline</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* RIGHT COMMAND HUB: Pro Pay-As-You-Go Credit Vault (Col Span 7) */}
            <div 
              className="lg:col-span-7 rounded-3xl p-6 sm:p-8 flex flex-col justify-between border relative overflow-hidden shadow-2xl transition-all"
              style={{
                ...G.cardWarm,
                borderColor: hexToRgba(t.accentBadge, 0.35),
                boxShadow: `0 8px 36px ${hexToRgba(t.accentBadge, 0.12)}`
              }}
            >
              <div className="space-y-6">
                
                {/* Top Tag & Exchange Rate Pill */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                      style={{ background: t.accentBadge, color: t.accentText }}
                    >
                      <Coins size={13} />
                      Pay-As-You-Go Credit Vault
                    </span>
                    <span 
                      className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border"
                      style={{ 
                        color: t.accentBadge, 
                        background: hexToRgba(t.accentBadge, 0.10), 
                        borderColor: hexToRgba(t.accentBadge, 0.25) 
                      }}
                    >
                      $1.00 = 100 CREDITS
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold" style={{ color: t.numPos }}>
                    <ShieldCheck size={14} />
                    <span>1-YEAR CREDIT VALIDITY</span>
                  </div>
                </div>

                {/* Preset Top-Up Buttons */}
                <div>
                  <div className="text-xs font-mono uppercase font-semibold tracking-wider mb-2.5" style={{ color: t.txtMuted }}>
                    Select Top-Up Preset or Adjust Custom Slider:
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { usd: 10, credits: "1,000 Cr", label: "Starter Pack" },
                      { usd: 20, credits: "2,000 Cr", label: "Growth Pack" },
                      { usd: 50, credits: "5,000 Cr", label: "Scale Blitz" },
                      { usd: 100, credits: "10,000 Cr", label: "Enterprise" },
                    ].map((pack) => {
                      const isSelected = depositAmount === pack.usd;
                      return (
                        <button
                          key={pack.usd}
                          type="button"
                          onClick={() => setDepositAmount(pack.usd)}
                          className="cursor-target p-3 rounded-2xl border text-center transition-all hover:scale-105 active:scale-95 font-mono"
                          style={{
                            background: isSelected ? hexToRgba(t.accentBadge, 0.15) : hexToRgba(t.bgPage, 0.4),
                            borderColor: isSelected ? t.accentBadge : hexToRgba(t.txtBody, 0.12),
                            boxShadow: isSelected ? `0 0 16px ${hexToRgba(t.accentBadge, 0.25)}` : "none"
                          }}
                        >
                          <div className="text-base font-extrabold" style={{ color: t.txtPrimary }}>
                            ${pack.usd}
                          </div>
                          <div className="text-[11px] font-bold" style={{ color: t.accentBadge }}>
                            {pack.credits}
                          </div>
                          <div className="text-[9px]" style={{ color: t.txtMuted }}>
                            {pack.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive Slider */}
                <div 
                  className="p-4 rounded-2xl border space-y-3"
                  style={{ background: hexToRgba(t.bgPage, 0.45), borderColor: hexToRgba(t.txtBody, 0.12) }}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span style={{ color: t.txtSecondary }}>Custom Deposit Value:</span>
                    <span className="font-bold text-sm" style={{ color: t.accentBadge }}>
                      ${depositAmount} USD = {credits.toLocaleString()} Credits
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono" style={{ color: t.txtMuted }}>
                    <span>$5 (500 Cr)</span>
                    <span>$50 (5,000 Cr)</span>
                    <span>$100 (10,000 Cr)</span>
                    <span>$200 (20,000 Cr)</span>
                  </div>
                </div>

                {/* AI Capacity Runway Forecast */}
                <div 
                  className="p-5 rounded-2xl border space-y-3"
                  style={{ background: hexToRgba(t.bgSurface, 0.6), borderColor: hexToRgba(t.txtBody, 0.15) }}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                      <Cpu size={14} style={{ color: t.accentBadge }} />
                      What ${depositAmount} unlocks for your hiring:
                    </span>
                    <span 
                      className="text-[10px] px-2 py-0.5 rounded font-bold border"
                      style={{ color: t.numPos, background: hexToRgba(t.numPos, 0.12), borderColor: hexToRgba(t.numPos, 0.25) }}
                    >
                      ACTIVE CAPACITY
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div 
                      className="p-3 rounded-xl border text-center"
                      style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtBody, 0.1) }}
                    >
                      <div className="text-[10px] font-mono uppercase" style={{ color: t.txtMuted }}>Resume Screenings</div>
                      <div className="text-xl font-bold font-mono my-0.5" style={{ color: t.numPos }}>
                        {cvCapacity.toLocaleString()}
                      </div>
                      <div className="text-[10px]" style={{ color: t.txtSecondary }}>1 Credit / Resume</div>
                    </div>

                    <div 
                      className="p-3 rounded-xl border text-center"
                      style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtBody, 0.1) }}
                    >
                      <div className="text-[10px] font-mono uppercase" style={{ color: t.txtMuted }}>AI Interviews</div>
                      <div className="text-xl font-bold font-mono my-0.5" style={{ color: t.accentBadge }}>
                        {evalCapacity.toLocaleString()}
                      </div>
                      <div className="text-[10px]" style={{ color: t.txtSecondary }}>2 Credits / Candidate</div>
                    </div>

                    <div 
                      className="p-3 rounded-xl border text-center"
                      style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtBody, 0.1) }}
                    >
                      <div className="text-[10px] font-mono uppercase" style={{ color: t.txtMuted }}>Campaign Portals</div>
                      <div className="text-xl font-bold font-mono my-0.5" style={{ color: t.txtPrimary }}>
                        {campCapacity.toLocaleString()}
                      </div>
                      <div className="text-[10px]" style={{ color: t.txtSecondary }}>1 Credit / Job Role</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Paid CTA Button */}
              <div className="pt-6">
                <button
                  onClick={onEnter}
                  className="cursor-target w-full py-4 rounded-2xl text-sm font-bold font-mono uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentBadge}, ${hexToRgba(t.accentBadge, 0.85)})`,
                    color: t.accentText,
                    boxShadow: `0 6px 24px ${hexToRgba(t.accentBadge, 0.35)}`
                  }}
                >
                  <Coins size={16} />
                  <span>Deposit ${depositAmount} & Activate Pro Credits ({credits.toLocaleString()} Cr)</span>
                  <ArrowUpRight size={16} />
                </button>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-[11px] font-mono" style={{ color: t.txtMuted }}>
                  <span>✓ Instant Activation</span>
                  <span>✓ 1-Year Credit Validity</span>
                  <span>✓ No Recurring Subscription</span>
                </div>
              </div>

            </div>

          </div>

          {/* Simplified Unit Economics Bottom Strip */}
          <div 
            className="rounded-3xl p-6 sm:p-8 border space-y-4 shadow-md"
            style={{ ...G.card, borderColor: hexToRgba(t.accentPrimary, 0.2) }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4" style={{ borderColor: hexToRgba(t.txtBody, 0.08) }}>
              <div>
                <h3 className="text-base font-bold" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
                  Simple, Transparent Pricing
                </h3>
                <p className="text-xs mt-0.5" style={{ color: t.txtSecondary }}>
                  Only pay for what you use ($10 gives you 1,000 Credits). No monthly subscriptions or hidden fees.
                </p>
              </div>
              <div 
                className="flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1 rounded-full border shrink-0"
                style={{ color: t.accentBadge, background: hexToRgba(t.accentBadge, 0.12), borderColor: hexToRgba(t.accentBadge, 0.25) }}
              >
                <Coins size={13} />
                <span>Pay Per Action</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              
              <div 
                className="p-4 rounded-2xl border space-y-2 transition-all hover:scale-[1.02]"
                style={{ background: hexToRgba(t.bgPage, 0.45), borderColor: hexToRgba(t.txtMuted, 0.15) }}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
                    <Layers size={16} />
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border" style={{ color: t.accentBadge, borderColor: hexToRgba(t.txtBody, 0.1) }}>
                    1 Credit ($0.01)
                  </span>
                </div>
                <div className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>Job Campaign Setup</div>
                <div className="text-[11px] leading-relaxed" style={{ color: t.txtSecondary }}>
                  Set up a new role and configure your screening criteria.
                </div>
              </div>

              <div 
                className="p-4 rounded-2xl border space-y-2 transition-all hover:scale-[1.02]"
                style={{ background: hexToRgba(t.bgPage, 0.45), borderColor: hexToRgba(t.txtMuted, 0.15) }}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                    <FileSearch size={16} />
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border" style={{ color: t.accentBadge, borderColor: hexToRgba(t.txtBody, 0.1) }}>
                    1 Credit ($0.01) / CV
                  </span>
                </div>
                <div className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>Resume Screening</div>
                <div className="text-[11px] leading-relaxed" style={{ color: t.txtSecondary }}>
                  Scan, evaluate, and score candidate resumes against job requirements.
                </div>
              </div>

              <div 
                className="p-4 rounded-2xl border space-y-2 transition-all hover:scale-[1.02]"
                style={{ background: hexToRgba(t.bgPage, 0.45), borderColor: hexToRgba(t.txtMuted, 0.15) }}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
                    <Send size={16} />
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border" style={{ color: t.accentBadge, borderColor: hexToRgba(t.txtBody, 0.1) }}>
                    1 Credit ($0.01) / Email
                  </span>
                </div>
                <div className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>Interview Invitation</div>
                <div className="text-[11px] leading-relaxed" style={{ color: t.txtSecondary }}>
                  Send personalized online interview links to shortlisted candidates.
                </div>
              </div>

              <div 
                className="p-4 rounded-2xl border space-y-2 transition-all hover:scale-[1.02]"
                style={{ background: hexToRgba(t.bgPage, 0.45), borderColor: hexToRgba(t.txtMuted, 0.15) }}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                    <UserCheck size={16} />
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border" style={{ color: t.accentBadge, borderColor: hexToRgba(t.txtBody, 0.1) }}>
                    2 Credits ($0.02) / Eval
                  </span>
                </div>
                <div className="text-xs font-bold font-mono" style={{ color: t.txtPrimary }}>AI Interview Evaluation</div>
                <div className="text-[11px] leading-relaxed" style={{ color: t.txtSecondary }}>
                  Review candidate answers, generate scorecards, and detect cheating.
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB 2: PIPELINE ROI SIMULATOR ──────────────────────────────────── */}
      {activeTab === "simulator" && (
        <motion.div
          key="simulator-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl p-6 sm:p-10 border relative overflow-hidden shadow-2xl space-y-8"
          style={{
            ...G.cardWarm,
            borderColor: hexToRgba(t.accentBadge, 0.35)
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left: Simulator Sliders (Col Span 7) */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
                  Simulate Your Hiring Throughput
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: t.txtSecondary }}>
                  Adjust your expected monthly resume volume and interview shortlist count to see exact credit costs and compute efficiency.
                </p>
              </div>

              {/* Slider 1: Resumes */}
              <div 
                className="p-4 rounded-2xl border space-y-2"
                style={{ background: hexToRgba(t.bgPage, 0.45), borderColor: hexToRgba(t.txtBody, 0.12) }}
              >
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold" style={{ color: t.txtPrimary }}>Monthly Applications / Resumes Ingested:</span>
                  <span className="text-base font-extrabold" style={{ color: t.accentBadge }}>{simResumes.toLocaleString()} Resumes</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={3000}
                  step={50}
                  value={simResumes}
                  onChange={(e) => setSimResumes(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono" style={{ color: t.txtMuted }}>
                  <span>50 CVs</span>
                  <span>500 CVs</span>
                  <span>1,500 CVs</span>
                  <span>3,000 CVs</span>
                </div>
              </div>

              {/* Slider 2: Interviews */}
              <div 
                className="p-4 rounded-2xl border space-y-2"
                style={{ background: hexToRgba(t.bgPage, 0.45), borderColor: hexToRgba(t.txtBody, 0.12) }}
              >
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold" style={{ color: t.txtPrimary }}>Candidates Invited to AI Written Interview:</span>
                  <span className="text-base font-extrabold" style={{ color: t.numPos }}>{simInterviews.toLocaleString()} Candidates</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={250}
                  step={5}
                  value={simInterviews}
                  onChange={(e) => setSimInterviews(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono" style={{ color: t.txtMuted }}>
                  <span>5 Evals</span>
                  <span>50 Evals</span>
                  <span>150 Evals</span>
                  <span>250 Evals</span>
                </div>
              </div>

              {/* Telemetry Stream Logs */}
              <div 
                className="p-3.5 rounded-xl border font-mono text-[11px] space-y-1"
                style={{ background: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.6)", borderColor: hexToRgba(t.txtBody, 0.1) }}
              >
                <div className="flex justify-between text-emerald-400">
                  <span>[compute] CV Extraction ({simResumes} × 1 Cr):</span>
                  <span>{simCvCredits.toLocaleString()} Credits</span>
                </div>
                <div className="flex justify-between text-purple-400">
                  <span>[compute] Interview Dispatch + Grading ({simInterviews} × 3 Cr):</span>
                  <span>{simInterviewCredits.toLocaleString()} Credits</span>
                </div>
                <div className="flex justify-between text-blue-400">
                  <span>[compute] Pipeline Infrastructure:</span>
                  <span>2 Campaigns (2 Cr)</span>
                </div>
              </div>
            </div>

            {/* Right: Cost Comparison & Savings (Col Span 5) */}
            <div 
              className="lg:col-span-5 p-6 rounded-3xl border flex flex-col justify-between space-y-6"
              style={{ background: hexToRgba(t.bgSurface, 0.7), borderColor: hexToRgba(t.txtBody, 0.15) }}
            >
              <div className="space-y-4">
                <div className="text-xs font-mono uppercase tracking-wider font-bold" style={{ color: t.txtMuted }}>
                  Total Compute Cost
                </div>

                <div className="flex items-baseline gap-2">
                  <div className="text-4xl sm:text-5xl font-extrabold font-mono" style={{ color: t.accentBadge }}>
                    {simTotalCredits.toLocaleString()}
                  </div>
                  <span className="text-lg font-bold font-mono" style={{ color: t.txtPrimary }}>Credits</span>
                  <span 
                    className="text-sm font-mono px-2 py-0.5 rounded font-bold border"
                    style={{ color: t.numPos, background: hexToRgba(t.numPos, 0.12), borderColor: hexToRgba(t.numPos, 0.25) }}
                  >
                    ≈ ${simTotalUsd} USD
                  </span>
                </div>

                {/* Comparison Bars */}
                <div className="space-y-3 pt-3 border-t" style={{ borderColor: hexToRgba(t.txtBody, 0.1) }}>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-mono">
                      <span style={{ color: t.txtSecondary }}>hireagent Compute:</span>
                      <span className="font-bold" style={{ color: t.numPos }}>${simTotalUsd}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: "4%" }} />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-mono">
                      <span style={{ color: t.txtSecondary }}>Legacy ATS Seat Licensing:</span>
                      <span className="font-bold" style={{ color: t.txtMuted }}>$250.00 / mo</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-500/60" style={{ width: "50%" }} />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-mono">
                      <span style={{ color: t.txtSecondary }}>Agency Headhunter Fee (20%):</span>
                      <span className="font-bold" style={{ color: t.numNeg }}>$4,500.00</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden">
                      <div className="h-full rounded-full bg-red-500/60" style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={onEnter}
                className="cursor-target w-full py-3.5 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: t.accentBadge, color: t.accentText }}
              >
                <span>Deposit & Launch for ${simTotalUsd}</span>
                <ArrowRight size={14} />
              </button>
            </div>

          </div>
        </motion.div>
      )}

    </section>
  );
}
