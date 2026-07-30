import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { HelpCircle, Tag, Gauge } from "lucide-react";

export interface QuestionRendererProps {
  theme: Theme;
  questionText: string;
  topic?: string;
  difficulty?: string;
  questionIndex?: number;
  totalQuestions?: number;
}

export function QuestionRenderer({
  theme: t,
  questionText,
  topic,
  difficulty,
  questionIndex,
  totalQuestions,
}: QuestionRendererProps) {
  const getDifficultyColor = (diff?: string) => {
    const d = (diff || "").toLowerCase();
    if (d.includes("hard") || d.includes("senior") || d.includes("advanced")) {
      return t.numNeg;
    }
    if (d.includes("medium") || d.includes("intermediate")) {
      return t.numMid;
    }
    return t.numPos;
  };

  const diffColor = getDifficultyColor(difficulty);

  return (
    <div
      className="p-6 rounded-2xl space-y-4"
      style={{
        background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6),
        border: `1px solid ${hexToRgba(t.bgCard, 0.3)}`,
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: t.accentPrimary }}
          >
            <HelpCircle size={14} />
            {questionIndex && totalQuestions
              ? `Question ${questionIndex} of ${totalQuestions}`
              : "Current Question"}
          </h3>
        </div>

        {/* Badges: Topic & Difficulty */}
        <div className="flex items-center gap-2">
          {topic && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
              style={{
                background: hexToRgba(t.accentPrimary, 0.12),
                color: t.accentPrimary,
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.25)}`,
              }}
            >
              <Tag size={10} />
              {topic}
            </span>
          )}

          {difficulty && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: hexToRgba(diffColor, 0.15),
                color: diffColor,
                border: `1px solid ${hexToRgba(diffColor, 0.3)}`,
              }}
            >
              <Gauge size={10} />
              {difficulty}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed font-medium" style={{ color: t.txtBody }}>
        {questionText || "Please provide your detailed answer to the technical assessment question."}
      </p>
    </div>
  );
}
