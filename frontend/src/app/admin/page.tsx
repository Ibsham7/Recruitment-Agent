import { useState, useEffect, useRef } from "react";
import { Theme, CreditRequest } from "../../lib/types";
import { hexToRgb, getGlass, hexToRgba } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { queryClient } from "../queryClient";
import { GlobalSpotlight } from "../../components/common/MagicBento";
import { Users, FileCheck2, BarChart3, ShieldCheck } from "lucide-react";
import { AdminUsersTab, AdminCreditRequestsTab, AdminStatsTab } from "./components";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export default function AdminPage({ theme: t }: { theme: Theme }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);
  const G = getGlass(t);

  const [activeTab, setActiveTab] = useState<"users" | "requests" | "stats">("users");

  // Query pending requests count for the badge
  const { data: requests = [] } = useQuery<CreditRequest[]>({
    queryKey: ["admin", "credit-requests"],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/credit-requests');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10_000,
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // Realtime Supabase Channel for instant Admin sync across all 3 tables
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const channel = supabase
      .channel("admin-realtime-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "UserProfile" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        }, 600);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "CreditRequest" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "credit-requests"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        }, 600);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "CreditTransaction" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        }, 600);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div
      ref={gridRef}
      className="bento-section p-6 lg:p-8 w-full min-h-full max-w-[1600px] mx-auto space-y-6"
      style={{ background: t.bgPage }}
    >
      <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={t.isDark} />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: hexToRgba(t.accentBadge, 0.15),
                color: t.accentBadge,
                border: `1px solid ${hexToRgba(t.accentBadge, 0.3)}`,
              }}
            >
              <ShieldCheck size={12} />
              Admin Portal
            </span>
            <span className="text-xs" style={{ color: t.txtMuted }}>· Full Access</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1" style={{ color: t.txtPrimary }}>
            Platform Administration Control Center
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: t.txtMuted }}>
            Manage user tiers, audit payment proofs, execute balance adjustments, and inspect platform metrics.
          </p>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div
        className="p-1.5 rounded-2xl border flex items-center gap-2 max-w-fit"
        style={{ ...G.card, borderColor: hexToRgba(t.txtMuted, 0.15) }}
      >
        <button
          onClick={() => setActiveTab("users")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "users" ? hexToRgba(t.accentBadge, 0.2) : "transparent",
            color: activeTab === "users" ? t.accentBadge : t.txtMuted,
            border: activeTab === "users" ? `1px solid ${hexToRgba(t.accentBadge, 0.3)}` : "1px solid transparent",
          }}
        >
          <Users size={14} />
          <span>Users</span>
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all relative"
          style={{
            background: activeTab === "requests" ? hexToRgba(t.accentBadge, 0.2) : "transparent",
            color: activeTab === "requests" ? t.accentBadge : t.txtMuted,
            border: activeTab === "requests" ? `1px solid ${hexToRgba(t.accentBadge, 0.3)}` : "1px solid transparent",
          }}
        >
          <FileCheck2 size={14} />
          <span>Credit Requests</span>
          {pendingCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
              style={{
                background: hexToRgba(t.numMid, 0.25),
                color: t.numMid,
                border: `1px solid ${hexToRgba(t.numMid, 0.4)}`,
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("stats")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "stats" ? hexToRgba(t.accentBadge, 0.2) : "transparent",
            color: activeTab === "stats" ? t.accentBadge : t.txtMuted,
            border: activeTab === "stats" ? `1px solid ${hexToRgba(t.accentBadge, 0.3)}` : "1px solid transparent",
          }}
        >
          <BarChart3 size={14} />
          <span>System Stats</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === "users" && <AdminUsersTab theme={t} />}
        {activeTab === "requests" && <AdminCreditRequestsTab theme={t} />}
        {activeTab === "stats" && <AdminStatsTab theme={t} onNavigateTab={(tab) => setActiveTab(tab)} />}
      </div>
    </div>
  );
}
