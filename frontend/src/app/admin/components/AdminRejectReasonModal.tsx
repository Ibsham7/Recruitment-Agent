import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  Ban,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Theme, CreditRequest, UserProfile } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";

export interface AdminRejectReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: (CreditRequest & { user?: UserProfile }) | null;
  onRejectSuccess: (requestId: string, reason: string) => void;
  theme: Theme;
}

const PRESET_REASONS = [
  "Unreadable or blurred payment screenshot",
  "Transaction reference / payment ID not visible",
  "Payment amount in receipt does not match requested amount",
  "Duplicate payment proof (already credited)",
  "Payment sent to incorrect account / destination",
  "Receipt date outside valid submission window",
  "Other reason (specify below)",
];

export function AdminRejectReasonModal({
  isOpen,
  onClose,
  request,
  onRejectSuccess,
  theme: t,
}: AdminRejectReasonModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset internal state when modal opens or target request changes
  useEffect(() => {
    if (isOpen && request) {
      setSelectedPreset(PRESET_REASONS[0]);
      setReason(PRESET_REASONS[0]);
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [isOpen, request]);

  // Modal UX Rule 3: Keyboard Escape dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !request) return null;

  const handleSelectPreset = (preset: string) => {
    setSelectedPreset(preset);
    if (preset === "Other reason (specify below)") {
      setReason("");
    } else {
      setReason(preset);
    }
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason.trim();
    if (!finalReason) {
      setErrorMessage("Please enter a valid rejection reason for the audit trail.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await apiFetch(`/api/admin/credit-requests/${request.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: finalReason }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to reject credit request (${res.status})`);
      }

      onRejectSuccess(request.id, finalReason);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while rejecting request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPdf = request.screenshotUrl?.toLowerCase().includes(".pdf");

  return (
    // Modal UX Rule 2: Backdrop container with click-to-close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-reject-modal-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      {/* Modal Dialog Container: stopPropagation on click */}
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden max-h-[90vh] shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: t.bgCard,
          borderColor: hexToRgba(t.numNeg, 0.35),
          boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 30px ${hexToRgba(t.numNeg, 0.15)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal UX Rule 1: Sticky Header & Fixed Controls */}
        <div
          className="shrink-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{
            background: t.bgCard,
            borderColor: hexToRgba(t.txtMuted, 0.15),
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: hexToRgba(t.numNeg, 0.15),
                color: t.numNeg,
                border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`,
              }}
            >
              <Ban size={18} />
            </div>
            <div>
              <h2
                id="admin-reject-modal-title"
                className="text-base font-semibold"
                style={{ color: t.txtPrimary }}
              >
                Reject Credit Request
              </h2>
              <p className="text-xs" style={{ color: t.txtMuted }}>
                Provide a reason for the user and system audit log
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50"
            style={{ color: t.txtMuted, background: hexToRgba(t.bgPage, 0.5) }}
            aria-label="Close rejection modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal UX Rule 4: Independent Scroll Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Target Request Summary Card */}
            <div
              className="p-4 rounded-xl border space-y-2"
              style={{
                background: hexToRgba(t.bgSurface, 0.5),
                borderColor: hexToRgba(t.txtMuted, 0.2),
              }}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span style={{ color: t.txtSecondary }}>Target Request</span>
                <span className="font-mono" style={{ color: t.txtMuted }}>
                  #{request.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold" style={{ color: t.txtPrimary }}>
                    {request.user?.email || `User ID: ${request.userId.slice(0, 8)}`}
                  </div>
                  <div className="text-xs" style={{ color: t.txtMuted }}>
                    Requested:{" "}
                    <span className="font-semibold" style={{ color: t.numPos }}>
                      ${request.amount.toFixed(2)} USD
                    </span>{" "}
                    ({Math.round(request.amount * 100).toLocaleString()} Credits)
                  </div>
                </div>

                {request.screenshotUrl && (
                  <a
                    href={request.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      background: hexToRgba(t.accentPrimary, 0.1),
                      color: t.accentPrimary,
                      borderColor: hexToRgba(t.accentPrimary, 0.25),
                    }}
                    title="View submitted proof in new tab"
                  >
                    {isPdf ? <FileText size={13} /> : <ImageIcon size={13} />}
                    <span>View Proof</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>

            {/* Quick-Select Preset Reason Chips */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block" style={{ color: t.txtSecondary }}>
                Standard Reason Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_REASONS.map((preset) => {
                  const isSelected = selectedPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="text-xs px-3 py-1.5 rounded-lg border text-left transition-all"
                      style={{
                        background: isSelected
                          ? hexToRgba(t.numNeg, 0.18)
                          : hexToRgba(t.bgSurface, 0.4),
                        color: isSelected ? t.numNeg : t.txtPrimary,
                        borderColor: isSelected
                          ? t.numNeg
                          : hexToRgba(t.txtMuted, 0.2),
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable Rejection Reason Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="rejection-reason-input"
                  className="text-xs font-semibold"
                  style={{ color: t.txtSecondary }}
                >
                  Audit Reason Description <span style={{ color: t.numNeg }}>*</span>
                </label>
                <span className="text-[11px]" style={{ color: t.txtMuted }}>
                  {reason.length} / 500
                </span>
              </div>
              <textarea
                id="rejection-reason-input"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Explain clearly why this payment receipt is rejected..."
                disabled={isSubmitting}
                className="w-full text-xs p-3 rounded-xl border focus:outline-none transition-all resize-none"
                style={{
                  background: hexToRgba(t.bgPage, 0.6),
                  color: t.txtPrimary,
                  borderColor: errorMessage
                    ? t.numNeg
                    : hexToRgba(t.txtMuted, 0.25),
                }}
              />
            </div>

            {/* Audit Warning Banner */}
            <div
              className="p-3 rounded-xl border flex items-start gap-2.5 text-xs"
              style={{
                background: hexToRgba(t.numNeg, 0.08),
                borderColor: hexToRgba(t.numNeg, 0.2),
                color: t.txtSecondary,
              }}
            >
              <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: t.numNeg }} />
              <p className="leading-relaxed">
                Rejecting this request will permanently update its status to{" "}
                <strong style={{ color: t.numNeg }}>Rejected</strong>. No credits will be
                allocated to the user. This reason will be recorded on their billing history.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                className="p-3 rounded-xl border text-xs font-medium flex items-center gap-2"
                style={{
                  background: hexToRgba(t.numNeg, 0.15),
                  color: t.numNeg,
                  borderColor: hexToRgba(t.numNeg, 0.3),
                }}
              >
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Sticky Modal Action Footer */}
          <div
            className="shrink-0 z-10 px-6 py-4 border-t flex items-center justify-end gap-3"
            style={{
              background: t.bgCard,
              borderColor: hexToRgba(t.txtMuted, 0.15),
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50"
              style={{
                borderColor: hexToRgba(t.txtMuted, 0.25),
                color: t.txtSecondary,
                background: hexToRgba(t.bgSurface, 0.5),
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(135deg, ${t.numNeg}, ${hexToRgba(t.numNeg, 0.85)})`,
                color: "#FFFFFF",
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <>
                  <Ban size={14} />
                  <span>Confirm Rejection</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
