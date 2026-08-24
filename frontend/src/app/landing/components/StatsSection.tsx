import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { landingStats, LandingStat } from "../landingData";

interface StatsSectionProps {
  theme: Theme;
}

interface StatCardProps {
  stat: LandingStat;
  theme: Theme;
}

const StatCard = React.memo(function StatCard({ stat, theme: t }: StatCardProps) {
  const formattedLabel = useMemo(() => stat.label.replace("\n", " "), [stat.label]);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.35, ease: "easeIn" } },
        show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
      }}
      className="group relative flex flex-col items-center justify-center p-3.5 min-[375px]:p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] overflow-hidden"
      style={{
        background: hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.65),
        borderColor: hexToRgba(t.txtBody, t.isDark ? 0.12 : 0.15),
        backdropFilter: "blur(12px)",
        boxShadow: t.isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 4px 20px rgba(0,0,0,0.03)",
        willChange: "transform, opacity",
      }}
    >
      {/* Ambient hover top highlight line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${t.accentPrimary}, transparent)`,
        }}
      />

      <div
        className="text-2xl min-[360px]:text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight"
        style={{
          fontFamily: "'Fraunces', serif",
          color: t.numHero,
          lineHeight: 1.15,
        }}
      >
        {stat.value}
      </div>
      <div
        className="text-[11px] min-[360px]:text-xs sm:text-sm font-medium mt-1.5 sm:mt-3 leading-snug sm:leading-relaxed max-w-[220px] mx-auto text-balance"
        style={{ color: t.txtSecondary }}
      >
        {formattedLabel}
      </div>
    </motion.div>
  );
});

export const StatsSection = React.memo(function StatsSection({ theme: t }: StatsSectionProps) {
  return (
    <section
      className="relative z-20 w-full px-3.5 sm:px-8 lg:px-12 py-10 sm:py-16"
      style={{
        background: hexToRgba(t.bgSurface, t.isDark ? 0.75 : 0.60),
        borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.60)}`,
        borderBottom: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.60)}`,
      }}
      aria-label="Platform Statistics"
    >
      <h2 className="sr-only">Key Platform Metrics</h2>
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={{
          hidden: { transition: { staggerChildren: 0.08, staggerDirection: -1 } },
          show: { transition: { staggerChildren: 0.08, staggerDirection: 1 } },
        }}
        className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8 text-center"
      >
        {landingStats.map((s) => (
          <StatCard key={s.value} stat={s} theme={t} />
        ))}
      </motion.div>
    </section>
  );
});

