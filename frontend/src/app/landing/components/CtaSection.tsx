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

export function CtaSection({ theme: t, onEnter, gridBorder, gridHover }: CtaSectionProps) {
  return (
    <section className="relative px-8 py-32 flex flex-col items-center text-center overflow-hidden">
      {/* ShapeGrid background for CTA section too */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <ShapeGrid direction="up" speed={0.3} squareSize={44} borderColor={gridBorder} hoverFillColor={gridHover} shape="square" hoverTrailAmount={4} />
      </div>
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, ${hexToRgba(t.bgPage, 0.65)} 55%, ${t.bgPage} 100%)`, pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 max-w-2xl"
      >
        <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.2, marginBottom: "1rem" }}>
          Ready to hire smarter?
        </h2>
        <p className="text-sm leading-relaxed mb-10" style={{ color: t.txtSecondary }}>
          Experience ultra-cost-optimized CV screening and AI candidate interviews today.
        </p>
        <button onClick={onEnter}
          className="cursor-target px-12 py-4 rounded-2xl text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.38)}` }}>
          Start for free →
        </button>
        <p className="text-xs mt-4" style={{ color: t.txtGhost }}>No credit card · Cancel anytime</p>
      </motion.div>
    </section>
  );
}
