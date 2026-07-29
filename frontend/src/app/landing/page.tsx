import { useState } from "react";
import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import { ShapeGrid } from "../../components/common/ShapeGrid";
import { PillNav } from "../../components/common/PillNav";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  Bot, 
  MessageSquareText, 
  CheckCircle,
  LayoutGrid,
  Target,
  TrendingUp,
  Layers,
  Clock,
  Sparkles,
  ChevronDown
} from "lucide-react";
import TargetCursor from "../../components/common/TargetCursor";
import TextType from "../../components/common/TextType";

const logoLightImg = "/logo-light.webp";
const logoDarkImg = "/logo-dark.webp";

export default function LandingPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const onEnter = () => navigate("/auth");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const steps = [
    { num: 1, title: "Post a Campaign", body: "Define job requirements, mandatory experience, and hard rules. hireagent sets up your screening pipeline instantly.", icon: FileText },
    { num: 2, title: "Multi-Tier AI Funnel", body: "PyMuPDF parsing, Python hard-filter rules, pgvector semantic search, and Gemini Flash JD scoring screen applications in seconds.", icon: Bot },
    { num: 3, title: "Asynchronous Interviews", body: "Shortlisted candidates answer 3-5 tailored technical questions addressing their specific CV gaps — anytime, anywhere.", icon: MessageSquareText },
    { num: 4, title: "Final Scorecard & Shortlist", body: "Review Claude Sonnet transcript evaluations, multi-dimensional radar scores, and per-candidate token costs ready for decision.", icon: CheckCircle },
  ];

  const features = [
    { title: "Live Pipeline View", desc: "Kanban board across five distinct stages — Pending, Screening, Interviewing, Shortlisted, Rejected. Drag, filter, decide.", icon: LayoutGrid },
    { title: "Multi-Dimensional Radar Scoring", desc: "Evaluate candidates across Technical, Communication, Cultural Fit, and Overall Fit dimensions.", icon: Target },
    { title: "Turn-by-Turn Transcripts", desc: "Full AI-generated written interview transcripts with timestamped Q&A and adaptive follow-up probing.", icon: FileText },
    { title: "Campaign Analytics & Velocity", desc: "Track candidate fit scores, shortlist velocity, screening progress, and multi-dimensional candidate evaluation metrics.", icon: TrendingUp },
    { title: "Multi-Campaign Pipelines", desc: "Run Engineering, Product, and Operations searches simultaneously with completely isolated candidate pools.", icon: Layers },
    { title: "SHA-256 CV Deduplication", desc: "Cryptographic hashing automatically detects duplicate resume uploads and reuses cached parse data instantly.", icon: Clock },
  ];

  const stats = [
    { value: "10×", label: "Faster candidate screening\nvs manual resume review" },
    { value: "4-Tier", label: "Automated candidate evaluation\n& AI interview funnel" },
    { value: "100%", label: "Standardized, objective\ncandidate fit scoring" },
    { value: "0 hrs", label: "Wasted reading unqualified\nor mismatched resumes" },
  ];

  const faqs = [
    {
      q: "How does the multi-tiered AI screening funnel work?",
      a: "The pipeline uses an intelligent 4-tier funnel: hard filters (experience & tech stack), semantic vector similarity matching, objective fit scoring (0-100), and comprehensive transcript evaluations for interview finalists."
    },
    {
      q: "How are automated interviews conducted and evaluated?",
      a: "Shortlisted candidates receive a unique link to complete an asynchronous written interview. The agent generates 3-5 technical questions tailored to their CV gaps. Once completed, the system evaluates the full transcript across Technical, Communication, and Cultural Fit dimensions."
    },
    {
      q: "What makes hireagent so fast and efficient compared to traditional screening tools?",
      a: "By filtering non-qualifying candidates early using automated hard rules and vector semantic matching before running deep evaluation algorithms, hireagent delivers up to 10× faster screening velocity and eliminates manual resume review fatigue."
    },
    {
      q: "How does hireagent handle duplicate CVs and candidate privacy?",
      a: "Every CV upload is cryptographic SHA-256 hashed to prevent redundant processing. All candidate records, vectors, and transcripts are stored securely in PostgreSQL with Supabase JWT authentication and strict privacy policies."
    }
  ];

  // Theme-derived ShapeGrid colors
  const gridBorder = hexToRgba(t.txtBody, t.isDark ? 0.07 : 0.09);
  const gridHover = hexToRgba(t.accentPrimary, t.isDark ? 0.35 : 0.18);

  return (
    <div className="relative w-full overflow-y-auto overflow-x-hidden" style={{ background: t.bgPage, color: t.txtBody, minHeight: "100vh" }}>
      <TargetCursor
        cursorColor="#ffffff"
        cursorColorOnTarget={t.accentPrimary}
      />
      
      {/* ── STICKY NAV BAR ─────────────────────────────────────────────────── */}
      <header 
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          height: "72px",
          background: hexToRgba(t.bgPage, t.isDark ? 0.75 : 0.85),
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06)}`,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          padding: "0 2rem",
          gap: "1rem"
        }}
      >
        <div className="flex items-center">
          <img src={t.isDark ? logoDarkImg : logoLightImg} alt="hireagent logo" width={148} height={48} decoding="async" fetchpriority="high" className="cursor-target max-h-9 w-auto object-contain object-left" />
        </div>

        <PillNav
          containerStyle={{ position: "relative", top: "unset" }}
          baseColor={t.isDark ? hexToRgba(t.bgSurface, 0.88) : hexToRgba(t.txtBody, 0.88)}
          pillColor={t.isDark ? hexToRgba(t.bgCard, 0.16) : hexToRgba(t.bgCard, 0.92)}
          pillTextColor={t.isDark ? t.txtBody : t.txtBody}
          hoveredPillTextColor={t.isDark ? t.bgPage : t.bgPage}
          items={[
            { label: "Features", onClick: () => document.getElementById("ha-features")?.scrollIntoView({ behavior: "smooth" }) },
            { label: "How it works", onClick: () => document.getElementById("ha-process")?.scrollIntoView({ behavior: "smooth" }) },
            { label: "FAQ", onClick: () => document.getElementById("ha-faq")?.scrollIntoView({ behavior: "smooth" }) },
            { label: "Sign in", onClick: onEnter },
          ]}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onEnter}
            className="cursor-target px-4 sm:px-5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 2px 12px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
            Get started →
          </button>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
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
            <Sparkles size={13} /> Multi-Tier AI Recruiting Engine
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

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="ha-process" className="w-full px-4 sm:px-8 lg:px-12 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.accentBadge, fontFamily: "'DM Mono',monospace" }}>Process</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15, whiteSpace: "pre-line" }}>
            From job post to shortlist.{"\n"}Powered by a multi-tiered funnel.
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
      <section className="w-full px-4 sm:px-8 lg:px-12 py-16" style={{ background: hexToRgba(t.bgSurface, t.isDark ? 0.70 : 0.55), borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}`, borderBottom: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}` }}>
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
          {stats.map((s) => (
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

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
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
          {features.map((f) => {
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

      {/* ── FAQ ACCORDION ─────────────────────────────────────────────────── */}
      <section id="ha-faq" className="w-full px-4 sm:px-8 lg:px-12 py-24 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.accentBadge, fontFamily: "'DM Mono',monospace" }}>FAQ</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15 }}>
            Frequently Asked Questions
          </h2>
          <p className="text-sm mt-3" style={{ color: t.txtSecondary }}>
            Technical details behind hireagent's multi-tiered screening & AI interview architecture.
          </p>
        </motion.div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.1 }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="rounded-2xl border overflow-hidden transition-all duration-200"
                style={{
                  background: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.50),
                  borderColor: isOpen ? hexToRgba(t.accentPrimary, 0.4) : hexToRgba(t.txtBody, 0.08),
                  backdropFilter: "blur(12px)"
                }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left cursor-target"
                >
                  <span className="text-sm sm:text-base font-semibold pr-4" style={{ color: t.txtPrimary }}>
                    {faq.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                    style={{ color: t.accentPrimary }}
                  >
                    <ChevronDown size={20} />
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-sm leading-relaxed border-t pt-4" style={{ color: t.txtSecondary, borderColor: hexToRgba(t.txtBody, 0.06) }}>
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
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

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full pt-16 pb-12 px-8 border-t" style={{ borderColor: hexToRgba(t.txtBody, 0.08), background: hexToRgba(t.bgSurface, t.isDark ? 0.50 : 0.30) }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1 flex flex-col items-start">
            <img src={t.isDark ? logoDarkImg : logoLightImg} alt="hireagent logo" width={130} height={40} className="mb-4 h-8 w-auto object-contain" />
            <p className="text-xs leading-relaxed mb-4" style={{ color: t.txtSecondary }}>
              Exponentially narrowing, ultra-cost-optimized AI screening & automated candidate interview engine.
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]" style={{ background: hexToRgba(t.accentBadge, 0.12), color: t.accentBadge }}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: t.txtPrimary, fontFamily: "'DM Mono',monospace" }}>Product</h4>
            <ul className="space-y-2.5 text-xs" style={{ color: t.txtSecondary }}>
              <li><button onClick={() => document.getElementById("ha-features")?.scrollIntoView({ behavior: "smooth" })} className="hover:underline">Features</button></li>
              <li><button onClick={() => document.getElementById("ha-process")?.scrollIntoView({ behavior: "smooth" })} className="hover:underline">How It Works</button></li>
              <li><button onClick={onEnter} className="hover:underline">Dashboard</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: t.txtPrimary, fontFamily: "'DM Mono',monospace" }}>Architecture</h4>
            <ul className="space-y-2.5 text-xs" style={{ color: t.txtSecondary }}>
              <li><button onClick={() => document.getElementById("ha-faq")?.scrollIntoView({ behavior: "smooth" })} className="hover:underline">FAQ</button></li>
              <li><a href="#" className="hover:underline">Multi-Tier Screening</a></li>
              <li><a href="#" className="hover:underline">Vector Semantic Match</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: t.txtPrimary, fontFamily: "'DM Mono',monospace" }}>Security & Data</h4>
            <ul className="space-y-2.5 text-xs" style={{ color: t.txtSecondary }}>
              <li><a href="#" className="hover:underline">Candidate Data Privacy</a></li>
              <li><a href="#" className="hover:underline">Secure JWT Authentication</a></li>
              <li><a href="#" className="hover:underline">Automatic CV Deduplication</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]" style={{ borderColor: hexToRgba(t.txtBody, 0.06), color: t.txtGhost, fontFamily: "'DM Mono',monospace" }}>
          <span>© 2026 hireagent. All rights reserved.</span>
          <span>Automated AI candidate screening & interview engine.</span>
        </div>
      </footer>
    </div>
  );
}
