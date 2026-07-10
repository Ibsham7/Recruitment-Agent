import { useRef } from "react";
import { useNavigate } from "react-router";
import { Filter, Plus, ChevronRight, Calendar } from "lucide-react";
import { Theme, Campaign } from "../../lib/types";
import { hexToRgb, hexToRgba, getGlass } from "../../lib/theme";
import { CAMPAIGNS } from "../../lib/mock-data";
import { ParticleCard, GlobalSpotlight } from "../../components/common/MagicBento";

function CampaignCard({ campaign, theme: t, G, glowColor, onClick }: { campaign: Campaign; theme: Theme; G: ReturnType<typeof getGlass>; glowColor: string; onClick: () => void }) {
  const statusColors = { active: "#40A060", completed: "#808090", paused: "#C09040" };
  const sc = statusColors[campaign.status];
  const progress = Math.round((campaign.processed / campaign.total) * 100);
  return (
    <ParticleCard onClick={onClick} className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-6 cursor-pointer"
      style={{ "--glow-color": glowColor, ...G.card } as React.CSSProperties}
      glowColor={glowColor} particleCount={10} enableTilt={true} clickEffect={true} enableMagnetism={true}>
      <div className="flex items-start justify-between mb-4" style={{ position: "relative", zIndex: 1 }}>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
            <span className="text-[11px] font-medium capitalize" style={{ color: sc }}>{campaign.status}</span>
          </div>
          <h3 className="font-semibold text-base leading-snug" style={{ color: t.txtPrimary }}>{campaign.title}</h3>
          <div className="text-xs mt-0.5" style={{ color: t.txtMuted }}>{campaign.department} · {campaign.location}</div>
        </div>
        <ChevronRight size={14} style={{ color: t.txtGhost, marginTop: "2px" }} />
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-[10px] mb-1.5" style={{ color: t.txtMuted }}>
          <span>AI Processing</span><span>{campaign.processed}/{campaign.total} CVs</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.25) }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: t.progressFill, boxShadow: `0 0 8px ${hexToRgba(t.progressFill, 0.45)}` }} />
        </div>
      </div>
      <div className="flex items-center gap-5 pt-3.5" style={{ borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.30)}` }}>
        {[{ v: campaign.total, l: "Total", c: t.numHero }, { v: campaign.shortlisted, l: "Shortlisted", c: t.numPos }].map((s) => (
          <div key={s.l}>
            <div className="text-2xl font-semibold leading-none mb-0.5" style={{ fontFamily: "'Fraunces',serif", color: s.c }}>{s.v}</div>
            <div className="text-[10px]" style={{ color: t.txtGhost }}>{s.l}</div>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: t.txtGhost }}><Calendar size={10} />{campaign.created}</div>
      </div>
    </ParticleCard>
  );
}

export default function DashboardPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);
  const campaigns = CAMPAIGNS;

  const stats = [
    { label: "Active Campaigns", value: "4",   sub: "+2 this month" },
    { label: "Total Candidates",  value: "116", sub: "across all campaigns" },
    { label: "AI Shortlisted",    value: "16",  sub: "awaiting review" },
    { label: "Avg. Match Score",  value: "74%", sub: "across screened CVs" },
  ];

  return (
    <div ref={gridRef} className="bento-section p-8">
      <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={t.isDark} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <ParticleCard key={s.label}
            className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5"
            style={{ "--glow-color": glow, ...G.cardWarm } as React.CSSProperties}
            glowColor={glow} particleCount={8} enableTilt={true} clickEffect={true} enableMagnetism={true}>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: t.txtMuted }}>{s.label}</div>
            <div className="text-3xl font-semibold leading-none mb-1" style={{ fontFamily: "'Fraunces',serif", color: t.numHero }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: t.txtGhost }}>{s.sub}</div>
          </ParticleCard>
        ))}
      </div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold" style={{ color: t.txtPrimary }}>All Campaigns</h2>
        <button className="flex items-center gap-1.5 text-xs" style={{ color: t.txtMuted }}><Filter size={12} /> Filter</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} theme={t} G={G} glowColor={glow} onClick={() => navigate(`/pipeline/${c.id}`)} />
        ))}
        <button onClick={() => navigate("/setup")} className="rounded-2xl flex flex-col items-center justify-center gap-2 py-12 transition-all"
          style={{ border: `2px dashed ${hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30)}`, background: hexToRgba(t.bgCard, t.isDark ? 0.04 : 0.20), color: t.txtGhost }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(t.accentPrimary, 0.45); (e.currentTarget as HTMLElement).style.color = t.txtSecondary; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30); (e.currentTarget as HTMLElement).style.color = t.txtGhost; }}>
          <Plus size={20} /><span className="text-sm font-medium">New Campaign</span>
        </button>
      </div>
    </div>
  );
}
