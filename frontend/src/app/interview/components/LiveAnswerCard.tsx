import React from "react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { Send, Loader2, Mic, MicOff, AlertCircle } from "lucide-react";

export interface LiveAnswerCardProps {
  theme: Theme;
  answer: string;
  setAnswer: (val: string) => void;
  submitting: boolean;
  error?: string;
  onSubmit: () => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  audioSupported?: boolean;
  telemetry?: {
    pasteCount: number;
    totalPastedChars: number;
    pasteRatio: number;
    pasteTimestamps: string[];
  };
  onTelemetryUpdate?: (data: {
    pasteCount: number;
    totalPastedChars: number;
    pasteRatio: number;
    pasteTimestamps: string[];
  }) => void;
  onPasteEvent?: (pastedLength: number, timestamp: string) => void;
}

export function LiveAnswerCard({
  theme: t,
  answer,
  setAnswer,
  submitting,
  error,
  onSubmit,
  isRecording = false,
  onToggleRecording,
  audioSupported = false,
  telemetry,
  onTelemetryUpdate,
  onPasteEvent,
}: LiveAnswerCardProps) {
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData?.getData("text") || "";
    const pastedLength = pastedText.length;
    const timestamp = new Date().toISOString();

    if (onPasteEvent) {
      onPasteEvent(pastedLength, timestamp);
    }

    if (onTelemetryUpdate) {
      const currentPasteCount = (telemetry?.pasteCount ?? 0) + 1;
      const currentTotalPasted = (telemetry?.totalPastedChars ?? 0) + pastedLength;
      const currentTimestamps = [...(telemetry?.pasteTimestamps ?? []), timestamp];
      const projectedAnswerLength = answer.length + pastedLength;
      const currentRatio = Number(
        (currentTotalPasted / Math.max(1, projectedAnswerLength)).toFixed(2)
      );

      onTelemetryUpdate({
        pasteCount: currentPasteCount,
        totalPastedChars: currentTotalPasted,
        pasteRatio: currentRatio,
        pasteTimestamps: currentTimestamps,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Response Header & Optional Audio Recording Indicator */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold" style={{ color: t.txtMuted }}>
          Your Response
        </label>

        {(audioSupported || onToggleRecording) && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer"
              style={{
                background: isRecording
                  ? hexToRgba(t.numNeg, 0.15)
                  : hexToRgba(t.bgSurface, 0.6),
                color: isRecording ? t.numNeg : t.txtMuted,
                border: `1px solid ${
                  isRecording ? hexToRgba(t.numNeg, 0.3) : hexToRgba(t.bgCard, 0.3)
                }`,
              }}
            >
              {isRecording ? (
                <>
                  <Mic size={12} className="animate-pulse" style={{ color: t.numNeg }} />
                  <span>Recording Active...</span>
                </>
              ) : (
                <>
                  <MicOff size={12} />
                  <span>Audio Mode (Optional)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Answer Textarea */}
      <div>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onPaste={handlePaste}
          rows={5}
          placeholder="Type your response here... Include specific examples, methodology, and technical reasoning."
          className="w-full rounded-2xl p-3.5 sm:p-4 text-sm focus:outline-none resize-none sm:rows-7"
          style={{
            color: t.txtBody,
            background: hexToRgba(t.bgSurface, t.isDark ? 0.1 : 0.8),
            border: `1px solid ${hexToRgba(t.accentPrimary, 0.4)}`,
          }}
        />
      </div>

      {error && (
        <div
          className="text-xs p-3 rounded-xl flex items-center gap-2"
          style={{
            background: hexToRgba(t.numNeg, 0.1),
            border: `1px solid ${hexToRgba(t.numNeg, 0.3)}`,
            color: t.numNeg,
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Action Button */}
      <button
        onClick={onSubmit}
        disabled={submitting || !answer.trim()}
        className="min-h-[44px] w-full py-3.5 sm:py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        style={{
          background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(
            t.accentPrimary,
            0.75
          )})`,
          color: t.accentText,
          boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}`,
        }}
      >
        {submitting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Send size={18} />
        )}
        <span>Submit Answer</span>
      </button>
    </div>
  );
}
