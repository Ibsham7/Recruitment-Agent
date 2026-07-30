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
      className="p-4 rounded-2xl flex items-center justify-between gap-3 text-xs"
      style={{ background: hexToRgba(t.numNeg, 0.12), border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`, color: t.numNeg }}
    >
      <div className="flex items-center gap-2.5">
        <AlertCircle size={16} className="flex-shrink-0" />
        <span>{error}</span>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all hover:opacity-80"
        style={{ background: hexToRgba(t.numNeg, 0.2), color: t.numNeg }}
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}
