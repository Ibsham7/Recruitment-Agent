import { AlertCircle } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface ErrorContainerProps {
  theme: Theme;
  error?: string | null;
}

export function ErrorContainer({ theme: t, error }: ErrorContainerProps) {
  if (!error) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px]"
      style={{
        background: hexToRgba(t.numNeg, 0.10),
        border: `1px solid ${hexToRgba(t.numNeg, 0.25)}`,
        color: t.numNeg,
      }}
    >
      <AlertCircle size={12} /> {error}
    </div>
  );
}
