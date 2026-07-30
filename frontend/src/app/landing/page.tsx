import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import { ShapeGrid } from "../../components/common/ShapeGrid";
import { PillNav } from "../../components/common/PillNav";
import { motion, AnimatePresence, useScroll, useMotionValueEvent, useTransform } from "motion/react";
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
  ChevronDown,
  Play,
  Pause,
  Maximize2,
  X,
  Lock,
  ChevronRight
} from "lucide-react";
import TargetCursor from "../../components/common/TargetCursor";
import TextType from "../../components/common/TextType";

const logoLightImg = "/logo-light.webp";
const logoDarkImg = "/logo-dark.webp";

export default function LandingPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const onEnter = () => navigate("/auth");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  const processSectionRef = useRef<HTMLDivElement>(null);

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

  const steps = [
    { 
      num: 1, 
      badge: "Step 01",
      title: "Post a Campaign", 
      body: "Define job requirements, mandatory experience, and custom hard rules. hireagent instantly constructs your automated screening pipeline.", 
      icon: FileText,
      url: "app.hireagent.ai/setup",
      image: "/process/step-1.png",
      tags: ["JD Parsing", "Hard-Filter Rules", "Pipeline Setup"],
      highlight: "Zero LLM Cost Filtering"
    },
    { 
      num: 2, 
      badge: "Step 02",
      title: "Multi-Tier AI Funnel", 
      body: "PyMuPDF parsing, Python hard filters, pgvector semantic search (1536d), and Gemini Flash JD scoring screen applications in seconds.", 
      icon: Bot,
      url: "app.hireagent.ai/pipeline",
      image: "/process/step-2.png",
      tags: ["PyMuPDF Engine", "pgvector Semantic Search", "Gemini Flash Fit"],
      highlight: "10x Screening Velocity"
    },
    { 
      num: 3, 
      badge: "Step 03",
      title: "Asynchronous AI Interviews", 
      body: "Shortlisted candidates answer 3-5 tailored technical questions designed dynamically to probe their specific CV gaps — anytime, anywhere.", 
      icon: MessageSquareText,
      url: "app.hireagent.ai/interview/session",
      image: "/process/step-3.png",
      tags: ["CV Gap Detection", "Adaptive Follow-ups", "Async Candidate Portal"],
      highlight: "Zero Scheduling Delay"
    },
    { 
      num: 4, 
      badge: "Step 04",
      title: "Final Scorecard & Shortlist", 
      body: "Review Claude Sonnet transcript evaluations, multi-dimensional radar scores, per-candidate cost analytics, and make instant hiring decisions.", 
      icon: CheckCircle,
      url: "app.hireagent.ai/dashboard",
      image: "/process/step-4.png",
      tags: ["Multi-Axis Radar", "Claude Sonnet Grading", "Token Cost Tracker"],
      highlight: "Data-Driven Hiring"
    },
  ];

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, steps.length]);

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
      category: "Control & Governance",
      q: "Will the AI make automated hiring or rejection decisions without my review?",
      a: "No. hireagent operates as an intelligent hiring co-pilot, not an autonomous black box. While our multi-stage engine automatically screens, ranks candidates, and evaluates interviews, your hiring team retains 100% decision control. You can inspect fit scores, review full interview transcripts, manually move candidates across pipeline stages, and override any recommendation."
    },
    {
      category: "Candidate Experience",
      q: "What is the assessment experience like for job applicants?",
      a: "Applicants receive a seamless, web-based interview assessment link that requires zero app downloads or login setups. Candidates answer role-specific written questions tailored to their experience at their own pace. If a response is brief, our engine adaptively asks a targeted follow-up probe to ensure candidate depth is fully captured."
    },
    {
      category: "Screening & Rules",
      q: "Can I set mandatory hard filters and custom criteria for specific roles?",
      a: "Yes. When setting up a campaign, you configure mandatory experience thresholds, non-negotiable tech stacks, and custom hard rules. Applicants who do not meet your mandatory criteria are filtered out immediately before deep fit scoring occurs."
    },
    {
      category: "Cost & Efficiency",
      q: "How does hireagent process high volumes of CVs so cost-effectively?",
      a: "Instead of running full AI evaluations on every raw application upfront, hireagent uses an intelligent multi-stage cascade. Non-matching profiles and duplicates are filtered out early during initial qualification checks, reserving deep AI evaluations exclusively for viable candidates. This multi-tiered approach dramatically reduces overall processing overhead while accelerating screening."
    },
    {
      category: "Objectivity & Bias",
      q: "How does hireagent minimize bias and maintain objective candidate evaluation?",
      a: "Our evaluation engine grades candidates strictly against job description requirements, verified skills, and structured multi-axis rubric standards (Technical Depth, Communication, and Problem-Solving). Every candidate in a campaign is judged against the exact same rules, filters, and criteria set up by your hiring team, ensuring consistent and objective evaluations."
    },
    {
      category: "Security & Privacy",
      q: "Is candidate resume and assessment data kept private and secure?",
      a: "Yes. All data transmissions are encrypted using standard SSL/TLS, and data access is enforced with token-based authentication and account-level isolation. Your candidate profiles, resume data, and interview transcripts are strictly private to your team and isolated to your account. We never sell candidate data or share it across accounts."
    },
    {
      category: "AI Interview Depth",
      q: "Are the AI interview questions static templates or dynamically generated?",
      a: "Questions are dynamically formulated for each campaign and candidate. The engine analyzes your job description requirements alongside the candidate's parsed resume to ask targeted questions that probe real skills and candidate background gaps, complete with live follow-up probing."
    },
    {
      category: "Setup & Onboarding",
      q: "How quickly can our team set up a hiring campaign and start screening?",
      a: "You can launch a hiring campaign in under 5 minutes. Simply paste your job description, define your mandatory filter rules, and upload candidate resumes. hireagent parses the CVs, runs the multi-stage screening funnel, and populates your visual pipeline dashboard instantly."
    }
  ];

  // Theme-derived ShapeGrid colors
  const gridBorder = hexToRgba(t.txtBody, t.isDark ? 0.07 : 0.09);
  const gridHover = hexToRgba(t.accentPrimary, t.isDark ? 0.35 : 0.18);

  return (
    <div className="relative w-full overflow-x-clip" style={{ background: t.bgPage, color: t.txtBody, minHeight: "100vh" }}>
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
          <img src={t.isDark ? logoDarkImg : logoLightImg} alt="hireagent logo" width={148} height={48} decoding="async" fetchPriority="high" className="cursor-target max-h-9 w-auto object-contain object-left" />
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

      {/* ── HOW IT WORKS / PRODUCT PROCESS SHOWCASE WITH SCROLLMATION ───────────── */}
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
              <Sparkles size={12} /> Interactive Scrollmation & Product Workflow
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
                  scaleX: isAutoPlaying ? (activeStep + 1) / steps.length : scrollYProgress,
                  background: `linear-gradient(90deg, ${t.accentPrimary}, ${t.accentBadge})` 
                }}
                transition={{ duration: isAutoPlaying ? 0.3 : 0 }}
              />
            </div>

            {steps.map((s, idx) => {
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
              <span className="text-[10px] font-mono">Step {activeStep + 1} of {steps.length}</span>
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
                  <span className="truncate">{steps[activeStep].url}</span>
                </div>

                {/* Status & Maximize Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium" style={{ background: hexToRgba(t.accentBadge, 0.12), color: t.accentBadge }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>App Screenshot</span>
                  </div>
                  <button 
                    onClick={() => setFullscreenImg(steps[activeStep].image)}
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
                {steps.map((s, idx) => {
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
                  <span className="font-mono text-[11px]" style={{ color: t.txtGhost }}>{steps[activeStep].badge}</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-medium" style={{ color: t.txtPrimary }}>{steps[activeStep].title}</span>
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
                    <Sparkles size={16} style={{ color: t.accentPrimary }} />
                    <span className="text-sm font-semibold" style={{ color: t.txtPrimary }}>
                      {steps[activeStep].title} — Full Screenshot View
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

      {/* ── STATS ─────────────────────────────────────────────────────────── */}
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
          <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color: t.txtSecondary }}>
            Everything you need to know about hireagent's screening engine, candidate experience, data privacy, and recruiting workflow.
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
                  <div className="flex flex-col gap-1 pr-4">
                    {faq.category && (
                      <span 
                        className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit mb-1"
                        style={{ 
                          color: t.accentBadge, 
                          background: hexToRgba(t.accentBadge, 0.12),
                          border: `1px solid ${hexToRgba(t.accentBadge, 0.20)}`
                        }}
                      >
                        {faq.category}
                      </span>
                    )}
                    <span className="text-sm sm:text-base font-semibold" style={{ color: t.txtPrimary }}>
                      {faq.q}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 ml-2"
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
