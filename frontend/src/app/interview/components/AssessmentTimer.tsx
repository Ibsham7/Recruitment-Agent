import { useEffect, useState, useRef } from "react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { Clock, AlertTriangle } from "lucide-react";

export interface AssessmentTimerProps {
  theme: Theme;
  timeRemaining?: number; // Legacy/fallback seconds
  initialSeconds?: number; // Initial duration in seconds
  timerSeconds?: number; // Dynamic duration (60s-90s per turn, 45s for adaptive probes)
  questionIndex?: number; // Active question index to trigger timer resets
  formattedTime?: string;
  totalTime?: number;
  onTimeUp?: () => void;
}

export function AssessmentTimer({
  theme: t,
  timeRemaining,
  initialSeconds,
  timerSeconds,
  questionIndex = 0,
  formattedTime,
  onTimeUp,
}: AssessmentTimerProps) {
  // Determine duration from available props (timerSeconds takes priority, then initialSeconds, timeRemaining, fallback 75s)
  const startSeconds = timerSeconds ?? initialSeconds ?? timeRemaining ?? 75;

  const [secondsLeft, setSecondsLeft] = useState<number>(startSeconds);
  const hasTriggeredTimeUp = useRef<boolean>(false);

  // Reset countdown timer when active question index or start duration changes
  useEffect(() => {
    setSecondsLeft(startSeconds);
    hasTriggeredTimeUp.current = false;
  }, [questionIndex, startSeconds]);

  // Clean countdown timer logic & single-shot onTimeUp trigger
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!hasTriggeredTimeUp.current) {
        hasTriggeredTimeUp.current = true;
        if (onTimeUp) {
          onTimeUp();
        }
      }
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, onTimeUp]);

  const formatDisplayTime = (secs: number) => {
    if (formattedTime) return formattedTime;
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Visual countdown warning colors (< 30s amber, < 10s red)
  const isRedWarning = secondsLeft < 10;
  const isAmberWarning = secondsLeft < 30;

  const badgeColor = isRedWarning
    ? (t.numNeg || "#ef4444")
    : isAmberWarning
    ? "#f59e0b"
    : t.accentPrimary;

  const displayString = formatDisplayTime(secondsLeft);

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors"
      style={{
        background: hexToRgba(badgeColor, 0.12),
        color: badgeColor,
        border: `1px solid ${hexToRgba(badgeColor, 0.3)}`,
      }}
    >
      {isAmberWarning || isRedWarning ? (
        <AlertTriangle size={14} className="animate-pulse" style={{ color: badgeColor }} />
      ) : (
        <Clock size={14} style={{ color: badgeColor }} />
      )}
      <span>Time Remaining: {displayString}</span>
    </div>
  );
}
