import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Theme, CampaignStatus } from "../../lib/types";
import { hexToRgb, getGlass } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { GlobalSpotlight } from "../../components/common/MagicBento";

import {
  ExtendedCampaign,
  DashboardMetrics,
  DashboardToolbar,
  DashboardErrorBanner,
  CampaignGrid,
} from "./components";

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

  const fetchCampaigns = async (isSilent = false, isMounted = true) => {
    try {
      if (isMounted && !isSilent) {
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
      if (isMounted && !isSilent) setError(err.message || "Failed to load campaigns. Please check connection.");
    } finally {
      if (isMounted && !isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any = null;

    fetchCampaigns(false, isMounted);

    // Realtime changes listener - perform silent refetch without showing loading skeletons
    const channel = supabase
      .channel('dashboard-candidate-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Candidate' },
        () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (isMounted) fetchCampaigns(true, isMounted);
          }, 1000);
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
          return new Date(a.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
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

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  return (
    <div 
      ref={gridRef} 
      className="bento-section p-6 lg:p-8 w-full min-h-full max-w-[1600px] mx-auto space-y-6"
      style={{ background: t.bgPage }}
    >
      <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={t.isDark} />

      {/* Top Metric Cards */}
      <DashboardMetrics
        theme={t}
        G={G}
        glow={glow}
        loading={loading}
        activeCount={activeCount}
        completedCount={completedCount}
        totalCampaigns={totalCampaigns}
        totalCandidates={totalCandidates}
        totalShortlisted={totalShortlisted}
        globalAvgMatch={globalAvgMatch}
      />

      {/* Interactive Toolbar */}
      <DashboardToolbar
        theme={t}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        totalCampaigns={totalCampaigns}
        activeCount={activeCount}
        pausedCount={pausedCount}
        completedCount={completedCount}
      />

      {/* Error Alert Banner */}
      {error && (
        <DashboardErrorBanner
          theme={t}
          error={error}
          onRetry={() => fetchCampaigns(true)}
        />
      )}

      {/* Main Campaign Grid & States */}
      <CampaignGrid
        loading={loading}
        campaigns={filteredCampaigns}
        theme={t}
        G={G}
        glowColor={glow}
        onNavigateSetup={() => navigate("/setup")}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        onClearFilters={handleClearFilters}
      />
    </div>
  );
}
