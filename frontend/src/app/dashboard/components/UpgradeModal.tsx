import React, { useState, useEffect, useRef } from "react";
import { X, Upload, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { Theme, PresignedPaymentUrlResponse } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/AuthContext";

interface UpgradeModalProps {
  theme: Theme;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialAmount?: number;
}

export function UpgradeModal({ theme: t, isOpen, onClose, onSuccess, initialAmount = 10 }: UpgradeModalProps) {
  const { refreshProfile } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number>(initialAmount);
  const [customAmount, setCustomAmount] = useState<string>([10, 20, 50].includes(initialAmount) ? "" : String(initialAmount));
  const [isCustom, setIsCustom] = useState(![10, 20, 50].includes(initialAmount));
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const isPreset = [10, 20, 50].includes(initialAmount);
      setSelectedAmount(initialAmount);
      setCustomAmount(isPreset ? "" : String(initialAmount));
      setIsCustom(!isPreset);
      setFile(null);
      setFilePreview(null);
      setError(null);
      setSuccess(false);
      setUploading(false);
    }
  }, [isOpen, initialAmount]);

  // Clean up object URL memory on file change / unmount
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  // Keyboard Escape key dismissal listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentAmount = isCustom ? (parseFloat(customAmount) || 0) : selectedAmount;
  const creditsEstimated = Math.floor(currentAmount * 100);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
        setError("Please upload an image (PNG, JPG, WEBP) or PDF screenshot.");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit.");
        return;
      }
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
      setFile(selected);
      setError(null);
      if (selected.type.startsWith("image/")) {
        setFilePreview(URL.createObjectURL(selected));
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (currentAmount <= 0) {
      setError("Please specify a valid payment amount greater than $0.");
      return;
    }
    if (!file) {
      setError("Please attach a payment receipt or transaction screenshot.");
      return;
    }

    setUploading(true);
    try {
      // 1. Obtain presigned PUT upload URL from backend
      const presignedRes = await apiFetch(
        `/api/upload/payment-screenshot-presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || "image/png")}`
      );
      if (!presignedRes.ok) {
        const errorData = await presignedRes.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to generate secure upload URL for payment receipt.");
      }
      const { uploadUrl, fileUrl } = (await presignedRes.json()) as PresignedPaymentUrlResponse;

      // 2. Direct browser upload to Cloudflare R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "image/png",
        },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Failed to upload screenshot to storage.");
      }

      // 3. Create CreditRequest in database
      const requestRes = await apiFetch('/api/user/credit-requests', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: currentAmount,
          screenshotUrl: fileUrl || uploadUrl.split("?")[0],
        }),
      });

      if (!requestRes.ok) {
        const errorData = await requestRes.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to submit credit purchase request.");
      }

      setSuccess(true);
      await refreshProfile();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("[UpgradeModal] Submission error:", err);
      setError(err.message || "An unexpected error occurred during submission.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(0, 0, 0, 0.72)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: t.bgCard,
          borderColor: hexToRgba(t.accentPrimary, 0.25),
          boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 30px ${hexToRgba(t.accentPrimary, 0.15)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div
          className="shrink-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b"
          style={{
            background: t.bgCard,
            borderColor: hexToRgba(t.txtMuted, 0.15),
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
            >
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="upgrade-modal-title" className="text-sm sm:text-base font-semibold truncate" style={{ color: t.txtPrimary }}>
                Upgrade to Paid Credits
              </h2>
              <p className="text-[11px] sm:text-xs truncate" style={{ color: t.txtMuted }}>
                $10 = 1,000 Credits · 1 Credit = 1 CV / 1 Action
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 sm:w-8 sm:h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg transition-colors shrink-0"
            style={{ color: t.txtMuted, background: hexToRgba(t.bgPage, 0.5) }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = t.txtPrimary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = t.txtMuted;
            }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Independent Scroll Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{ background: hexToRgba(t.numPos, 0.15), color: t.numPos }}
              >
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold" style={{ color: t.txtPrimary }}>
                  Payment Request Submitted!
                </h3>
                <p className="text-xs leading-relaxed max-w-md mx-auto" style={{ color: t.txtMuted }}>
                  Your request for <strong style={{ color: t.txtPrimary }}>${currentAmount.toFixed(2)} ({creditsEstimated.toLocaleString()} Credits)</strong> has been sent to the administrator. Once verified, credits will be added to your balance immediately.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold mt-2 transition-transform active:scale-95 inline-flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
                  color: t.accentText,
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Unit Economics Breakdown Card */}
              <div
                className="p-3.5 rounded-xl border text-xs space-y-2"
                style={{
                  background: hexToRgba(t.bgSurface, 0.5),
                  borderColor: hexToRgba(t.accentBadge, 0.2),
                }}
              >
                <div className="flex items-center justify-between font-semibold" style={{ color: t.accentBadge }}>
                  <span>Transparent Credit Pricing</span>
                  <span>$10 / 1,000 CVs</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]" style={{ color: t.txtSecondary }}>
                  <div>• 1 Campaign = 1 Credit</div>
                  <div>• 1 CV Parsing = 1 Credit</div>
                  <div>• 1 Invite Email = 1 Credit</div>
                  <div>• 1 Evaluation = 2 Credits</div>
                </div>
              </div>

              {/* Amount Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium block" style={{ color: t.txtSecondary }}>
                  Select Purchase Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 20, 50].map((amt) => {
                    const active = !isCustom && selectedAmount === amt;
                    return (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => {
                          setSelectedAmount(amt);
                          setIsCustom(false);
                        }}
                        className="py-2.5 px-2 sm:px-3 min-h-[44px] rounded-xl border text-center transition-all flex flex-col items-center justify-center"
                        style={{
                          background: active ? hexToRgba(t.accentBadge, 0.15) : hexToRgba(t.bgSurface, 0.4),
                          borderColor: active ? t.accentBadge : hexToRgba(t.txtMuted, 0.2),
                          color: active ? t.accentBadge : t.txtPrimary,
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        <div className="text-sm font-bold">${amt}</div>
                        <div className="text-[10px]" style={{ color: active ? t.accentBadge : t.txtMuted }}>
                          {(amt * 100).toLocaleString()} Credits
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount Input */}
                <div className="pt-1">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="Custom USD ($)"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setIsCustom(true);
                      }}
                      onFocus={() => setIsCustom(true)}
                      className="flex-1 px-3.5 py-2.5 h-11 min-h-[44px] sm:min-h-0 rounded-xl text-xs border outline-none transition-colors"
                      style={{
                        background: hexToRgba(t.bgSurface, 0.6),
                        borderColor: isCustom ? t.accentBadge : hexToRgba(t.txtMuted, 0.2),
                        color: t.txtPrimary,
                      }}
                    />
                    <div
                      className="px-3.5 py-2.5 h-11 min-h-[44px] sm:min-h-0 rounded-xl text-xs border font-medium whitespace-nowrap text-center flex items-center justify-center"
                      style={{
                        background: hexToRgba(t.bgSurface, 0.4),
                        borderColor: hexToRgba(t.txtMuted, 0.2),
                        color: t.txtSecondary,
                      }}
                    >
                      {creditsEstimated > 0 ? `${creditsEstimated.toLocaleString()} Credits` : "0 Credits"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Instructions */}
              <div
                className="p-3.5 rounded-xl border space-y-1.5 text-xs"
                style={{
                  background: hexToRgba(t.bgPage, 0.4),
                  borderColor: hexToRgba(t.txtMuted, 0.15),
                }}
              >
                <div className="flex items-center gap-1.5 font-semibold" style={{ color: t.txtPrimary }}>
                  <ShieldCheck size={14} style={{ color: t.accentPrimary }} />
                  <span>Manual Payment & Verification</span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: t.txtMuted }}>
                  Please transfer <strong style={{ color: t.txtPrimary }}>${currentAmount.toFixed(2)}</strong> via your agreed payment method and attach a clear screenshot of the transaction confirmation below.
                </p>
              </div>

              {/* Screenshot File Upload */}
              <div className="space-y-2">
                <label className="text-xs font-medium block" style={{ color: t.txtSecondary }}>
                  Attach Payment Screenshot
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-3.5 sm:p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 relative group min-h-[88px]"
                  style={{
                    borderColor: file ? t.accentBadge : hexToRgba(t.txtMuted, 0.25),
                    background: file ? hexToRgba(t.accentBadge, 0.05) : hexToRgba(t.bgSurface, 0.3),
                  }}
                >
                  {filePreview ? (
                    <div className="relative group max-h-32 overflow-hidden rounded-lg">
                      <img src={filePreview} alt="Screenshot preview" className="max-h-28 object-contain rounded" />
                      <div className="flex items-center justify-between gap-2 mt-1 text-[10px] font-medium" style={{ color: t.txtPrimary }}>
                        <span className="truncate max-w-[200px]">{file?.name} ({(file!.size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Remove file"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : file ? (
                    <div className="flex items-center justify-between w-full px-3 py-1">
                      <div className="flex items-center gap-2" style={{ color: t.accentBadge }}>
                        <ImageIcon size={18} />
                        <span className="text-xs font-medium truncate max-w-xs">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: hexToRgba(t.txtMuted, 0.1), color: t.txtMuted }}
                      >
                        <Upload size={18} />
                      </div>
                      <div className="text-xs font-medium" style={{ color: t.txtPrimary }}>
                        Click to upload receipt image (PNG, JPG, PDF)
                      </div>
                      <div className="text-[10px]" style={{ color: t.txtMuted }}>
                        Max file size: 10MB
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div
                  className="p-3 rounded-xl border flex items-center gap-2 text-xs"
                  style={{
                    background: hexToRgba(t.numNeg, 0.1),
                    borderColor: hexToRgba(t.numNeg, 0.25),
                    color: t.numNeg,
                  }}
                >
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Action */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploading || !file || currentAmount <= 0}
                  className="w-full py-3 sm:py-3.5 px-4 min-h-[48px] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
                    color: t.accentText,
                    boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.3)}`,
                  }}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Uploading & Submitting...
                    </>
                  ) : (
                    <>
                      <span>Submit for Approval (${currentAmount.toFixed(2)})</span>
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

