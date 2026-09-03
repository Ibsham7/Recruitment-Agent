import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { PRESETS, hexToRgba, getGlass } from "../../lib/theme";
import { ArrowLeft, Scale, FileText, CheckCircle2, UserCheck, Cpu, ShieldAlert, Award } from "lucide-react";
import SEOHead from "../../components/SEOHead";

export default function TermsPage({ theme: t = PRESETS[4] }: { theme?: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen md:h-screen w-full overflow-hidden"
      style={{ background: t.bgPage, color: t.txtBody }}
    >
      <SEOHead
        title="Terms of Service"
        description="Terms and conditions for using AgenticHR's recruitment platform, assessment workflows, and automated screening services."
        path="/terms"
      />
      {/* Sticky Header */}
      <header
        className="shrink-0 z-10 w-full px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between gap-3"
        style={{
          background: hexToRgba(t.bgSurface, t.isDark ? 0.85 : 0.95),
          borderColor: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.8),
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="min-w-[44px] min-h-[44px] p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
            style={{
              borderColor: hexToRgba(t.accentPrimary, 0.3),
              color: t.txtPrimary,
              background: hexToRgba(t.bgCard, 0.2),
            }}
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div
              className="p-2 rounded-xl shrink-0"
              style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
            >
              <Scale size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold leading-none truncate" style={{ color: t.txtPrimary }}>
                Terms of Service
              </h1>
              <p className="text-[11px] sm:text-xs mt-1 truncate" style={{ color: t.txtMuted }}>
                Candidate Assessment Terms
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span
            className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-mono font-medium border"
            style={{
              background: hexToRgba(t.accentPrimary, 0.1),
              borderColor: hexToRgba(t.accentPrimary, 0.3),
              color: t.accentPrimary,
            }}
          >
            v1.0 • Effective July 2026
          </span>
          <button
            onClick={() => navigate("/")}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 flex items-center justify-center"
            style={{ background: t.accentPrimary, color: t.accentText }}
          >
            Home
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full p-4 sm:p-6 gap-4 sm:gap-8">
        {/* Table of Contents Sidebar */}
        <aside
          className="w-full md:w-64 shrink-0 rounded-2xl p-3.5 sm:p-5 border flex flex-col justify-between overflow-y-auto"
          style={G.card}
        >
          <div>
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-2 sm:mb-4 flex items-center gap-2"
              style={{ color: t.txtPrimary, fontFamily: "'DM Mono', monospace" }}
            >
              <FileText size={14} style={{ color: t.accentPrimary }} /> Document Structure
            </h3>
            <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 no-scrollbar text-xs font-medium">
              {[
                { id: "sec-acceptance", label: "1. Acceptance of Terms", icon: CheckCircle2 },
                { id: "sec-warranties", label: "2. Candidate Warranties", icon: UserCheck },
                { id: "sec-disclosures", label: "3. AI Evaluation Terms", icon: Cpu },
                { id: "sec-hitl", label: "4. Human-in-the-Loop", icon: Award },
                { id: "sec-ip", label: "5. Intellectual Property", icon: Scale },
                { id: "sec-liability", label: "6. Limitation of Liability", icon: ShieldAlert },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="whitespace-nowrap min-h-[36px] md:min-h-0 text-left px-3 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
                  style={{ color: t.txtSecondary }}
                >
                  <item.icon size={14} style={{ color: t.accentPrimary }} />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div
            className="hidden md:block mt-6 p-3.5 rounded-xl border text-[11px] space-y-2"
            style={{
              background: hexToRgba(t.bgSurface, 0.4),
              borderColor: hexToRgba(t.accentPrimary, 0.2),
            }}
          >
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: t.txtPrimary }}>
              <Scale size={14} className="text-indigo-500" />
              <span>Binding Agreement</span>
            </div>
            <p className="leading-relaxed" style={{ color: t.txtMuted }}>
              By checking the consent box or participating in an assessment, you agree to these terms.
            </p>
          </div>
        </aside>

        {/* Terms Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 text-sm leading-relaxed">
          {/* Intro Banner */}
          <div
            className="p-6 rounded-2xl border"
            style={{
              background: hexToRgba(t.accentPrimary, 0.05),
              borderColor: hexToRgba(t.accentPrimary, 0.2),
            }}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: t.txtPrimary }}>
              Candidate Terms of Service & Automated Assessment Rules
            </h2>
            <p style={{ color: t.txtSecondary }}>
              Welcome to <strong>AgenticHR</strong>. These Terms of Service govern your access to and use of our recruitment platform, assessment links, and automated screening workflow. Please read these terms carefully before initiating your assessment.
            </p>
          </div>

          {/* Section 1 */}
          <section id="sec-acceptance" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <CheckCircle2 size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                1. Acceptance of Terms & Service Scope
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              By accepting an interview invitation, submitting your email address, or participating in an assessment, you confirm that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy.
            </p>
            <p style={{ color: t.txtSecondary }}>
              If you are participating on behalf of an employer or hiring organization as an administrator or recruiter, you represent that you possess authority to bind that entity to these terms.
            </p>
          </section>

          {/* Section 2 */}
          <section id="sec-warranties" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <UserCheck size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                2. Candidate Warranties & Fair Assessment Rules
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              When taking an assessment on AgenticHR, candidates agree to maintain integrity and authenticate their identity:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2" style={{ color: t.txtSecondary }}>
              <li><strong style={{ color: t.txtPrimary }}>Authenticity of Responses:</strong> All submitted written answers must be your own authentic work. You warrant that you will not engage proxy test-takers or unauthorized automated response generators.</li>
              <li><strong style={{ color: t.txtPrimary }}>Accuracy of Resume & Credentials:</strong> All educational credentials, work history, skill sets, and contact details uploaded or submitted must be truthful and accurate.</li>
              <li><strong style={{ color: t.txtPrimary }}>No System Interference:</strong> You must not attempt to bypass invitation token security, manipulate system timers, or inspect client-side application code to extract test questions.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="sec-disclosures" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Cpu size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                3. Automated AI Assessment Disclosures
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              In compliance with local and international AI regulation (including EU AI Act requirements):
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2" style={{ color: t.txtSecondary }}>
              <li><strong style={{ color: t.txtPrimary }}>AI Model Assistance:</strong> Large Language Models are used as analytical aids to generate job-relevant technical questions and assist in evaluating candidate answers against objective domain rubrics.</li>
              <li><strong style={{ color: t.txtPrimary }}>Objective Domain Prompts:</strong> Prompts are strictly restricted to technical skill requirements and job description competencies. Age, gender, ethnicity, location, and non-job-related personal characteristics are excluded from evaluation logic.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="sec-hitl" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Award size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                4. Mandatory Human-in-the-Loop Decision Making
              </h2>
            </div>
            <div
              className="p-4 rounded-xl border flex items-start gap-3"
              style={{
                background: hexToRgba(t.accentPrimary, 0.08),
                borderColor: hexToRgba(t.accentPrimary, 0.3),
              }}
            >
              <Award size={20} style={{ color: t.accentPrimary }} className="shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs" style={{ color: t.txtPrimary }}>Human Recruiter Oversight Guarantee</h4>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: t.txtSecondary }}>
                  No candidate is automatically rejected or extended a formal offer solely by automated software algorithms. All final candidate status advancements (shortlisting, interviewing, hiring, or rejection) require review and confirmation by a human recruiter.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="sec-ip" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Scale size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                5. Intellectual Property & Confidentiality
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              All assessment questions, campaign materials, platform interface designs, and proprietary scoring algorithms are the exclusive intellectual property of AgenticHR and its hiring organization partners.
            </p>
            <p style={{ color: t.txtSecondary }}>
              Candidates agree not to copy, publish, record, share, or publicly distribute assessment questions or materials encountered during their assessment session.
            </p>
          </section>

          {/* Section 6 */}
          <section id="sec-liability" className="p-6 rounded-2xl border space-y-4 mb-8" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <ShieldAlert size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                6. Limitation of Liability & Contact
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              To the maximum extent permitted by applicable law, AgenticHR and its affiliates shall not be liable for indirect, incidental, or consequential damages resulting from technical interruptions or candidate internet connection failures during assessments.
            </p>
            <p style={{ color: t.txtSecondary }}>
              For legal notices or questions regarding these terms, please contact us at <a href="mailto:contact@agentichr.dev" className="font-mono hover:underline" style={{ color: t.accentPrimary }}>contact@agentichr.dev</a>.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
