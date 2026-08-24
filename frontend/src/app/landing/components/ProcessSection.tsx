import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import { Play, Pause, Maximize2, Lock, ChevronRight, ChevronLeft, X, Sparkles } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { landingSteps } from "../landingData";

interface ProcessSectionProps {
  theme: Theme;
  onEnter: () => void;
  processSectionRef: React.RefObject<HTMLDivElement | null>;
}

export const ProcessSection = React.memo(function ProcessSection({ theme: t, onEnter, processSectionRef }: ProcessSectionProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  // Swipe gesture tracking for mobile viewports
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Minimum swipe threshold 40px, ensuring horizontal swipe intent
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (deltaX < 0) {
        // Swiped left -> next step
        setActiveStep((prev) => (prev + 1) % landingSteps.length);
        setIsAutoPlaying(false);
      } else {
        // Swiped right -> previous step
        setActiveStep((prev) => (prev - 1 + landingSteps.length) % landingSteps.length);
        setIsAutoPlaying(false);
      }
    }
  };

  const { scrollYProgress } = useScroll({
    target: processSectionRef,
    offset: ["start start", "end end"]
  });

  const step0Progress = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
  const step1Progress = useTransform(scrollYProgress, [0.25, 0.5], [0, 1]);
  const step2Progress = useTransform(scrollYProgress, [0.5, 0.75], [0, 1]);
  const step3Progress = useTransform(scrollYProgress, [0.75, 1], [0, 1]);
  const stepProgresses = useMemo(
    () => [step0Progress, step1Progress, step2Progress, step3Progress],
    [step0Progress, step1Progress, step2Progress, step3Progress]
  );

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (isAutoPlaying) return;
    // Only drive step change via scroll on desktop viewports (>= 1024px)
    if (typeof window !== "undefined" && window.innerWidth < 1024) return;
    const clamped = Math.min(0.999, Math.max(0, latest));
    const stepIndex = Math.min(
      3,
      Math.max(0, Math.floor(clamped * 4))
    );
    setActiveStep((prev) => (prev !== stepIndex ? stepIndex : prev));
  });

  const handleStepClick = (idx: number) => {
    setActiveStep(idx);
    setIsAutoPlaying(false);
    if (typeof window !== "undefined" && window.innerWidth >= 1024 && processSectionRef.current) {
      const rect = processSectionRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      // Target center of step's scroll zone to prevent floating-point boundary jitter
      const stepOffset = ((idx + 0.5) / 4) * (rect.height - window.innerHeight);
      const targetY = scrollTop + rect.top + stepOffset;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    setActiveStep((prev) => (prev - 1 + landingSteps.length) % landingSteps.length);
    setIsAutoPlaying(false);
  };

  const handleNextStep = () => {
    setActiveStep((prev) => (prev + 1) % landingSteps.length);
    setIsAutoPlaying(false);
  };

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % landingSteps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  // Modal Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreenImg) {
        setFullscreenImg(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreenImg]);

  const activeStepData = landingSteps[activeStep];
  const ActiveStepIcon = activeStepData.icon;

  return (
    <section
      ref={processSectionRef}
      id="ha-process"
      className="relative z-10 w-full lg:h-[320vh] max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 mb-16 sm:mb-24 lg:mb-28 pb-8 lg:pb-12"
    >
      {/* ─── DESKTOP VIEWPORT (>= 1024px): 320vh STICKY SCROLLMATION ─── */}
      <div className="hidden lg:flex sticky top-20 flex-col justify-center min-h-[calc(100vh-6rem)] py-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-4"
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              color: t.accentBadge,
              background: hexToRgba(t.accentBadge, 0.10),
              border: `1px solid ${hexToRgba(t.accentBadge, 0.20)}`,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            <Sparkles size={11} />
            <span>Interactive Scrollmation & Product Workflow</span>
          </div>
          <h2
            style={{
              fontFamily: "'Fraunces',serif",
              color: t.txtPrimary,
              fontSize: "clamp(1.8rem, 3.2vw, 2.4rem)",
              fontWeight: 600,
              lineHeight: 1.15,
            }}
          >
            From job post to shortlist. Powered by AI.
          </h2>
        </motion.div>

        {/* Desktop Showcase Grid: Stepper (Left 5 cols) & Browser Window Mockup (Right 7 cols) */}
        <div className="grid grid-cols-12 gap-8 items-center">
          {/* Stepper Tabs (Left - 5 cols) */}
          <div className="col-span-5 flex flex-col gap-2">
            {/* Scroll Progress Bar */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
              <motion.div
                className="h-full rounded-full origin-left w-full"
                style={{
                  scaleX: isAutoPlaying ? (activeStep + 1) / landingSteps.length : scrollYProgress,
                  background: `linear-gradient(90deg, ${t.accentPrimary}, ${t.accentBadge})`,
                }}
                transition={{ duration: isAutoPlaying ? 0.3 : 0 }}
              />
            </div>

            {landingSteps.map((s, idx) => {
              const isActive = activeStep === idx;
              const StepIcon = s.icon;

              return (
                <div
                  key={s.num}
                  onClick={() => handleStepClick(idx)}
                  className="cursor-target rounded-xl p-3.5 border transition-all duration-300 relative overflow-hidden group"
                  style={{
                    background: isActive
                      ? hexToRgba(t.bgCard, t.isDark ? 0.32 : 0.92)
                      : hexToRgba(t.bgCard, t.isDark ? 0.08 : 0.40),
                    borderColor: isActive
                      ? t.accentPrimary
                      : hexToRgba(t.txtPrimary, 0.08),
                    boxShadow: isActive
                      ? `0 6px 20px ${hexToRgba(t.accentPrimary, 0.16)}`
                      : "none",
                  }}
                >
                  {/* Left Accent Bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
                    style={{
                      opacity: isActive ? 1 : 0,
                      background: t.accentPrimary,
                      transform: isActive ? "scaleY(1)" : "scaleY(0)",
                    }}
                  />

                  {/* Active Step Micro Progress Bar at Card Bottom */}
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-[2px] origin-left"
                    style={{
                      scaleX: isAutoPlaying ? (isActive ? 1 : 0) : stepProgresses[idx],
                      background: t.accentPrimary,
                      opacity: isActive ? 1 : 0,
                    }}
                    transition={{
                      opacity: { duration: 0.2 },
                      scaleX: { duration: isAutoPlaying ? 0.3 : 0 },
                    }}
                  />

                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300"
                      style={{
                        background: isActive ? hexToRgba(t.accentPrimary, 0.18) : hexToRgba(t.txtPrimary, 0.05),
                        color: isActive ? t.accentPrimary : t.txtSecondary,
                      }}
                    >
                      <StepIcon size={16} strokeWidth={isActive ? 2 : 1.5} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[10px] font-mono font-medium tracking-wider"
                          style={{ color: isActive ? t.accentPrimary : t.txtGhost }}
                        >
                          {s.badge}
                        </span>
                        <span
                          className="text-[9px] px-2 py-0.5 rounded-full font-semibold transition-opacity duration-300"
                          style={{
                            background: hexToRgba(t.accentBadge, 0.15),
                            color: t.accentBadge,
                            opacity: isActive ? 1 : 0.3,
                          }}
                        >
                          {s.highlight}
                        </span>
                      </div>

                      <h3
                        className="text-sm font-semibold transition-colors mt-0.5"
                        style={{ color: t.txtPrimary }}
                      >
                        {s.title}
                      </h3>

                      <p
                        className="text-[11px] leading-relaxed mt-0.5 line-clamp-1"
                        style={{ color: t.txtSecondary }}
                      >
                        {s.body}
                      </p>

                      {/* Feature Tags - Reflow Free CSS Grid expansion */}
                      <div
                        className="grid transition-all duration-300 ease-out overflow-hidden"
                        style={{
                          gridTemplateRows: isActive ? "1fr" : "0fr",
                          opacity: isActive ? 1 : 0,
                          marginTop: isActive ? "0.375rem" : "0px",
                          paddingTop: isActive ? "0.375rem" : "0px",
                          borderTop: isActive
                            ? `1px solid ${hexToRgba(t.txtPrimary, 0.08)}`
                            : "1px solid transparent",
                        }}
                      >
                        <div className="overflow-hidden flex flex-wrap gap-1">
                          {s.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                              style={{
                                background: hexToRgba(t.txtPrimary, 0.06),
                                color: t.txtSecondary,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Auto Play Toggle */}
            <div className="flex items-center justify-between px-1 pt-1 text-xs" style={{ color: t.txtGhost }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="cursor-target min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:text-white text-xs font-medium"
                  style={{
                    borderColor: hexToRgba(t.txtPrimary, 0.12),
                    background: hexToRgba(t.bgCard, 0.25),
                  }}
                >
                  {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
                  <span>{isAutoPlaying ? "Pause Auto-play" : "Start Auto-play"}</span>
                </button>
              </div>
              <span className="text-[11px] font-mono">Step {activeStep + 1} of {landingSteps.length}</span>
            </div>
          </div>

          {/* Browser Window Screenshot Showcase (Right - 7 cols) */}
          <div className="col-span-7 w-full">
            <div
              className="rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300"
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.35 : 0.95),
                borderColor: hexToRgba(t.txtPrimary, 0.12),
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Browser Header Bar */}
              <div
                className="px-4 py-3 border-b flex items-center justify-between gap-4"
                style={{
                  background: hexToRgba(t.bgSurface, t.isDark ? 0.60 : 0.85),
                  borderColor: hexToRgba(t.txtPrimary, 0.08),
                }}
              >
                {/* Traffic Light Dots */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>

                {/* URL Bar */}
                <div
                  className="flex-1 max-w-sm px-3 py-1 rounded-lg border flex items-center gap-2 text-xs font-mono truncate"
                  style={{
                    background: hexToRgba(t.bgPage, 0.5),
                    borderColor: hexToRgba(t.txtPrimary, 0.08),
                    color: t.txtSecondary,
                  }}
                >
                  <Lock size={11} className="shrink-0 text-emerald-400" />
                  <span className="truncate">{landingSteps[activeStep].url}</span>
                </div>

                {/* Status & Maximize Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium"
                    style={{ background: hexToRgba(t.accentBadge, 0.12), color: t.accentBadge }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>App Screenshot</span>
                  </div>
                  <button
                    onClick={() => setFullscreenImg(landingSteps[activeStep].image)}
                    title="View full resolution screenshot"
                    aria-label="View full resolution screenshot"
                    className="cursor-target min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg border transition-colors hover:scale-105"
                    style={{ borderColor: hexToRgba(t.txtPrimary, 0.12), color: t.txtSecondary }}
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>

              {/* Stacked Absolute Motion Parallax Screenshot Body */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40 flex items-center justify-center group">
                {landingSteps.map((s, idx) => {
                  const isActive = activeStep === idx;
                  const isNear = Math.abs(idx - activeStep) <= 1;

                  return (
                    <motion.div
                      key={s.num}
                      initial={false}
                      animate={{
                        opacity: isActive ? 1 : 0,
                        scale: isActive ? 1 : 0.96,
                        y: isActive ? 0 : 16,
                        filter: isActive ? "blur(0px)" : "blur(4px)",
                      }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0"
                      style={{
                        pointerEvents: isActive ? "auto" : "none",
                      }}
                    >
                      {isNear && (
                        <>
                          <img
                            src={s.image}
                            alt={s.title}
                            width={1200}
                            height={750}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                          />

                          {/* Vignette Overlay */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, ${hexToRgba(t.bgPage, t.isDark ? 0.35 : 0.15)} 100%)`,
                            }}
                          />

                          {/* Click-to-Expand Overlay Hint */}
                          <div
                            onClick={() => setFullscreenImg(s.image)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
                          >
                            <div
                              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-transform scale-95 group-hover:scale-100 min-h-[44px]"
                              style={{
                                background: t.accentPrimary,
                                color: t.accentText,
                                boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.4)}`,
                              }}
                            >
                              <Maximize2 size={14} /> Expand Screenshot View
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer Bar inside Mockup */}
              <div
                className="px-4 py-2.5 border-t flex items-center justify-between text-xs"
                style={{
                  background: hexToRgba(t.bgSurface, t.isDark ? 0.40 : 0.60),
                  borderColor: hexToRgba(t.txtPrimary, 0.08),
                  color: t.txtSecondary,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]" style={{ color: t.txtGhost }}>
                    {landingSteps[activeStep].badge}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="font-medium truncate max-w-[280px]" style={{ color: t.txtPrimary }}>
                    {landingSteps[activeStep].title}
                  </span>
                </div>

                <button
                  onClick={onEnter}
                  className="cursor-target min-h-[44px] px-3 flex items-center gap-1 text-xs font-semibold transition-all hover:underline"
                  style={{ color: t.accentPrimary }}
                >
                  <span>Try in App</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE & TABLET VIEWPORT (< 1024px): RESPONSIVE SWIPEABLE TABBED STEPPER ─── */}
      <div className="block lg:hidden w-full">
        {/* Mobile Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center mb-5"
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              color: t.accentBadge,
              background: hexToRgba(t.accentBadge, 0.12),
              border: `1px solid ${hexToRgba(t.accentBadge, 0.24)}`,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            <Sparkles size={11} />
            <span>Interactive Workflow · 4-Step Funnel</span>
          </div>
          <h2
            style={{
              fontFamily: "'Fraunces',serif",
              color: t.txtPrimary,
              fontSize: "clamp(1.45rem, 5vw, 2rem)",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            From job post to shortlist. Powered by AI.
          </h2>
          <p className="text-xs text-center mt-1.5 max-w-md mx-auto" style={{ color: t.txtSecondary }}>
            Tap tabs or swipe the preview card below to explore every stage.
          </p>
        </motion.div>

        {/* Step Selector Tabs Strip (Touch targets >= 44x44px) */}
        <div
          className="grid grid-cols-4 gap-1 sm:gap-2 mb-3.5 p-1 rounded-xl border bg-black/25 backdrop-blur-sm"
          style={{ borderColor: hexToRgba(t.txtPrimary, 0.10) }}
        >
          {landingSteps.map((s, idx) => {
            const isActive = activeStep === idx;
            const StepIcon = s.icon;
            // Short label for compact mobile screens
            const shortLabels = ["Post", "Funnel", "Interview", "Shortlist"];

            return (
              <button
                key={s.num}
                onClick={() => handleStepClick(idx)}
                aria-label={`Go to Step ${s.num}: ${s.title}`}
                className="cursor-target min-h-[44px] px-1 sm:px-2 py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all duration-200"
                style={{
                  background: isActive ? hexToRgba(t.accentPrimary, 0.18) : "transparent",
                  border: isActive ? `1px solid ${t.accentPrimary}` : "1px solid transparent",
                  color: isActive ? t.accentPrimary : t.txtSecondary,
                  boxShadow: isActive ? `0 2px 12px ${hexToRgba(t.accentPrimary, 0.20)}` : "none",
                }}
              >
                <div className="flex items-center gap-1">
                  <StepIcon size={13} strokeWidth={isActive ? 2.5 : 1.75} />
                  <span
                    className="text-[10px] sm:text-xs font-mono font-bold tracking-tight"
                    style={{ color: isActive ? t.accentPrimary : t.txtGhost }}
                  >
                    0{s.num}
                  </span>
                </div>
                <span
                  className="text-[9px] sm:text-[10px] font-medium truncate max-w-full leading-none"
                  style={{ color: isActive ? t.txtPrimary : t.txtSecondary }}
                >
                  {shortLabels[idx]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Step Content & Browser Mockup Card Container (Touch Swipeable) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="touch-pan-y rounded-2xl border overflow-hidden transition-all duration-300 shadow-xl"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.40 : 0.95),
            borderColor: hexToRgba(t.txtPrimary, 0.12),
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Active Step Header Details */}
          <div
            className="p-3.5 sm:p-4 border-b"
            style={{
              background: hexToRgba(t.bgSurface, t.isDark ? 0.45 : 0.70),
              borderColor: hexToRgba(t.txtPrimary, 0.08),
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{
                  background: hexToRgba(t.accentPrimary, 0.20),
                  color: t.accentPrimary,
                  border: `1px solid ${hexToRgba(t.accentPrimary, 0.30)}`,
                }}
              >
                <ActiveStepIcon size={18} strokeWidth={2} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                  <span
                    className="text-[10px] font-mono font-semibold tracking-wider"
                    style={{ color: t.accentPrimary }}
                  >
                    {activeStepData.badge}
                  </span>
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: hexToRgba(t.accentBadge, 0.15),
                      color: t.accentBadge,
                      border: `1px solid ${hexToRgba(t.accentBadge, 0.25)}`,
                    }}
                  >
                    {activeStepData.highlight}
                  </span>
                </div>

                <h3
                  className="text-sm sm:text-base font-semibold leading-snug"
                  style={{ color: t.txtPrimary }}
                >
                  {activeStepData.title}
                </h3>

                <p
                  className="text-xs leading-relaxed mt-1"
                  style={{ color: t.txtSecondary }}
                >
                  {activeStepData.body}
                </p>

                {/* Feature Tags Row */}
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t" style={{ borderColor: hexToRgba(t.txtPrimary, 0.07) }}>
                  {activeStepData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                      style={{
                        background: hexToRgba(t.txtPrimary, 0.06),
                        color: t.txtSecondary,
                        border: `1px solid ${hexToRgba(t.txtPrimary, 0.08)}`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Browser Window Header */}
          <div
            className="px-3 sm:px-4 py-2 sm:py-2.5 border-b flex items-center justify-between gap-2"
            style={{
              background: hexToRgba(t.bgSurface, t.isDark ? 0.65 : 0.85),
              borderColor: hexToRgba(t.txtPrimary, 0.08),
            }}
          >
            {/* Traffic Light Dots */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>

            {/* URL Bar */}
            <div
              className="flex-1 min-w-0 max-w-[200px] sm:max-w-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 text-[10px] sm:text-xs font-mono truncate"
              style={{
                background: hexToRgba(t.bgPage, 0.6),
                borderColor: hexToRgba(t.txtPrimary, 0.08),
                color: t.txtSecondary,
              }}
            >
              <Lock size={10} className="shrink-0 text-emerald-400" />
              <span className="truncate">{activeStepData.url}</span>
            </div>

            {/* Maximize Button (>= 44x44px touch target) */}
            <button
              onClick={() => setFullscreenImg(activeStepData.image)}
              title="Expand screenshot"
              aria-label="Expand screenshot"
              className="cursor-target min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg border transition-transform active:scale-95 shrink-0"
              style={{
                borderColor: hexToRgba(t.txtPrimary, 0.12),
                background: hexToRgba(t.bgCard, 0.3),
                color: t.txtSecondary,
              }}
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Screenshot Preview Image (Animated crossfade & click to enlarge) */}
          <div
            onClick={() => setFullscreenImg(activeStepData.image)}
            className="relative aspect-[16/10] w-full overflow-hidden bg-black/50 cursor-pointer group"
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={activeStepData.num}
                src={activeStepData.image}
                alt={activeStepData.title}
                width={1200}
                height={750}
                loading="lazy"
                decoding="async"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full h-full object-cover object-top"
              />
            </AnimatePresence>

            {/* Tap-to-expand pill overlay */}
            <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
              <div
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-md"
                style={{
                  background: hexToRgba(t.bgCard, 0.85),
                  color: t.txtPrimary,
                  border: `1px solid ${hexToRgba(t.txtPrimary, 0.15)}`,
                }}
              >
                <Maximize2 size={11} /> Tap to Enlarge
              </div>
            </div>
          </div>

          {/* Card Bottom CTA & Navigation Row */}
          <div
            className="px-3.5 py-2.5 border-t flex items-center justify-between gap-2"
            style={{
              background: hexToRgba(t.bgSurface, t.isDark ? 0.50 : 0.70),
              borderColor: hexToRgba(t.txtPrimary, 0.08),
            }}
          >
            <span className="text-[11px] font-mono font-medium" style={{ color: t.txtGhost }}>
              Swipe ↔ or use arrows
            </span>

            <button
              onClick={onEnter}
              className="cursor-target min-h-[44px] px-3.5 flex items-center gap-1 text-xs font-semibold rounded-lg transition-all"
              style={{
                color: t.accentText,
                background: t.accentPrimary,
                boxShadow: `0 2px 10px ${hexToRgba(t.accentPrimary, 0.30)}`,
              }}
            >
              <span>Try in App</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Controls: Prev / Dots / Next / Auto-play */}
        <div className="flex items-center justify-between gap-2 mt-3.5 px-1">
          {/* Auto-play Button (>= 44x44px touch target) */}
          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            aria-label={isAutoPlaying ? "Pause Auto-play" : "Start Auto-play"}
            className="cursor-target min-h-[44px] px-3 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{
              borderColor: hexToRgba(t.txtPrimary, 0.12),
              background: isAutoPlaying ? hexToRgba(t.accentPrimary, 0.15) : hexToRgba(t.bgCard, 0.30),
              color: isAutoPlaying ? t.accentPrimary : t.txtSecondary,
            }}
          >
            {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span className="text-[11px]">{isAutoPlaying ? "Pause" : "Auto-play"}</span>
          </button>

          {/* Step Pagination Dots */}
          <div className="flex items-center gap-1.5">
            {landingSteps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleStepClick(idx)}
                aria-label={`Jump to step ${idx + 1}`}
                className="cursor-target min-w-[28px] min-h-[44px] flex items-center justify-center"
              >
                <div
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: activeStep === idx ? 20 : 6,
                    height: 6,
                    background: activeStep === idx ? t.accentPrimary : hexToRgba(t.txtPrimary, 0.20),
                    boxShadow: activeStep === idx ? `0 0 8px ${hexToRgba(t.accentPrimary, 0.5)}` : "none",
                  }}
                />
              </button>
            ))}
          </div>

          {/* Prev / Next Navigation Buttons (>= 44x44px touch targets) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevStep}
              aria-label="Previous step"
              className="cursor-target min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-colors active:scale-95"
              style={{
                borderColor: hexToRgba(t.txtPrimary, 0.12),
                background: hexToRgba(t.bgCard, 0.30),
                color: t.txtPrimary,
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextStep}
              aria-label="Next step"
              className="cursor-target min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-colors active:scale-95"
              style={{
                borderColor: hexToRgba(t.txtPrimary, 0.12),
                background: hexToRgba(t.bgCard, 0.30),
                color: t.txtPrimary,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── LIGHTBOX MODAL (Touch-Ergonomic, Backdrop Click & Escape Key Dismiss) ─── */}
      <AnimatePresence>
        {fullscreenImg && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/85 backdrop-blur-md"
            onClick={() => setFullscreenImg(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-5xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border shadow-2xl"
              style={{ background: t.bgCard, borderColor: hexToRgba(t.txtPrimary, 0.18) }}
            >
              {/* Sticky Header */}
              <div
                className="shrink-0 z-10 px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between gap-3"
                style={{ background: t.bgSurface, borderColor: hexToRgba(t.txtPrimary, 0.10) }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
                  >
                    {landingSteps[activeStep].badge}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: t.txtPrimary }}>
                    {landingSteps[activeStep].title} — Full Screenshot
                  </span>
                </div>
                <button
                  onClick={() => setFullscreenImg(null)}
                  aria-label="Close screenshot preview"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg border transition-colors hover:bg-white/10 shrink-0"
                  style={{ borderColor: hexToRgba(t.txtPrimary, 0.15), color: t.txtPrimary }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scroll Body */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4 flex items-center justify-center bg-black/60">
                <img
                  src={fullscreenImg}
                  alt="Full resolution preview"
                  decoding="async"
                  className="max-w-full max-h-[68vh] sm:max-h-[75vh] object-contain rounded-xl shadow-lg border border-white/10"
                />
              </div>

              {/* Modal Footer Controls */}
              <div
                className="shrink-0 z-10 px-4 py-2.5 border-t flex items-center justify-between gap-2"
                style={{ background: t.bgSurface, borderColor: hexToRgba(t.txtPrimary, 0.10) }}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newIdx = (activeStep - 1 + landingSteps.length) % landingSteps.length;
                      setActiveStep(newIdx);
                      setFullscreenImg(landingSteps[newIdx].image);
                    }}
                    aria-label="Previous screenshot"
                    className="min-w-[44px] min-h-[44px] px-3 flex items-center gap-1 rounded-lg border text-xs font-medium"
                    style={{ borderColor: hexToRgba(t.txtPrimary, 0.12), color: t.txtPrimary }}
                  >
                    <ChevronLeft size={14} />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <button
                    onClick={() => {
                      const newIdx = (activeStep + 1) % landingSteps.length;
                      setActiveStep(newIdx);
                      setFullscreenImg(landingSteps[newIdx].image);
                    }}
                    aria-label="Next screenshot"
                    className="min-w-[44px] min-h-[44px] px-3 flex items-center gap-1 rounded-lg border text-xs font-medium"
                    style={{ borderColor: hexToRgba(t.txtPrimary, 0.12), color: t.txtPrimary }}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="text-[11px] font-mono text-center" style={{ color: t.txtGhost }}>
                  Step {activeStep + 1} of {landingSteps.length}
                </div>

                <button
                  onClick={() => setFullscreenImg(null)}
                  className="min-h-[44px] px-4 rounded-lg text-xs font-semibold flex items-center justify-center"
                  style={{ background: t.accentPrimary, color: t.accentText }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
});

