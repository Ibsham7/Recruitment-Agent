import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView } from "motion/react";
import { 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle 
} from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { landingDeckFeatures, LandingDeckFeature } from "../landingData";

interface FeaturesSectionProps {
  theme: Theme;
}

export function FeaturesSection({ theme: t }: FeaturesSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [strictMode, setStrictMode] = useState<"lenient" | "moderate" | "strict">("moderate");
  const [strictScore, setStrictScore] = useState(84);
  const total = landingDeckFeatures.length;

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Intersection observer: only active when user scrolls to features section
  const isInView = useInView(sectionRef, { amount: 0.2 });

  const ROTATE_INTERVAL = 3000; // 3.0 Seconds

  // Relative Circular Rotate
  const rotate = useCallback((step: number) => {
    setActiveIndex((prev) => (prev + step + total) % total);
  }, [total]);

  // Jump to specific slide
  const jumpTo = useCallback((index: number) => {
    setActiveIndex((index + total) % total);
  }, [total]);

  // Reset & restart progress bar animation
  const resetProgressBar = useCallback(() => {
    if (!progressBarRef.current) return;
    progressBarRef.current.style.transition = "none";
    progressBarRef.current.style.width = "0%";
    // Force DOM repaint
    void progressBarRef.current.offsetWidth;
    if (!isHovered && isInView) {
      progressBarRef.current.style.transition = `width ${ROTATE_INTERVAL}ms linear`;
      progressBarRef.current.style.width = "100%";
    }
  }, [isHovered, isInView, ROTATE_INTERVAL]);

  // Auto-Rotation Timer Effect: STRICTLY only runs when in viewport and not hovered
  useEffect(() => {
    resetProgressBar();
    if (isHovered || !isInView) return;

    const timer = setInterval(() => {
      rotate(1);
    }, ROTATE_INTERVAL);

    return () => clearInterval(timer);
  }, [rotate, isHovered, isInView, activeIndex, resetProgressBar, ROTATE_INTERVAL]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInView) return;
      if (e.key === "ArrowRight") rotate(1);
      if (e.key === "ArrowLeft") rotate(-1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rotate, isInView]);

  // Horizontal Trackpad / Mouse Scroll Listener
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let accumulatedDeltaX = 0;
    let wheelTimeout: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      const deltaX = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);

      if (Math.abs(deltaX) > 15) {
        e.preventDefault();
        accumulatedDeltaX += deltaX;

        if (Math.abs(accumulatedDeltaX) >= 45) {
          rotate(accumulatedDeltaX > 0 ? 1 : -1);
          accumulatedDeltaX = 0;
        }
      }

      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        accumulatedDeltaX = 0;
      }, 150);
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [rotate]);

  // Drag & Swipe Physics
  const dragRef = useRef({ startX: 0, currentX: 0, isDragging: false });

  const handleTouchStart = (e: React.TouchEvent) => {
    dragRef.current.startX = e.touches[0].clientX;
    dragRef.current.isDragging = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.currentX = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = () => {
    if (!dragRef.current.isDragging) return;
    const delta = dragRef.current.currentX - dragRef.current.startX;
    if (Math.abs(delta) > 50) {
      rotate(delta < 0 ? 1 : -1);
    }
    dragRef.current.isDragging = false;
    dragRef.current.startX = 0;
    dragRef.current.currentX = 0;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current.startX = e.clientX;
    dragRef.current.isDragging = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.currentX = e.clientX;
    }
  };

  const handleMouseUp = () => {
    if (!dragRef.current.isDragging) return;
    const delta = dragRef.current.currentX - dragRef.current.startX;
    if (Math.abs(delta) > 60) {
      rotate(delta < 0 ? 1 : -1);
    }
    dragRef.current.isDragging = false;
    dragRef.current.startX = 0;
    dragRef.current.currentX = 0;
  };

  // Dynamically compute precise CSS tokens directly from theme `t`
  const isDark = t.isDark;
  const isIvory = !isDark && (t.name === "Ivory" || t.bgPage === "#F8F5EF" || t.bgPage === "#f8f8f7");

  // Dynamic token palette ensuring 100% theme awareness in Light and Dark modes
  const dynamicStyles = {
    "--deck-txt-primary": t.txtPrimary,
    "--deck-txt-body": t.txtBody,
    "--deck-txt-secondary": t.txtSecondary,
    "--deck-txt-muted": t.txtMuted,
    "--deck-accent-badge": t.accentBadge,
    "--deck-accent-glow": hexToRgba(t.accentBadge, isDark ? 0.18 : 0.14),
    
    "--deck-num-pos": t.numPos,
    "--deck-num-pos-bg": hexToRgba(t.numPos, isDark ? 0.12 : 0.10),
    "--deck-num-pos-border": hexToRgba(t.numPos, isDark ? 0.28 : 0.25),

    "--deck-num-mid": t.numMid,
    "--deck-num-mid-bg": hexToRgba(t.numMid, isDark ? 0.12 : 0.10),
    "--deck-num-mid-border": hexToRgba(t.numMid, isDark ? 0.28 : 0.25),

    "--deck-num-neg": t.numNeg,
    "--deck-num-neg-bg": hexToRgba(t.numNeg, isDark ? 0.14 : 0.10),
    "--deck-num-neg-border": hexToRgba(t.numNeg, isDark ? 0.32 : 0.25),

    // Card Chassis & Viewports
    "--deck-bg-page": t.bgPage,
    "--deck-bg-surface": isDark ? hexToRgba(t.bgSurface, 0.95) : (isIvory ? "#EDE8DD" : hexToRgba(t.bgSurface, 0.95)),
    "--deck-bg-surface-elevated": isDark ? (t.bgCard === "#FFFFFF" ? "#151528" : hexToRgba(t.bgCard, 0.08)) : (isIvory ? "#E2DDD0" : hexToRgba(t.bgSurface, 0.70)),
    "--deck-bg-card": isDark ? (t.bgCard === "#FFFFFF" ? "rgba(255, 255, 255, 0.035)" : hexToRgba(t.bgCard, 0.05)) : "rgba(255, 255, 255, 0.92)",
    "--deck-border-card": isDark ? (t.bgCard === "#FFFFFF" ? "rgba(255, 255, 255, 0.09)" : hexToRgba(t.bgCard, 0.12)) : "rgba(0, 0, 0, 0.10)",
    
    // Shadows
    "--deck-shadow-card": isDark 
      ? "0 24px 60px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.08)" 
      : "0 16px 40px rgba(0, 0, 0, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
    "--deck-shadow-viewport": isDark 
      ? "inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 24px 60px rgba(0, 0, 0, 0.6)" 
      : "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 16px 40px rgba(0, 0, 0, 0.09)",
  } as React.CSSProperties;

  // Render individual slide viewport mockups matching HTML preview exactly
  const renderViewportContent = (feat: LandingDeckFeature) => {
    switch (feat.viewport.type) {
      case "verbatim-quote":
        return (
          <div className="space-y-3 font-mono text-xs">
            <div className="deck-viewport-inner-card p-3.5">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[11px]" style={{ color: "var(--deck-txt-primary)" }}>Requirement: Distributed SQL & Postgres (5+ Yrs)</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold tone-pos border">FULL MATCH (100%)</span>
              </div>
              <div 
                className="p-2.5 rounded-lg text-[11px] leading-relaxed tone-accent border-l-[3px]" 
                style={{ borderLeftColor: "var(--deck-accent-badge)" }}
              >
                "...Architected PostgreSQL sharding and connection pooling saving 40% latency across 10M daily requests..."
              </div>
              <div className="mt-2 flex justify-between text-[10px]" style={{ color: "var(--deck-txt-secondary)" }}>
                <span>Source: <strong style={{ color: "var(--deck-txt-primary)" }}>Employment History (Weight: 1.5x)</strong></span>
                <span className="font-bold" style={{ color: "var(--deck-num-pos)" }}>+25.0 / 25.0 Pts</span>
              </div>
            </div>
            <div className="deck-viewport-inner-card p-3 opacity-80 flex justify-between items-center text-[10px]">
              <span style={{ color: "var(--deck-txt-secondary)" }}>Requirement: Kubernetes Cluster Ops</span>
              <span className="px-2 py-0.5 rounded font-semibold tone-mid border">CAPPED (Partial 50% - Skill List Only)</span>
            </div>
          </div>
        );

      case "anti-cheat":
        return (
          <div className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="deck-viewport-inner-card p-2.5 text-center">
                <div className="text-[9px] uppercase" style={{ color: "var(--deck-txt-muted)" }}>Tab Switches</div>
                <div className="font-bold text-sm mt-1" style={{ color: "var(--deck-num-neg)" }}>4 Blurs</div>
              </div>
              <div className="deck-viewport-inner-card p-2.5 text-center">
                <div className="text-[9px] uppercase" style={{ color: "var(--deck-txt-muted)" }}>Paste Ratio</div>
                <div className="font-bold text-sm mt-1" style={{ color: "var(--deck-num-neg)" }}>82.4%</div>
              </div>
              <div className="deck-viewport-inner-card p-2.5 text-center">
                <div className="text-[9px] uppercase" style={{ color: "var(--deck-txt-muted)" }}>Pasted Chars</div>
                <div className="font-bold text-sm mt-1" style={{ color: "var(--deck-num-neg)" }}>1,450 ch</div>
              </div>
            </div>
            <div className="p-3 rounded-xl text-[10px] space-y-1 tone-neg border">
              <div className="flex items-center gap-1.5 font-bold" style={{ color: "var(--deck-num-neg)" }}>
                <AlertTriangle size={14} /> Detected Flags (2 Critical)
              </div>
              <p style={{ color: "var(--deck-txt-secondary)" }}>• MASSIVE_PASTE_BLOB: Injected 450 characters 1.2s after tab blur.</p>
              <p style={{ color: "var(--deck-txt-secondary)" }}>• LLM_TRANSITIONS: Detected robotic boilerplate ("In summary, furthermore...").</p>
            </div>
          </div>
        );

      case "timeline-math":
        return (
          <div className="space-y-3 font-mono text-xs">
            <div className="deck-viewport-inner-card p-3.5 space-y-2.5">
              <div className="flex justify-between text-[11px]">
                <span style={{ color: "var(--deck-txt-secondary)" }}>Overlapping Interval Deduplication</span>
                <span className="font-bold" style={{ color: "var(--deck-num-pos)" }}>14 Months Merged</span>
              </div>
              <div className="space-y-2 py-1">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-28 text-right truncate" style={{ color: "var(--deck-txt-muted)" }}>Role A (2020-22)</span>
                  <div className="flex-1 h-2 rounded bg-black/20 overflow-hidden">
                    <div className="h-full rounded" style={{ width: "60%", background: "var(--deck-accent-badge)" }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-28 text-right truncate" style={{ color: "var(--deck-txt-muted)" }}>Role B (2021-23)</span>
                  <div className="flex-1 h-2 rounded bg-black/20 overflow-hidden flex justify-end">
                    <div className="h-full rounded" style={{ width: "65%", background: "var(--deck-num-mid)" }} />
                  </div>
                </div>
                <div className="pt-2 border-t flex items-center gap-2 text-[10px]" style={{ borderColor: "var(--deck-border-card)" }}>
                  <span className="w-28 text-right font-bold" style={{ color: "var(--deck-num-pos)" }}>Merged Tenure</span>
                  <div className="flex-1 h-2.5 rounded bg-black/20 overflow-hidden">
                    <div className="h-full rounded" style={{ width: "85%", background: "var(--deck-num-pos)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "ai-interviews":
        return (
          <div className="space-y-2.5 font-mono text-xs">
            <div className="deck-viewport-inner-card p-3 text-[11px] leading-relaxed" style={{ color: "var(--deck-txt-primary)" }}>
              <span className="text-[10px] uppercase font-bold block mb-1" style={{ color: "var(--deck-accent-badge)" }}>Q2 // Architectural Depth Check:</span>
              "In your role at Fintech Corp, you mentioned migrating to an event-driven architecture. How did you ensure idempotency across distributed order consumers?"
            </div>
            <div className="p-2.5 rounded-lg text-[10px] italic flex items-center gap-2 tone-accent border">
              <span className="w-2 h-2 rounded-full animate-ping" style={{ background: "var(--deck-accent-badge)" }} />
              <span>Real-Time Prober: Evaluating candidate answer depth on the fly...</span>
            </div>
          </div>
        );

      case "radar-rubric":
        return (
          <div className="space-y-2.5 font-mono text-xs">
            <div className="deck-viewport-inner-card p-3.5 space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1"><span style={{ color: "var(--deck-txt-primary)" }}>Technical Depth</span><span className="font-bold" style={{ color: "var(--deck-num-pos)" }}>94%</span></div>
                <div className="w-full h-1.5 rounded-full bg-black/20"><div className="h-full rounded-full" style={{ width: "94%", background: "var(--deck-num-pos)" }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1"><span style={{ color: "var(--deck-txt-primary)" }}>Communication Clarity</span><span className="font-bold" style={{ color: "var(--deck-num-pos)" }}>88%</span></div>
                <div className="w-full h-1.5 rounded-full bg-black/20"><div className="h-full rounded-full" style={{ width: "88%", background: "var(--deck-num-pos)" }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1"><span style={{ color: "var(--deck-txt-primary)" }}>Cultural Fit</span><span className="font-bold" style={{ color: "var(--deck-num-pos)" }}>90%</span></div>
                <div className="w-full h-1.5 rounded-full bg-black/20"><div className="h-full rounded-full" style={{ width: "90%", background: "var(--deck-num-pos)" }} /></div>
              </div>
            </div>
          </div>
        );

      case "adaptive-probing":
        return (
          <div className="space-y-2 font-mono text-xs">
            <div className="deck-viewport-inner-card p-2.5 text-[11px]">
              <span className="text-[9px] uppercase block mb-0.5" style={{ color: "var(--deck-txt-muted)" }}>Candidate Response (18 words):</span>
              <span style={{ color: "var(--deck-txt-primary)" }}>"We used Redis caching to store user sessions and reduce our Postgres load during peak flash sales."</span>
            </div>
            <div className="p-3 rounded-xl text-[11px] space-y-1 tone-accent border">
              <span className="text-[9px] uppercase font-bold block" style={{ color: "var(--deck-accent-badge)" }}>⚡ AI Follow-Up Probe Generated:</span>
              <span style={{ color: "var(--deck-txt-primary)" }}>"Can you detail your cache invalidation strategy and how you prevented cache stampedes during those sales?"</span>
            </div>
          </div>
        );

      case "strictness-presets":
        return (
          <div className="space-y-3 font-mono text-xs">
            <div className="deck-viewport-inner-card p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "var(--deck-txt-secondary)" }}>Evaluation Strictness Mode</span>
                <span className="text-sm font-bold" style={{ color: "var(--deck-num-pos)" }}>{strictScore}% ({strictMode.charAt(0).toUpperCase() + strictMode.slice(1)})</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <button 
                  onClick={() => { setStrictMode("lenient"); setStrictScore(91); }}
                  className={`p-2 rounded-lg border transition-all ${strictMode === "lenient" ? "font-bold tone-accent" : ""}`}
                  style={strictMode !== "lenient" ? { borderColor: "var(--deck-border-card)", background: "var(--deck-bg-card)", color: "var(--deck-txt-primary)" } : {}}
                >
                  Lenient (+4 pts)
                </button>
                <button 
                  onClick={() => { setStrictMode("moderate"); setStrictScore(84); }}
                  className={`p-2 rounded-lg border transition-all ${strictMode === "moderate" ? "font-bold tone-accent" : ""}`}
                  style={strictMode !== "moderate" ? { borderColor: "var(--deck-border-card)", background: "var(--deck-bg-card)", color: "var(--deck-txt-primary)" } : {}}
                >
                  Moderate (Default)
                </button>
                <button 
                  onClick={() => { setStrictMode("strict"); setStrictScore(71); }}
                  className={`p-2 rounded-lg border transition-all ${strictMode === "strict" ? "font-bold tone-accent" : ""}`}
                  style={strictMode !== "strict" ? { borderColor: "var(--deck-border-card)", background: "var(--deck-bg-card)", color: "var(--deck-txt-primary)" } : {}}
                >
                  Strict (-25% Cap)
                </button>
              </div>
            </div>
          </div>
        );

      case "vision-ocr":
        return (
          <div className="space-y-2 font-mono text-xs">
            <div className="deck-viewport-inner-card p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span style={{ color: "var(--deck-txt-secondary)" }}>Canva Multi-Column Graphic PDF:</span><span className="font-bold" style={{ color: "var(--deck-num-pos)" }}>Extracted (100%)</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--deck-txt-secondary)" }}>Cryptographic SHA-256 Hash:</span><span style={{ color: "var(--deck-txt-muted)" }}>#9f8a...e312 (Cached)</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--deck-txt-secondary)" }}>Structured JSON Entity Extraction:</span><span className="font-bold" style={{ color: "var(--deck-num-pos)" }}>Normalized</span></div>
            </div>
          </div>
        );

      case "live-pipeline":
        return (
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div className="deck-viewport-inner-card p-2.5">
              <div className="text-[9px] uppercase font-semibold mb-1.5" style={{ color: "var(--deck-txt-muted)" }}>Screening (12)</div>
              <div className="p-1.5 rounded text-[10px] truncate mb-1" style={{ background: "var(--deck-bg-card)", color: "var(--deck-txt-primary)" }}>Ayesha K. (90%)</div>
              <div className="p-1.5 rounded text-[10px] truncate" style={{ background: "var(--deck-bg-card)", color: "var(--deck-txt-primary)" }}>Daniyal M. (72%)</div>
            </div>
            <div className="deck-viewport-inner-card p-2.5">
              <div className="text-[9px] uppercase font-semibold mb-1.5" style={{ color: "var(--deck-num-mid)" }}>Interviewing (4)</div>
              <div className="p-1.5 rounded text-[10px] truncate tone-mid border">Chloe T. (Active)</div>
            </div>
            <div className="deck-viewport-inner-card p-2.5">
              <div className="text-[9px] uppercase font-semibold mb-1.5" style={{ color: "var(--deck-num-pos)" }}>Shortlisted (3)</div>
              <div className="p-1.5 rounded text-[10px] truncate font-bold tone-pos border">Farah Z. (94%)</div>
            </div>
          </div>
        );

      case "keyword-stuffer":
        return (
          <div className="space-y-2.5 font-mono text-xs">
            <div className="deck-viewport-inner-card p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span style={{ color: "var(--deck-txt-muted)" }}>Detected Skill Dump:</span><span className="font-bold" style={{ color: "var(--deck-num-neg)" }}>14 Unevidenced Keywords</span></div>
              <div className="p-2 rounded-lg text-[10px] italic tone-neg border" style={{ color: "var(--deck-txt-primary)" }}>
                "Skills: Python, Rust, AWS, Kubernetes, Terraform, AI/ML, Kafka, Distributed Systems, Docker, Redis..."
              </div>
              <div className="pt-1.5 border-t flex justify-between items-center text-[10px]" style={{ borderColor: "var(--deck-border-card)" }}>
                <span className="font-bold" style={{ color: "var(--deck-num-neg)" }}>⚠️ Scoring Action:</span>
                <span style={{ color: "var(--deck-txt-secondary)" }}>Overridden to 0% (Skills-List Only • No Evidence)</span>
              </div>
            </div>
          </div>
        );
    }
  };

  const currentFeature = landingDeckFeatures[activeIndex];

  return (
    <section 
      ref={sectionRef}
      id="ha-features" 
      style={dynamicStyles}
      className="deck-section-root w-full px-4 sm:px-8 lg:px-12 py-24 max-w-7xl mx-auto overflow-hidden"
    >
      <style>{`
        .deck-glass-surface {
          background: var(--deck-bg-card);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--deck-border-card);
          box-shadow: var(--deck-shadow-card);
        }

        .deck-screenshot-viewport {
          background: var(--deck-bg-surface);
          border: 1px solid var(--deck-border-card);
          border-radius: 1.25rem;
          position: relative;
          overflow: hidden;
          box-shadow: var(--deck-shadow-viewport);
        }

        .deck-viewport-inner-card {
          background: var(--deck-bg-surface-elevated);
          border: 1px solid var(--deck-border-card);
          border-radius: 0.875rem;
        }

        .tone-pos { color: var(--deck-num-pos); background: var(--deck-num-pos-bg); border-color: var(--deck-num-pos-border); }
        .tone-neg { color: var(--deck-num-neg); background: var(--deck-num-neg-bg); border-color: var(--deck-num-neg-border); }
        .tone-mid { color: var(--deck-num-mid); background: var(--deck-num-mid-bg); border-color: var(--deck-num-mid-border); }
        .tone-accent { color: var(--deck-accent-badge); background: var(--deck-accent-glow); border-color: var(--deck-border-card); }
      `}</style>

      {/* Retained Heading with Exact Brand Font Hierarchy & Correct Text Color */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <div 
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-3 tone-accent border" 
          style={{ fontFamily: "'DM Mono',monospace" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: "var(--deck-accent-badge)" }} />
          Features // Circular Endless Deck
        </div>
        <h2 style={{ fontFamily: "'Fraunces',serif", color: "var(--deck-txt-primary)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15, whiteSpace: "pre-line" }}>
          Built for engineering precision.{"\n"}Designed for hiring velocity.
        </h2>
        <p className="max-w-2xl mx-auto text-xs sm:text-sm mt-3 leading-relaxed" style={{ color: "var(--deck-txt-secondary)" }}>
          Explore all 10 capabilities. Auto-rotates every 3 seconds (pauses on hover). Swipe horizontally, drag, or use arrow keys.
        </p>
      </motion.div>

      {/* Top Rail Navigation Deck (Slide Counter, Status & Next/Prev) */}
      <div 
        className="flex items-center justify-between mb-4 pb-2 border-b relative" 
        style={{ borderColor: "var(--deck-border-card)" }}
      >
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--deck-accent-badge)" }} />
          <span 
            className="text-xs uppercase tracking-wider font-semibold truncate max-w-[220px] sm:max-w-none font-mono" 
            style={{ color: "var(--deck-txt-primary)" }}
          >
            {currentFeature.number} // {currentFeature.title.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div 
            className="text-[11px] font-mono hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg deck-glass-surface mr-2" 
            style={{ color: "var(--deck-accent-badge)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: "var(--deck-accent-badge)" }} />
            <span>{!isInView ? "PAUSED (OFFSCREEN)" : isHovered ? "PAUSED (HOVER)" : "AUTO (3s)"}</span>
          </div>

          <span className="text-xs font-mono mr-2 font-bold" style={{ color: "var(--deck-accent-badge)" }}>
            {(activeIndex + 1).toString().padStart(2, "0")} / {total.toString().padStart(2, "0")}
          </span>

          <button 
            onClick={() => rotate(-1)} 
            aria-label="Previous Slide" 
            className="w-9 h-9 rounded-xl deck-glass-surface flex items-center justify-center transition-all hover:scale-105 active:scale-95" 
            style={{ color: "var(--deck-txt-primary)" }}
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={() => rotate(1)} 
            aria-label="Next Slide" 
            className="w-9 h-9 rounded-xl deck-glass-surface flex items-center justify-center transition-all hover:scale-105 active:scale-95" 
            style={{ color: "var(--deck-txt-primary)" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 3-Second Sweep Progress Bar */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden bg-black/10">
          <div ref={progressBarRef} className="h-full w-0" style={{ background: "var(--deck-accent-badge)" }} />
        </div>
      </div>

      {/* 3D Carousel Stage */}
      <div 
        ref={stageRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative w-full min-h-[520px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        style={{ perspective: "1600px", touchAction: "pan-y" }}
      >
        {landingDeckFeatures.map((feat, idx) => {
          let diff = (idx - activeIndex) % total;
          if (diff < -Math.floor(total / 2)) diff += total;
          if (diff > Math.floor(total / 2)) diff -= total;

          const isCenter = diff === 0;
          const isLeft = diff === -1;
          const isRight = diff === 1;
          const isFarLeft = diff === -2;
          const isFarRight = diff === 2;

          let transform = "translate3d(0%, 0, -200px) scale(0.6)";
          let opacity = 0;
          let zIndex = 0;
          let filter = "blur(4px)";
          let pointerEvents: "auto" | "none" = "none";
          let boxShadow = "none";

          if (isCenter) {
            transform = "translate3d(0%, 0, 0px) scale(1)";
            opacity = 1;
            zIndex = 30;
            filter = "blur(0px)";
            pointerEvents = "auto";
            boxShadow = "var(--deck-shadow-card), 0 0 40px var(--deck-accent-glow)";
          } else if (isLeft) {
            transform = "translate3d(-68%, 0, -80px) scale(0.86) rotateY(6deg)";
            opacity = 0.32;
            zIndex = 20;
            filter = "blur(1.5px)";
            pointerEvents = "auto";
          } else if (isRight) {
            transform = "translate3d(68%, 0, -80px) scale(0.86) rotateY(-6deg)";
            opacity = 0.32;
            zIndex = 20;
            filter = "blur(1.5px)";
            pointerEvents = "auto";
          } else if (isFarLeft) {
            transform = "translate3d(-120%, 0, -160px) scale(0.72)";
            opacity = 0;
            zIndex = 10;
          } else if (isFarRight) {
            transform = "translate3d(120%, 0, -160px) scale(0.72)";
            opacity = 0;
            zIndex = 10;
          }

          const Icon = feat.icon;

          return (
            <div
              key={feat.id}
              onClick={() => {
                if (isLeft) rotate(-1);
                if (isRight) rotate(1);
              }}
              className="deck-glass-surface absolute w-full max-w-[980px] rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row gap-8 items-center"
              style={{
                transform,
                opacity,
                zIndex,
                filter,
                pointerEvents,
                boxShadow,
                transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), filter 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                transformStyle: "preserve-3d",
                willChange: "transform, opacity, filter"
              }}
            >
              {/* Left Column: Spec Details */}
              <div className="lg:w-5/12 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div 
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase mb-3 tone-${feat.metrics[0].tone} border`}
                  >
                    <Icon size={12} /> Feature {feat.number} // {feat.category}
                  </div>
                  <h3 
                    className="text-2xl sm:text-3xl font-semibold mb-2" 
                    style={{ fontFamily: "'Fraunces', serif", color: "var(--deck-txt-primary)" }}
                  >
                    {feat.title}
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--deck-txt-secondary)" }}>
                    {feat.description}
                  </p>
                </div>

                <div 
                  className="grid grid-cols-2 gap-3 pt-3 border-t font-mono text-xs" 
                  style={{ borderColor: "var(--deck-border-card)" }}
                >
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--deck-txt-muted)" }}>{feat.metrics[0].label}</div>
                    <div className="font-bold text-sm" style={{ color: `var(--deck-num-${feat.metrics[0].tone})` }}>
                      {feat.metrics[0].value}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--deck-txt-muted)" }}>{feat.metrics[1].label}</div>
                    <div className="font-bold text-sm" style={{ color: `var(--deck-num-${feat.metrics[1].tone})` }}>
                      {feat.metrics[1].value}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: High-Fidelity UI Viewport Mockup */}
              <div className="lg:w-7/12 w-full deck-screenshot-viewport p-4 sm:p-5">
                {/* Traffic Lights Header Chrome */}
                <div 
                  className="flex items-center justify-between pb-3 mb-3 border-b text-[10px] font-mono" 
                  style={{ borderColor: "var(--deck-border-card)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F56" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FFBD2E" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#27C93F" }} />
                    <span className="ml-2 font-medium truncate max-w-[180px] sm:max-w-none" style={{ color: "var(--deck-txt-muted)" }}>
                      {feat.viewport.file}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold tone-${feat.viewport.tag.tone} border`}>
                    {feat.viewport.tag.text}
                  </span>
                </div>

                {/* Inner Viewport Content */}
                {renderViewportContent(feat)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tactile Bottom Pill Jump Selector */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {landingDeckFeatures.map((feat, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={feat.id}
              onClick={() => jumpTo(idx)}
              className={`indicator-pill px-3 py-1.5 rounded-xl text-xs font-mono border transition-all ${
                isActive ? "active" : "deck-glass-surface hover:scale-102"
              }`}
              style={{
                color: isActive ? "var(--deck-accent-badge)" : "var(--deck-txt-secondary)",
                background: isActive ? "var(--deck-accent-glow)" : "var(--deck-bg-card)",
                borderColor: isActive ? "var(--deck-accent-badge)" : "var(--deck-border-card)",
                boxShadow: isActive ? "0 0 15px var(--deck-accent-glow)" : "none"
              }}
            >
              {feat.pillTitle}
            </button>
          );
        })}
      </div>

    </section>
  );
}
