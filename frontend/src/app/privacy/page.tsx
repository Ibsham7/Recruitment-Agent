import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { PRESETS, hexToRgba, getGlass } from "../../lib/theme";
import { ArrowLeft, ShieldCheck, FileText, Lock, Cpu, Server, Trash2, Mail, CheckCircle2 } from "lucide-react";

export default function PrivacyPage({ theme: t = PRESETS[4] }: { theme?: Theme }) {
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
      className="flex flex-col h-screen w-full overflow-hidden select-none"
      style={{ background: t.bgPage, color: t.txtBody }}
    >
      {/* Sticky Header */}
      <header
        className="shrink-0 z-10 w-full px-6 py-4 border-b flex items-center justify-between"
        style={{
          background: hexToRgba(t.bgSurface, t.isDark ? 0.85 : 0.95),
          borderColor: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.8),
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer"
            style={{
              borderColor: hexToRgba(t.accentPrimary, 0.3),
              color: t.txtPrimary,
              background: hexToRgba(t.bgCard, 0.2),
            }}
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl"
              style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none" style={{ color: t.txtPrimary }}>
                Privacy Policy & Candidate Data Disclosures
              </h1>
              <p className="text-xs mt-1" style={{ color: t.txtMuted }}>
                GDPR & CCPA Compliant Candidate Information Notice
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-mono font-medium border"
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
            className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: t.accentPrimary, color: t.accentText }}
          >
            Home
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full p-6 gap-8">
        {/* Table of Contents Sidebar */}
        <aside
          className="w-full md:w-64 shrink-0 rounded-2xl p-5 border flex flex-col justify-between overflow-y-auto"
          style={G.card}
        >
          <div>
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2"
              style={{ color: t.txtPrimary, fontFamily: "'DM Mono', monospace" }}
            >
              <FileText size={14} style={{ color: t.accentPrimary }} /> Table of Contents
            </h3>
            <nav className="space-y-1.5 text-xs font-medium">
              {[
                { id: "sec-data", label: "1. Information We Collect", icon: Lock },
                { id: "sec-ai", label: "2. AI Processing & LLMs", icon: Cpu },
                { id: "sec-subprocessors", label: "3. Sub-Processors", icon: Server },
                { id: "sec-rights", label: "4. Candidate Rights (GDPR/CCPA)", icon: ShieldCheck },
                { id: "sec-retention", label: "5. Retention & Deletion", icon: Trash2 },
                { id: "sec-contact", label: "6. DPO & Contact Info", icon: Mail },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: t.txtSecondary }}
                >
                  <item.icon size={14} style={{ color: t.accentPrimary }} />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div
            className="mt-6 p-3.5 rounded-xl border text-[11px] space-y-2"
            style={{
              background: hexToRgba(t.bgSurface, 0.4),
              borderColor: hexToRgba(t.accentPrimary, 0.2),
            }}
          >
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: t.txtPrimary }}>
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Human-in-the-Loop</span>
            </div>
            <p className="leading-relaxed" style={{ color: t.txtMuted }}>
              Final hiring & rejection decisions are always reviewed and rendered by human recruiters.
            </p>
          </div>
        </aside>

        {/* Policy Content Body */}
        <main className="flex-1 overflow-y-auto pr-2 space-y-8 text-sm leading-relaxed">
          {/* Intro Box */}
          <div
            className="p-6 rounded-2xl border"
            style={{
              background: hexToRgba(t.accentPrimary, 0.05),
              borderColor: hexToRgba(t.accentPrimary, 0.2),
            }}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: t.txtPrimary }}>
              Candidate Privacy & Automated Assessment Transparency
            </h2>
            <p style={{ color: t.txtSecondary }}>
              At <strong>hireagent</strong>, we are committed to upholding the highest standards of data privacy, algorithmic fairness, and transparency under the General Data Protection Regulation (GDPR), California Consumer Privacy Act (CCPA), and EU AI Act. This disclosure outlines how candidate data is handled during recruitment and assessment workflows.
            </p>
          </div>

          {/* Section 1 */}
          <section id="sec-data" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Lock size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                1. Information We Collect
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              We collect candidate information strictly necessary to facilitate recruitment assessments and campaign matching:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2" style={{ color: t.txtSecondary }}>
              <li><strong style={{ color: t.txtPrimary }}>Candidate PII:</strong> Full name, email address, telephone number, and optional professional profile links (LinkedIn, GitHub).</li>
              <li><strong style={{ color: t.txtPrimary }}>Resume & Career Documents:</strong> Uploaded PDF/Word CV documents, parsed work history, education history, and extracted technical skills.</li>
              <li><strong style={{ color: t.txtPrimary }}>Assessment Data:</strong> Written answers submitted during candidate assessment sessions, response timestamps, and assessment progress logs.</li>
              <li><strong style={{ color: t.txtPrimary }}>Derived Embeddings & Metadata:</strong> High-dimensional vector embeddings generated from candidate CV text for objective semantic matching against job requirements.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section id="sec-ai" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Cpu size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                2. AI Processing & LLM Question Generation
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              Our platform utilizes Large Language Models (LLMs) and semantic vector search to streamline candidate evaluation:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2" style={{ color: t.txtSecondary }}>
              <li><strong style={{ color: t.txtPrimary }}>Dynamic Assessment Generation:</strong> Tailored, job-anchored technical questions are generated on-demand based on job descriptions and candidate background.</li>
              <li><strong style={{ color: t.txtPrimary }}>Objective Evaluation Rubrics:</strong> Candidate responses are graded against standardized technical rubrics to calculate preliminary domain fit scores.</li>
              <li><strong style={{ color: t.txtPrimary }}>No Biometric or Surveillance Processing:</strong> We explicitly do NOT use facial recognition, eye tracking, emotion detection, audio voiceprint analysis, or video keystroke monitoring.</li>
              <li><strong style={{ color: t.txtPrimary }}>No AI Model Training on Candidate PII:</strong> Candidate personal data is NOT used to train public LLM foundation models. All third-party LLM API invocations operate under strict zero-data-retention agreements.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="sec-subprocessors" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Server size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                3. Authorized Sub-Processors
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              To deliver secure and scalable recruitment services, we engage trusted sub-processors under compliant data processing agreements:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {[
                { name: "Supabase Inc.", role: "Managed PostgreSQL Database & Authentication Provider", loc: "USA / EU" },
                { name: "OpenAI / OpenRouter", role: "LLM Question Generation & Vector Embeddings", loc: "USA (Zero-Data-Retention)" },
                { name: "Upstash Inc.", role: "Serverless Distributed Task Queue & Rate Limiting", loc: "USA / EU" },
                { name: "Cloudflare Inc.", role: "Encrypted Cloudflare R2 Object Storage & Resume Host", loc: "USA / EU" },
              ].map((sp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border flex flex-col justify-between"
                  style={{
                    background: hexToRgba(t.bgSurface, 0.4),
                    borderColor: hexToRgba(t.accentPrimary, 0.2),
                  }}
                >
                  <div>
                    <div className="font-bold text-xs" style={{ color: t.txtPrimary }}>{sp.name}</div>
                    <div className="text-xs mt-1" style={{ color: t.txtSecondary }}>{sp.role}</div>
                  </div>
                  <div className="text-[10px] font-mono mt-3" style={{ color: t.txtMuted }}>Location: {sp.loc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4 */}
          <section id="sec-rights" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <ShieldCheck size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                4. Candidate Rights (GDPR & CCPA)
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              Candidates whose personal data is processed through our platform retain full legal rights:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2" style={{ color: t.txtSecondary }}>
              <li><strong style={{ color: t.txtPrimary }}>Right of Access:</strong> Request a copy of all stored personal records, CV parse results, and evaluation summaries.</li>
              <li><strong style={{ color: t.txtPrimary }}>Right to Rectification:</strong> Request correction of inaccurate contact or career data.</li>
              <li><strong style={{ color: t.txtPrimary }}>Right to Human Review:</strong> Object to automated profiling and request manual evaluation by a hiring manager.</li>
              <li><strong style={{ color: t.txtPrimary }}>Right to Data Portability:</strong> Obtain personal assessment history in a standard machine-readable format.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="sec-retention" className="p-6 rounded-2xl border space-y-4" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Trash2 size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                5. Data Retention & Erasure (Right to be Forgotten)
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              Candidate records are retained only for the duration of the recruitment campaign or as specified by the hiring organization (typically 90 to 365 days).
            </p>
            <p style={{ color: t.txtSecondary }}>
              Candidates may request immediate and total purge of their data at any time. Upon receiving an erasure request, all associated PII, uploaded CV documents, database records, and vector embeddings will be permanently removed across primary databases and backups within 14 business days.
            </p>
          </section>

          {/* Section 6 */}
          <section id="sec-contact" className="p-6 rounded-2xl border space-y-4 mb-8" style={G.card}>
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: hexToRgba(t.bgCard, 0.2) }}>
              <div className="p-2 rounded-xl" style={{ background: hexToRgba(t.accentPrimary, 0.1), color: t.accentPrimary }}>
                <Mail size={18} />
              </div>
              <h2 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                6. DPO & Compliance Contacts
              </h2>
            </div>
            <p style={{ color: t.txtBody }}>
              If you have any questions regarding candidate privacy, automated screening disclaimers, or data subject rights requests, please contact our Data Protection Officer (DPO):
            </p>
            <div
              className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                background: hexToRgba(t.bgSurface, 0.5),
                borderColor: hexToRgba(t.accentPrimary, 0.3),
              }}
            >
              <div>
                <div className="font-bold text-xs" style={{ color: t.txtPrimary }}>Data Protection & Compliance Team</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: t.accentPrimary }}>privacy@hireagent.ai • dpo@hireagent.ai</div>
              </div>
              <a
                href="mailto:privacy@hireagent.ai?subject=Candidate%20Data%20Privacy%20Inquiry"
                className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: t.accentPrimary, color: t.accentText }}
              >
                Contact Privacy Team
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
