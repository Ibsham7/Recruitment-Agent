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
}: LiveAnswerCardProps) {
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
          rows={7}
          placeholder="Type your response here... Include specific examples, methodology, and technical reasoning."
          className="w-full rounded-2xl p-4 text-sm focus:outline-none resize-none"
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
        className="w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
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
        Submit Answer
      </button>
    </div>
  );
}
