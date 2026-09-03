import { AlertCircle, RefreshCw } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface DashboardErrorBannerProps {
  theme: Theme;
  error: string;
  onRetry: () => void;
}

export function DashboardErrorBanner({
  theme: t,
  error,
  onRetry,
}: DashboardErrorBannerProps) {
  return (
    <div 
      className="p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      style={{ background: hexToRgba(t.numNeg, 0.12), border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`, color: t.numNeg }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle size={16} className="flex-shrink-0" />
        <span className="break-words">{error}</span>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg font-semibold transition-all hover:opacity-80 shrink-0 self-end sm:self-auto"
        style={{ background: hexToRgba(t.numNeg, 0.2), color: t.numNeg }}
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}
