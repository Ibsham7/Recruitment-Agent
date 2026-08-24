import { memo } from "react";
import { motion } from "motion/react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { ShapeGrid } from "../../../components/common/ShapeGrid";

interface CtaSectionProps {
  theme: Theme;
  onEnter: () => void;
  gridBorder: string;
  gridHover: string;
}

export const CtaSection = memo(function CtaSection({ theme: t, onEnter, gridBorder, gridHover }: CtaSectionProps) {
  return (
    <section id="ha-cta" className="relative w-full max-w-full px-4 sm:px-8 py-16 sm:py-24 md:py-28 flex flex-col items-center justify-center text-center overflow-hidden">
      {/* ShapeGrid background for CTA section */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <ShapeGrid
          direction="up"
          speed={0.3}
          squareSize={44}
          borderColor={gridBorder}
          hoverFillColor={gridHover}
          shape="square"
          hoverTrailAmount={4}
        />
      </div>

      {/* Radial fade overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, ${hexToRgba(t.bgPage, 0.65)} 55%, ${t.bgPage} 100%)`
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center px-2 sm:px-0"
      >
        <h2
          className="tracking-tight"
          style={{
            fontFamily: "'Fraunces', serif",
            color: t.txtPrimary,
            fontSize: "clamp(1.75rem, 5vw, 2.8rem)",
            fontWeight: 600,
            lineHeight: 1.2,
            marginBottom: "1rem"
          }}
        >
          Ready to hire smarter?
        </h2>

        <p
          className="text-sm sm:text-base leading-relaxed mb-8 sm:mb-10 max-w-lg mx-auto"
          style={{ color: t.txtSecondary }}
        >
          Experience ultra-cost-optimized CV screening and AI candidate interviews today.
        </p>

        <button
          onClick={onEnter}
          aria-label="Start for free"
          className="cursor-target w-full sm:w-auto min-h-[48px] sm:min-h-[52px] min-w-[44px] px-8 sm:px-12 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 touch-manipulation"
          style={{
            background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`,
            color: t.accentText,
            boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.38)}`
          }}
        >
          <span>Start for free</span>
          <span aria-hidden="true">→</span>
        </button>

        <p
          className="text-xs mt-4 flex items-center justify-center gap-2 flex-wrap"
          style={{ color: t.txtGhost }}
        >
          <span>No credit card required</span>
          <span className="hidden sm:inline opacity-60">·</span>
          <span>Cancel anytime</span>
        </p>
      </motion.div>
    </section>
  );
});

