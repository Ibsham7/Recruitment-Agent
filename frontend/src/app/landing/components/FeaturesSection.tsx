import { motion } from "motion/react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { landingFeatures } from "../landingData";

interface FeaturesSectionProps {
  theme: Theme;
}

export function FeaturesSection({ theme: t }: FeaturesSectionProps) {
  return (
    <section id="ha-features" className="w-full px-4 sm:px-8 lg:px-12 py-24 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-16"
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.accentBadge, fontFamily: "'DM Mono',monospace" }}>Features</div>
        <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15, whiteSpace: "pre-line" }}>
          Built for engineering precision.{"\n"}Designed for hiring velocity.
        </h2>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: false, amount: 0.1 }}
        variants={{
          hidden: { transition: { staggerChildren: 0.1, staggerDirection: -1 } },
          show: { transition: { staggerChildren: 0.1, staggerDirection: 1 } }
        }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {landingFeatures.map((f) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              variants={{
                hidden: { opacity: 0, y: 20, transition: { duration: 0.4, ease: "easeIn" } },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
              }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="cursor-target rounded-2xl p-6 transition-all duration-300 group"
              style={{ 
                background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50), 
                border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.80)}`, 
                backdropFilter: "blur(16px)" 
              }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: hexToRgba(t.accentPrimary, 0.12), color: t.accentPrimary }}>
                <Icon size={22} strokeWidth={1.75} />
              </div>
              <div className="text-base font-semibold mb-2" style={{ color: t.txtPrimary }}>{f.title}</div>
              <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>{f.desc}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
