import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import { ShapeGrid } from "../../components/common/ShapeGrid";
import { PillNav } from "../../components/common/PillNav";
const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";

export default function LandingPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const onEnter = () => navigate("/auth");

  const steps = [
    { num: "01", title: "Post a Campaign", body: "Define the role, requirements, and ideal candidate profile. hireagent configures your pipeline automatically." },
    { num: "02", title: "AI Screens Every CV", body: "Every application is parsed, scored against your job description, and ranked — instantly, at any volume." },
    { num: "03", title: "Automated Interviews", body: "Top candidates receive an asynchronous AI interview. No scheduling, no bias, consistent evaluation every time." },
    { num: "04", title: "You Make the Call", body: "Review transcripts, radar scores, and AI recommendations. Your shortlist arrives pre-ranked and ready." },
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
          <img src={t.isDark ? logoDarkImg : logoLightImg} alt="hireagent" style={{ width: "148px", height: "48px", objectFit: "contain", objectPosition: "left center" }} />

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
              className="px-5 py-2 rounded-xl text-xs font-semibold"
              style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 2px 12px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
              Get started →
            </button>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-6 px-3 py-1.5 rounded-full"
            style={{ color: t.accentBadge, background: hexToRgba(t.accentBadge, 0.10), border: `1px solid ${hexToRgba(t.accentBadge, 0.22)}`, fontFamily: "'DM Mono',monospace" }}>
            AI-Powered Recruiting Platform
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(2.6rem, 6vw, 4.5rem)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
            Hire the right people,<br />faster than ever before.
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-xl" style={{ color: t.txtSecondary }}>
            hireagent automates CV screening, conducts AI interviews, and surfaces your best candidates — so your team spends time on decisions, not admin.
          </p>
          <button onClick={onEnter}
            className="px-10 py-4 rounded-2xl text-base font-semibold"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.38)}`, letterSpacing: "0.01em" }}>
            Get started free →
          </button>
          <p className="text-xs mt-4" style={{ color: t.txtGhost }}>No credit card required · Set up in under 5 minutes</p>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5" style={{ color: t.txtGhost }}>
          <span className="text-[10px] uppercase tracking-widest" style={{ fontFamily: "'DM Mono',monospace" }}>Scroll</span>
          <div style={{ width: "1px", height: "32px", background: `linear-gradient(to bottom, ${hexToRgba(t.txtGhost, 0.6)}, transparent)` }} />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="ha-process" className="px-8 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.accentBadge, fontFamily: "'DM Mono',monospace" }}>Process</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15 }}>
            From job post to shortlist.<br />No human bottlenecks.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {steps.map((s, i) => (
            <div key={s.num} className="rounded-2xl p-7 relative overflow-hidden"
              style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.60), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.22 : 0.85)}`, backdropFilter: "blur(20px)" }}>
              {/* Big step number watermark */}
              <div style={{ position: "absolute", right: "20px", top: "12px", fontFamily: "'Fraunces',serif", fontSize: "72px", fontWeight: 700, color: hexToRgba(t.numHero, 0.07), lineHeight: 1, userSelect: "none", pointerEvents: "none" }}>{s.num}</div>
              <div className="text-[10px] font-semibold mb-3" style={{ fontFamily: "'DM Mono',monospace", color: t.accentBadge }}>{s.num}</div>
              <div className="text-base font-semibold mb-2" style={{ color: t.txtPrimary }}>{s.title}</div>
              <p className="text-sm leading-relaxed" style={{ color: t.txtSecondary }}>{s.body}</p>
              {/* Connector line between steps except last column */}
              {i < steps.length - 1 && (
                <div style={{ position: "absolute", right: "-12px", top: "50%", width: "24px", height: "1px", background: hexToRgba(t.accentPrimary, 0.25), display: i % 2 === 0 ? "block" : "none" }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────── */}
      <section className="px-8 py-16" style={{ background: hexToRgba(t.bgSurface, t.isDark ? 0.70 : 0.55), borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}`, borderBottom: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.55)}` }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.value}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 600, color: t.numHero, lineHeight: 1 }}>{s.value}</div>
              <div className="text-xs mt-2 leading-snug" style={{ color: t.txtSecondary, whiteSpace: "pre-line" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="ha-features" className="px-8 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.accentBadge, fontFamily: "'DM Mono',monospace" }}>Features</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15 }}>
            Everything a recruiting team needs.<br />Nothing it doesn't.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl p-6 group transition-all"
              style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.80)}`, backdropFilter: "blur(16px)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.72); (e.currentTarget as HTMLDivElement).style.borderColor = hexToRgba(t.accentPrimary, 0.35); }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.50); (e.currentTarget as HTMLDivElement).style.borderColor = hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.80); }}>
              <div className="text-2xl mb-4" style={{ color: t.accentPrimary }}>{f.icon}</div>
              <div className="text-sm font-semibold mb-2" style={{ color: t.txtPrimary }}>{f.title}</div>
              <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="relative px-8 py-32 flex flex-col items-center text-center overflow-hidden">
        {/* ShapeGrid background for CTA section too */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <ShapeGrid direction="up" speed={0.3} squareSize={44} borderColor={gridBorder} hoverFillColor={gridHover} shape="square" hoverTrailAmount={4} />
        </div>
        <div style={{ position: "absolute", inset: 0, zIndex: 1, background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, ${hexToRgba(t.bgPage, 0.65)} 55%, ${t.bgPage} 100%)`, pointerEvents: "none" }} />

        <div className="relative z-10 max-w-2xl">
          <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.2, marginBottom: "1rem" }}>
            Ready to hire smarter?
          </h2>
          <p className="text-sm leading-relaxed mb-10" style={{ color: t.txtSecondary }}>
            Join recruiting teams that have already replaced hours of manual screening with minutes of AI-powered insight.
          </p>
          <button onClick={onEnter}
            className="px-12 py-4 rounded-2xl text-base font-semibold"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.38)}` }}>
            Start for free →
          </button>
          <p className="text-xs mt-4" style={{ color: t.txtGhost }}>No credit card · Cancel anytime</p>
        </div>

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
