import { Check } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

interface SetupHeaderProps {
  theme: Theme;
  step: number;
  setStep: (step: number) => void;
  title: string;
  jd: string;
}

export default function SetupHeader({ 
  theme: t, 
  step = 1, 
  setStep = () => {}, 
  title = "", 
  jd = "" 
}: SetupHeaderProps) {
  const G = getGlass(t);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl border transition-all" style={G.card}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span 
            className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider" 
            style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
          >
            Campaign Setup Wizard
          </span>
          <span className="text-xs font-medium" style={{ color: t.txtMuted }}>• Step {step} of 2</span>
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: t.txtPrimary }}>
          {step === 1 ? "Create Recruitment Campaign" : "Upload Candidate Resumes"}
        </h1>
        <p className="text-xs sm:text-sm mt-1 font-medium max-w-2xl" style={{ color: t.txtSecondary }}>
          {step === 1 
            ? "Define role specifications, evaluation strictness, and screening filters to align AI evaluation with your hiring criteria." 
            : "Upload candidate CV files (PDF, DOCX, TXT) for automated parsing, hard filter checks, and multi-dimensional LLM scoring."}
        </p>
      </div>

      {/* Stepper Control Pill */}
      <div 
        className="flex items-center justify-between sm:justify-start gap-1 sm:gap-1.5 p-1.5 rounded-xl shrink-0 w-full sm:w-auto" 
        style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.75), border: `1px solid ${hexToRgba(t.txtGhost, 0.2)}` }}
      >
        <button
          onClick={() => setStep(1)}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-bold transition-all"
          style={{
            background: step === 1 ? t.accentPrimary : "transparent",
            color: step === 1 ? t.accentText : t.txtSecondary,
            boxShadow: step === 1 ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.35)}` : "none"
          }}
        >
          <span 
            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" 
            style={{ background: step === 1 ? t.accentText : hexToRgba(t.txtGhost, 0.3), color: step === 1 ? t.accentPrimary : t.txtPrimary }}
          >
            {step > 1 ? <Check size={10} /> : "1"}
          </span>
          <span className="truncate">1. Details</span>
        </button>
        
        <span className="text-xs font-bold px-0.5 shrink-0" style={{ color: t.txtGhost }}>/</span>
        
        <button
          onClick={() => { if (title && jd) setStep(2); }}
          disabled={!title || !jd}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-bold transition-all disabled:opacity-40"
          style={{
            background: step === 2 ? t.accentPrimary : "transparent",
            color: step === 2 ? t.accentText : t.txtSecondary,
            boxShadow: step === 2 ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.35)}` : "none"
          }}
        >
          <span 
            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" 
            style={{ background: step === 2 ? t.accentText : hexToRgba(t.txtGhost, 0.3), color: step === 2 ? t.accentPrimary : t.txtPrimary }}
          >
            2
          </span>
          <span className="truncate">2. Resumes</span>
        </button>
      </div>
    </div>
  );
}
