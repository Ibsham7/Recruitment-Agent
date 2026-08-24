import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import { Play, Pause, Maximize2, Lock, ChevronRight, X } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { landingSteps } from "../landingData";

interface ProcessSectionProps {
  theme: Theme;
  onEnter: () => void;
  processSectionRef: React.RefObject<HTMLDivElement | null>;
}

export function ProcessSection({ theme: t, onEnter, processSectionRef }: ProcessSectionProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  const { scrollYProgress } = useScroll({
    target: processSectionRef,
    offset: ["start start", "end end"]
  });

  const step0Progress = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
  const step1Progress = useTransform(scrollYProgress, [0.25, 0.5], [0, 1]);
  const step2Progress = useTransform(scrollYProgress, [0.5, 0.75], [0, 1]);
  const step3Progress = useTransform(scrollYProgress, [0.75, 1], [0, 1]);
  const stepProgresses = [step0Progress, step1Progress, step2Progress, step3Progress];

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (isAutoPlaying) return;
    const clamped = Math.min(0.999, Math.max(0, latest));
    const stepIndex = Math.min(
      3,
      Math.max(0, Math.floor(clamped * 4))
    );
    setActiveStep(stepIndex);
  });

  const handleStepClick = (idx: number) => {
    setActiveStep(idx);
    setIsAutoPlaying(false);
    if (processSectionRef.current) {
      const rect = processSectionRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      // Target center of step's scroll zone to prevent floating-point boundary jitter
      const stepOffset = ((idx + 0.5) / 4) * (rect.height - window.innerHeight);
      const targetY = scrollTop + rect.top + stepOffset;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % landingSteps.length);
    }, 6000);
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

  return (
    <section ref={processSectionRef} id="ha-process" className="relative z-10 w-full h-[320vh] max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 mb-28 pb-12">
      <div className="sticky top-20 flex flex-col justify-center min-h-[calc(100vh-6rem)] py-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-4"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
            style={{ color: t.accentBadge, background: hexToRgba(t.accentBadge, 0.10), border: `1px solid ${hexToRgba(t.accentBadge, 0.20)}`, fontFamily: "'DM Mono',monospace" }}>
            Interactive Scrollmation & Product Workflow
          </div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 600, lineHeight: 1.15 }}>
            From job post to shortlist. Powered by AI.
          </h2>
        </motion.div>

        {/* Showcase Grid: Stepper (Left) & Browser Window Mockup (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
          
          {/* Stepper Tabs (Left - 5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            {/* Scroll Progress Bar (Butter-smooth GPU scaleX Motion tracking) */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
              <motion.div 
                className="h-full rounded-full origin-left w-full"
                style={{ 
                  scaleX: isAutoPlaying ? (activeStep + 1) / landingSteps.length : scrollYProgress,
                  background: `linear-gradient(90deg, ${t.accentPrimary}, ${t.accentBadge})` 
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
                  className="cursor-target rounded-xl p-3 sm:p-3.5 border transition-all duration-300 relative overflow-hidden group"
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
                      transform: isActive ? "scaleY(1)" : "scaleY(0)" 
                    }}
                  />

                  {/* Active Step Micro Progress Bar at Card Bottom (Butter-smooth GPU scaleX) */}
                  <motion.div 
                    className="absolute bottom-0 left-0 right-0 h-[2px] origin-left"
                    style={{
                      scaleX: isAutoPlaying ? (isActive ? 1 : 0) : stepProgresses[idx],
                      background: t.accentPrimary,
                      opacity: isActive ? 1 : 0
                    }}
                    transition={{ opacity: { duration: 0.2 }, scaleX: { duration: isAutoPlaying ? 0.3 : 0 } }}
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
                        <span className="text-[10px] font-mono font-medium tracking-wider" style={{ color: isActive ? t.accentPrimary : t.txtGhost }}>
                          {s.badge}
                        </span>
                        <span 
                          className="text-[9px] px-2 py-0.5 rounded-full font-semibold transition-opacity duration-300" 
                          style={{ 
                            background: hexToRgba(t.accentBadge, 0.15), 
                            color: t.accentBadge,
                            opacity: isActive ? 1 : 0.3 
                          }}
                        >
                          {s.highlight}
                        </span>
                      </div>

                      <h3 className="text-xs sm:text-sm font-semibold transition-colors" style={{ color: t.txtPrimary }}>
                        {s.title}
                      </h3>

                      <p className="text-[11px] leading-relaxed mt-0.5 line-clamp-1" style={{ color: t.txtSecondary }}>
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
                          borderTop: isActive ? `1px solid ${hexToRgba(t.txtPrimary, 0.08)}` : "1px solid transparent"
                        }}
                      >
                        <div className="overflow-hidden flex flex-wrap gap-1">
                          {s.tags.map((tag) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: hexToRgba(t.txtPrimary, 0.06), color: t.txtSecondary }}>
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
            <div className="flex items-center justify-between px-1 pt-0.5 text-xs" style={{ color: t.txtGhost }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="cursor-target flex items-center gap-1 px-2.5 py-1 rounded-md border transition-colors hover:text-white text-[11px]"
                  style={{ borderColor: hexToRgba(t.txtPrimary, 0.12), background: hexToRgba(t.bgCard, 0.2) }}
                >
                  {isAutoPlaying ? <Pause size={11} /> : <Play size={11} />}
                  <span>{isAutoPlaying ? "Pause Auto-play" : "Start Auto-play"}</span>
                </button>
              </div>
              <span className="text-[10px] font-mono">Step {activeStep + 1} of {landingSteps.length}</span>
            </div>
          </div>

          {/* Browser Window Screenshot Showcase (Right - 7 cols) */}
          <div className="lg:col-span-7 w-full">
            <div 
              className="rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300"
              style={{ 
                background: hexToRgba(t.bgCard, t.isDark ? 0.35 : 0.95), 
                borderColor: hexToRgba(t.txtPrimary, 0.12),
                backdropFilter: "blur(20px)"
              }}
            >
              {/* Browser Header Bar */}
              <div 
                className="px-4 py-3 border-b flex items-center justify-between gap-4"
                style={{ 
                  background: hexToRgba(t.bgSurface, t.isDark ? 0.60 : 0.85),
                  borderColor: hexToRgba(t.txtPrimary, 0.08)
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
                    color: t.txtSecondary 
                  }}
                >
                  <Lock size={11} className="shrink-0 text-emerald-400" />
                  <span className="truncate">{landingSteps[activeStep].url}</span>
                </div>

                {/* Status & Maximize Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium" style={{ background: hexToRgba(t.accentBadge, 0.12), color: t.accentBadge }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>App Screenshot</span>
                  </div>
                  <button 
                    onClick={() => setFullscreenImg(landingSteps[activeStep].image)}
                    title="View full resolution screenshot"
                    className="cursor-target p-1.5 rounded-lg border transition-colors hover:scale-105"
                    style={{ borderColor: hexToRgba(t.txtPrimary, 0.12), color: t.txtSecondary }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              {/* Stacked Absolute Motion Parallax Screenshot Body */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40 flex items-center justify-center group">
                {landingSteps.map((s, idx) => {
                  const isActive = activeStep === idx;

                  return (
                    <motion.div
                      key={s.num}
                      initial={false}
                      animate={{
                        opacity: isActive ? 1 : 0,
                        scale: isActive ? 1 : 0.96,
                        y: isActive ? 0 : 16,
                        filter: isActive ? "blur(0px)" : "blur(4px)"
                      }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0"
                      style={{
                        pointerEvents: isActive ? "auto" : "none",
                      }}
                    >
                      <img 
                        src={s.image} 
                        alt={s.title} 
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                      />

                      {/* Vignette Overlay */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, ${hexToRgba(t.bgPage, t.isDark ? 0.35 : 0.15)} 100%)`
                        }}
                      />

                      {/* Click-to-Expand Overlay Hint */}
                      <div 
                        onClick={() => setFullscreenImg(s.image)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
                      >
                        <div 
                          className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-transform scale-95 group-hover:scale-100"
                          style={{ background: t.accentPrimary, color: t.accentText, boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.4)}` }}
                        >
                          <Maximize2 size={14} /> Expand Screenshot View
                        </div>
                      </div>
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
                  color: t.txtSecondary
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]" style={{ color: t.txtGhost }}>{landingSteps[activeStep].badge}</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-medium" style={{ color: t.txtPrimary }}>{landingSteps[activeStep].title}</span>
                </div>

                <button 
                  onClick={onEnter} 
                  className="cursor-target flex items-center gap-1 text-[11px] font-semibold transition-all hover:underline"
                  style={{ color: t.accentPrimary }}
                >
                  <span>Try in App</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lightbox Modal */}
        <AnimatePresence>
          {fullscreenImg && (
            <div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md"
              onClick={() => setFullscreenImg(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-5xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border shadow-2xl"
                style={{ background: t.bgCard, borderColor: hexToRgba(t.txtPrimary, 0.15) }}
              >
                {/* Sticky Header */}
                <div 
                  className="shrink-0 z-10 px-6 py-4 border-b flex items-center justify-between"
                  style={{ background: t.bgSurface, borderColor: hexToRgba(t.txtPrimary, 0.10) }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: t.txtPrimary }}>
                      {landingSteps[activeStep].title} — Full Screenshot View
                    </span>
                  </div>
                  <button
                    onClick={() => setFullscreenImg(null)}
                    className="p-1.5 rounded-lg border transition-colors hover:bg-white/10"
                    style={{ borderColor: hexToRgba(t.txtPrimary, 0.12), color: t.txtPrimary }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scroll Body */}
                <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-black/50">
                  <img 
                    src={fullscreenImg} 
                    alt="Full resolution preview" 
                    className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg border border-white/10"
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
