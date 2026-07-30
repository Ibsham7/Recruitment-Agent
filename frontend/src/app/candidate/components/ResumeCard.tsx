import { FileText, ExternalLink } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";

export interface ResumeCardProps {
  cvUrl?: string | null;
  theme: Theme;
}

export function ResumeCard({ cvUrl, theme: t }: ResumeCardProps) {
  const G = getGlass(t);

  return (
    <div className="rounded-2xl p-5 flex items-center justify-between transition-all" style={G.card}>
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentBadge }}>
          <FileText size={20} />
        </div>
        <div>
          <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>Candidate Resume / CV</div>
          <div className="text-[11px]" style={{ color: t.txtMuted }}>
            {cvUrl ? "Original resume document uploaded for screening" : "No original resume file attached to candidate profile"}
          </div>
        </div>
      </div>
      {cvUrl ? (
        <a
          href={cvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
            color: t.accentText,
            boxShadow: `0 4px 14px ${hexToRgba(t.accentPrimary, 0.35)}`
          }}
        >
          <FileText size={13} />
          <span>Open Full CV</span>
          <ExternalLink size={11} />
        </a>
      ) : (
        <span className="text-xs px-3 py-1.5 rounded-lg" style={{ color: t.txtGhost, background: hexToRgba(t.bgCard, 0.2) }}>
          Unavailable
        </span>
      )}
    </div>
  );
}
