import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { Theme, Candidate } from "../../../lib/types";
import { hexToRgba, getGlass, scoreColor } from "../../../lib/theme";
import { getCandidateDisplayName } from "../../../lib/candidate";

interface CandidateGridCardProps {
  candidate: Candidate;
  theme: Theme;
  G: ReturnType<typeof getGlass>;
}

export function CandidateGridCard({ candidate, theme: t, G }: CandidateGridCardProps) {
  const isScreening = candidate.status === 'pending' || candidate.status === 'screening';
  
  const statusBadgeMap: Record<string, { text: string; label: string }> = { 
    shortlisted:          { text: "#40A060", label: "✓ Shortlisted" }, 
    invited:              { text: "#EAB308", label: "✉ Invited" },
    interviewing:         { text: "#4088C0", label: "💬 Interviewing" },
    interview_completed:  { text: "#9040C0", label: "★ Evaluation Ready" },
    review:               { text: "#9040C0", label: "★ Evaluation Ready" },
    finalized:            { text: "#10B981", label: "✓ Finalized" },
    complete:             { text: "#10B981", label: "✓ Finalized" },
    rejected:             { text: "#C04040", label: "✗ Rejected" },
    screening_hold:       { text: "#EAB308", label: "⏸ Screening Hold" },
    pending:              { text: t.numMid,  label: "⋯ Screening" },
    screening:            { text: t.numMid,  label: "⋯ Screening" }
  };
  
  const currentStatus = candidate.status || "pending";
  const badge = statusBadgeMap[currentStatus] || { text: t.numMid, label: currentStatus };
  let score = candidate.score || candidate.fitScore || 0;
  score = Math.min(100, Math.max(0, score));
  score = typeof score === 'number' && score % 1 !== 0 ? Number(score.toFixed(2)) : score;
  
  const displayName = getCandidateDisplayName(candidate);

  return (
    <Link to={`/candidate/${candidate.id}`} className="w-full rounded-3xl p-5 text-left transition-all duration-300 flex flex-col justify-between h-full group" style={{ ...G.card, position: 'relative', overflow: 'hidden' }}
      onMouseEnter={(e) => { 
        const el = e.currentTarget as HTMLElement; 
        el.style.transform = "translateY(-6px)";
        el.style.border = `1px solid ${hexToRgba(t.accentPrimary, 0.50)}`; 
        el.style.boxShadow = t.isDark ? `0 16px 40px ${hexToRgba(t.accentPrimary, 0.20)}` : `0 16px 40px ${hexToRgba(t.accentPrimary, 0.15)}`; 
      }}
      onMouseLeave={(e) => { 
        const el = e.currentTarget as HTMLElement; 
        el.style.transform = "none";
        el.style.border = G.card.border as string; 
        el.style.boxShadow = G.card.boxShadow as string; 
      }}>
      
      {/* Decorative top gradient line based on score */}
      <div className="absolute top-0 left-0 right-0 h-1.5 opacity-60 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${scoreColor(score, t)}, transparent)` }}></div>

      <div className="flex items-start justify-between mb-5">
        <div className="flex-1 min-w-0 pr-4">
          <div className="text-lg font-semibold truncate transition-colors group-hover:text-opacity-90 flex items-center gap-2" style={{ color: t.txtPrimary }}>
            {isScreening && <Loader2 size={16} className="animate-spin flex-shrink-0 text-amber-500" />}
            <span className="truncate">{displayName}</span>
          </div>
          <div className="text-sm mt-1 truncate flex items-center gap-1.5" style={{ color: t.txtMuted }}>
            {isScreening ? (
              <span className="text-amber-500 font-medium text-xs flex items-center gap-1">
                Parsing candidate profile...
              </span>
            ) : (
              candidate.currentRole || "Candidate"
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full border-2" 
             style={{ 
               borderColor: hexToRgba(scoreColor(score, t), 0.3),
               background: hexToRgba(scoreColor(score, t), 0.1) 
             }}>
          {isScreening && score === 0 ? (
            <Loader2 size={20} className="animate-spin text-amber-500" />
          ) : (
            <span className="text-2xl font-bold leading-none" style={{ fontFamily: "'Fraunces',serif", color: scoreColor(score, t) }}>{score}</span>
          )}
        </div>
      </div>
      
      <div className="mt-auto pt-4 border-t" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
        <div className="flex items-center justify-between">
          <span className="text-xs truncate max-w-[55%]" style={{ color: t.txtGhost }}>{candidate.experience || "No experience listed"}</span>
          <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1" 
                style={{ 
                  color: badge.text, 
                  background: hexToRgba(badge.text, 0.15), 
                  border: `1px solid ${hexToRgba(badge.text, 0.25)}` 
                }}>
            {isScreening && <Loader2 size={11} className="animate-spin" />}
            {badge.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
