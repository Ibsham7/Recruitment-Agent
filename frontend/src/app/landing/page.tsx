import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import { ShapeGrid } from "../../components/common/ShapeGrid";
import { PillNav } from "../../components/common/PillNav";
import { motion } from "motion/react";
import { FileText, Bot, Video, CheckCircle } from "lucide-react";
import TargetCursor from "../../components/common/TargetCursor";
import TextType from "../../components/common/TextType";
const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";

export default function LandingPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const onEnter = () => navigate("/auth");

  const steps = [
    { num: 1, title: "Post a Campaign", body: "Define the role, requirements, and ideal candidate profile. hireagent configures your pipeline automatically.", icon: FileText },
    { num: 2, title: "AI Screens Every CV", body: "Every application is parsed, scored against your job description, and ranked — instantly, at any volume.", icon: Bot },
    { num: 3, title: "Automated Interviews", body: "Top candidates receive an asynchronous AI interview. No scheduling, no bias, consistent evaluation every time.", icon: Video },
    { num: 4, title: "You Make the Call", body: "Review transcripts, radar scores, and AI recommendations. Your shortlist arrives pre-ranked and ready.", icon: CheckCircle },
  ];

  const features = [
    { title: "Live Pipeline View", desc: "Kanban-style board across five stages — Pending, Screening, Interviewing, Shortlisted, Rejected. Drag, filter, decide.", icon: "▦" },
    { title: "Radar Scoring", desc: "Six dimensions: Technical, Communication, Cultural Fit, Problem Solving, Leadership, Domain. Every candidate charted.", icon: "◎" },
    { title: "Interview Transcripts", desc: "Full AI-generated transcripts with timestamped Q&A. Read the whole conversation or jump to flagged moments.", icon: "≡" },
    { title: "Campaign Analytics", desc: "Processing rates, match scores, shortlist velocity — track what matters across every active campaign.", icon: "↗" },
    { title: "Multi-Campaign Support", desc: "Run Senior Eng, PM, and DevOps searches simultaneously. Each pipeline stays clean and separate.", icon: "⊕" },
    { title: "Zero Scheduling Overhead", desc: "Candidates interview on their own time. You review when you're ready. The bottleneck is gone.", icon: "◷" },
  ];

  const stats = [
    { value: "2,400+", label: "Interviews automated\nevery month" },
    { value: "94%",    label: "Candidate match\naccuracy" },
    { value: "3.2×",   label: "Faster time-to-hire\nvs traditional process" },
    { value: "< 2 min", label: "Average time to first\ncandidate score" },
  ];

  // Theme-derived ShapeGrid colors
  const gridBorder = hexToRgba(t.txtBody, t.isDark ? 0.07 : 0.09);
  const gridHover  = hexToRgba(t.accentPrimary, t.isDark ? 0.35 : 0.18);

  return (
    <div className="relative w-full overflow-y-auto overflow-x-hidden" style={{ background: t.bgPage, color: t.txtBody, minHeight: "100vh" }}>
      <TargetCursor 
        cursorColor="#ffffff" 
        cursorColorOnTarget={t.accentPrimary} 
      />
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center" style={{ minHeight: "100vh" }}>
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

        {/* Nav bar — 3-col: logo | PillNav | CTA */}
        <div className="absolute top-0 left-0 right-0 z-10" style={{ height: "72px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 2.5rem", gap: "1rem" }}>
          <img src={t.isDark ? logoDarkImg : logoLightImg} alt="hireagent" className="cursor-target" style={{ width: "148px", height: "48px", objectFit: "contain", objectPosition: "left center" }} />

          <PillNav
            containerStyle={{ position: "relative", top: "unset" }}
            baseColor={t.isDark ? hexToRgba(t.bgSurface, 0.88) : hexToRgba(t.txtBody, 0.88)}
            pillColor={t.isDark ? hexToRgba(t.bgCard, 0.16) : hexToRgba(t.bgCard, 0.92)}
            pillTextColor={t.isDark ? t.txtBody : t.txtBody}
            hoveredPillTextColor={t.isDark ? t.bgPage : t.bgPage}
            items={[
              { label: "Features",    onClick: () => document.getElementById("ha-features")?.scrollIntoView({ behavior: "smooth" }) },
              { label: "How it works", onClick: () => document.getElementById("ha-process")?.scrollIntoView({ behavior: "smooth" }) },
              { label: "Sign in",     onClick: onEnter },
            ]}
          />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onEnter}
              className="cursor-target px-5 py-2 rounded-xl text-xs font-semibold"
              style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 2px 12px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
              Get started →
            </button>
          </div>
        </div>

        {/* Hero copy */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl"
        >
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-6 px-3 py-1.5 rounded-full"
            style={{ color: t.accentBadge, background: hexToRgba(t.accentBadge, 0.10), border: `1px solid ${hexToRgba(t.accentBadge, 0.22)}`, fontFamily: "'DM Mono',monospace" }}>
            AI-Powered Recruiting Platform
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(2.6rem, 6vw, 4.5rem)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
            Hire the right people,<br />
            <TextType 
              text={[
                "faster than ever.", 
                "with zero hassle.", 
                "without bias."
              ]}
              typingSpeed={50}
              pauseDuration={1500}
              showCursor={true}
              cursorCharacter="|"
            />
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-xl" style={{ color: t.txtSecondary }}>
            hireagent automates CV screening, conducts AI interviews, and surfaces your best candidates — so your team spends time on decisions, not admin.
          </p>
          <button onClick={onEnter}
            className="cursor-target px-10 py-4 rounded-2xl text-base font-semibold"
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

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="ha-process" className="px-8 py-24 max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.accentBadge, fontFamily: "'DM Mono',monospace" }}>Process</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15 }}>
            From job post to shortlist.<br />No human bottlenecks.
          </h2>
        </motion.div>

        <motion.div 
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, amount: 0.1 }}
          variants={{
            hidden: {
              transition: { staggerChildren: 0.1, staggerDirection: -1 }
            },
            show: {
              transition: { staggerChildren: 0.2, staggerDirection: 1 }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12"
        >
          {steps.map((s, i) => (
            <motion.div 
              key={s.num} 
              variants={{
                hidden: { opacity: 0, y: 30, transition: { duration: 0.4, ease: "easeIn" } },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
              }}
              className="cursor-target flex flex-col items-center group"
            >
              {/* Icon Container */}
              <div className="mb-6 relative w-full flex justify-center">
                <motion.div 
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm"
                  style={{ 
                    background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 1),
                    border: `1px solid ${hexToRgba(t.txtPrimary, 0.1)}`,
                    color: t.accentPrimary,
                  }}
                >
                  <s.icon size={28} strokeWidth={1.5} />
                </motion.div>
                {/* Connecting line between icons (desktop only) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-[1px] -translate-y-1/2 border-t border-dashed opacity-40" 
                    style={{ borderColor: t.txtPrimary }} 
                  />
                )}
              </div>

              {/* Number and Text Content */}
              <div className="flex items-start text-left gap-4 w-full">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-medium border"
                  style={{ 
                    borderColor: hexToRgba(t.txtPrimary, 0.2), 
                    color: t.txtPrimary,
                    fontFamily: "'DM Mono',monospace"
                  }}
                >
                  {s.num}
                </div>
                <div className="flex-1 mt-[2px]">
                  <h3 className="text-base font-semibold mb-2" style={{ color: t.txtPrimary }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: t.txtSecondary }}>{s.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────── */}
      <section className="px-8 py-16" style={{ background: hexToRgba(t.bgSurface, t.isDark ? 0.70 : 0.55), borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}`, borderBottom: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}` }}>
        <motion.div 
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, amount: 0.1 }}
          variants={{
            hidden: { transition: { staggerChildren: 0.1, staggerDirection: -1 } },
            show: { transition: { staggerChildren: 0.1, staggerDirection: 1 } }
          }}
          className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          {stats.map((s) => (
            <motion.div 
              key={s.value}
              variants={{
                hidden: { opacity: 0, scale: 0.9, transition: { duration: 0.4, ease: "easeIn" } },
                show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
              }}
            >
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 600, color: t.numHero, lineHeight: 1 }}>{s.value}</div>
              <div className="text-xs mt-2 leading-snug" style={{ color: t.txtSecondary, whiteSpace: "pre-line" }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="ha-features" className="px-8 py-24 max-w-5xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.accentBadge, fontFamily: "'DM Mono',monospace" }}>Features</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15 }}>
            Everything a recruiting team needs.<br />Nothing it doesn't.
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
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {features.map((f) => (
            <motion.div 
              key={f.title} 
              variants={{
                hidden: { opacity: 0, y: 20, transition: { duration: 0.4, ease: "easeIn" } },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
              }}
              className="cursor-target rounded-2xl p-6 group transition-all"
              style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.80)}`, backdropFilter: "blur(16px)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.72); (e.currentTarget as HTMLDivElement).style.borderColor = hexToRgba(t.accentPrimary, 0.35); }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50); (e.currentTarget as HTMLDivElement).style.borderColor = hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.80); }}>
              <div className="text-2xl mb-4" style={{ color: t.accentPrimary }}>{f.icon}</div>
              <div className="text-sm font-semibold mb-2" style={{ color: t.txtPrimary }}>{f.title}</div>
              <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
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
            Join recruiting teams that have already replaced hours of manual screening with minutes of AI-powered insight.
          </p>
          <button onClick={onEnter}
            className="cursor-target px-12 py-4 rounded-2xl text-base font-semibold"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.38)}` }}>
            Start for free →
          </button>
          <p className="text-xs mt-4" style={{ color: t.txtGhost }}>No credit card · Cancel anytime</p>
        </motion.div>

        {/* Footer */}
        <div className="relative z-10 mt-24 flex items-center gap-6 text-[10px]" style={{ color: t.txtGhost, fontFamily: "'DM Mono',monospace" }}>
          <span>© 2026 hireagent</span>
          <span style={{ width: "1px", height: "12px", background: hexToRgba(t.txtGhost, 0.3) }} />
          <span>Privacy</span>
          <span style={{ width: "1px", height: "12px", background: hexToRgba(t.txtGhost, 0.3) }} />
          <span>Terms</span>
        </div>
      </section>
    </div>
  );
}
