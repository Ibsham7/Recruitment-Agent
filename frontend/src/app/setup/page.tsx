import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { apiFetch } from "../../lib/api";
import { queryClient } from "../queryClient";
import { CAMPAIGNS_QUERY_KEY } from "../../lib/hooks/useCampaigns";
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
  const [uploading, setUploading] = useState(false);
  const [dbWakingUp, setDbWakingUp] = useState(false);

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

  const uploadToCloudinarySingle = (taskId: string, file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const val = validateFile(file);
      if (val.isError) {
        const errorMsg = val.reason || "Invalid file.";
        setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', progress: 0, errorReason: errorMsg } : t));
        reject(new Error(errorMsg));
        return;
      }

      const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();
      const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "").trim();
      
      if (!cloudName || !uploadPreset) {
        const errorMsg = "Cloudinary upload credentials missing (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).";
        console.error(errorMsg);
        setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', progress: 0, errorReason: "Cloudinary config missing" } : t));
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
            setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', errorReason: "Invalid server response" } : t));
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
          
          const isRateLimit = xhr.status === 429 || errDetail.toLowerCase().includes("slow down") || errDetail.toLowerCase().includes("capacity");
          const finalReason = isRateLimit ? "Cloudinary rate limit (429)" : errDetail;
          
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', errorReason: finalReason } : t));
          
          const errObj = new Error(finalReason);
          (errObj as any).isRateLimit = isRateLimit;
          (errObj as any).status = xhr.status;
          reject(errObj);
        }
      };

      xhr.onerror = () => {
        setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', errorReason: "Network upload error" } : t));
        reject(new Error("Network error during upload"));
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      xhr.send(formData);
    });
  };

  const uploadToCloudinaryWithProgress = async (taskId: string, file: File, maxRetries = 3): Promise<string> => {
    let attempt = 0;
    while (true) {
      try {
        return await uploadToCloudinarySingle(taskId, file);
      } catch (err: any) {
        attempt++;
        if (attempt <= maxRetries && (err?.isRateLimit || err?.status === 429 || (err?.message && err.message.toLowerCase().includes("slow down")))) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { 
            ...t, 
            status: 'uploading', 
            progress: 0, 
            errorReason: `Rate limited. Retrying (${attempt}/${maxRetries}) in ${Math.round(delay/1000)}s...` 
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

    // Filter only valid (non-error and non-0 B) tasks for upload
    const currentTasks = uploadTasksRef.current;
    const validCurrentTasks = currentTasks.filter(t => t.status !== 'error' && t.file.size > 0);
    
    if (validCurrentTasks.length === 0) {
      alert("No valid CVs available to process. Please remove problematic files or add valid resumes.");
      return;
    }

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

      const activeTasks = uploadTasksRef.current;
      const tasksToUpload = activeTasks.filter(t => (t.status === 'pending' || t.status === 'error') && t.file.size > 0);
      
      const newlyUploadedUrls: Record<string, string> = {};
      if (tasksToUpload.length > 0) {
        // Concurrency limit of max 2 simultaneous uploads to Cloudinary
        const uploadResults = await runWithConcurrencyLimit(tasksToUpload, 2, async (t) => {
          const url = await uploadToCloudinaryWithProgress(t.id, t.file);
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
      
      await queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      alert("An error occurred during upload or campaign creation.");
      setUploading(false);
    }
  };

  const wordCount = jd.trim() ? jd.trim().split(/\s+/).length : 0;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Bar */}
      <SetupHeader 
        theme={t} 
        step={step} 
        setStep={setStep} 
        title={title} 
        jd={jd} 
      />

      {/* STEP 1: Job Details & Evaluation Criteria */}
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
          />

          <Step1Sidebar 
            theme={t}
            title={title}
            wordCount={wordCount}
            strictness={strictness}
            hardFilters={hardFilters}
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
            dbWakingUp={dbWakingUp}
            setStep={setStep}
            onComplete={onComplete}
            uploadToCloudinaryWithProgress={uploadToCloudinaryWithProgress}
          />

          <Step2Sidebar 
            theme={t}
            uploadTasks={uploadTasks}
          />
        </div>
      )}

      {/* Hard Filters Configuration Modal */}
      <FiltersModal 
        theme={t}
        showFiltersModal={showFiltersModal}
        setShowFiltersModal={setShowFiltersModal}
        hardFilters={hardFilters}
        setHardFilters={setHardFilters}
      />
    </div>
  );
}
