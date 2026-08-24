import { ShieldCheck, FileText, Send, UserCheck, Layers } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export function CreditPricingGuide({ theme: t }: { theme: Theme }) {
  const G = getGlass(t);

  const units = [
    {
      icon: <Layers size={14} className="text-blue-400" />,
      title: "Job Campaign Setup",
      cost: "1 Credit",
      desc: "Set up a new role and configure screening criteria",
    },
    {
      icon: <FileText size={14} className="text-emerald-400" />,
      title: "Resume Screening",
      cost: "1 Credit / Resume",
      desc: "Scan, evaluate, and score candidate resumes against the job",
    },
    {
      icon: <Send size={14} className="text-purple-400" />,
      title: "Interview Invitation",
      cost: "1 Credit / Email",
      desc: "Send personalized online interview links to shortlisted candidates",
    },
    {
      icon: <UserCheck size={14} className="text-amber-400" />,
      title: "AI Interview Evaluation",
      cost: "2 Credits / Candidate",
      desc: "Review candidate answers, generate scorecards, and detect cheating",
    },
  ];

  return (
    <div
      className="rounded-3xl p-6 border space-y-4 shadow-md"
      style={{
        ...G.card,
        borderColor: hexToRgba(t.accentPrimary, 0.18),
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold" style={{ color: t.txtPrimary }}>
            Transparent Unit Economics ($10 = 1,000 Credits)
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: t.txtMuted }}>
          <ShieldCheck size={13} style={{ color: t.accentPrimary }} />
          <span>Direct Storage & Verified Proof</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {units.map((unit) => (
          <div
            key={unit.title}
            className="p-3.5 rounded-2xl border space-y-1.5 transition-all hover:scale-[1.02]"
            style={{
              background: hexToRgba(t.bgPage, 0.45),
              borderColor: hexToRgba(t.txtMuted, 0.15),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="p-1 rounded-lg" style={{ background: hexToRgba(t.bgCard, 0.3) }}>
                {unit.icon}
              </div>
              <span className="text-xs font-bold font-mono" style={{ color: t.accentBadge }}>
                {unit.cost}
              </span>
            </div>
            <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
              {unit.title}
            </div>
            <div className="text-[10px] leading-tight" style={{ color: t.txtMuted }}>
              {unit.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
