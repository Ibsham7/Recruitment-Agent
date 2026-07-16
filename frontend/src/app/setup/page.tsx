import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Check, Upload, FileText, CheckCircle, Loader2, XCircle, RefreshCw } from "lucide-react";
import { Theme } from "../../lib/types";
import { hexToRgba, getGlass } from "../../lib/theme";

interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
}

export default function SetupPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("AI Engineer (Applied ML & Agentic Systems)");
  const [jd, setJd] = useState(`We are looking for an AI Developer to design, build, and deploy intelligent applications and machine learning infrastructure. In this role, you will bridge the gap between advanced deep learning models and production-ready software. You will focus heavily on large language model (LLM) orchestration, multi-agent frameworks, and building the robust backend architecture required to support scalable AI features.
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
A strong mathematical foundation in vector calculus and linear algebra.`);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const uploadTasksRef = useRef<UploadTask[]>([]);

  useEffect(() => {
    uploadTasksRef.current = uploadTasks;
  }, [uploadTasks]);

  const [dragging, setDragging] = useState(false);
  const [enableInterviews, setEnableInterviews] = useState(true);
  const [interviewConfig, setInterviewConfig] = useState("");
  const [hardFilters, setHardFilters] = useState<{type: string, value: string, penalty: string}[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dbWakingUp, setDbWakingUp] = useState(false);
  
  const fieldStyle: React.CSSProperties = { color: t.txtBody, background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.55), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.80)}`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" };

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
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";
      
      if (!cloudName || !uploadPreset) {
        console.warn("Cloudinary env vars missing. Returning mock URL.");
        let p = 0;
        const interval = setInterval(() => {
          p += 20;
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading', progress: p } : t));
          if (p >= 100) {
            clearInterval(interval);
            setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'success', progress: 100, url: `https://mock.cloudinary.com/resumes/${file.name}` } : t));
            resolve(`https://mock.cloudinary.com/resumes/${file.name}`);
          }
        }, 300);
        return;
      }

      setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading', progress: 0 } : t));

      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
      
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
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
          reject(new Error("Upload failed"));
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
      // 0. Ensure database is awake (handle Supabase cold start)
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

      // 1. Upload pending/error files
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
          return; // UI will show error states, allow user to retry
        }

        uploadResults.forEach(r => {
          if (r.status === 'fulfilled') {
            newlyUploadedUrls[r.value.id] = r.value.url;
          }
        });
      }

      // 2. Get all file URLs
      const fileUrls = currentTasks.map(t => {
        if (t.status === 'success' && t.url) return t.url;
        return newlyUploadedUrls[t.id];
      });

      if (fileUrls.some(url => !url)) {
        setUploading(false);
        return;
      }

      // 3. Send payload to backend
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          jobDescription: jd,
          resumes: fileUrls,
          hardFiltersConfig: hardFilters,
          enableInterviews,
          interviewConfig
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

  return (
    <div className="max-w-xl mx-auto py-10 px-6">
      <div className="flex items-center gap-2 mb-10">
        {[1,2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
              style={{ background: step > s ? hexToRgba(t.numPos, 0.25) : step === s ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.70)})` : hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.45), color: step > s ? t.numPos : step === s ? t.accentText : t.txtGhost, boxShadow: step === s ? `0 2px 12px ${hexToRgba(t.accentPrimary, 0.35)}` : "none" }}>
              {step > s ? <Check size={12} /> : s}
            </div>
            <span className="text-xs font-medium" style={{ color: step >= s ? t.txtPrimary : t.txtGhost }}>{s === 1 ? "Job Details" : "Upload CVs"}</span>
            {s < 2 && <div className="w-8 h-px mx-1" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.30) }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>Create a new campaign</h2>
            <p className="text-sm" style={{ color: t.txtSecondary }}>Tell the AI what you are looking for.</p>
          </div>
          <div className="space-y-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: t.txtMuted }}>Job Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none" style={fieldStyle} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: t.txtMuted }}>Job Description</label><textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={7} className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none leading-relaxed" style={fieldStyle} /></div>
            
            <div className="rounded-2xl p-5 space-y-4" style={G.card}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>AI Interviews</div>
                  <div className="text-xs mt-1" style={{ color: t.txtSecondary }}>Enable to automatically conduct chat-based interviews after screening</div>
                </div>
                <button onClick={() => setEnableInterviews(!enableInterviews)} className="w-9 h-5 rounded-full relative flex-shrink-0 transition-all"
                  style={{ background: enableInterviews ? hexToRgba(t.progressFill, 0.65) : hexToRgba(t.bgCard, t.isDark ? 0.18 : 0.30), border: `1px solid ${hexToRgba(t.bgCard, 0.20)}`, boxShadow: enableInterviews ? `0 0 10px ${hexToRgba(t.progressFill, 0.35)}` : "none" }}>
                  <span className="w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all shadow-sm" style={{ left: enableInterviews ? "19px" : "2px", backgroundColor: enableInterviews ? "#fff" : t.txtGhost }} />
                </button>
              </div>
              
              {enableInterviews && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: t.txtMuted }}>Interview Focus & Custom Questions (Optional)</label>
                  <textarea value={interviewConfig} onChange={(e) => setInterviewConfig(e.target.value)} rows={3} placeholder="e.g. Ask the candidate to explain their most complex React project. Focus heavily on system design and cultural fit..." className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none leading-relaxed" style={fieldStyle} />
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={G.card}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>Hard Filters & Penalties</div>
                  <div className="text-xs mt-1" style={{ color: t.txtSecondary }}>
                    {hardFilters.length === 0 ? "No hard filters applied" : `${hardFilters.length} filter${hardFilters.length === 1 ? '' : 's'} applied`}
                  </div>
                </div>
                <button onClick={() => setShowFiltersModal(true)} className="text-[10px] font-semibold px-3 py-2 rounded-lg transition-colors" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>Configure Filters</button>
              </div>
              {hardFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {hardFilters.map((hf, i) => (
                    <div key={i} className="text-[10px] font-medium px-2 py-1 rounded-md" style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.2 : 0.8), border: `1px solid ${hexToRgba(t.txtGhost, 0.2)}`, color: t.txtPrimary }}>
                      {hf.type === "skill" ? `Skill: ${hf.value}` : `Exp: ${hf.value}yrs`} 
                      <span style={{ color: hf.penalty === "reject" ? "#ef4444" : "#eab308", marginLeft: 4 }}>
                        ({hf.penalty === "reject" ? "Reject" : hf.penalty.replace("_", " ")})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!title || !jd} className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})`, color: t.accentText, boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
            Continue to Upload CVs
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>Upload candidate CVs</h2>
            <p className="text-sm" style={{ color: t.txtSecondary }}>Upload PDFs — the AI will begin screening immediately.</p>
          </div>
          
          <input type="file" multiple accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
          
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleFileDrop} onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl p-12 text-center cursor-pointer transition-all border-2 border-dashed"
            style={{ borderColor: dragging ? hexToRgba(t.accentPrimary, 0.55) : hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.30), background: dragging ? hexToRgba(t.accentPrimary, 0.07) : hexToRgba(t.bgCard, t.isDark ? 0.06 : 0.22) }}>
            <Upload size={26} className="mx-auto mb-3" style={{ color: t.txtGhost }} />
            <div className="text-sm font-medium" style={{ color: t.txtPrimary }}>Drop PDF files here</div>
            <div className="text-xs mt-0.5" style={{ color: t.txtMuted }}>or click to browse — up to 100 files</div>
          </div>
          
          {uploadTasks.length > 0 && <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.txtMuted }}>{uploadTasks.length} Files Queued</div>
            {uploadTasks.map((task) => (
              <div key={task.id} className="relative overflow-hidden flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ ...G.card, border: task.status === 'error' ? `1px solid ${hexToRgba('#ef4444', 0.5)}` : G.card.border }}>
                {(task.status === 'uploading' || task.status === 'success') && (
                  <div 
                    className="absolute top-0 left-0 h-full transition-all duration-300 ease-out" 
                    style={{ 
                      width: `${task.progress}%`, 
                      background: hexToRgba(task.status === 'success' ? t.numPos : t.accentPrimary, 0.15),
                      zIndex: 0
                    }} 
                  />
                )}
                
                <div className="relative z-10 flex items-center w-full gap-3">
                  <FileText size={13} style={{ color: t.accentBadge }} />
                  <span className="text-xs flex-1 truncate" style={{ color: t.txtBody }}>{task.file.name}</span>
                  
                  {task.status === 'pending' && <span className="text-[10px]" style={{ color: t.txtMuted }}>Pending</span>}
                  {task.status === 'uploading' && <span className="text-[10px] font-medium" style={{ color: t.accentPrimary }}>{task.progress}%</span>}
                  {task.status === 'success' && <CheckCircle size={14} style={{ color: t.numPos }} />}
                  {task.status === 'error' && (
                     <div className="flex items-center gap-2">
                        <XCircle size={14} className="text-red-500" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); uploadToCloudinaryWithProgress(task.id, task.file).catch(() => {}); }} 
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors"
                          style={{ border: `1px solid ${hexToRgba('#ef4444', 0.3)}`, color: '#ef4444', background: hexToRgba('#ef4444', 0.1) }}>
                          <RefreshCw size={10} /> Retry
                        </button>
                     </div>
                  )}
                  {task.status !== 'uploading' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setUploadTasks(prev => prev.filter(t => t.id !== task.id)); }} 
                      className="text-[10px] ml-1 hover:opacity-70 transition-opacity" style={{ color: t.txtGhost }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>}
          
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} disabled={uploading} className="flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-50" style={{ ...G.card, color: t.txtSecondary }}>Back</button>
            <button onClick={onComplete} disabled={uploadTasks.length === 0 || uploading} className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: uploadTasks.length > 0 ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})` : hexToRgba(t.bgCard, 0.15), color: uploadTasks.length > 0 ? t.accentText : t.txtGhost, boxShadow: uploadTasks.length > 0 ? `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` : "none", cursor: uploadTasks.length > 0 && !uploading ? "pointer" : "not-allowed" }}>
              {uploading ? (
                dbWakingUp ? (
                  <><Loader2 size={16} className="animate-spin" /> Waking up database (takes ~30s)...</>
                ) : uploadTasks.some(t => t.status !== 'success') ? (
                  <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                ) : (
                  <><Loader2 size={16} className="animate-spin" /> Creating Campaign (Embedding JD)...</>
                )
              ) : uploadTasks.some(t => t.status === 'error') ? "Retry Failed Uploads" : "Launch Campaign"}
            </button>
          </div>
        </div>
      )}

      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: hexToRgba("#000", 0.5), backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl max-w-md w-full p-6 shadow-2xl relative" style={{ background: t.bgCard, border: `1px solid ${hexToRgba(t.txtGhost, 0.2)}` }}>
            <button onClick={() => setShowFiltersModal(false)} className="absolute top-4 right-4 text-xl hover:opacity-70 transition-opacity" style={{ color: t.txtGhost }}>✕</button>
            <h3 className="text-lg font-semibold mb-1" style={{ color: t.txtPrimary }}>Hard Filters & Penalties</h3>
            <p className="text-xs mb-6" style={{ color: t.txtSecondary }}>Define strict requirements and their consequences.</p>
            
            <div className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto pr-1">
              {hardFilters.length === 0 ? (
                <div className="text-sm text-center py-6" style={{ color: t.txtMuted }}>No filters added yet.</div>
              ) : (
                hardFilters.map((hf, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: hexToRgba(t.bgCard, 0.5), border: `1px solid ${hexToRgba(t.txtGhost, 0.1)}` }}>
                    <div className="flex gap-2">
                      <select value={hf.type} onChange={e => { const newHf = [...hardFilters]; newHf[i].type = e.target.value; setHardFilters(newHf); }} className="rounded-lg px-2 py-2 text-xs focus:outline-none" style={{...fieldStyle, flex: 1}}>
                        <option value="skill">Mandatory Skill</option>
                        <option value="experience">Min Experience (Years)</option>
                      </select>
                      <button onClick={() => { const newHf = [...hardFilters]; newHf.splice(i, 1); setHardFilters(newHf); }} className="text-xs px-2 py-1 hover:opacity-70 transition-opacity ml-auto rounded" style={{color: t.txtGhost, background: hexToRgba(t.txtGhost, 0.1)}}>Remove</button>
                    </div>
                    <div className="flex gap-2">
                      <input value={hf.value} onChange={e => { const newHf = [...hardFilters]; newHf[i].value = e.target.value; setHardFilters(newHf); }} placeholder={hf.type === "experience" ? "e.g. 3" : "e.g. Python, React"} className="rounded-lg px-2 py-2 text-xs focus:outline-none" style={{...fieldStyle, flex: 1}} />
                      <select value={hf.penalty} onChange={e => { const newHf = [...hardFilters]; newHf[i].penalty = e.target.value; setHardFilters(newHf); }} className="rounded-lg px-2 py-2 text-xs focus:outline-none" style={{...fieldStyle, flex: 1.5}}>
                        <option value="reject">Completely Reject</option>
                        <option value="hard_penalize">Hard Penalize (-30)</option>
                        <option value="intermediate_penalize">Intermediate Penalize (-20)</option>
                        <option value="slight_penalize">Slight Penalize (-10)</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setHardFilters([...hardFilters, {type: "skill", value: "", penalty: "reject"}])} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ background: hexToRgba(t.accentPrimary, 0.15), color: t.accentPrimary }}>+ Add Filter</button>
              <button onClick={() => setShowFiltersModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ background: t.accentPrimary, color: t.accentText }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
