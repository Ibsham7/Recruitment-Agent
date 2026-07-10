import { useParams, useNavigate } from "react-router";
import { Theme, Campaign, Candidate, CandidateStage } from "../../lib/types";
import { hexToRgba, getGlass, scoreColor } from "../../lib/theme";
import { CAMPAIGNS, CANDIDATES, STAGE_CONFIG } from "../../lib/mock-data";

function KanbanCard({ candidate, theme: t, G, onClick }: { candidate: Candidate; theme: Theme; G: ReturnType<typeof getGlass>; onClick: () => void }) {
  const recMap = { shortlist: { text: t.numPos, label: "✓ Shortlist" }, reject: { text: t.numNeg, label: "✗ Reject" }, pending: { text: t.numMid, label: "⋯ Pending" } };
  const rec = recMap[candidate.recommendation];
  return (
    <button onClick={onClick} className="w-full rounded-2xl p-4 text-left transition-all" style={{ ...G.card }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.border = `1px solid ${hexToRgba(t.accentPrimary, 0.40)}`; el.style.boxShadow = t.isDark ? "0 8px 32px rgba(0,0,0,0.50)" : "0 8px 32px rgba(0,0,0,0.12)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.border = G.card.border as string; el.style.boxShadow = G.card.boxShadow as string; }}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: t.txtPrimary }}>{candidate.name}</div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: t.txtMuted }}>{candidate.currentRole}</div>
        </div>
        <div className="text-xl font-semibold leading-none ml-2 flex-shrink-0" style={{ fontFamily: "'Fraunces',serif", color: scoreColor(candidate.score, t) }}>{candidate.score}</div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color: t.txtGhost }}>{candidate.experience}</span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: rec.text, background: hexToRgba(rec.text, 0.15), border: `1px solid ${hexToRgba(rec.text, 0.25)}` }}>{rec.label}</span>
      </div>
    </button>
  );
}

export default function PipelinePage({ theme: t }: { theme: Theme }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const G = getGlass(t);
  
  const campaign = CAMPAIGNS.find((c) => c.id === id);
  if (!campaign) {
    return <div className="p-8 text-center" style={{ color: t.txtMuted }}>Campaign not found.</div>;
  }
  const candidates = CANDIDATES.filter((c) => c.campaignId === id);

  const stages: CandidateStage[] = ["pending","screening","rejected","interviewing","shortlisted"];
  const progress = Math.round((campaign.processed / campaign.total) * 100);

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 flex-shrink-0" style={{ ...G.bar }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: t.numPos }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.numPos, boxShadow: `0 0 5px ${hexToRgba(t.numPos, 0.6)}` }} />Active
              </span>
              <span className="text-[11px]" style={{ color: t.txtMuted }}>{campaign.location}</span>
            </div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>{campaign.title}</h2>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 rounded-full overflow-hidden" style={{ width: "200px", background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.25) }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: t.progressFill, boxShadow: `0 0 8px ${hexToRgba(t.progressFill, 0.5)}` }} />
              </div>
              <span className="text-[11px]" style={{ color: t.txtMuted }}>{campaign.processed}/{campaign.total} CVs</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            {[{ v: campaign.total, l: "Candidates", c: t.numHero }, { v: campaign.processed, l: "Processed", c: t.numHero }, { v: campaign.shortlisted, l: "Shortlisted", c: t.numPos }].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-3xl font-semibold leading-none mb-0.5" style={{ fontFamily: "'Fraunces',serif", color: s.c }}>{s.v}</div>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: t.txtGhost }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-6">
        <div className="flex gap-4 h-full" style={{ minWidth: "900px" }}>
          {stages.map((stage) => {
            const config = STAGE_CONFIG[stage];
            const stageCandidates = candidates.filter((c) => c.stage === stage);
            return (
              <div key={stage} className="flex flex-col w-52 flex-shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[11px] font-semibold" style={{ color: config.color }}>{config.label}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ fontFamily: "'DM Mono',monospace", color: t.txtGhost, background: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.40), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.60)}` }}>{stageCandidates.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2.5">
                  {stageCandidates.map((cand) => (
                    <KanbanCard key={cand.id} candidate={cand} theme={t} G={G} onClick={() => navigate(`/candidate/${cand.id}`)} />
                  ))}
                  {stageCandidates.length === 0 && <div className="text-[11px] text-center py-8 rounded-2xl border-2 border-dashed" style={{ color: t.txtGhost, borderColor: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.25) }}>No candidates</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
