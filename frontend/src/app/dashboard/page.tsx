import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Theme, CampaignStatus } from "../../lib/types";
import { hexToRgb, getGlass } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { GlobalSpotlight } from "../../components/common/MagicBento";

import { useCampaigns } from "../../lib/hooks/useCampaigns";
import {
  DashboardMetrics,
  DashboardToolbar,
  DashboardErrorBanner,
  CampaignGrid,
  UsageBanner,
} from "./components";

export default function DashboardPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);

  // TanStack Query cached campaigns data
  const { campaigns, isLoading, error, refetch, invalidateCampaigns } = useCampaigns();

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "candidates" | "match">("newest");

  useEffect(() => {
    let timeoutId: any = null;

    // Realtime changes listener - perform silent background cache invalidation without resetting UI or showing skeletons
    const channel = supabase
      .channel('dashboard-candidate-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Candidate' },
        () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            invalidateCampaigns();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [invalidateCampaigns]);

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

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

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  return (
    <div 
      ref={gridRef} 
      className="bento-section p-4 sm:p-6 lg:p-8 w-full min-h-full max-w-[1600px] mx-auto space-y-4 sm:space-y-6"
      style={{ background: t.bgPage }}
    >
      <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={t.isDark} />

      {/* Quota & Billing Usage Banner */}
      <UsageBanner theme={t} />

      {/* Top Metric Cards */}
      <DashboardMetrics
        theme={t}
        G={G}
        glow={glow}
        loading={isLoading}
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
      {errorMessage && (
        <DashboardErrorBanner
          theme={t}
          error={errorMessage}
          onRetry={() => refetch()}
        />
      )}

      {/* Main Campaign Grid & States */}
      <CampaignGrid
        loading={isLoading}
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

