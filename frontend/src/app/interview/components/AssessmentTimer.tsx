import { useEffect, useState } from "react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { Clock, AlertTriangle } from "lucide-react";

export interface AssessmentTimerProps {
  theme: Theme;
  timeRemaining?: number; // Time remaining in seconds
  formattedTime?: string;
  totalTime?: number;
  onTimeUp?: () => void;
}

export function AssessmentTimer({
  theme: t,
  timeRemaining: initialSeconds,
  formattedTime,
  onTimeUp,
}: AssessmentTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | undefined>(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft === undefined || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === undefined || prev <= 1) {
          clearInterval(interval);
          if (onTimeUp) onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, onTimeUp]);

  const formatDisplayTime = (secs?: number) => {
    if (formattedTime) return formattedTime;
    if (secs === undefined) return "--:--";
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const isLowTime = secondsLeft !== undefined && secondsLeft < 300; // < 5 mins
  const displayString = formatDisplayTime(secondsLeft);

  const badgeColor = isLowTime ? t.numNeg : t.accentPrimary;

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors"
      style={{
        background: hexToRgba(badgeColor, 0.12),
        color: badgeColor,
        border: `1px solid ${hexToRgba(badgeColor, 0.3)}`,
      }}
    >
      {isLowTime ? (
        <AlertTriangle size={14} className="animate-pulse" style={{ color: badgeColor }} />
      ) : (
        <Clock size={14} style={{ color: badgeColor }} />
      )}
      <span>Time Remaining: {displayString}</span>
    </div>
  );
}
