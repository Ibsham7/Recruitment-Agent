import React, { useRef } from "react";
import { 
  Upload, 
  AlertTriangle, 
  Trash2, 
  CheckCircle, 
  RefreshCw, 
  ArrowLeft, 
  Loader2 
} from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { UploadTask, validateFile, formatFileSize } from "./types";

interface Step2UploadProps {
  theme: Theme;
  uploadTasks: UploadTask[];
  setUploadTasks: React.Dispatch<React.SetStateAction<UploadTask[]>>;
  uploading: boolean;
  dbWakingUp: boolean;
  setStep: (step: number) => void;
  onComplete: () => void;
  uploadToCloudinaryWithProgress: (taskId: string, file: File) => Promise<string>;
}

export default function Step2Upload({
  theme: t,
  uploadTasks,
  setUploadTasks,
  uploading,
  dbWakingUp,
  setStep,
  onComplete,
  uploadToCloudinaryWithProgress
}: Step2UploadProps) {
  const G = getGlass(t);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newTasks: UploadTask[] = Array.from(e.dataTransfer.files).map(f => {
        const val = validateFile(f);
        return {
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          status: val.isError ? 'error' : 'pending',
          progress: 0,
          errorReason: val.reason
        };
      });
      setUploadTasks((prev) => [...prev, ...newTasks]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newTasks: UploadTask[] = Array.from(e.target.files).map(f => {
        const val = validateFile(f);
        return {
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          status: val.isError ? 'error' : 'pending',
          progress: 0,
          errorReason: val.reason
        };
      });
      setUploadTasks((prev) => [...prev, ...newTasks]);
    }
    if (e.target) e.target.value = '';
  };

  const totalFileSize = uploadTasks.reduce((acc, task) => acc + task.file.size, 0);
  const problematicTasks = uploadTasks.filter(t => t.status === 'error' || t.file.size === 0);
  const validTasks = uploadTasks.filter(t => t.status !== 'error' && t.file.size > 0);

  return (
    <div className="lg:col-span-7 xl:col-span-8 space-y-6">
      <input 
        type="file" 
        multiple 
        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
      />
      
      {/* Expanded Dropzone */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} 
        onDragLeave={() => setDragging(false)} 
        onDrop={handleFileDrop} 
        onClick={() => fileInputRef.current?.click()}
        className="rounded-2xl p-10 text-center cursor-pointer transition-all border-2 border-dashed flex flex-col items-center justify-center gap-3 hover:scale-[1.005]"
        style={{ 
          borderColor: dragging ? t.accentPrimary : hexToRgba(t.accentPrimary, 0.4), 
          background: dragging ? hexToRgba(t.accentPrimary, 0.12) : hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.45) 
        }}
      >
        <div 
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1 transition-transform"
          style={{ background: hexToRgba(t.accentPrimary, 0.18), color: t.accentPrimary, transform: dragging ? "scale(1.1)" : "scale(1)" }}
        >
          <Upload size={28} />
        </div>
        
        <div>
          <div className="text-base font-bold" style={{ color: t.txtPrimary }}>
            Drop candidate resumes here or click to browse files
          </div>
          <div className="text-xs mt-1 font-medium" style={{ color: t.txtMuted }}>
            Supports PDF, DOCX, DOC, and TXT files — batch upload up to 100 resumes at once
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          {['PDF', 'DOCX', 'DOC', 'TXT'].map(ext => (
            <span 
              key={ext} 
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg border" 
              style={{ background: hexToRgba(t.txtGhost, 0.15), borderColor: hexToRgba(t.txtGhost, 0.2), color: t.txtSecondary }}
            >
              {ext}
            </span>
          ))}
        </div>
      </div>

      {/* Problematic CVs Alert Banner */}
      {problematicTasks.length > 0 && (
        <div 
          className="rounded-2xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all shadow-md"
          style={{ background: hexToRgba('#ef4444', 0.12), borderColor: hexToRgba('#ef4444', 0.4) }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: hexToRgba('#ef4444', 0.2), color: '#ef4444' }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-xs font-extrabold text-red-500 flex items-center gap-1.5">
                <span>{problematicTasks.length} {problematicTasks.length === 1 ? 'Problematic Resume Detected' : 'Problematic Resumes Detected'}</span>
              </div>
              <div className="text-[11px] text-red-400/90 mt-0.5 font-medium">
                Contains empty (0 B) or invalid files. Remove them to launch campaign smoothly.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUploadTasks(prev => prev.filter(task => task.status !== 'error' && task.file.size > 0))}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-auto shadow-sm hover:opacity-90 active:scale-95"
            style={{ background: '#ef4444', color: '#ffffff' }}
          >
            <Trash2 size={13} />
            <span>Remove {problematicTasks.length === 1 ? 'Problematic CV' : 'All Problematic CVs'}</span>
          </button>
        </div>
      )}

      {/* Queued Files Card */}
      {uploadTasks.length > 0 && (
        <div className="rounded-2xl p-5 sm:p-6 space-y-4" style={G.card}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>
              {uploadTasks.length} {uploadTasks.length === 1 ? 'File' : 'Files'} Queued ({formatFileSize(totalFileSize)})
            </span>
            <button 
              onClick={() => setUploadTasks([])} 
              className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors"
            >
              <Trash2 size={13} /> Clear Batch
            </button>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {uploadTasks.map((task) => {
              const isProblematic = task.status === 'error' || task.file.size === 0;
              return (
                <div 
                  key={task.id} 
                  className="relative overflow-hidden flex items-center gap-3 rounded-xl px-3.5 py-3 border transition-all" 
                  style={{ 
                    background: isProblematic ? hexToRgba('#ef4444', 0.08) : hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.6),
                    borderColor: isProblematic ? hexToRgba('#ef4444', 0.5) : hexToRgba(t.txtGhost, 0.18) 
                  }}
                >
                  {(task.status === 'uploading' || task.status === 'success') && (
                    <div 
                      className="absolute top-0 left-0 h-full transition-all duration-300 ease-out" 
                      style={{ 
                        width: `${task.progress}%`, 
                        background: hexToRgba(task.status === 'success' ? t.numPos : t.accentPrimary, 0.12),
                        zIndex: 0
                      }} 
                    />
                  )}
                  
                  <div className="relative z-10 flex items-center w-full gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: isProblematic ? '#ef4444' : t.txtPrimary }}>
                        {task.file.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: isProblematic ? hexToRgba('#ef4444', 0.8) : t.txtMuted }}>
                          {formatFileSize(task.file.size)}
                        </span>
                        {isProblematic && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                            <AlertTriangle size={9} />
                            {task.errorReason || (task.file.size === 0 ? "Empty file (0 B)" : "Problematic file")}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {task.status === 'pending' && !isProblematic && <span className="text-[10px] font-bold" style={{ color: t.txtMuted }}>Ready</span>}
                    {task.status === 'uploading' && <span className="text-[10px] font-bold" style={{ color: t.accentPrimary }}>{task.progress}%</span>}
                    {task.status === 'success' && <CheckCircle size={16} style={{ color: t.numPos }} />}
                    
                    {isProblematic && (
                      <div className="flex items-center gap-1.5">
                        {task.file.size > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); uploadToCloudinaryWithProgress(task.id, task.file).catch(() => {}); }} 
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold transition-colors"
                            style={{ border: `1px solid ${hexToRgba('#ef4444', 0.4)}`, color: '#ef4444', background: hexToRgba('#ef4444', 0.1) }}
                          >
                            <RefreshCw size={10} /> Retry
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setUploadTasks(prev => prev.filter(t => t.id !== task.id)); }}
                          className="text-[10px] px-2 py-0.5 rounded font-bold transition-colors flex items-center gap-1 hover:bg-red-500/30"
                          style={{ border: `1px solid ${hexToRgba('#ef4444', 0.4)}`, color: '#ef4444', background: hexToRgba('#ef4444', 0.15) }}
                          title="Remove this problematic file"
                        >
                          <Trash2 size={10} /> Remove
                        </button>
                      </div>
                    )}

                    {!isProblematic && task.status !== 'uploading' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setUploadTasks(prev => prev.filter(t => t.id !== task.id)); }} 
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors" 
                        style={{ color: t.txtMuted }}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button 
          onClick={() => setStep(1)} 
          disabled={uploading} 
          className="px-6 py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all border" 
          style={{ ...G.card, color: t.txtSecondary }}
        >
          <ArrowLeft size={15} />
          <span>Back to Details</span>
        </button>

        <button 
          onClick={onComplete} 
          disabled={validTasks.length === 0 || uploading} 
          className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.005]"
          style={{ 
            background: validTasks.length > 0 ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})` : hexToRgba(t.bgCard, 0.2), 
            color: validTasks.length > 0 ? t.accentText : t.txtGhost, 
            boxShadow: validTasks.length > 0 ? `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` : "none", 
            cursor: validTasks.length > 0 && !uploading ? "pointer" : "not-allowed" 
          }}
        >
          {uploading ? (
            dbWakingUp ? (
              <><Loader2 size={16} className="animate-spin" /> Waking up database (~30s)...</>
            ) : uploadTasks.some(t => t.status !== 'success') ? (
              <><Loader2 size={16} className="animate-spin" /> Uploading Candidate Resumes...</>
            ) : (
              <><Loader2 size={16} className="animate-spin" /> Launching Campaign...</>
            )
          ) : problematicTasks.length > 0 && validTasks.length === 0 ? (
            "Remove Problematic Files to Proceed"
          ) : problematicTasks.length > 0 ? (
            `Launch AI Campaign (${validTasks.length} Valid ${validTasks.length === 1 ? 'CV' : 'CVs'})`
          ) : (
            "Launch AI Campaign"
          )}
        </button>
      </div>
    </div>
  );
}
