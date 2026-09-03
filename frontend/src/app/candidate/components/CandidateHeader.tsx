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
    <div className="px-4 sm:px-6 lg:px-8 py-3.5 sm:py-5 flex-shrink-0" style={G.bar}>
      <div className="flex items-center justify-between gap-4 mb-2.5 sm:mb-3">
        <button
          onClick={() => {
            if (candidate.campaignId) {
              navigate(`/pipeline/${candidate.campaignId}`);
            } else {
              navigate(-1);
            }
          }}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-95 cursor-pointer"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.6),
            color: t.txtSecondary,
            border: `1px solid ${hexToRgba(t.txtPrimary, 0.12)}`
          }}
        >
          <ArrowLeft size={14} /> <span>Back to Pipeline</span>
        </button>

        {/* Mobile-only Score Display */}
        <div className="sm:hidden flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: t.txtGhost }}>Score</span>
          <div className="text-2xl font-bold leading-none px-2.5 py-1 rounded-xl" style={{ fontFamily: "'Fraunces',serif", color: t.numHero, background: hexToRgba(t.numHero, 0.12), border: `1px solid ${hexToRgba(t.numHero, 0.25)}` }}>
            {candidate.score}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 flex-1 min-w-0">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-base sm:text-lg font-semibold flex-shrink-0"
            style={{ fontFamily: "'Fraunces',serif", color: t.accentBadge, ...G.card }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-0.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold truncate" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>
                {displayName}
              </h2>
              <span
                className="flex items-center gap-1 text-[11px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shrink-0"
                style={{
                  color: rec.color,
                  background: hexToRgba(rec.color, 0.14),
                  border: `1px solid ${hexToRgba(rec.color, 0.28)}`
                }}
              >
                {rec.icon}{rec.label}
              </span>
            </div>
            <div className="text-xs sm:text-sm truncate" style={{ color: t.txtSecondary }}>
              {candidate.currentRole || "Candidate"}{candidate.experience ? ` · ${candidate.experience}` : ""}
            </div>
            <div className="text-[11px] mt-1 flex items-center gap-2 sm:gap-3 flex-wrap" style={{ fontFamily: "'DM Mono',monospace", color: t.txtGhost }}>
              <span className="truncate max-w-[200px] sm:max-w-none">{candidate.email || "No email provided"}</span>
              {candidate.cvUrl && (
                <>
                  <span style={{ color: t.txtMuted }}>•</span>
                  <a
                    href={candidate.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:opacity-80 active:scale-95"
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
        </div>

        <div className="hidden sm:flex text-right items-center gap-4 shrink-0">
          {candidate.cvUrl && (
            <a
              href={candidate.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
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
            <div className="text-4xl sm:text-5xl font-semibold leading-none" style={{ fontFamily: "'Fraunces',serif", color: t.numHero, textShadow: `0 0 30px ${hexToRgba(t.numHero, 0.40)}` }}>
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
