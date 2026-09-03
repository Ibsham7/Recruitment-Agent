import React, { useState, useEffect } from "react";
import { X, SlidersHorizontal, Coins, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Theme, UserProfile, PlanType } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";

export interface AdminCreditAdjustmentModalProps {
  theme: Theme;
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess?: () => void;
}

export function AdminCreditAdjustmentModal({
  theme: t,
  isOpen,
  onClose,
  user,
  onSuccess,
}: AdminCreditAdjustmentModalProps) {
  const [adjustment, setAdjustment] = useState<number>(100);
  const [customInput, setCustomInput] = useState<string>("100");
  const [planOverride, setPlanOverride] = useState<PlanType | "keep">("keep");
  const [reason, setReason] = useState<string>("Admin manual adjustment");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen && user) {
      setAdjustment(100);
      setCustomInput("100");
      setPlanOverride("keep");
      setReason("Admin manual adjustment");
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, user]);

  // Modal UX Rule 3: Keyboard Escape Dismissal
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

  if (!isOpen || !user) return null;

  const currentBalance = user.creditBalance;
  const newBalance = Math.max(0, currentBalance + adjustment);
  const willChangePlan = planOverride !== "keep" && planOverride !== user.plan;

  const handlePresetClick = (amount: number) => {
    setAdjustment(amount);
    setCustomInput(amount.toString());
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      setAdjustment(parsed);
    } else {
      setAdjustment(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustment === 0 && !willChangePlan) {
      setError("Please specify a non-zero credit adjustment or change the plan tier.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: { adjustment: number; reason: string; plan?: string } = {
        adjustment,
        reason: reason.trim() || "Admin manual adjustment",
      };

      if (planOverride !== "keep") {
        payload.plan = planOverride;
      }

      const res = await apiFetch(`/api/admin/users/${user.userId}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned status ${res.status}`);
      }

      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to adjust user credits");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Modal UX Rule 2: Backdrop click-to-close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-adjust-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden max-h-[90vh] shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: t.bgCard,
          borderColor: hexToRgba(t.accentBadge, 0.25),
          boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 30px ${hexToRgba(t.accentBadge, 0.12)}`,
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
                background: hexToRgba(t.accentBadge, 0.15),
                color: t.accentBadge,
                border: `1px solid ${hexToRgba(t.accentBadge, 0.3)}`,
              }}
            >
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 id="credit-adjust-title" className="text-base font-semibold" style={{ color: t.txtPrimary }}>
                Adjust Credits & Plan
              </h2>
              <p className="text-xs truncate max-w-[280px] sm:max-w-xs" style={{ color: t.txtMuted }}>
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
            style={{ color: t.txtMuted, background: hexToRgba(t.bgPage, 0.5) }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal UX Rule 4: Independent Scroll Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {success ? (
            <div className="text-center py-8 space-y-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{ background: hexToRgba(t.numPos, 0.15), color: t.numPos }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-base font-semibold" style={{ color: t.txtPrimary }}>
                Adjustment Applied Successfully!
              </h3>
              <p className="text-xs" style={{ color: t.txtMuted }}>
                User balance updated to <strong>{newBalance.toLocaleString()} Credits</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* User Overview Summary Card */}
              <div
                className="p-3.5 rounded-xl border text-xs space-y-2"
                style={{
                  background: hexToRgba(t.bgSurface, 0.5),
                  borderColor: hexToRgba(t.txtMuted, 0.15),
                }}
              >
                <div className="flex justify-between items-center text-xs">
                  <span style={{ color: t.txtSecondary }}>Current Plan:</span>
                  <span
                    className="font-semibold uppercase px-2 py-0.5 rounded-md text-[10px]"
                    style={{
                      background: user.plan === "paid" ? hexToRgba(t.numPos, 0.15) : hexToRgba(t.txtMuted, 0.15),
                      color: user.plan === "paid" ? t.numPos : t.txtSecondary,
                    }}
                  >
                    {user.plan}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span style={{ color: t.txtSecondary }}>Current Balance:</span>
                  <span className="font-semibold" style={{ color: t.txtPrimary }}>
                    {currentBalance.toLocaleString()} Credits
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t" style={{ borderColor: hexToRgba(t.txtMuted, 0.1) }}>
                  <span style={{ color: t.txtSecondary }}>Simulated New Balance:</span>
                  <span
                    className="font-bold flex items-center gap-1.5"
                    style={{
                      color: adjustment >= 0 ? t.numPos : t.numNeg,
                    }}
                  >
                    {newBalance.toLocaleString()} Credits
                    <span className="text-[10px] font-normal" style={{ color: t.txtMuted }}>
                      ({adjustment >= 0 ? `+${adjustment}` : adjustment})
                    </span>
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <label className="text-xs font-medium block" style={{ color: t.txtSecondary }}>
                  Quick Credit Presets
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { label: "+100", val: 100 },
                    { label: "+500", val: 500 },
                    { label: "+1k", val: 1000 },
                    { label: "+5k", val: 5000 },
                    { label: "-100", val: -100 },
                    { label: "-500", val: -500 },
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => handlePresetClick(preset.val)}
                      className="py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all"
                      style={{
                        background: adjustment === preset.val ? hexToRgba(t.accentBadge, 0.15) : hexToRgba(t.bgSurface, 0.4),
                        borderColor: adjustment === preset.val ? t.accentBadge : hexToRgba(t.txtMuted, 0.2),
                        color: adjustment === preset.val ? t.accentBadge : t.txtPrimary,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Adjustment Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium block" style={{ color: t.txtSecondary }}>
                  Adjustment Amount (positive to add, negative to deduct)
                </label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: t.txtMuted }} />
                  <input
                    type="number"
                    value={customInput}
                    onChange={handleCustomChange}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none font-medium"
                    style={{
                      background: hexToRgba(t.bgSurface, 0.6),
                      borderColor: hexToRgba(t.txtMuted, 0.25),
                      color: t.txtPrimary,
                    }}
                    placeholder="e.g. 500 or -200"
                  />
                </div>
              </div>

              {/* Plan Tier Override */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium block" style={{ color: t.txtSecondary }}>
                  Plan Tier Override
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "keep", label: "Keep Current" },
                    { id: "free", label: "Set Free Tier" },
                    { id: "paid", label: "Upgrade to Paid" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setPlanOverride(opt.id as any)}
                      className="py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all"
                      style={{
                        background: planOverride === opt.id ? hexToRgba(t.accentBadge, 0.15) : hexToRgba(t.bgSurface, 0.4),
                        borderColor: planOverride === opt.id ? t.accentBadge : hexToRgba(t.txtMuted, 0.2),
                        color: planOverride === opt.id ? t.accentBadge : t.txtSecondary,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audit Reason Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium block" style={{ color: t.txtSecondary }}>
                  Audit Trail Reason
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none"
                  style={{
                    background: hexToRgba(t.bgSurface, 0.6),
                    borderColor: hexToRgba(t.txtMuted, 0.25),
                    color: t.txtPrimary,
                  }}
                  placeholder="e.g. Compensation for failed parse, Beta bonus"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div
                  className="p-3 rounded-xl flex items-center gap-2 text-xs"
                  style={{ background: hexToRgba(t.numNeg, 0.12), color: t.numNeg }}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
                    color: t.accentText,
                    boxShadow: `0 4px 14px ${hexToRgba(t.accentPrimary, 0.25)}`,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Applying Adjustment...
                    </>
                  ) : (
                    <>
                      <span>Save Changes</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
