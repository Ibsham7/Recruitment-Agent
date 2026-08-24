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
    <section 
      className="relative flex flex-col items-center justify-center w-full min-h-[100dvh] pt-20 sm:pt-28 md:pt-32 pb-16 sm:pb-20 overflow-hidden overflow-x-clip"
    >
      {/* ShapeGrid canvas — full bleed behind everything */}
      <div 
        aria-hidden="true"
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none sm:pointer-events-auto"
      >
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
      <div 
        aria-hidden="true"
        style={{ 
          position: "absolute", 
          inset: 0, 
          zIndex: 1, 
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, ${hexToRgba(t.bgPage, 0.55)} 55%, ${t.bgPage} 100%)`, 
          pointerEvents: "none" 
        }} 
      />

      {/* Hero copy — immediately visible on first paint for instant LCP */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-4 sm:px-6 w-full max-w-3xl mx-auto"
      >
        {/* Badge pill with fluid typography & wrapping protection */}
        <div 
          className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider sm:tracking-widest mb-5 sm:mb-6 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full inline-flex items-center justify-center text-center max-w-[92vw] sm:max-w-full leading-normal"
          style={{ 
            color: t.accentBadge, 
            background: hexToRgba(t.accentBadge, 0.10), 
            border: `1px solid ${hexToRgba(t.accentBadge, 0.22)}`, 
            fontFamily: "'DM Mono',monospace" 
          }}
        >
          Multi-Tier AI Recruiting Engine
        </div>

        {/* Fluid responsive headline */}
        <h1 
          className="flex flex-col items-center text-center w-full max-w-full mb-5 sm:mb-6"
          style={{ 
            fontFamily: "'Fraunces',serif", 
            color: t.txtPrimary, 
            fontSize: "clamp(1.75rem, 5.5vw, 4.4rem)", 
            fontWeight: 600, 
            lineHeight: 1.15, 
            letterSpacing: "-0.02em" 
          }}
        >
          <span className="block max-w-full text-balance">
            Hire top candidates
          </span>
          <span 
            className="inline-flex items-center justify-center max-w-full mt-1 sm:mt-1.5 min-h-[1.3em] min-w-[200px] sm:min-w-[280px] md:min-w-[340px]"
            style={{ 
              color: t.txtPrimary,
            }}
          >
            <TextType
              as="span"
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

        {/* Subtitle description */}
        <p 
          className="text-sm sm:text-base leading-relaxed mb-8 sm:mb-10 max-w-xl px-1 sm:px-0 text-balance" 
          style={{ color: t.txtSecondary }}
        >
          From 500 applicants to your top 5 finalists in minutes. Screen resumes, run AI technical interviews, and rank top talent on complete autopilot.
        </p>
        
        {/* Primary CTA button with >= 44x44px touch target */}
        <button 
          type="button"
          onClick={onEnter}
          aria-label="Get started free with hireagent"
          className="cursor-target w-full sm:w-auto min-h-[48px] px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center touch-manipulation"
          style={{ 
            background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, 
            color: t.accentText, 
            boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.38)}`, 
            letterSpacing: "0.01em" 
          }}
        >
          Get started free →
        </button>
        
        <p className="text-xs mt-3 sm:mt-4 px-2 text-center" style={{ color: t.txtGhost }}>
          No credit card required · Set up in under 5 minutes
        </p>
      </div>

      {/* Scroll cue */}
      <div 
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 sm:gap-1.5 pointer-events-none select-none opacity-80" 
        style={{ color: t.txtGhost }}
        aria-hidden="true"
      >
        <span className="text-[9px] sm:text-[10px] uppercase tracking-widest" style={{ fontFamily: "'DM Mono',monospace" }}>
          Scroll
        </span>
        <div style={{ width: "1px", height: "24px", background: `linear-gradient(to bottom, ${hexToRgba(t.txtGhost, 0.6)}, transparent)` }} />
      </div>
    </section>
  );
}
