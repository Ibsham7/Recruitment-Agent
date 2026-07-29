import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { 
  Check, 
  Upload, 
  FileText, 
  CheckCircle, 
  Loader2, 
  XCircle, 
  RefreshCw, 
  Briefcase, 
  Sliders, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  Plus, 
  ArrowRight, 
  ArrowLeft, 
  RotateCcw, 
  Info,
  FileCheck,
  Zap,
  Target,
  Layers,
  Cpu,
  CheckCircle2,
  HelpCircle,
  FileCode
} from "lucide-react";
import { Theme } from "../../lib/types";
import { hexToRgba, getGlass } from "../../lib/theme";
import { apiFetch } from "../../lib/api";

interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
}

const DEFAULT_TITLE = "AI Engineer (Applied ML & Agentic Systems)";
const DEFAULT_JD = `We are looking for an AI Developer to design, build, and deploy intelligent applications and machine learning infrastructure. In this role, you will bridge the gap between advanced deep learning models and production-ready software. You will focus heavily on large language model (LLM) orchestration, multi-agent frameworks, and building the robust backend architecture required to support scalable AI features.
Key Responsibilities
Agentic Workflow Development: Design and implement autonomous multi-agent execution loops and orchestration pipelines for complex problem-solving.
Backend & API Engineering: Build production-grade, scalable backend services and APIs to serve ML models and manage data flow between shared stores.
Model Integration & Optimization: Integrate various cloud-hosted multi-model platforms and manage API connectivity, rate limits, and contextual token scaling.
Advanced AI Architectures: Implement and maintain Retrieval-Augmented Generation (RAG) systems and apply parameter-efficient fine-tuning techniques to adapt open-weights models.
Infrastructure & Tooling: Establish reliable machine learning production pipelines and utilize open-source connectivity standards to allow models to interact with external tools and databases.
Required Qualifications
Programming Languages: Strong proficiency in Python and TypeScript/Node.js.
AI & LLM Frameworks: Hands-on experience with orchestration and agent frameworks such as LangChain, LangGraph, CrewAI, AutoGen, or the Model Context Protocol (MCP).
Backend Technologies: Experience with modern backend web architectures (e.g., NestJS, Express) and relational databases (PostgreSQL) using ORMs like Prisma or Drizzle.
Applied Machine Learning: Solid understanding of deep learning optimization strategies, post-training alignment, and architectures like LoRA (Low-Rank Adaptation) and GRPO.
Cloud & Model Ops: Experience utilizing platforms like OpenRouter to manage API keys, track billing structures, and test diverse production-grade model architectures.
Preferred Qualifications
A strong portfolio of independent, agent-based proof-of-concept projects demonstrating practical AI engineering skills.
An understanding of low-level hardware optimizations, compute thermal management, and cache organization mechanics for local model deployments.
A strong mathematical foundation in vector calculus and linear algebra.`;


function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function SetupPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [jd, setJd] = useState(DEFAULT_JD);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const uploadTasksRef = useRef<UploadTask[]>([]);

  useEffect(() => {
    uploadTasksRef.current = uploadTasks;
  }, [uploadTasks]);

  const [dragging, setDragging] = useState(false);
  const [strictness, setStrictness] = useState<"lenient" | "moderate" | "strict">("moderate");
  const [hardFilters, setHardFilters] = useState<{type: string, value: string, penalty: string}[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dbWakingUp, setDbWakingUp] = useState(false);

  // Modal Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showFiltersModal) {
        setShowFiltersModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFiltersModal]);
  
  const fieldStyle: React.CSSProperties = { 
    color: t.txtPrimary, 
    background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.55), 
    border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.75)}`, 
    backdropFilter: "blur(12px)", 
    WebkitBackdropFilter: "blur(12px)",
    transition: "all 0.2s ease"
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newTasks: UploadTask[] = Array.from(e.dataTransfer.files).map(f => ({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        status: 'pending',
        progress: 0
      }));
      setUploadTasks((prev) => [...prev, ...newTasks]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newTasks: UploadTask[] = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        status: 'pending',
        progress: 0
      }));
      setUploadTasks((prev) => [...prev, ...newTasks]);
    }
  };

  const uploadToCloudinaryWithProgress = (taskId: string, file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();
      const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "").trim();
      
      if (!cloudName || !uploadPreset) {
        const errorMsg = "Cloudinary upload credentials missing (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).";
        console.error(errorMsg);
        setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', progress: 0 } : t));
        reject(new Error(errorMsg));
        return;
      }

      setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading', progress: 0 } : t));

      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      
      xhr.open("POST", url, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress: percentComplete } : t));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'success', progress: 100, url: response.secure_url } : t));
            resolve(response.secure_url);
          } catch (err) {
            setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
            reject(new Error("Failed to parse Cloudinary response"));
          }
        } else {
          let errDetail = `Upload failed (${xhr.status})`;
          try {
            const errRes = JSON.parse(xhr.responseText);
            if (errRes.error?.message) {
              errDetail = errRes.error.message;
            }
          } catch (e) {}
          console.error("Cloudinary error:", errDetail);
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
          reject(new Error(errDetail));
        }
      };

      xhr.onerror = () => {
        setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
        reject(new Error("Network error during upload"));
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      xhr.send(formData);
    });
  };

  const onComplete = async () => {
    if (!title || !jd || uploadTasks.length === 0) return;
    setUploading(true);
    
    try {
      let isAwake = false;
      let firstTry = true;
      while (!isAwake) {
        try {
          const healthRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/health/db`);
          if (healthRes.ok) {
            isAwake = true;
          } else {
            if (firstTry) {
              setDbWakingUp(true);
              firstTry = false;
            }
            await new Promise(r => setTimeout(r, 3000));
          }
        } catch (e) {
          if (firstTry) {
            setDbWakingUp(true);
            firstTry = false;
          }
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      setDbWakingUp(false);

      const currentTasks = uploadTasksRef.current;
      const tasksToUpload = currentTasks.filter(t => t.status === 'pending' || t.status === 'error');
      
      const newlyUploadedUrls: Record<string, string> = {};
      if (tasksToUpload.length > 0) {
        const uploadPromises = tasksToUpload.map(async t => {
          const url = await uploadToCloudinaryWithProgress(t.id, t.file);
          return { id: t.id, url };
        });
        const uploadResults = await Promise.allSettled(uploadPromises);
        
        const hasErrors = uploadResults.some(r => r.status === 'rejected');
        if (hasErrors) {
          setUploading(false);
          return;
        }

        uploadResults.forEach(r => {
          if (r.status === 'fulfilled') {
            newlyUploadedUrls[r.value.id] = r.value.url;
          }
        });
      }

      const fileUrls = currentTasks.map(t => {
        if (t.status === 'success' && t.url) return t.url;
        return newlyUploadedUrls[t.id];
      });

      if (fileUrls.some(url => !url)) {
        setUploading(false);
        return;
      }

      const res = await apiFetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          jobDescription: jd,
          resumes: fileUrls,
          hardFiltersConfig: hardFilters,
          enableInterviews: true,
          strictness
        })
      });

      if (!res.ok) throw new Error("Failed to create campaign");
      
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      alert("An error occurred during upload or campaign creation.");
      setUploading(false);
    }
  };

  const getPenaltyInfo = (penalty: string) => {
    switch (penalty) {
      case "reject":
        return { label: "Reject Candidate", color: "#ef4444", bg: hexToRgba("#ef4444", 0.15) };
      case "hard_penalize":
        return { label: "-30 Penalty", color: "#f97316", bg: hexToRgba("#f97316", 0.15) };
      case "intermediate_penalize":
        return { label: "-20 Penalty", color: "#eab308", bg: hexToRgba("#eab308", 0.15) };
      case "slight_penalize":
        return { label: "-10 Penalty", color: "#3b82f6", bg: hexToRgba("#3b82f6", 0.15) };
      default:
        return { label: penalty, color: t.txtSecondary, bg: hexToRgba(t.txtGhost, 0.15) };
    }
  };

  const wordCount = jd.trim() ? jd.trim().split(/\s+/).length : 0;
  const totalFileSize = uploadTasks.reduce((acc, task) => acc + task.file.size, 0);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border transition-all" style={G.card}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider" 
              style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>
              Campaign Setup Wizard
            </span>
            <span className="text-xs" style={{ color: t.txtMuted }}>• Step {step} of 2</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: t.txtPrimary }}>
            {step === 1 ? "Create Recruitment Campaign" : "Upload Candidate Resumes"}
          </h1>
          <p className="text-xs sm:text-sm mt-1 font-medium max-w-2xl" style={{ color: t.txtSecondary }}>
            {step === 1 
              ? "Define role specifications, evaluation strictness, and screening filters to align AI evaluation with your hiring criteria." 
              : "Upload candidate CV files (PDF, DOCX, TXT) for automated parsing, hard filter checks, and multi-dimensional LLM scoring."}
          </p>
        </div>

        {/* Stepper Control Pill */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl shrink-0 self-start sm:self-auto" 
          style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.75), border: `1px solid ${hexToRgba(t.txtGhost, 0.2)}` }}>
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: step === 1 ? t.accentPrimary : "transparent",
              color: step === 1 ? t.accentText : t.txtSecondary,
              boxShadow: step === 1 ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.35)}` : "none"
            }}
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold" 
              style={{ background: step === 1 ? t.accentText : hexToRgba(t.txtGhost, 0.3), color: step === 1 ? t.accentPrimary : t.txtPrimary }}>
              {step > 1 ? <Check size={10} /> : "1"}
            </span>
            <span>1. Details</span>
          </button>
          
          <span className="text-xs font-bold px-0.5" style={{ color: t.txtGhost }}>/</span>
          
          <button
            onClick={() => { if (title && jd) setStep(2); }}
            disabled={!title || !jd}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{
              background: step === 2 ? t.accentPrimary : "transparent",
              color: step === 2 ? t.accentText : t.txtSecondary,
              boxShadow: step === 2 ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.35)}` : "none"
            }}
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold" 
              style={{ background: step === 2 ? t.accentText : hexToRgba(t.txtGhost, 0.3), color: step === 2 ? t.accentPrimary : t.txtPrimary }}>
              2
            </span>
            <span>2. Resumes</span>
          </button>
        </div>
      </div>

      {/* STEP 1: Job Details & Evaluation Criteria */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form Left Column */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">

            {/* Main Form Box */}
            <div className="rounded-2xl p-5 sm:p-6 space-y-6" style={G.card}>
              {/* Job Title Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: t.txtMuted }}>
                    <Briefcase size={14} style={{ color: t.accentPrimary }} />
                    <span>Job Title</span>
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" 
                    style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>
                    Required
                  </span>
                </div>
                <input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Senior Frontend Engineer (React & TypeScript)" 
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-1" 
                  style={{ 
                    ...fieldStyle,
                    borderColor: title ? hexToRgba(t.accentPrimary, 0.4) : fieldStyle.borderColor
                  }} 
                />
              </div>

              {/* Job Description Textarea */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: t.txtMuted }}>
                    <FileText size={14} style={{ color: t.accentPrimary }} />
                    <span>Job Description & Role Requirements</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium" style={{ color: t.txtMuted }}>
                      {wordCount} words | {jd.length} chars
                    </span>
                    <button 
                      onClick={() => { setTitle(DEFAULT_TITLE); setJd(DEFAULT_JD); }} 
                      className="text-xs font-semibold flex items-center gap-1 hover:underline transition-all" 
                      style={{ color: t.accentPrimary }}
                    >
                      <RotateCcw size={11} /> Reset Sample
                    </button>
                  </div>
                </div>
                <textarea 
                  value={jd} 
                  onChange={(e) => setJd(e.target.value)} 
                  rows={10} 
                  placeholder="Paste role requirements, responsibilities, technical stack, qualifications..."
                  className="w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none resize-y leading-relaxed font-sans" 
                  style={fieldStyle} 
                />
              </div>

              {/* Evaluation Strictness */}
              <div className="pt-3 border-t space-y-3" style={{ borderColor: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.35) }}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: t.txtMuted }}>
                    <Sliders size={14} style={{ color: t.accentPrimary }} />
                    <span>Evaluation Strictness Level</span>
                  </label>
                  <span className="text-xs capitalize font-bold px-2.5 py-0.5 rounded-full" 
                    style={{ background: hexToRgba(t.accentPrimary, 0.18), color: t.accentPrimary }}>
                    {strictness} Mode
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2.5 p-1.5 rounded-xl" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.6) }}>
                  {(["lenient", "moderate", "strict"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setStrictness(level)}
                      className="py-2.5 px-3 rounded-lg text-xs font-bold capitalize transition-all flex items-center justify-center gap-2"
                      style={{
                        background: strictness === level ? t.accentPrimary : "transparent",
                        color: strictness === level ? t.accentText : t.txtSecondary,
                        boxShadow: strictness === level ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.35)}` : "none"
                      }}
                    >
                      {level === "lenient" && <Sparkles size={14} />}
                      {level === "moderate" && <Sliders size={14} />}
                      {level === "strict" && <ShieldCheck size={14} />}
                      <span>{level}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-normal font-medium" style={{ color: t.txtMuted }}>
                  {strictness === "lenient" && "Lenient: Broader requirement matching with higher candidate inclusion and flexible skill overlap."}
                  {strictness === "moderate" && "Moderate: Balanced scoring based on core technical skills and experience overlap."}
                  {strictness === "strict" && "Strict: Uncompromising evaluation against all specified qualifications and experience thresholds."}
                </p>
              </div>

              {/* Hard Filters Section */}
              <div className="pt-3 border-t space-y-3" style={{ borderColor: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.35) }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: t.txtMuted }}>
                      <ShieldAlert size={14} style={{ color: t.accentPrimary }} />
                      <span>Hard Filters & Score Deductions</span>
                    </div>
                    <div className="text-xs mt-0.5 font-medium" style={{ color: t.txtSecondary }}>
                      {hardFilters.length === 0 ? "No hard filters defined (Optional)" : `${hardFilters.length} rule${hardFilters.length === 1 ? '' : 's'} active`}
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowFiltersModal(true)} 
                    className="text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 hover:opacity-90 shadow-sm" 
                    style={{ background: hexToRgba(t.accentPrimary, 0.18), color: t.accentPrimary }}
                  >
                    <Plus size={14} />
                    <span>Configure Rules</span>
                  </button>
                </div>

                {hardFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {hardFilters.map((hf, i) => {
                      const penInfo = getPenaltyInfo(hf.penalty);
                      return (
                        <div 
                          key={i} 
                          className="text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-2 border"
                          style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.8), borderColor: hexToRgba(t.txtGhost, 0.2), color: t.txtPrimary }}
                        >
                          <span>{hf.type === "skill" ? `Skill: ${hf.value || 'Unspecified'}` : `Min Exp: ${hf.value || '0'} yrs`}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: penInfo.bg, color: penInfo.color }}>
                            {penInfo.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Step 1 Continue Button */}
            <button 
              onClick={() => setStep(2)} 
              disabled={!title || !jd} 
              className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-[1.005]"
              style={{ 
                background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`, 
                color: t.accentText, 
                boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` 
              }}
            >
              <span>Continue to Resume Upload</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Right Column Context Panel */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Live Campaign Preview Card */}
            <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                <Target size={18} style={{ color: t.accentPrimary }} />
                <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: t.txtPrimary }}>
                  Live Campaign Overview
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.txtMuted }}>Role Title</div>
                  <div className="font-bold text-sm mt-0.5 truncate" style={{ color: title ? t.txtPrimary : t.txtGhost }}>
                    {title || "Untitled Role"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl border" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>JD Quality</div>
                    <div className="font-bold text-xs mt-1 flex items-center gap-1" style={{ color: wordCount >= 100 ? t.numPos : '#f59e0b' }}>
                      {wordCount >= 100 ? <CheckCircle2 size={13} /> : <Info size={13} />}
                      {wordCount >= 100 ? "Comprehensive" : "Brief (<100 words)"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>Strictness</div>
                    <div className="font-bold text-xs mt-1 capitalize" style={{ color: t.accentPrimary }}>
                      {strictness} Mode
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border" style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: t.txtMuted }}>Configured Filters</div>
                  <div className="font-semibold text-xs" style={{ color: t.txtSecondary }}>
                    {hardFilters.length === 0 ? "No hard filters applied" : `${hardFilters.length} filter rule(s) configured`}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Screening Engine Capabilities */}
            <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                <Cpu size={18} style={{ color: t.accentPrimary }} />
                <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: t.txtPrimary }}>
                  AI Screening Workflow
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold" 
                    style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}>
                    1
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: t.txtPrimary }}>Deep JD Vectorization</div>
                    <div className="text-[11px] mt-0.5" style={{ color: t.txtMuted }}>
                      Extracts required skills, experience thresholds, and domain responsibilities into high-dimensional embeddings.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold" 
                    style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}>
                    2
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: t.txtPrimary }}>Hard Rule Enforcement</div>
                    <div className="text-[11px] mt-0.5" style={{ color: t.txtMuted }}>
                      Automatically applies instant rejection or score penalties for missing mandatory qualifications.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold" 
                    style={{ background: hexToRgba(t.accentPrimary, 0.2), color: t.accentPrimary }}>
                    3
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: t.txtPrimary }}>Multi-Dimensional Scoring</div>
                    <div className="text-[11px] mt-0.5" style={{ color: t.txtMuted }}>
                      Evaluates technical alignment, project relevance, and overall role fit on a 0-100 scale.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Best Practices Tip Box */}
            <div className="rounded-2xl p-4 sm:p-5 border space-y-2" style={{ background: hexToRgba(t.accentPrimary, 0.08), borderColor: hexToRgba(t.accentPrimary, 0.25) }}>
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: t.accentPrimary }}>
                <HelpCircle size={15} />
                <span>Tips for High AI Accuracy</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: t.txtSecondary }}>
                Provide clear sections for <strong>Key Responsibilities</strong> and <strong>Required Qualifications</strong> in your JD to help the AI distinguish between mandatory vs. nice-to-have skills.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Resume Upload & Batch Launch */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Upload Left Column */}
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
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1 transition-transform"
                style={{ background: hexToRgba(t.accentPrimary, 0.18), color: t.accentPrimary, transform: dragging ? "scale(1.1)" : "scale(1)" }}>
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
                  <span key={ext} className="text-[10px] font-bold px-2.5 py-1 rounded-lg border" 
                    style={{ background: hexToRgba(t.txtGhost, 0.15), borderColor: hexToRgba(t.txtGhost, 0.2), color: t.txtSecondary }}>
                    {ext}
                  </span>
                ))}
              </div>
            </div>

            {/* Queued Files Card */}
            {uploadTasks.length > 0 && (
              <div className="rounded-2xl p-5 sm:p-6 space-y-4" style={G.card}>
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                  <div className="flex items-center gap-2">
                    <FileCheck size={16} style={{ color: t.accentPrimary }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.txtMuted }}>
                      {uploadTasks.length} {uploadTasks.length === 1 ? 'File' : 'Files'} Queued ({formatFileSize(totalFileSize)})
                    </span>
                  </div>
                  <button 
                    onClick={() => setUploadTasks([])} 
                    className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={13} /> Clear Batch
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {uploadTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="relative overflow-hidden flex items-center gap-3 rounded-xl px-3.5 py-3 border transition-all" 
                      style={{ 
                        background: hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.6),
                        borderColor: task.status === 'error' ? hexToRgba('#ef4444', 0.5) : hexToRgba(t.txtGhost, 0.18) 
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
                        <FileText size={16} style={{ color: t.accentPrimary }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: t.txtPrimary }}>{task.file.name}</div>
                          <div className="text-[10px]" style={{ color: t.txtMuted }}>{formatFileSize(task.file.size)}</div>
                        </div>
                        
                        {task.status === 'pending' && <span className="text-[10px] font-bold" style={{ color: t.txtMuted }}>Ready</span>}
                        {task.status === 'uploading' && <span className="text-[10px] font-bold" style={{ color: t.accentPrimary }}>{task.progress}%</span>}
                        {task.status === 'success' && <CheckCircle size={16} style={{ color: t.numPos }} />}
                        {task.status === 'error' && (
                          <div className="flex items-center gap-2">
                            <XCircle size={16} className="text-red-500" />
                            <button 
                              onClick={(e) => { e.stopPropagation(); uploadToCloudinaryWithProgress(task.id, task.file).catch(() => {}); }} 
                              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold transition-colors"
                              style={{ border: `1px solid ${hexToRgba('#ef4444', 0.4)}`, color: '#ef4444', background: hexToRgba('#ef4444', 0.1) }}
                            >
                              <RefreshCw size={10} /> Retry
                            </button>
                          </div>
                        )}
                        {task.status !== 'uploading' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setUploadTasks(prev => prev.filter(t => t.id !== task.id)); }} 
                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors" 
                            style={{ color: t.txtMuted }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
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
                disabled={uploadTasks.length === 0 || uploading} 
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.005]"
                style={{ 
                  background: uploadTasks.length > 0 ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})` : hexToRgba(t.bgCard, 0.2), 
                  color: uploadTasks.length > 0 ? t.accentText : t.txtGhost, 
                  boxShadow: uploadTasks.length > 0 ? `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` : "none", 
                  cursor: uploadTasks.length > 0 && !uploading ? "pointer" : "not-allowed" 
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
                ) : uploadTasks.some(t => t.status === 'error') ? "Retry Failed Uploads" : "Launch AI Campaign"}
              </button>
            </div>
          </div>

          {/* Right Column Summary & Pipeline Panel */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Batch Upload Summary Card */}
            <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                <Layers size={18} style={{ color: t.accentPrimary }} />
                <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: t.txtPrimary }}>
                  Batch Upload Status
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl border" 
                  style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                  <span className="font-semibold" style={{ color: t.txtMuted }}>Total Resumes Queued</span>
                  <span className="font-bold text-sm" style={{ color: t.accentPrimary }}>{uploadTasks.length} CVs</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl border" 
                  style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                  <span className="font-semibold" style={{ color: t.txtMuted }}>Combined File Payload</span>
                  <span className="font-bold" style={{ color: t.txtPrimary }}>{formatFileSize(totalFileSize)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl border" 
                  style={{ background: hexToRgba(t.bgPage, 0.4), borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                  <span className="font-semibold" style={{ color: t.txtMuted }}>Estimated AI Evaluation</span>
                  <span className="font-bold" style={{ color: t.txtPrimary }}>~{Math.max(1, Math.ceil(uploadTasks.length * 2.5))} seconds</span>
                </div>
              </div>
            </div>

            {/* AI Evaluation Pipeline Card */}
            <div className="rounded-2xl p-5 sm:p-6 space-y-4 border" style={G.card}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
                <Sparkles size={18} style={{ color: t.accentPrimary }} />
                <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: t.txtPrimary }}>
                  What Happens Next?
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <FileCode size={16} className="mt-0.5 shrink-0" style={{ color: t.accentPrimary }} />
                  <div>
                    <div className="font-bold" style={{ color: t.txtPrimary }}>1. Resume Storage & Parsing</div>
                    <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                      Resumes are uploaded to encrypted cloud storage and extracted into structured candidate profiles.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" style={{ color: t.accentPrimary }} />
                  <div>
                    <div className="font-bold" style={{ color: t.txtPrimary }}>2. Hard Filter Verification</div>
                    <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                      Candidate profiles are evaluated against configured mandatory skills and experience limits.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Cpu size={16} className="mt-0.5 shrink-0" style={{ color: t.accentPrimary }} />
                  <div>
                    <div className="font-bold" style={{ color: t.txtPrimary }}>3. LLM Candidate Scoring</div>
                    <div className="text-[11px] mt-0.5 leading-normal" style={{ color: t.txtMuted }}>
                      AI reasoning model generates detailed candidate breakdown, skill overlap scores, and interview question suggestions.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HARD FILTERS COMPLIANT MODAL */}
      {showFiltersModal && (
        <div 
          onClick={() => setShowFiltersModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4" 
          style={{ background: hexToRgba("#000", 0.6), backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl max-w-md w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden relative border" 
            style={{ background: t.bgCard, borderColor: hexToRgba(t.txtGhost, 0.2) }}
          >
            {/* Sticky Header */}
            <div className="shrink-0 z-10 p-5 border-b flex items-center justify-between" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: t.txtPrimary }}>Hard Filters & Penalties</h3>
                <p className="text-xs mt-0.5" style={{ color: t.txtSecondary }}>Define mandatory requirements and score deductions.</p>
              </div>
              <button 
                onClick={() => setShowFiltersModal(false)} 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors" 
                style={{ color: t.txtMuted }}
              >
                ✕
              </button>
            </div>
            
            {/* Independent Scroll Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {hardFilters.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Info size={28} className="mx-auto" style={{ color: t.txtMuted }} />
                  <div className="text-xs font-medium" style={{ color: t.txtSecondary }}>No filters configured.</div>
                  <p className="text-[11px] max-w-xs mx-auto leading-normal" style={{ color: t.txtMuted }}>
                    Define mandatory skills or min experience thresholds to penalize or reject unqualified applicants automatically.
                  </p>
                </div>
              ) : (
                hardFilters.map((hf, i) => (
                  <div 
                    key={i} 
                    className="p-3.5 rounded-xl space-y-2.5 border" 
                    style={{ background: hexToRgba(t.bgPage, 0.5), borderColor: hexToRgba(t.txtGhost, 0.15) }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <select 
                        value={hf.type} 
                        onChange={e => { const newHf = [...hardFilters]; newHf[i].type = e.target.value; setHardFilters(newHf); }} 
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none" 
                        style={{ ...fieldStyle, flex: 1 }}
                      >
                        <option value="skill">Mandatory Skill</option>
                        <option value="experience">Min Experience (Years)</option>
                      </select>

                      <button 
                        onClick={() => { const newHf = [...hardFilters]; newHf.splice(i, 1); setHardFilters(newHf); }} 
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        value={hf.value} 
                        onChange={e => { const newHf = [...hardFilters]; newHf[i].value = e.target.value; setHardFilters(newHf); }} 
                        placeholder={hf.type === "experience" ? "e.g. 3" : "e.g. Python, React"} 
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none flex-1" 
                        style={fieldStyle} 
                      />
                      <select 
                        value={hf.penalty} 
                        onChange={e => { const newHf = [...hardFilters]; newHf[i].penalty = e.target.value; setHardFilters(newHf); }} 
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none" 
                        style={{ ...fieldStyle, flex: 1.3 }}
                      >
                        <option value="reject">Completely Reject</option>
                        <option value="hard_penalize">Hard Penalize (-30)</option>
                        <option value="intermediate_penalize">Intermediate (-20)</option>
                        <option value="slight_penalize">Slight Penalize (-10)</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Fixed Footer */}
            <div className="shrink-0 z-10 p-4 border-t flex gap-2.5" style={{ borderColor: hexToRgba(t.txtGhost, 0.15), background: t.bgCard }}>
              <button 
                onClick={() => setHardFilters([...hardFilters, { type: "skill", value: "", penalty: "reject" }])} 
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1" 
                style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}
              >
                <Plus size={14} />
                <span>Add Filter</span>
              </button>
              <button 
                onClick={() => setShowFiltersModal(false)} 
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all" 
                style={{ background: t.accentPrimary, color: t.accentText }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
