import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router";
import { 
  Filter, Plus, ChevronRight, Calendar, Loader2, Search, X, 
  ArrowUpDown, PlayCircle, PauseCircle, CheckCircle2, AlertCircle, 
  RefreshCw, Briefcase, Users, Award, Sparkles 
} from "lucide-react";
import { Theme, Campaign, CampaignStatus } from "../../lib/types";
import { hexToRgb, hexToRgba, getGlass } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";

import { ParticleCard, GlobalSpotlight } from "../../components/common/MagicBento";

interface ExtendedCampaign extends Campaign {
  avgMatch?: number | null;
  candidates?: any[];
  isAllProcessed?: boolean;
}

function StatusBadge({ status, sc }: { status: CampaignStatus; sc: string }) {
  const icons = {
    active: <PlayCircle size={12} className="flex-shrink-0" />,
    completed: <CheckCircle2 size={12} className="flex-shrink-0" />,
    paused: <PauseCircle size={12} className="flex-shrink-0" />
  };
  return (
    <span 
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-all" 
      style={{ backgroundColor: hexToRgba(sc, 0.15), color: sc, border: `1px solid ${hexToRgba(sc, 0.35)}` }}
    >
      {icons[status] || icons.active}
      {status}
    </span>
  );
}

function CampaignCard({ campaign, theme: t, G, glowColor }: { campaign: ExtendedCampaign; theme: Theme; G: ReturnType<typeof getGlass>; glowColor: string }) {
  const statusColors: Record<CampaignStatus, string> = { 
    active: "#40A060", 
    completed: "#4A70D0", 
    paused: "#C09040" 
  };
  const status = campaign.status || "active";
  const sc = statusColors[status];
  const total = campaign.total || 0;
  const processed = campaign.processed || 0;
  const shortlisted = campaign.shortlisted || 0;
  const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const isProcessing = total > 0 && processed < total && status === "active";
  
  return (
    <Link to={`/pipeline/${campaign.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <ParticleCard 
        className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:translate-y-[-2px]"
        style={{ "--glow-color": glowColor, ...G.card } as React.CSSProperties}
        glowColor={glowColor} particleCount={10} enableTilt={true} clickEffect={true} enableMagnetism={true}
      >
        <div className="flex items-start justify-between mb-4" style={{ position: "relative", zIndex: 1 }}>
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={status} sc={sc} />
              {campaign.avgMatch !== null && campaign.avgMatch !== undefined && (
                <span 
                  className="inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: hexToRgba(t.accentPrimary, 0.12), color: t.accentPrimary, border: `1px solid ${hexToRgba(t.accentPrimary, 0.25)}` }}
                  title="Average candidate AI fit score across evaluations"
                >
                  Avg Fit: {campaign.avgMatch}%
                </span>
              )}
            </div>
            <h3 className="font-semibold text-base leading-snug truncate" style={{ color: t.txtPrimary }}>{campaign.title}</h3>
            <div className="text-xs mt-1 truncate font-medium" style={{ color: t.txtMuted }}>
              {campaign.department || "General"} · {campaign.location || "Remote"}
            </div>
          </div>
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:translate-x-1"
            style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.45), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.60)}`, color: t.txtMuted }}
          >
            <ChevronRight size={14} />
          </div>
        </div>

        {/* AI Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-[11px] mb-1.5 font-medium" style={{ color: t.txtMuted }}>
            <span className="flex items-center gap-1.5">
              {isProcessing ? "AI Processing" : progress === 100 ? "Processing Complete" : "AI Processing"}
              {isProcessing && <Loader2 size={12} className="animate-spin text-amber-500 flex-shrink-0" />}
              {progress === 100 && <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />}
            </span>
            <span className="font-mono text-xs font-semibold" style={{ color: t.txtSecondary }}>
              {processed}/{total} CVs ({progress}%)
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.25) }}>
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out" 
              style={{ 
                width: `${progress}%`, 
                backgroundColor: status === "completed" || progress === 100 ? "#40A060" : t.progressFill, 
                boxShadow: `0 0 10px ${hexToRgba(status === "completed" || progress === 100 ? "#40A060" : t.progressFill, 0.5)}` 
              }} 
            />
          </div>
        </div>

        {/* Stat metrics & date */}
        <div className="flex items-center gap-5 pt-3.5" style={{ borderTop: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.30)}` }}>
          {[
            { v: total, l: "Total CVs", c: t.numHero }, 
            { v: shortlisted, l: "Shortlisted", c: t.numPos }
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl font-bold leading-none mb-0.5 font-sans" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: t.txtGhost }}>{s.l}</div>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1 text-[11px]" style={{ color: t.txtGhost }}>
            <Calendar size={11} />
            {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
          </div>
        </div>
      </ParticleCard>
    </Link>
  );
}

function StatCardSkeleton({ G }: { G: ReturnType<typeof getGlass> }) {
  return (
    <div className="magic-bento-card rounded-2xl p-5 animate-pulse" style={G.cardWarm}>
      <div className="h-3 w-24 bg-white/10 rounded mb-3" />
      <div className="h-8 w-16 bg-white/15 rounded mb-2" />
      <div className="h-3 w-32 bg-white/10 rounded" />
    </div>
  );
}

function CampaignSkeleton({ G }: { G: ReturnType<typeof getGlass> }) {
  return (
    <div className="magic-bento-card rounded-2xl p-6 animate-pulse" style={G.card}>
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-20 bg-white/10 rounded" />
          <div className="h-5 w-3/4 bg-white/15 rounded" />
          <div className="h-3 w-1/2 bg-white/10 rounded" />
        </div>
        <div className="h-7 w-7 bg-white/10 rounded-lg" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-white/10 rounded" />
          <div className="h-3 w-12 bg-white/10 rounded" />
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full" />
      </div>
      <div className="flex justify-between pt-3.5 border-t border-white/10">
        <div className="h-6 w-12 bg-white/10 rounded" />
        <div className="h-6 w-12 bg-white/10 rounded" />
        <div className="h-4 w-20 bg-white/10 rounded" />
      </div>
    </div>
  );
}

export default function DashboardPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);

  const [campaigns, setCampaigns] = useState<ExtendedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "candidates" | "match">("newest");

  const fetchCampaigns = async (isMounted = true) => {
    try {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns`);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const campaignsData = await res.json();
      
      if (campaignsData && isMounted) {
        const processedCampaigns: ExtendedCampaign[] = campaignsData.map((c: any) => {
          const candidates = c.candidates || [];
          const total = candidates.length;
          const processed = candidates.filter((cand: any) => 
            cand.status !== 'pending' && cand.status !== 'screening'
          ).length;
          const shortlisted = candidates.filter((cand: any) => 
            cand.status === 'shortlisted' || cand.status === 'complete' || cand.status === 'finalized'
          ).length;

          // Compute individual campaign match score average
          const scoredCandidates = candidates.filter((cand: any) => 
            typeof cand.fitScore === 'number' && cand.fitScore > 0
          );
          const avgMatch = scoredCandidates.length > 0
            ? Math.round(scoredCandidates.reduce((acc: number, cand: any) => acc + cand.fitScore, 0) / scoredCandidates.length)
            : null;
          
          const rawStatus = (c.status as CampaignStatus) || 'active';
          const isAllProcessed = total > 0 && processed >= total;
          
          // Effective Status logic: If all CVs are processed, classify as Completed!
          const effectiveStatus: CampaignStatus = rawStatus === 'paused'
            ? 'paused'
            : (rawStatus === 'completed' || isAllProcessed)
              ? 'completed'
              : 'active';

          return {
            ...c,
            total,
            processed,
            shortlisted,
            avgMatch,
            isAllProcessed,
            status: effectiveStatus,
            department: c.department || 'General',
            location: c.location || 'Remote'
          };
        });

        setCampaigns(processedCampaigns);
      }
    } catch (err: any) {
      console.error("Error fetching campaigns:", err);
      if (isMounted) setError(err.message || "Failed to load campaigns. Please check connection.");
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any = null;

    fetchCampaigns(isMounted);

    // Realtime changes listener
    const channel = supabase
      .channel('dashboard-candidate-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Candidate' },
        () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (isMounted) fetchCampaigns(true);
          }, 1200);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute Aggregates
  const totalCampaigns = campaigns.length;
  const activeCount = campaigns.filter(c => c.status === 'active').length;
  const pausedCount = campaigns.filter(c => c.status === 'paused').length;
  const completedCount = campaigns.filter(c => c.status === 'completed').length;

  const totalCandidates = campaigns.reduce((acc, c) => acc + (c.total || 0), 0);
  const totalShortlisted = campaigns.reduce((acc, c) => acc + (c.shortlisted || 0), 0);

  // Dynamic Global Average Match Score
  const globalAvgMatch = useMemo(() => {
    const allScores: number[] = [];
    campaigns.forEach(c => {
      if (Array.isArray(c.candidates)) {
        c.candidates.forEach((cand: any) => {
          if (typeof cand.fitScore === 'number' && cand.fitScore > 0) {
            allScores.push(cand.fitScore);
          }
        });
      }
    });
    if (allScores.length === 0) return null;
    return Math.round(allScores.reduce((sum, val) => sum + val, 0) / allScores.length);
  }, [campaigns]);

  // Filter & Sort Logic
  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => {
        // Status filter
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const titleMatch = c.title?.toLowerCase().includes(q);
          const deptMatch = c.department?.toLowerCase().includes(q);
          const locMatch = c.location?.toLowerCase().includes(q);
          return titleMatch || deptMatch || locMatch;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }
        if (sortBy === "candidates") {
          return (b.total || 0) - (a.total || 0);
        }
        if (sortBy === "match") {
          return (b.avgMatch || 0) - (a.avgMatch || 0);
        }
        return 0;
      });
  }, [campaigns, searchQuery, statusFilter, sortBy]);

  const stats = [
    { 
      label: "Active Campaigns", 
      value: activeCount.toString(), 
      sub: `${completedCount} completed · ${totalCampaigns} total`,
      icon: <Briefcase size={16} className="text-emerald-500" />
    },
    { 
      label: "Total Candidates",  
      value: totalCandidates.toString(), 
      sub: "Across all pipelines",
      icon: <Users size={16} className="text-blue-500" />
    },
    { 
      label: "AI Shortlisted",    
      value: totalShortlisted.toString(),  
      sub: totalCandidates > 0 ? `${Math.round((totalShortlisted / totalCandidates) * 100)}% shortlist rate` : "Awaiting evaluations",
      icon: <Award size={16} className="text-purple-500" />
    },
    { 
      label: "Avg. Match Score",  
      value: globalAvgMatch !== null ? `${globalAvgMatch}%` : "--%", 
      sub: globalAvgMatch !== null ? "Computed across evaluations" : "Awaiting evaluations",
      icon: <Sparkles size={16} className="text-amber-500" />
    },
  ];

  return (
    <div 
      ref={gridRef} 
      className="bento-section p-6 lg:p-8 w-full min-h-full max-w-[1600px] mx-auto space-y-6"
      style={{ background: t.bgPage }}
    >
      <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={t.isDark} />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} G={G} />)
        ) : (
          stats.map((s) => (
            <ParticleCard 
              key={s.label}
              className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5"
              style={{ "--glow-color": glow, ...G.cardWarm } as React.CSSProperties}
              glowColor={glow} particleCount={8} enableTilt={true} clickEffect={true} enableMagnetism={true}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>
                  {s.label}
                </div>
                <div className="p-1.5 rounded-lg" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6) }}>
                  {s.icon}
                </div>
              </div>
              <div className="text-3xl font-bold leading-none mb-1.5 font-sans" style={{ color: t.numHero }}>
                {s.value}
              </div>
              <div className="text-[11px]" style={{ color: t.txtGhost }}>{s.sub}</div>
            </ParticleCard>
          ))
        )}
      </div>

      {/* Interactive Toolbar */}
      <div 
        className="rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.08 : 0.35), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.50)}` }}
      >
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtMuted }} />
          <input
            type="text"
            placeholder="Search campaigns, roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs outline-none transition-all"
            style={{ 
              background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.6), 
              color: t.txtPrimary, 
              border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.70)}` 
            }}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md"
              style={{ color: t.txtMuted }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: `All (${totalCampaigns})` },
            { id: "active", label: `Active (${activeCount})` },
            { id: "paused", label: `Paused (${pausedCount})` },
            { id: "completed", label: `Completed (${completedCount})` },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  background: isActive ? hexToRgba(t.accentPrimary, 0.18) : "transparent",
                  color: isActive ? t.accentPrimary : t.txtMuted,
                  border: isActive ? `1px solid ${hexToRgba(t.accentPrimary, 0.35)}` : "1px solid transparent"
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <ArrowUpDown size={13} style={{ color: t.txtMuted }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="py-1.5 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
            style={{ 
              background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.6), 
              color: t.txtSecondary,
              border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.70)}` 
            }}
          >
            <option value="newest" style={{ background: t.bgPage, color: t.txtPrimary }}>Newest First</option>
            <option value="oldest" style={{ background: t.bgPage, color: t.txtPrimary }}>Oldest First</option>
            <option value="candidates" style={{ background: t.bgPage, color: t.txtPrimary }}>Most Candidates</option>
            <option value="match" style={{ background: t.bgPage, color: t.txtPrimary }}>Highest Match Score</option>
          </select>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div 
          className="p-4 rounded-2xl flex items-center justify-between gap-3 text-xs"
          style={{ background: hexToRgba(t.numNeg, 0.12), border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`, color: t.numNeg }}
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchCampaigns(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all hover:opacity-80"
            style={{ background: hexToRgba(t.numNeg, 0.2), color: t.numNeg }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Main Campaign Grid & States */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CampaignSkeleton key={i} G={G} />)}
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCampaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} theme={t} G={G} glowColor={glow} />
          ))}

          {/* New Campaign Button */}
          <button 
            onClick={() => navigate("/setup")} 
            className="rounded-2xl flex flex-col items-center justify-center gap-2 py-12 transition-all group border-2 border-dashed"
            style={{ 
              borderColor: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30), 
              background: hexToRgba(t.bgCard, t.isDark ? 0.04 : 0.20), 
              color: t.txtGhost 
            }}
            onMouseEnter={(e) => { 
              (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(t.accentPrimary, 0.45); 
              (e.currentTarget as HTMLElement).style.color = t.txtSecondary; 
            }}
            onMouseLeave={(e) => { 
              (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30); 
              (e.currentTarget as HTMLElement).style.color = t.txtGhost; 
            }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>
              <Plus size={20} />
            </div>
            <span className="text-sm font-semibold">Start New Campaign</span>
            <span className="text-xs" style={{ color: t.txtGhost }}>Upload JD & configure AI evaluation criteria</span>
          </button>
        </div>
      ) : (
        /* Empty State */
        <div 
          className="rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3"
          style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.05 : 0.25), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.40)}` }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: hexToRgba(t.accentPrimary, 0.12), color: t.accentPrimary }}>
            <Filter size={24} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: t.txtPrimary }}>
            {searchQuery || statusFilter !== "all" ? "No matching campaigns found" : "No campaigns created yet"}
          </h3>
          <p className="text-xs max-w-sm" style={{ color: t.txtMuted }}>
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search criteria or clearing filters to see results."
              : "Launch your first AI recruitment campaign to screen CVs and rank top candidates automatically."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <button
              onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all"
              style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary, border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}` }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={() => navigate("/setup")}
              className="px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all"
              style={{ background: t.accentPrimary, color: t.accentText }}
            >
              + Create Campaign
            </button>
          )}
        </div>
      )}
    </div>
  );
}
