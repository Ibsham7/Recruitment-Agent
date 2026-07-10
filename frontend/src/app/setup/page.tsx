import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Upload, FileText, CheckCircle } from "lucide-react";
import { Theme } from "../../lib/types";
import { hexToRgba, getGlass } from "../../lib/theme";

export default function SetupPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  
  const [step, setStep] = useState(1);
  const [jd, setJd] = useState("We are looking for a Senior Frontend Engineer to join our product team. You will architect and build the next generation of our user-facing applications using React, TypeScript, and modern tooling.\n\nKey Requirements:\n• 5+ years of experience with React and modern JavaScript/TypeScript\n• Strong understanding of web performance, accessibility, and testing\n• Experience designing and building design systems\n• Excellent communication skills and a collaborative mindset");
  const [files, setFiles] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [toggles, setToggles] = useState([true, false, true]);
  const mockFiles = ["AriaC_Resume.pdf","MarcusW_CV.pdf","PriyaS_Resume.pdf","JordanB_CV.pdf","SamT_Resume.pdf","NinaK_CV.pdf"];
  const fieldStyle: React.CSSProperties = { color: t.txtBody, background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.55), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.80)}`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" };

  const onComplete = () => {
    navigate("/dashboard");
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-6">
      <div className="flex items-center gap-2 mb-10">
        {[1,2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
              style={{ background: step > s ? hexToRgba(t.numPos, 0.25) : step === s ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.70)})` : hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.45), color: step > s ? t.numPos : step === s ? t.accentText : t.txtGhost, boxShadow: step === s ? `0 2px 12px ${hexToRgba(t.accentPrimary, 0.35)}` : "none" }}>
              {step > s ? <Check size={12} /> : s}
            </div>
            <span className="text-xs font-medium" style={{ color: step >= s ? t.txtPrimary : t.txtGhost }}>{s === 1 ? "Job Details" : "Upload CVs"}</span>
            {s < 2 && <div className="w-8 h-px mx-1" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30) }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>Create a new campaign</h2>
            <p className="text-sm" style={{ color: t.txtSecondary }}>Tell the AI what you are looking for.</p>
          </div>
          <div className="space-y-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: t.txtMuted }}>Job Title</label><input defaultValue="Senior Frontend Engineer" className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={fieldStyle} /></div>
            <div className="grid grid-cols-2 gap-4">
               <div><label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: t.txtMuted }}>Department</label><input defaultValue="Engineering" className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={fieldStyle} /></div>
               <div><label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: t.txtMuted }}>Location</label><input defaultValue="Remote · London" className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={fieldStyle} /></div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: t.txtMuted }}>Job Description</label><textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={7} className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none leading-relaxed" style={fieldStyle} /></div>
            <div className="rounded-2xl p-5 space-y-4" style={G.card}>
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>AI Configuration</div>
              {[{ label: "Require Technical Assessment", sub: "AI assigns a coding challenge before interview" }, { label: "Strict Cultural Fit Scoring", sub: "Weight culture fit at 30% of total score" }, { label: "Auto-reject below 40% match", sub: "Skip to rejection for very low JD match" }].map((item, i) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div><div className="text-xs font-medium" style={{ color: t.txtPrimary }}>{item.label}</div><div className="text-[11px]" style={{ color: t.txtMuted }}>{item.sub}</div></div>
                  <button onClick={() => { const n = [...toggles]; n[i] = !n[i]; setToggles(n); }} className="w-9 h-5 rounded-full relative flex-shrink-0 transition-all"
                    style={{ background: toggles[i] ? hexToRgba(t.progressFill, 0.65) : hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.30), border: `1px solid ${hexToRgba(t.bgCard, 0.20)}`, boxShadow: toggles[i] ? `0 0 10px ${hexToRgba(t.progressFill, 0.35)}` : "none" }}>
                    <span className="w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all shadow-sm" style={{ left: toggles[i] ? "19px" : "2px", backgroundColor: toggles[i] ? "#fff" : t.txtGhost }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setStep(2)} className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})`, color: t.accentText, boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
            Continue to Upload CVs
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>Upload candidate CVs</h2>
            <p className="text-sm" style={{ color: t.txtSecondary }}>Upload PDFs — the AI will begin screening immediately.</p>
          </div>
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); setFiles(mockFiles); }} onClick={() => setFiles(mockFiles)}
            className="rounded-2xl p-12 text-center cursor-pointer transition-all border-2 border-dashed"
            style={{ borderColor: dragging ? hexToRgba(t.accentPrimary, 0.55) : hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.30), background: dragging ? hexToRgba(t.accentPrimary, 0.07) : hexToRgba(t.bgCard, t.isDark ? 0.06 : 0.22) }}>
            <Upload size={26} className="mx-auto mb-3" style={{ color: t.txtGhost }} />
            <div className="text-sm font-medium" style={{ color: t.txtPrimary }}>Drop PDF files here</div>
            <div className="text-xs mt-0.5" style={{ color: t.txtMuted }}>or click to browse — up to 100 files</div>
          </div>
          {files.length > 0 && <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>{files.length} Files Queued</div>
            {files.map((f) => (<div key={f} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ ...G.card }}><FileText size={13} style={{ color: t.accentBadge }} /><span className="text-xs flex-1" style={{ color: t.txtBody }}>{f}</span><CheckCircle size={12} style={{ color: t.numPos }} /></div>))}
          </div>}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl text-sm font-medium" style={{ ...G.card, color: t.txtSecondary }}>Back</button>
            <button onClick={onComplete} disabled={files.length === 0} className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: files.length > 0 ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})` : hexToRgba(t.bgCard, 0.15), color: files.length > 0 ? t.accentText : t.txtGhost, boxShadow: files.length > 0 ? `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` : "none", cursor: files.length > 0 ? "pointer" : "not-allowed" }}>
              Launch Campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
