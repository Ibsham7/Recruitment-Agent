import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Filter, Plus, ChevronRight, Calendar } from "lucide-react";
import { Theme, Campaign } from "../../lib/types";
import { hexToRgb, hexToRgba, getGlass } from "../../lib/theme";
import { apiFetch } from "../../lib/api";

import { ParticleCard, GlobalSpotlight } from "../../components/common/MagicBento";

function CampaignCard({ campaign, theme: t, G, glowColor, onClick }: { campaign: Campaign; theme: Theme; G: ReturnType<typeof getGlass>; glowColor: string; onClick: () => void }) {
  const statusColors = { active: "#40A060", completed: "#808090", paused: "#C09040" };
  const sc = statusColors[campaign.status || "active"];
  const total = campaign.total || 0;
  const processed = campaign.processed || 0;
  const shortlisted = campaign.shortlisted || 0;
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
  
  return (
    <ParticleCard onClick={onClick} className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-6 cursor-pointer"
      style={{ "--glow-color": glowColor, ...G.card } as React.CSSProperties}
      glowColor={glowColor} particleCount={10} enableTilt={true} clickEffect={true} enableMagnetism={true}>
      <div className="flex items-start justify-between mb-4" style={{ position: "relative", zIndex: 1 }}>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
            <span className="text-[11px] font-medium capitalize" style={{ color: sc }}>{campaign.status || "active"}</span>
          </div>
          <h3 className="font-semibold text-base leading-snug" style={{ color: t.txtPrimary }}>{campaign.title}</h3>
          <div className="text-xs mt-0.5" style={{ color: t.txtMuted }}>{campaign.department || "General"} · {campaign.location || "Remote"}</div>
        </div>
        <ChevronRight size={14} style={{ color: t.txtGhost, marginTop: "2px" }} />
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-[10px] mb-1.5" style={{ color: t.txtMuted }}>
          <span>AI Processing</span><span>{processed}/{total} CVs</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.25) }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: t.progressFill, boxShadow: `0 0 8px ${hexToRgba(t.progressFill, 0.45)}` }} />
        </div>
      </div>
      <div className="flex items-center gap-5 pt-3.5" style={{ borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.30)}` }}>
        {[{ v: total, l: "Total", c: t.numHero }, { v: shortlisted, l: "Shortlisted", c: t.numPos }].map((s) => (
          <div key={s.l}>
            <div className="text-2xl font-semibold leading-none mb-0.5" style={{ fontFamily: "'Fraunces',serif", color: s.c }}>{s.v}</div>
            <div className="text-[10px]" style={{ color: t.txtGhost }}>{s.l}</div>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: t.txtGhost }}>
          <Calendar size={10} />
          {new Date(campaign.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </ParticleCard>
  );
}

export default function DashboardPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Aggregate stats
  const totalCampaigns = campaigns.length;
  const totalCandidates = campaigns.reduce((acc, c) => acc + (c.total || 0), 0);
  const totalShortlisted = campaigns.reduce((acc, c) => acc + (c.shortlisted || 0), 0);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        // Fetch campaigns and their candidates count from backend
        const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns`);
        if (!res.ok) throw new Error("Failed to fetch campaigns");
        const campaignsData = await res.json();
        
        // Process aggregate counts from related candidates
        if (campaignsData) {
          const processedCampaigns = campaignsData.map((c: any) => {
            const total = c.candidates?.length || 0;
            const processed = c.candidates?.filter((cand: any) => cand.status !== 'pending').length || 0;
            const shortlisted = c.candidates?.filter((cand: any) => cand.status === 'shortlisted').length || 0;
            
            return {
              ...c,
              total,
              processed,
              shortlisted,
              status: c.status || 'active', // Fallback for UI if missing in DB
              department: c.department || 'General',
              location: c.location || 'Remote'
            };
          });
          setCampaigns(processedCampaigns);
        }
      } catch (err) {
        console.error("Error fetching campaigns:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCampaigns();
  }, []);

  const stats = [
    { label: "Active Campaigns", value: totalCampaigns.toString(), sub: "Total campaigns" },
    { label: "Total Candidates",  value: totalCandidates.toString(), sub: "across all campaigns" },
    { label: "AI Shortlisted",    value: totalShortlisted.toString(),  sub: "awaiting review" },
    { label: "Avg. Match Score",  value: "--%", sub: "Needs calculation" },
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
      
      {loading ? (
        <div className="flex justify-center p-12 text-sm" style={{ color: t.txtGhost }}>Loading campaigns...</div>
      ) : (
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
      )}
    </div>
  );
}
