import { useEffect, useState } from "react";
import { X, ExternalLink, FileText, Image as ImageIcon, AlertCircle, Copy, Check } from "lucide-react";
import { Theme } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";

export interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
  theme: Theme;
  metadata?: {
    amount?: number;
    date?: string;
    status?: "pending" | "approved" | "rejected";
    requestId?: string;
  };
}

export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  title = "Payment Receipt Proof",
  theme: t,
  metadata,
}: ImagePreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  // Reset error & copy states on URL change
  useEffect(() => {
    setImgError(false);
    setCopied(false);
  }, [imageUrl, isOpen]);

  if (!isOpen || !imageUrl) return null;

  const isPdf =
    imageUrl.toLowerCase().includes(".pdf") ||
    (imageUrl.startsWith("blob:") && imageUrl.includes("application/pdf"));

  const handleCopyLink = () => {
    navigator.clipboard.writeText(imageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status?: string) => {
    if (status === "approved") return t.numPos;
    if (status === "rejected") return t.numNeg;
    return t.numMid;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.78)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl flex flex-col overflow-hidden max-h-[92vh] shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: t.bgCard,
          borderColor: hexToRgba(t.accentPrimary, 0.25),
          boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 35px ${hexToRgba(t.accentPrimary, 0.15)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Sticky Header */}
        <div
          className="shrink-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{
            background: t.bgCard,
            borderColor: hexToRgba(t.txtMuted, 0.15),
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
            >
              {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="image-preview-title" className="text-base font-semibold" style={{ color: t.txtPrimary }}>
                  {title}
                </h2>
                {metadata?.status && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                    style={{
                      background: hexToRgba(getStatusColor(metadata.status), 0.15),
                      color: getStatusColor(metadata.status),
                      border: `1px solid ${hexToRgba(getStatusColor(metadata.status), 0.3)}`,
                    }}
                  >
                    {metadata.status}
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: t.txtMuted }}>
                {metadata?.amount !== undefined ? `$${metadata.amount.toFixed(2)} USD` : "Payment Proof"}
                {metadata?.date ? ` · ${metadata.date}` : ""}
                {metadata?.requestId ? ` · #${metadata.requestId.slice(0, 8)}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors border"
              style={{
                color: t.txtSecondary,
                borderColor: hexToRgba(t.txtMuted, 0.2),
                background: hexToRgba(t.bgSurface, 0.4),
              }}
              title="Copy receipt URL"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
            </button>

            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors border"
              style={{
                color: t.txtSecondary,
                borderColor: hexToRgba(t.txtMuted, 0.2),
                background: hexToRgba(t.bgSurface, 0.4),
              }}
              title="Open full receipt in new tab"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">Open Full</span>
            </a>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: t.txtMuted, background: hexToRgba(t.bgPage, 0.5) }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = t.txtPrimary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = t.txtMuted;
              }}
              aria-label="Close preview modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. Independent Scroll Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center min-h-[300px]">
          {isPdf ? (
            <div className="w-full flex flex-col items-center justify-center p-8 space-y-4 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
              >
                <FileText size={36} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold" style={{ color: t.txtPrimary }}>
                  PDF Receipt Document
                </h3>
                <p className="text-xs max-w-sm" style={{ color: t.txtMuted }}>
                  This payment proof is stored as a PDF document. You can view or download it in your browser viewer.
                </p>
              </div>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-transform active:scale-95 shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
                  color: t.accentText,
                }}
              >
                <ExternalLink size={14} />
                View PDF Document
              </a>
            </div>
          ) : imgError ? (
            <div className="text-center p-8 space-y-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                style={{ background: hexToRgba(t.numNeg, 0.15), color: t.numNeg }}
              >
                <AlertCircle size={24} />
              </div>
              <div className="text-xs font-medium" style={{ color: t.txtPrimary }}>
                Unable to load image directly in preview
              </div>
              <p className="text-[11px]" style={{ color: t.txtMuted }}>
                The image link may require direct browser access or authentication.
              </p>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs border transition-colors"
                style={{ borderColor: hexToRgba(t.txtMuted, 0.2), color: t.txtPrimary }}
              >
                <ExternalLink size={13} />
                Open Image Directly
              </a>
            </div>
          ) : (
            <div className="relative group max-w-full flex items-center justify-center">
              <img
                src={imageUrl}
                alt="Payment Receipt"
                onError={() => setImgError(true)}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg border"
                style={{ borderColor: hexToRgba(t.txtMuted, 0.2) }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
