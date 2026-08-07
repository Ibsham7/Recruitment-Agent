import { useEffect } from "react";
import { X, FileText, Code2, Download, CheckCircle2, Sparkles, FolderArchive } from "lucide-react";
import { Campaign, Candidate, Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { generateCampaignMarkdownReport, generateCampaignJsonData, downloadFile } from "../../../lib/exportUtils";

export interface ExportCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  candidates: Candidate[];
  theme: Theme;
}

export function ExportCampaignModal({ isOpen, onClose, campaign, candidates, theme: t }: ExportCampaignModalProps) {
  const G = getGlass(t);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalCandidates = candidates.length;
  const processedCandidates = candidates.filter((c) => c.score !== undefined && c.score > 0).length;
  const shortlistedCandidates = candidates.filter((c) =>
    ["shortlisted", "invited", "interviewing", "interview_completed", "finalized", "complete"].includes(c.stage || c.status)
  ).length;

  const safeTitle = (campaign.title || "campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleDownloadMarkdown = () => {
    const mdContent = generateCampaignMarkdownReport(campaign, candidates);
    downloadFile(mdContent, `${safeTitle}-evaluation-report.md`, "text/markdown;charset=utf-8");
  };

  const handleDownloadJson = () => {
    const jsonContent = generateCampaignJsonData(campaign, candidates);
    downloadFile(jsonContent, `${safeTitle}-evaluation-data.json`, "application/json;charset=utf-8");
  };

  const handleDownloadBoth = () => {
    handleDownloadMarkdown();
    setTimeout(() => {
      handleDownloadJson();
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all border"
        style={{
          background: t.isDark
            ? `linear-gradient(135deg, ${hexToRgba("#0f172a", 0.95)}, ${hexToRgba("#1e293b", 0.95)})`
            : `linear-gradient(135deg, ${hexToRgba("#ffffff", 0.95)}, ${hexToRgba("#f8fafc", 0.95)})`,
          borderColor: hexToRgba(t.accentPrimary, 0.3),
          boxShadow: `0 25px 50px -12px ${hexToRgba("#000000", 0.5)}, 0 0 30px ${hexToRgba(t.accentPrimary, 0.15)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div
          className="shrink-0 z-10 px-6 py-5 flex items-center justify-between border-b"
          style={{
            borderColor: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6),
            background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.7),
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl flex items-center justify-center"
              style={{
                background: hexToRgba(t.accentPrimary, 0.15),
                color: t.accentPrimary,
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`,
              }}
            >
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>
                Export Campaign Report & Data
              </h3>
              <p className="text-xs" style={{ color: t.txtMuted }}>
                Download all candidate fit scores, score breakdowns, XAI strengths, concerns & AI reasoning
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all cursor-pointer hover:scale-105"
            style={{
              background: hexToRgba(t.bgCard, 0.5),
              color: t.txtMuted,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Campaign Stats Pill Banner */}
          <div
            className="p-4 rounded-2xl flex items-center justify-between text-xs"
            style={{
              background: hexToRgba(t.accentPrimary, 0.08),
              border: `1px solid ${hexToRgba(t.accentPrimary, 0.2)}`,
            }}
          >
            <div>
              <div className="font-semibold text-sm mb-0.5" style={{ color: t.txtPrimary }}>{campaign.title}</div>
              <div className="flex items-center gap-3 font-medium" style={{ color: t.txtSecondary }}>
                <span>Total Candidates: <strong style={{ color: t.numHero }}>{totalCandidates}</strong></span>
                <span>•</span>
                <span>Evaluated: <strong style={{ color: t.numPos }}>{processedCandidates}</strong></span>
                <span>•</span>
                <span>Shortlisted: <strong style={{ color: t.accentPrimary }}>{shortlistedCandidates}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold" style={{ background: hexToRgba(t.numPos, 0.15), color: t.numPos }}>
              <CheckCircle2 size={14} /> Ready for Export
            </div>
          </div>

          {/* Format Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Markdown Option */}
            <div
              className="group p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.6),
                borderColor: hexToRgba(t.accentPrimary, 0.2),
              }}
              onClick={handleDownloadMarkdown}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="p-2.5 rounded-xl flex items-center justify-center"
                    style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}
                  >
                    <FileText size={22} />
                  </div>
                  <span
                    className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md"
                    style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}
                  >
                    Recommended (.md)
                  </span>
                </div>
                <h4 className="font-bold text-base mb-1" style={{ color: t.txtPrimary }}>
                  Markdown Report (.md)
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>
                  Rich, human-readable document containing complete campaign overview, candidate matrix, granular XAI score equations, Must-Have & Nice-to-Have tables, strengths, concerns, and step-by-step AI reasoning.
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadMarkdown(); }}
                className="mt-5 w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 group-hover:shadow-lg"
                style={{
                  background: t.accentPrimary,
                  color: "#ffffff",
                  boxShadow: `0 4px 14px ${hexToRgba(t.accentPrimary, 0.3)}`,
                }}
              >
                <Download size={14} /> Download Markdown (.md)
              </button>
            </div>

            {/* JSON Option */}
            <div
              className="group p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.6),
                borderColor: hexToRgba(t.numMid, 0.2),
              }}
              onClick={handleDownloadJson}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="p-2.5 rounded-xl flex items-center justify-center"
                    style={{ background: hexToRgba(t.numMid, 0.15), color: t.numMid }}
                  >
                    <Code2 size={22} />
                  </div>
                  <span
                    className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md"
                    style={{ background: hexToRgba(t.numMid, 0.15), color: t.numMid }}
                  >
                    Machine Readable (.json)
                  </span>
                </div>
                <h4 className="font-bold text-base mb-1" style={{ color: t.txtPrimary }}>
                  JSON Raw Dataset (.json)
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>
                  Formatted structured JSON containing full candidate objects, evaluation records, score breakdown trees, structured resume profiles, anti-cheat telemetry, and cost metrics.
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadJson(); }}
                className="mt-5 w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 group-hover:shadow-lg"
                style={{
                  background: hexToRgba(t.numMid, 0.2),
                  color: t.numMid,
                  border: `1px solid ${hexToRgba(t.numMid, 0.4)}`,
                }}
              >
                <Download size={14} /> Download JSON (.json)
              </button>
            </div>
          </div>

          {/* Quick Dual Download Banner */}
          <div
            className="p-4 rounded-2xl flex items-center justify-between"
            style={{
              background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.5),
              border: `1px dashed ${hexToRgba(t.accentPrimary, 0.3)}`,
            }}
          >
            <div className="flex items-center gap-3">
              <FolderArchive size={20} style={{ color: t.accentBadge }} />
              <div>
                <div className="text-xs font-bold" style={{ color: t.txtPrimary }}>Want both formats?</div>
                <div className="text-[11px]" style={{ color: t.txtMuted }}>Download both Markdown (.md) report and JSON (.json) dataset simultaneously.</div>
              </div>
            </div>
            <button
              onClick={handleDownloadBoth}
              className="px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105"
              style={{
                background: hexToRgba(t.accentBadge, 0.15),
                color: t.accentBadge,
                border: `1px solid ${hexToRgba(t.accentBadge, 0.3)}`,
              }}
            >
              <Sparkles size={14} /> Download Both
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-6 py-4 border-t flex justify-end"
          style={{
            borderColor: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6),
            background: hexToRgba(t.bgPage, t.isDark ? 0.4 : 0.7),
          }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-all"
            style={{
              background: hexToRgba(t.bgCard, 0.6),
              color: t.txtSecondary,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
