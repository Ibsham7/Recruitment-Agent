import { useState, useEffect, useRef } from "react";
import { Theme } from "../../lib/types";
import { hexToRgb } from "../../lib/theme";
import { useAuth } from "../../lib/AuthContext";
import { supabase } from "../../lib/supabase";
import { queryClient } from "../queryClient";
import { GlobalSpotlight } from "../../components/common/MagicBento";
import { UpgradeModal } from "../dashboard/components/UpgradeModal";
import {
  PlanOverviewCard,
  SpendAnalyticsCard,
  BillingToolbar,
  CreditRequestsTable,
  TransactionsTable,
} from "./components";

export default function BillingPage({ theme: t }: { theme: Theme }) {
  const { profile, refreshProfile } = useAuth();
  const gridRef = useRef<HTMLDivElement>(null);
  const glow = hexToRgb(t.accentPrimary);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [initialUpgradeAmount, setInitialUpgradeAmount] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<"requests" | "transactions">("requests");
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenUpgrade = (amount: number = 10) => {
    setInitialUpgradeAmount(amount);
    setIsUpgradeModalOpen(true);
  };

  // Realtime Supabase Channel for instant balance & ledger sync
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const channel = supabase
      .channel("billing-realtime-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "CreditRequest" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["user", "credit-requests"] });
          refreshProfile();
        }, 800);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "CreditTransaction" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["user", "transactions"] });
          refreshProfile();
        }, 800);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refreshProfile]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs font-medium" style={{ color: t.txtMuted }}>
        Loading billing details...
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="bento-section p-6 lg:p-8 w-full min-h-full max-w-[1600px] mx-auto space-y-6"
      style={{ background: t.bgPage }}
    >
      {t.isDark && (
        <GlobalSpotlight gridRef={gridRef} glowColor={glow} spotlightRadius={300} isDark={true} />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: t.txtPrimary }}>
            Billing & Subscription Portal
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: t.txtMuted }}>
            Manage credit balance, monitor automated AI burn rates, and track verified proof submissions.
          </p>
        </div>
      </div>

      {/* Hero Plan & Balance Overview Card (Asymmetric 2-Column Bento Grid) */}
      <PlanOverviewCard
        theme={t}
        profile={profile}
        onOpenUpgradeModal={handleOpenUpgrade}
        onRefreshProfile={refreshProfile}
      />

      {/* High-Value Live Spend Analytics & Velocity Card */}
      <SpendAnalyticsCard theme={t} profile={profile} />

      {/* Section Toolbar / Tabs */}
      <BillingToolbar
        theme={t}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Active Tab Content */}
      <div className="space-y-6">
        {activeTab === "requests" ? (
          <CreditRequestsTable
            theme={t}
            searchQuery={searchQuery}
            onOpenUpgrade={() => handleOpenUpgrade(10)}
          />
        ) : (
          <TransactionsTable
            theme={t}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Buy Credits / Upgrade Modal */}
      <UpgradeModal
        theme={t}
        isOpen={isUpgradeModalOpen}
        initialAmount={initialUpgradeAmount}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={async () => {
          await refreshProfile();
          queryClient.invalidateQueries({ queryKey: ["user", "credit-requests"] });
          queryClient.invalidateQueries({ queryKey: ["user", "transactions"] });
        }}
      />
    </div>
  );
}
