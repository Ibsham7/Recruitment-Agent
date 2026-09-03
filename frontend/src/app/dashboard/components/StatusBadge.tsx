import { PlayCircle, CheckCircle2, PauseCircle } from "lucide-react";
import { CampaignStatus } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface StatusBadgeProps {
  status: CampaignStatus;
  sc: string;
}

export function StatusBadge({ status, sc }: StatusBadgeProps) {
  const icons = {
    active: <PlayCircle size={12} className="flex-shrink-0" />,
    completed: <CheckCircle2 size={12} className="flex-shrink-0" />,
    paused: <PauseCircle size={12} className="flex-shrink-0" />
  };
  return (
    <span 
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-all shrink-0 whitespace-nowrap" 
      style={{ backgroundColor: hexToRgba(sc, 0.15), color: sc, border: `1px solid ${hexToRgba(sc, 0.35)}` }}
    >
      {icons[status] || icons.active}
      {status}
    </span>
  );
}
