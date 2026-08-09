import { useNavigate } from "react-router";
import { CheckCircle, XCircle, Clock, Pause, FileText, ExternalLink, ArrowLeft } from "lucide-react";
import { Theme, Candidate } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { getCandidateDisplayName } from "../../../lib/candidate";

export interface CandidateHeaderProps {
  candidate: Candidate;
  theme: Theme;
}

export function CandidateHeader({ candidate, theme: t }: CandidateHeaderProps) {
  const G = getGlass(t);
  const navigate = useNavigate();
  const recommendation = candidate.recommendation || "pending";
  const recCfg = {
    shortlist: { label: "Highly Recommended", color: t.numPos, icon: <CheckCircle size={13} /> },
    advance:   { label: "Recommended",        color: t.numPos, icon: <CheckCircle size={13} /> },
    approve:   { label: "Approved",           color: t.numPos, icon: <CheckCircle size={13} /> },
    reject:    { label: "Not Recommended",    color: t.numNeg, icon: <XCircle size={13} /> },
    pending:   { label: "Evaluation Pending", color: t.numMid, icon: <Clock size={13} /> },
    hold:      { label: "Hold / Borderline Match", color: t.numMid, icon: <Pause size={13} /> },
  };
  const rec = recCfg[recommendation as keyof typeof recCfg] || recCfg.pending;

  const displayName = getCandidateDisplayName(candidate);
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "C";

  return (
    <div className="px-8 py-5 flex-shrink-0" style={G.bar}>
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={() => {
            if (candidate.campaignId) {
              navigate(`/pipeline/${candidate.campaignId}`);
            } else {
              navigate(-1);
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.6),
            color: t.txtSecondary,
            border: `1px solid ${hexToRgba(t.txtPrimary, 0.12)}`
          }}
        >
          <ArrowLeft size={13} /> Back to Pipeline
        </button>
      </div>

      <div className="flex items-center gap-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
          style={{ fontFamily: "'Fraunces',serif", color: t.accentBadge, ...G.card }}
        >
          {initials}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-0.5">
            <h2 className="text-xl font-semibold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>
              {displayName}
            </h2>
            <span
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                color: rec.color,
                background: hexToRgba(rec.color, 0.14),
                border: `1px solid ${hexToRgba(rec.color, 0.28)}`
              }}
            >
              {rec.icon}{rec.label}
            </span>
          </div>
          <div className="text-sm" style={{ color: t.txtSecondary }}>
            {candidate.currentRole || "Candidate"}{candidate.experience ? ` · ${candidate.experience}` : ""}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-3 flex-wrap" style={{ fontFamily: "'DM Mono',monospace", color: t.txtGhost }}>
            <span>{candidate.email || "No email provided"}</span>
            {candidate.cvUrl && (
              <>
                <span style={{ color: t.txtMuted }}>•</span>
                <a
                  href={candidate.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                  style={{
                    background: hexToRgba(t.accentPrimary, 0.15),
                    color: t.accentBadge,
                    border: `1px solid ${hexToRgba(t.accentPrimary, 0.30)}`
                  }}
                >
                  <FileText size={12} />
                  <span>View CV</span>
                  <ExternalLink size={10} className="opacity-70" />
                </a>
              </>
            )}
          </div>
        </div>
        <div className="text-right flex items-center gap-4">
          {candidate.cvUrl && (
            <a
              href={candidate.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
              style={{
                background: hexToRgba(t.accentPrimary, 0.16),
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.35)}`,
                color: t.accentBadge,
              }}
            >
              <FileText size={14} />
              <span>Candidate CV</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          )}
          <div>
            <div className="text-5xl font-semibold leading-none" style={{ fontFamily: "'Fraunces',serif", color: t.numHero, textShadow: `0 0 30px ${hexToRgba(t.numHero, 0.40)}` }}>
              {candidate.score}
            </div>
            <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: t.txtGhost }}>
              Overall Score
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
