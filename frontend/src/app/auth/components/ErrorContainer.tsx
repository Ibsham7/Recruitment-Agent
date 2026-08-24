import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface ErrorContainerProps {
  theme: Theme;
  error?: string | null;
  success?: string | null;
}

export function ErrorContainer({ theme: t, error, success }: ErrorContainerProps) {
  if (!error && !success) return null;

  const isSuccess = !error && Boolean(success);
  const message = error || success;
  const color = isSuccess ? t.numPos : t.numNeg;
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[11px] font-medium transition-all"
      style={{
        background: hexToRgba(color, t.isDark ? 0.14 : 0.10),
        border: `1px solid ${hexToRgba(color, t.isDark ? 0.35 : 0.28)}`,
        color: color,
        boxShadow: `0 2px 8px ${hexToRgba(color, 0.08)}`,
      }}
    >
      <Icon size={14} className="shrink-0" style={{ color }} />
      <span className="leading-tight">{message}</span>
    </div>
  );
}
