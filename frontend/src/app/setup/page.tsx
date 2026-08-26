import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { queryClient } from "../queryClient";
import { CAMPAIGNS_QUERY_KEY } from "../../lib/hooks/useCampaigns";
import { useAuth } from "../../lib/AuthContext";
import { UpgradeModal } from "../dashboard/components/UpgradeModal";
import { 
  UploadTask, 
  HardFilter, 
  validateFile, 
  DEFAULT_TITLE, 
  DEFAULT_JD 
} from "./components/types";

import SetupHeader from "./components/SetupHeader";
import Step1Details from "./components/Step1Details";
import Step1Sidebar from "./components/Step1Sidebar";
import Step2Upload from "./components/Step2Upload";
import Step2Sidebar from "./components/Step2Sidebar";
import FiltersModal from "./components/FiltersModal";

export default function SetupPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [campaignId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [jd, setJd] = useState(DEFAULT_JD);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const uploadTasksRef = useRef<UploadTask[]>([]);

  useEffect(() => {
    uploadTasksRef.current = uploadTasks;
  }, [uploadTasks]);

  const [strictness, setStrictness] = useState<"lenient" | "moderate" | "strict">("moderate");
  const [hardFilters, setHardFilters] = useState<HardFilter[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const runWithConcurrencyLimit = async <T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<PromiseSettledResult<R>[]> => {
    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let index = 0;

    const worker = async () => {
      while (index < items.length) {
        const i = index++;
        try {
          const res = await fn(items[i]);
          results[i] = { status: 'fulfilled', value: res };
        } catch (err: any) {
          results[i] = { status: 'rejected', reason: err };
        }
      }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  };

  const uploadToR2Single = async (taskId: string, file: File): Promise<string> => {
    const val = validateFile(file);
    if (val.isError) {
      const errorMsg = val.reason || "Invalid file.";
      setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', progress: 0, errorReason: errorMsg } : t));
      throw new Error(errorMsg);
    }

    setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading', progress: 0 } : t));

    // Step A: Fetch presigned upload URL from backend with campaign folder isolation
    const contentType = file.type || "application/pdf";
    const presignedRes = await apiFetch(
      `/api/upload/presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(contentType)}&campaignId=${encodeURIComponent(campaignId)}`
    );
    if (!presignedRes.ok) {
      let errReason = `Presigned URL generation failed (${presignedRes.status})`;
      try {
        const errJson = await presignedRes.json();
        if (errJson.detail) errReason = errJson.detail;
      } catch (e) {}
      setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', errorReason: errReason } : t));
      throw new Error(errReason);
    }

    const { uploadUrl, fileUrl } = await presignedRes.json();

    // Step B: Direct PUT upload to Cloudflare R2 with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress: percentComplete } : t));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'success', progress: 100, url: fileUrl } : t));
          resolve(fileUrl);
        } else {
          const errReason = `R2 Upload failed (${xhr.status})`;
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', errorReason: errReason } : t));
          reject(new Error(errReason));
        }
      };

      xhr.onerror = () => {
        setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', errorReason: "Network upload error" } : t));
        reject(new Error("Network error during R2 upload"));
      };

      xhr.send(file);
    });
  };

  const uploadToR2WithProgress = async (taskId: string, file: File, maxRetries = 3): Promise<string> => {
    let attempt = 0;
    while (true) {
      try {
        return await uploadToR2Single(taskId, file);
      } catch (err: any) {
        attempt++;
        if (attempt <= maxRetries) {
          const delay = Math.pow(2, attempt) * 500 + Math.random() * 500;
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { 
            ...t, 
            status: 'uploading', 
            progress: 0, 
            errorReason: `Upload error. Retrying (${attempt}/${maxRetries}) in ${Math.round(delay/1000)}s...` 
          } : t));
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
  };

  const onComplete = async () => {
    if (!title || !jd || uploadTasks.length === 0) return;

    const currentTasks = uploadTasksRef.current;
    const validCurrentTasks = currentTasks.filter(t => t.status !== 'error' && t.file.size > 0);
    
    if (validCurrentTasks.length === 0) {
      alert("No valid CVs available to process. Please remove problematic files or add valid resumes.");
      return;
    }

    // Pre-flight quota & credit validation before R2 uploads
    if (profile?.plan === 'free') {
      if ((profile.totalCampaignsCreated ?? 0) >= 5) {
        alert("Free plan limit reached: maximum 5 campaigns allowed. Please upgrade to a paid plan.");
        setShowUpgradeModal(true);
        return;
      }
      if ((profile.totalCvsProcessed ?? 0) + validCurrentTasks.length > 100) {
        alert(`Free plan limit exceeded: maximum 100 CVs allowed (current: ${profile.totalCvsProcessed ?? 0}, requested: ${validCurrentTasks.length}). Please upgrade to a paid plan.`);
        setShowUpgradeModal(true);
        return;
      }
    } else if (profile) {
      const requiredCredits = 1 + validCurrentTasks.length;
      if ((profile.creditBalance ?? 0) < requiredCredits) {
        alert(`Insufficient credit balance. Required: ${requiredCredits} credits (1 for campaign + ${validCurrentTasks.length} for CVs), available: ${profile.creditBalance ?? 0} credits. Please purchase more credits.`);
        setShowUpgradeModal(true);
        return;
      }
    }

    setUploading(true);
    
    try {
      const activeTasks = uploadTasksRef.current;
      const tasksToUpload = activeTasks.filter(t => (t.status === 'pending' || t.status === 'error') && t.file.size > 0);
      
      const newlyUploadedUrls: Record<string, string> = {};
      if (tasksToUpload.length > 0) {
        // Concurrency limit of max 5 simultaneous uploads to Cloudflare R2
        const uploadResults = await runWithConcurrencyLimit(tasksToUpload, 5, async (t) => {
          const url = await uploadToR2WithProgress(t.id, t.file);
          return { id: t.id, url };
        });
        
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

      const validSuccessfulTasks = uploadTasksRef.current.filter(t => t.status === 'success' || newlyUploadedUrls[t.id]);
      const fileUrls = validSuccessfulTasks.map(t => t.url || newlyUploadedUrls[t.id]).filter((url): url is string => Boolean(url));

      if (fileUrls.length === 0) {
        setUploading(false);
        return;
      }

      const res = await apiFetch('/api/campaigns', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: campaignId,
          title,
          jobDescription: jd,
          resumes: fileUrls,
          hardFiltersConfig: hardFilters,
          enableInterviews: true,
          strictness
        })
      });

      if (!res.ok) {
        setUploading(false);
        const errJson = await res.json().catch(() => ({}));
        const detailMsg = errJson.detail || "Failed to launch campaign. Please check backend logs.";
        alert(detailMsg);
        if (res.status === 402) {
          setShowUpgradeModal(true);
        }
        return;
      }

      const data = await res.json();
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
      navigate(`/pipeline/${data.campaignId}`);
    } catch (err: any) {
      setUploading(false);
      alert(err.message || "An unexpected error occurred during campaign setup.");
    }
  };

  return (
    <div className="min-h-screen font-sans transition-colors duration-200" style={{ background: t.bgPage }}>
      <SetupHeader 
        theme={t} 
        step={step} 
        setStep={setStep} 
        title={title} 
        jd={jd} 
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: hexToRgba(t.txtGhost, 0.15) }}>
          <button 
            onClick={() => setStep(1)} 
            className={`flex items-center gap-2 text-sm font-bold transition-all px-3 py-1.5 rounded-lg ${step === 1 ? 'shadow-sm' : 'opacity-60 hover:opacity-100'}`}
            style={{ 
              background: step === 1 ? hexToRgba(t.accentPrimary, 0.15) : 'transparent',
              color: step === 1 ? t.accentPrimary : t.txtMuted 
            }}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black border" style={{ borderColor: step === 1 ? t.accentPrimary : t.txtMuted }}>1</span>
            <span>Campaign Details & JD</span>
          </button>
          
          <span className="text-xs font-black" style={{ color: t.txtGhost }}>➔</span>

          <button 
            disabled={!title || !jd}
            onClick={() => setStep(2)} 
            className={`flex items-center gap-2 text-sm font-bold transition-all px-3 py-1.5 rounded-lg ${step === 2 ? 'shadow-sm' : 'opacity-60 hover:opacity-100 disabled:opacity-30'}`}
            style={{ 
              background: step === 2 ? hexToRgba(t.accentPrimary, 0.15) : 'transparent',
              color: step === 2 ? t.accentPrimary : t.txtMuted 
            }}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black border" style={{ borderColor: step === 2 ? t.accentPrimary : t.txtMuted }}>2</span>
            <span>Resume Upload & Batch Launch</span>
          </button>
        </div>

        {/* STEP 1: Campaign Details & JD */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Step1Details 
              theme={t}
              title={title}
              setTitle={setTitle}
              jd={jd}
              setJd={setJd}
              strictness={strictness}
              setStrictness={setStrictness}
              hardFilters={hardFilters}
              setShowFiltersModal={setShowFiltersModal}
              onContinue={() => setStep(2)}
              profile={profile}
              onOpenUpgradeModal={() => setShowUpgradeModal(true)}
            />

            <Step1Sidebar 
              theme={t}
              title={title}
              wordCount={jd.trim() ? jd.trim().split(/\s+/).length : 0}
              strictness={strictness}
              hardFilters={hardFilters}
              profile={profile}
              onOpenUpgradeModal={() => setShowUpgradeModal(true)}
            />
          </div>
        )}

        {/* STEP 2: Resume Upload & Batch Launch */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Step2Upload 
              theme={t}
              uploadTasks={uploadTasks}
              setUploadTasks={setUploadTasks}
              uploading={uploading}
              setStep={setStep}
              onComplete={onComplete}
              uploadToR2WithProgress={uploadToR2WithProgress}
              profile={profile}
              onOpenUpgradeModal={() => setShowUpgradeModal(true)}
            />

            <Step2Sidebar 
              theme={t}
              uploadTasks={uploadTasks}
              profile={profile}
              onOpenUpgradeModal={() => setShowUpgradeModal(true)}
            />
          </div>
        )}
      </main>

      {/* Hard Filters Configuration Modal */}
      <FiltersModal 
        theme={t}
        showFiltersModal={showFiltersModal}
        setShowFiltersModal={setShowFiltersModal}
        hardFilters={hardFilters}
        setHardFilters={setHardFilters}
      />

      {/* Upgrade / Top Up Credits Modal */}
      <UpgradeModal
        theme={t}
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={async () => {
          await refreshProfile();
        }}
      />
    </div>
  );
}
