import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

export interface NotificationToastProps {
  message: string | null;
  theme: Theme;
  onDismiss: () => void;
}

export function NotificationToast({ message, theme: t, onDismiss }: NotificationToastProps) {
  if (!message) return null;

  const isError = message.startsWith("Error");

  return (
    <div
      className="mb-6 p-4 rounded-xl text-xs font-medium flex items-center justify-between shadow-lg"
      style={{
        background: isError ? hexToRgba(t.numNeg, 0.15) : hexToRgba(t.numPos, 0.15),
        border: `1px solid ${isError ? t.numNeg : t.numPos}`,
        color: t.txtPrimary,
      }}
    >
      <div className="flex items-center gap-2">
        {isError ? (
          <ShieldAlert size={16} style={{ color: t.numNeg }} />
        ) : (
          <CheckCircle2 size={16} style={{ color: t.numPos }} />
        )}
        <span>{message}</span>
      </div>
      <button onClick={onDismiss} className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer">
        Dismiss
      </button>
    </div>
  );
}
