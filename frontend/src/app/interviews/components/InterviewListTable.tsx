import { Theme } from "../../../lib/types";
import { getGlass, hexToRgba } from "../../../lib/theme";
import { Loader2, Mail } from "lucide-react";
import { InterviewCandidate } from "../types";
import { CandidateStatusBadge } from "./CandidateStatusBadge";

export interface InterviewListTableProps {
  theme: Theme;
  loading: boolean;
  filteredCandidates: InterviewCandidate[];
  selectedIds: string[];
  handleSelectAll: (checked: boolean) => void;
  handleToggleSelect: (id: string) => void;
  handleSendInvitations: (targetIds?: string[]) => void;
  setInspectingCandidate: (c: InterviewCandidate) => void;
  sending: boolean;
  sendingIds: string[];
}

export function InterviewListTable({
  theme: t,
  loading,
  filteredCandidates,
  selectedIds,
  handleSelectAll,
  handleToggleSelect,
  handleSendInvitations,
  setInspectingCandidate,
  sending,
  sendingIds,
}: InterviewListTableProps) {
  const G = getGlass(t);

  if (loading) {
    return (
      <div className="p-16 text-center text-xs" style={{ color: t.txtGhost }}>
        <Loader2 size={24} className="animate-spin mx-auto mb-2" />
        Loading candidate assessment database...
      </div>
    );
  }

  if (filteredCandidates.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl" style={{ ...G.card, color: t.txtMuted }}>
        No candidates found matching current filter criteria.
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl" style={G.card}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6), borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.3)}` }}>
            <th className="p-4 w-10 text-center">
              <input
                type="checkbox"
                checked={selectedIds.length > 0 && selectedIds.length === filteredCandidates.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded cursor-pointer"
              />
            </th>
            <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Candidate</th>
            <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Campaign / Position</th>
            <th className="p-4 text-xs font-semibold text-center" style={{ color: t.txtMuted }}>Interview Score</th>
            <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Status</th>
            <th className="p-4 text-xs font-semibold" style={{ color: t.txtMuted }}>Invitation Sent</th>
            <th className="p-4 text-xs font-semibold text-right" style={{ color: t.txtMuted }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCandidates.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            const intScore = c.evaluation?.overallScore;
            const isRowSending = sendingIds.includes(c.id);

            return (
              <tr
                key={c.id}
                style={{
                  borderBottom: `1px solid ${hexToRgba(t.bgCard, 0.15)}`,
                  background: isSelected ? hexToRgba(t.accentPrimary, 0.06) : "transparent",
                }}
                className="hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => setInspectingCandidate(c)}
              >
                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelect(c.id)}
                    className="rounded cursor-pointer"
                  />
                </td>
                <td className="p-4">
                  <div className="text-xs font-semibold" style={{ color: t.txtPrimary }}>{c.name}</div>
                  <div className="text-[11px]" style={{ color: t.txtMuted }}>{c.email || "No email provided"}</div>
                </td>
                <td className="p-4">
                  <div className="text-xs font-medium" style={{ color: t.txtBody }}>{c.campaignTitle}</div>
                </td>
                <td className="p-4 text-center">
                  <span className="text-xs font-bold" style={{ color: intScore && intScore >= 75 ? t.numPos : t.txtPrimary }}>
                    {intScore !== undefined && intScore !== null ? `${Math.round(intScore)}/100` : "--"}
                  </span>
                </td>
                <td className="p-4">
                  <CandidateStatusBadge status={c.status} theme={t} />
                </td>
                <td className="p-4 text-xs" style={{ color: t.txtMuted }}>
                  {c.invitedAt ? new Date(c.invitedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not Sent"}
                </td>
                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {c.status === "shortlisted" || c.status === "invited" ? (
                      <button
                        onClick={() => handleSendInvitations([c.id])}
                        disabled={sending}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background: hexToRgba(t.accentPrimary, 0.15),
                          border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
                          color: t.accentPrimary,
                        }}
                      >
                        {isRowSending ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-amber-400" />
                            <span>{c.status === "invited" ? "Resending..." : "Sending..."}</span>
                          </>
                        ) : (
                          <>
                            <Mail size={12} />
                            <span>{c.status === "invited" ? "Resend Invite" : "Send Invite"}</span>
                          </>
                        )}
                      </button>
                    ) : null}
                    <button
                      onClick={() => setInspectingCandidate(c)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                      style={{
                        background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.7),
                        border: `1px solid ${hexToRgba(t.bgCard, 0.5)}`,
                        color: t.txtPrimary,
                      }}
                    >
                      Inspect Interview
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
