import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserProfile, Theme } from "../../../lib/types";
import { getGlass, hexToRgba } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";
import {
  Search,
  SlidersHorizontal,
  Coins,
  RefreshCw,
  Copy,
  Check,
  Users,
  ArrowUpDown,
  Layers,
} from "lucide-react";
import { AdminCreditAdjustmentModal } from "./AdminCreditAdjustmentModal";

export interface AdminUsersTabProps {
  theme: Theme;
}

export function AdminUsersTab({ theme: t }: AdminUsersTabProps) {
  const G = getGlass(t);
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "paid">("all");
  const [sortBy, setSortBy] = useState<"date" | "credits" | "cvs" | "campaigns">("date");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const {
    data: users = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<UserProfile[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/users');
      if (!res.ok) {
        throw new Error(`Failed to fetch admin users (${res.status})`);
      }
      return res.json();
    },
    staleTime: 10_000,
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenAdjust = (user: UserProfile) => {
    setSelectedUser(user);
    setIsAdjustModalOpen(true);
  };

  // Filtered & Sorted Users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (planFilter !== "all" && u.plan !== planFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const emailMatch = u.email.toLowerCase().includes(q);
          const idMatch = u.userId.toLowerCase().includes(q);
          const planMatch = u.plan.toLowerCase().includes(q);
          return emailMatch || idMatch || planMatch;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "credits") return b.creditBalance - a.creditBalance;
        if (sortBy === "cvs") return b.totalCvsProcessed - a.totalCvsProcessed;
        if (sortBy === "campaigns") return b.totalCampaignsCreated - a.totalCampaignsCreated;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [users, planFilter, searchQuery, sortBy]);

  const totalCredits = useMemo(() => users.reduce((acc, u) => acc + u.creditBalance, 0), [users]);
  const paidCount = useMemo(() => users.filter((u) => u.plan === "paid").length, [users]);
  const freeCount = useMemo(() => users.filter((u) => u.plan === "free").length, [users]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="p-4 rounded-2xl border"
          style={{ ...G.card, borderColor: hexToRgba(t.txtMuted, 0.15) }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: t.txtMuted }}>
            <span>Total Registered</span>
            <Users size={15} style={{ color: t.accentBadge }} />
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: t.txtPrimary }}>
            {users.length}
          </div>
          <div className="text-[11px] mt-1 flex items-center gap-2" style={{ color: t.txtSecondary }}>
            <span>Free: <strong>{freeCount}</strong></span>
            <span>·</span>
            <span style={{ color: t.numPos }}>Paid: <strong>{paidCount}</strong></span>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border"
          style={{ ...G.card, borderColor: hexToRgba(t.txtMuted, 0.15) }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: t.txtMuted }}>
            <span>Credits in Circulation</span>
            <Coins size={15} style={{ color: t.numPos }} />
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: t.txtPrimary }}>
            {totalCredits.toLocaleString()}
          </div>
          <div className="text-[11px] mt-1" style={{ color: t.txtMuted }}>
            Active across {users.length} accounts
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border"
          style={{ ...G.card, borderColor: hexToRgba(t.txtMuted, 0.15) }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: t.txtMuted }}>
            <span>Usage Aggregate</span>
            <Layers size={15} style={{ color: t.accentBadge }} />
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: t.txtPrimary }}>
            {users.reduce((acc, u) => acc + u.totalCvsProcessed, 0).toLocaleString()} <span className="text-xs font-normal" style={{ color: t.txtMuted }}>CVs</span>
          </div>
          <div className="text-[11px] mt-1" style={{ color: t.txtMuted }}>
            {users.reduce((acc, u) => acc + u.totalCampaignsCreated, 0)} campaigns created
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div
        className="p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3"
        style={{ ...G.card, borderColor: hexToRgba(t.txtMuted, 0.15) }}
      >
        <div className="flex flex-1 items-center gap-2 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: t.txtMuted }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by email, user ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none"
            style={{
              background: hexToRgba(t.bgSurface, 0.5),
              borderColor: hexToRgba(t.txtMuted, 0.2),
              color: t.txtPrimary,
            }}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Plan Filter */}
          <div className="flex items-center p-1 rounded-xl border" style={{ background: hexToRgba(t.bgSurface, 0.4), borderColor: hexToRgba(t.txtMuted, 0.15) }}>
            {(["all", "free", "paid"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlanFilter(p)}
                className="px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all"
                style={{
                  background: planFilter === p ? hexToRgba(t.accentBadge, 0.18) : "transparent",
                  color: planFilter === p ? t.accentBadge : t.txtSecondary,
                  fontWeight: planFilter === p ? 600 : 400,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs" style={{ background: hexToRgba(t.bgSurface, 0.4), borderColor: hexToRgba(t.txtMuted, 0.2), color: t.txtSecondary }}>
            <ArrowUpDown size={12} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer"
              style={{ color: t.txtPrimary }}
            >
              <option value="date" style={{ background: t.bgCard, color: t.txtPrimary }}>Joined Date</option>
              <option value="credits" style={{ background: t.bgCard, color: t.txtPrimary }}>Credit Balance</option>
              <option value="cvs" style={{ background: t.bgCard, color: t.txtPrimary }}>CVs Processed</option>
              <option value="campaigns" style={{ background: t.bgCard, color: t.txtPrimary }}>Campaigns</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl border transition-all hover:opacity-80"
            style={{ background: hexToRgba(t.bgSurface, 0.4), borderColor: hexToRgba(t.txtMuted, 0.2), color: t.txtSecondary }}
            title="Refresh Users"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ ...G.card, borderColor: hexToRgba(t.txtMuted, 0.15) }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className="border-b"
                style={{
                  background: hexToRgba(t.bgSurface, 0.5),
                  borderColor: hexToRgba(t.txtMuted, 0.15),
                  color: t.txtMuted,
                }}
              >
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Plan Tier</th>
                <th className="py-3 px-4 font-semibold">Credits</th>
                <th className="py-3 px-4 font-semibold">Usage (Camp / CV / Int)</th>
                <th className="py-3 px-4 font-semibold">Joined</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: hexToRgba(t.txtMuted, 0.1) }}>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center" style={{ color: t.txtMuted }}>
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 opacity-50" />
                    Loading user records...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-rose-400">
                    {(error as Error).message || "Failed to load users"}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center" style={{ color: t.txtMuted }}>
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="transition-colors"
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = hexToRgba(t.accentBadge, 0.04);
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {/* User Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] uppercase shrink-0"
                          style={{
                            background: hexToRgba(t.accentBadge, 0.15),
                            color: t.accentBadge,
                            border: `1px solid ${hexToRgba(t.accentBadge, 0.3)}`,
                          }}
                        >
                          {user.email ? user.email.substring(0, 2) : "US"}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                            <span>{user.email}</span>
                          </div>
                          <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: t.txtMuted }}>
                            <span>ID: {user.userId.slice(0, 10)}...</span>
                            <button
                              onClick={() => handleCopy(user.userId, user.userId)}
                              className="p-0.5 hover:opacity-100 opacity-60"
                              title="Copy full User ID"
                            >
                              {copiedId === user.userId ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Plan Tier */}
                    <td className="py-3.5 px-4">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          background: user.plan === "paid" ? hexToRgba(t.numPos, 0.15) : hexToRgba(t.txtMuted, 0.15),
                          color: user.plan === "paid" ? t.numPos : t.txtSecondary,
                          border: `1px solid ${user.plan === "paid" ? hexToRgba(t.numPos, 0.3) : hexToRgba(t.txtMuted, 0.25)}`,
                        }}
                      >
                        {user.plan}
                      </span>
                    </td>

                    {/* Credits */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-xs" style={{ color: user.creditBalance > 0 ? t.numPos : t.txtPrimary }}>
                        {user.creditBalance.toLocaleString()}
                      </span>
                      <span className="text-[10px] ml-1" style={{ color: t.txtMuted }}>
                        credits
                      </span>
                    </td>

                    {/* Usage */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 text-[11px]" style={{ color: t.txtSecondary }}>
                        <div>
                          <strong>{user.totalCampaignsCreated}</strong> {user.plan === "free" ? "/ 5" : ""} camps
                        </div>
                        <div>
                          <strong>{user.totalCvsProcessed}</strong> {user.plan === "free" ? "/ 100" : ""} CVs
                        </div>
                        <div>
                          <strong>{user.totalInterviewsSent}</strong> {user.plan === "free" ? "/ 5" : ""} ints
                        </div>
                      </div>
                    </td>

                    {/* Joined */}
                    <td className="py-3.5 px-4 text-xs" style={{ color: t.txtMuted }}>
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenAdjust(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95"
                        style={{
                          background: hexToRgba(t.accentBadge, 0.12),
                          borderColor: hexToRgba(t.accentBadge, 0.3),
                          color: t.accentBadge,
                        }}
                      >
                        <SlidersHorizontal size={12} />
                        <span>Adjust</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Modal */}
      <AdminCreditAdjustmentModal
        theme={t}
        isOpen={isAdjustModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        }}
      />
    </div>
  );
}
