import { motion } from "motion/react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { ShapeGrid } from "../../../components/common/ShapeGrid";
import TextType from "../../../components/common/TextType";

interface HeroSectionProps {
  theme: Theme;
  onEnter: () => void;
  gridBorder: string;
  gridHover: string;
}

export function HeroSection({ theme: t, onEnter, gridBorder, gridHover }: HeroSectionProps) {
  return (
    <section className="relative flex flex-col items-center justify-center pt-24" style={{ minHeight: "100vh" }}>
      {/* ShapeGrid canvas — full bleed behind everything */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <ShapeGrid
          direction="diagonal"
          speed={0.4}
          squareSize={44}
          borderColor={gridBorder}
          hoverFillColor={gridHover}
          shape="square"
          hoverTrailAmount={6}
        />
      </div>

      {/* Radial fade: page bg bleeding in from edges so grid fades to solid */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, ${hexToRgba(t.bgPage, 0.55)} 55%, ${t.bgPage} 100%)`, pointerEvents: "none" }} />

      {/* Hero copy */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl"
      >
        <div className="text-[11px] font-semibold uppercase tracking-widest mb-6 px-3.5 py-1.5 rounded-full flex items-center gap-2"
          style={{ color: t.accentBadge, background: hexToRgba(t.accentBadge, 0.10), border: `1px solid ${hexToRgba(t.accentBadge, 0.22)}`, fontFamily: "'DM Mono',monospace" }}>
          Multi-Tier AI Recruiting Engine
        </div>
        <h1 
          className="flex flex-col items-center text-center"
          style={{ 
            fontFamily: "'Fraunces',serif", 
            color: t.txtPrimary, 
            fontSize: "clamp(2.4rem, 6vw, 4.4rem)", 
            fontWeight: 600, 
            lineHeight: 1.15, 
            letterSpacing: "-0.02em", 
            marginBottom: "1.5rem" 
          }}
        >
          <span className="whitespace-nowrap">Hire top candidates</span>
          <span 
            className="inline-flex items-center justify-center whitespace-nowrap max-w-full overflow-hidden text-ellipsis mt-1"
            style={{ 
              color: t.txtPrimary,
              minHeight: "1.3em" 
            }}
          >
            <TextType
              text={[
                "in seconds.",
                "without bias.",
                "on autopilot."
              ]}
              typingSpeed={60}
              pauseDuration={1800}
              deletingSpeed={35}
              showCursor={true}
              cursorCharacter="|"
              cursorClassName="ml-1 opacity-80"
            />
          </span>
        </h1>
        <p className="text-base leading-relaxed mb-10 max-w-xl" style={{ color: t.txtSecondary }}>
          hireagent automates CV screening using zero-cost Python filters and vector matching, conducts AI technical interviews, and delivers ranked candidate scorecards.
        </p>
        
        <button onClick={onEnter}
          className="cursor-target px-10 py-4 rounded-2xl text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.38)}`, letterSpacing: "0.01em" }}>
          Get started free →
        </button>
        
        <p className="text-xs mt-4" style={{ color: t.txtGhost }}>No credit card required · Set up in under 5 minutes</p>
      </motion.div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5" style={{ color: t.txtGhost }}>
        <span className="text-[10px] uppercase tracking-widest" style={{ fontFamily: "'DM Mono',monospace" }}>Scroll</span>
        <div style={{ width: "1px", height: "32px", background: `linear-gradient(to bottom, ${hexToRgba(t.txtGhost, 0.6)}, transparent)` }} />
      </div>
    </section>
  );
}
