import { motion } from "motion/react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { landingStats } from "../landingData";

interface StatsSectionProps {
  theme: Theme;
}

export function StatsSection({ theme: t }: StatsSectionProps) {
  return (
    <section className="relative z-20 w-full px-4 sm:px-8 lg:px-12 py-16" style={{ background: hexToRgba(t.bgSurface, t.isDark ? 0.70 : 0.55), borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}`, borderBottom: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}` }}>
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: false, amount: 0.1 }}
        variants={{
          hidden: { transition: { staggerChildren: 0.1, staggerDirection: -1 } },
          show: { transition: { staggerChildren: 0.1, staggerDirection: 1 } }
        }}
        className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8 text-center"
      >
        {landingStats.map((s) => (
          <motion.div
            key={s.value}
            variants={{
              hidden: { opacity: 0, scale: 0.95, transition: { duration: 0.4, ease: "easeIn" } },
              show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
            }}
            className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.60),
              borderColor: hexToRgba(t.txtBody, t.isDark ? 0.10 : 0.12),
              backdropFilter: "blur(12px)",
              boxShadow: t.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)"
            }}
          >
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(2.4rem, 4vw, 3.4rem)", fontWeight: 600, color: t.numHero, lineHeight: 1.1 }}>{s.value}</div>
            <div className="text-xs sm:text-sm font-medium mt-3 leading-relaxed max-w-[220px]" style={{ color: t.txtSecondary }}>{s.label.replace("\n", " ")}</div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
