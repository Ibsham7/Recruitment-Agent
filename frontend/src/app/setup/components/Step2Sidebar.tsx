import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { UploadTask, formatFileSize } from "./types";

interface Step2SidebarProps {
  theme: Theme;
  uploadTasks: UploadTask[];
}

export default function Step2Sidebar({ theme: t, uploadTasks }: Step2SidebarProps) {
  const G = getGlass(t);

  const totalFileSize = uploadTasks.reduce((acc, task) => acc + task.file.size, 0);

  return (
    <div className="lg:col-span-5 xl:col-span-4 space-y-6">
      {/* Batch Upload Summary Card */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
        <div className="border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: t.txtPrimary }}>
            Batch Upload Status
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <div 
            className="flex justify-between items-center p-3 rounded-xl border" 
            style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}
          >
            <span className="font-semibold" style={{ color: t.txtMuted }}>Total Resumes Queued</span>
            <span className="font-bold text-sm" style={{ color: t.accentPrimary }}>{uploadTasks.length} CVs</span>
          </div>

          <div 
            className="flex justify-between items-center p-3 rounded-xl border" 
            style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}
          >
            <span className="font-semibold" style={{ color: t.txtMuted }}>Combined File Payload</span>
            <span className="font-bold" style={{ color: t.txtPrimary }}>{formatFileSize(totalFileSize)}</span>
          </div>

          <div 
            className="flex justify-between items-center p-3 rounded-xl border" 
            style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}
          >
            <span className="font-semibold" style={{ color: t.txtMuted }}>Estimated AI Evaluation</span>
            <span className="font-bold" style={{ color: t.txtPrimary }}>~{Math.max(1, Math.ceil(uploadTasks.length * 2.5))} seconds</span>
          </div>
        </div>
      </div>

      {/* AI Evaluation Pipeline Card */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
        <div className="border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: t.txtPrimary }}>
            What Happens Next?
          </h3>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="flex items-start gap-3">
            <div 
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
              style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
            >
              1
            </div>
            <div>
              <div className="font-bold" style={{ color: t.txtPrimary }}>Resume Storage & Parsing</div>
              <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                Resumes are uploaded to encrypted cloud storage and extracted into structured candidate profiles.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div 
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
              style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
            >
              2
            </div>
            <div>
              <div className="font-bold" style={{ color: t.txtPrimary }}>Hard Filter Verification</div>
              <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                Candidate profiles are evaluated against configured mandatory skills and experience limits.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div 
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]" 
              style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}
            >
              3
            </div>
            <div>
              <div className="font-bold" style={{ color: t.txtPrimary }}>LLM Candidate Scoring</div>
              <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                AI reasoning model generates detailed candidate breakdown, skill overlap scores, and interview question suggestions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
