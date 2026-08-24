import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  HelpCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Cpu, 
  Video, 
  Layers, 
  Building2, 
  Send, 
  Check, 
  BookOpen,
  Clock,
  Mail,
  User,
  FileText
} from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

interface FaqQuestionWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
}

export interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  snippet: string;
  tags: string[];
}

const CATEGORIES = [
  {
    id: "Screening Engine",
    title: "Screening & Evaluation",
    desc: "Resume parsing, embedding matching, hard filters, scoring strictness",
    icon: Cpu,
  },
  {
    id: "Interview Workflows",
    title: "Candidate Experience & Interviews",
    desc: "Voice/text interviews, dynamic questions, anti-cheat security",
    icon: Video,
  },
  {
    id: "Data Privacy & Security",
    title: "Data Privacy & Security",
    desc: "GDPR compliance, tenant isolation, RLS, encryption",
    icon: ShieldCheck,
  },
  {
    id: "System Integration & API",
    title: "API & ATS Integration",
    desc: "Greenhouse, Lever, Workday sync, custom webhooks, REST API",
    icon: Layers,
  },
  {
    id: "Enterprise Onboarding",
    title: "Enterprise & High-Volume",
    desc: "Dedicated SLA, volume scaling, custom AI model prompts",
    icon: Building2,
  },
];

const URGENCY_LEVELS = [
  { id: "low", label: "Low / General Inquiry", color: "#10b981" },
  { id: "medium", label: "Medium / Active Project", color: "#3b82f6" },
  { id: "high", label: "High / Planning Deployment", color: "#f59e0b" },
  { id: "critical", label: "Critical / Enterprise SLA", color: "#ef4444" },
];

const VOLUME_OPTIONS = ["1-50 candidates/mo", "50-500 candidates/mo", "500+ candidates/mo"];

export function FaqQuestionWizardModal({ isOpen, onClose, theme: t }: FaqQuestionWizardModalProps) {
  const [step, setStep] = useState<number>(1);
  
  // Form State
  const [category, setCategory] = useState<string>("Screening Engine");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [solvedByKb, setSolvedByKb] = useState<boolean>(false);
  
  const [question, setQuestion] = useState<string>("");
  const [contextDetails, setContextDetails] = useState<string>("");
  const [urgency, setUrgency] = useState<string>("medium");
  const [candidateVolume, setCandidateVolume] = useState<string>("50-500 candidates/mo");
  
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [preferredContact, setPreferredContact] = useState<string>("email");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submissionId, setSubmissionId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Keyboard dismiss & Scroll lock handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Live Knowledge Search Trigger
  useEffect(() => {
    if (!isOpen || step !== 2) return;

    const controller = new AbortController();
    const fetchKnowledge = async () => {
      setIsSearching(true);
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
        const res = await fetch(`${backendUrl}/api/faqs/search-knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, category }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        } else {
          // Fallback static search if backend endpoint unavailable
          setSearchResults(getFallbackKnowledge(searchQuery, category));
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setSearchResults(getFallbackKnowledge(searchQuery, category));
        }
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchKnowledge, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, category, step, isOpen]);

  const resetForm = () => {
    setStep(1);
    setCategory("Screening Engine");
    setSearchQuery("");
    setSearchResults([]);
    setSolvedByKb(false);
    setQuestion("");
    setContextDetails("");
    setUrgency("medium");
    setCandidateVolume("50-500 candidates/mo");
    setName("");
    setEmail("");
    setCompany("");
    setRole("");
    setPreferredContact("email");
    setIsSubmitting(false);
    setIsSubmitted(false);
    setSubmissionId("");
    setErrorMessage("");
  };

  const handleClose = () => {
    onClose();
    setTimeout(resetForm, 300);
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setErrorMessage("Please enter your question.");
      setStep(3);
      return;
    }
    if (!name.trim() || !email.trim() || !email.includes("@")) {
      setErrorMessage("Please provide a valid name and email address.");
      setStep(4);
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const payload = {
        category,
        question: question.trim(),
        contextDetails: contextDetails.trim() || null,
        company: company.trim() || null,
        role: role.trim() || null,
        candidateVolume,
        urgency,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        preferredContact,
      };

      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/faqs/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to submit question. Please try again.");
      }

      const data = await res.json();
      setSubmissionId(data.id || `FAQ-${Math.floor(100000 + Math.random() * 900000)}`);
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try submitting again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        background: hexToRgba("#000000", 0.70),
        backdropFilter: "blur(8px)",
      }}
      onClick={handleClose}
    >
      {/* Dialog Box Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-2xl h-[88vh] max-h-[720px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden relative"
        style={{
          background: t.isDark ? "#12131a" : "#ffffff",
          borderColor: hexToRgba(t.accentPrimary, 0.3),
          color: t.txtPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── STICKY HEADER & FIXED CONTROLS ───────────────────────────────── */}
        <div 
          className="shrink-0 z-10 px-6 py-4 border-b flex items-center justify-between"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.95 : 0.98),
            borderColor: hexToRgba(t.txtBody, 0.10),
            backdropFilter: "blur(12px)"
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm"
              style={{
                background: hexToRgba(t.accentPrimary, 0.15),
                color: t.accentPrimary,
                border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`
              }}
            >
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight" style={{ color: t.txtPrimary }}>
                Ask Architecture & Workflow Specialist
              </h3>
              <p className="text-xs" style={{ color: t.txtSecondary }}>
                Step {step} of 5: {getStepTitle(step)}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-xl transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            style={{ color: t.txtGhost }}
            title="Close dialog (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── STEP PROGRESS BAR ────────────────────────────────────────────── */}
        <div className="w-full bg-black/10 dark:bg-white/10 h-1 shrink-0">
          <motion.div 
            className="h-full transition-all duration-300"
            style={{
              width: `${(step / 5) * 100}%`,
              background: `linear-gradient(90deg, ${t.accentPrimary}, ${t.accentBadge})`
            }}
          />
        </div>

        {/* ── INDEPENDENT SCROLL BODY ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {errorMessage && (
            <div 
              className="p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2"
              style={{
                background: hexToRgba("#ef4444", 0.12),
                borderColor: hexToRgba("#ef4444", 0.30),
                color: "#ef4444"
              }}
            >
              <HelpCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SUCCESS CONFIRMATION SCREEN */}
          {isSubmitted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center py-8 space-y-5"
            >
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 shadow-lg"
              >
                <Check size={32} />
              </div>

              <div className="space-y-2 max-w-md">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Question Stored Successfully
                </span>
                <h4 className="text-xl font-bold" style={{ color: t.txtPrimary }}>
                  Inquiry Ticket #{submissionId}
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>
                  Thank you, <strong style={{ color: t.txtPrimary }}>{name}</strong>! Your question regarding{" "}
                  <strong style={{ color: t.accentPrimary }}>{category}</strong> has been saved to our database.
                  Our team will review your context and reach out via <strong className="capitalize">{preferredContact}</strong>.
                </p>
              </div>

              <div 
                className="w-full max-w-md p-4 rounded-2xl border text-left text-xs space-y-2"
                style={{
                  background: hexToRgba(t.bgCard, t.isDark ? 0.25 : 0.60),
                  borderColor: hexToRgba(t.txtBody, 0.10)
                }}
              >
                <div className="flex justify-between text-slate-400">
                  <span>Category:</span>
                  <span className="font-semibold" style={{ color: t.txtPrimary }}>{category}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Urgency:</span>
                  <span className="font-semibold uppercase" style={{ color: t.txtPrimary }}>{urgency}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Contact Email:</span>
                  <span className="font-semibold" style={{ color: t.txtPrimary }}>{email}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background: hexToRgba(t.txtBody, 0.05),
                    borderColor: hexToRgba(t.txtBody, 0.12),
                    color: t.txtPrimary
                  }}
                >
                  Ask Another Question
                </button>
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`,
                    color: t.accentText,
                    boxShadow: `0 4px 14px ${hexToRgba(t.accentPrimary, 0.35)}`
                  }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* STEP 1: CATEGORY & DOMAIN SELECTION */}
              {step === 1 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <h4 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                      1. Select Your Inquiry Domain
                    </h4>
                    <p className="text-xs" style={{ color: t.txtSecondary }}>
                      Choose the primary topic area you'd like to explore or ask about.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;

                      return (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className="w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 group cursor-pointer"
                          style={{
                            background: isSelected 
                              ? hexToRgba(t.accentPrimary, 0.12) 
                              : hexToRgba(t.bgCard, t.isDark ? 0.15 : 0.40),
                            borderColor: isSelected 
                              ? t.accentPrimary 
                              : hexToRgba(t.txtBody, 0.08),
                            boxShadow: isSelected ? `0 4px 16px ${hexToRgba(t.accentPrimary, 0.15)}` : "none"
                          }}
                        >
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              background: isSelected ? t.accentPrimary : hexToRgba(t.txtBody, 0.06),
                              color: isSelected ? t.accentText : t.txtSecondary
                            }}
                          >
                            <Icon size={20} />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold" style={{ color: t.txtPrimary }}>
                                {cat.title}
                              </span>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: t.accentPrimary, color: t.accentText }}>
                                  ✓
                                </span>
                              )}
                            </div>
                            <p className="text-xs mt-1" style={{ color: t.txtSecondary }}>
                              {cat.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: INTERACTIVE KNOWLEDGE BASE & LIVE SEARCH */}
              {step === 2 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                        2. Search & Research Knowledge Base
                      </h4>
                      <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full" style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}>
                        {category}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: t.txtSecondary }}>
                      Search existing documentation or check instantly matching architecture specs before posting.
                    </p>
                  </div>

                  {/* Live Search Bar */}
                  <div 
                    className="relative flex items-center p-1.5 rounded-2xl border"
                    style={{
                      background: hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.60),
                      borderColor: hexToRgba(t.accentPrimary, 0.30)
                    }}
                  >
                    <Search size={16} className="ml-3" style={{ color: t.txtGhost }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${category} topics, specs, privacy...`}
                      className="w-full px-3 py-2 bg-transparent text-xs outline-none"
                      style={{ color: t.txtPrimary }}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="mr-2 p-1 rounded-full text-xs opacity-60 hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Solved by KB Banner */}
                  {solvedByKb ? (
                    <div 
                      className="p-5 rounded-2xl border text-center space-y-3"
                      style={{
                        background: hexToRgba("#10b981", 0.10),
                        borderColor: hexToRgba("#10b981", 0.30),
                      }}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto text-emerald-400 bg-emerald-500/20">
                        <CheckCircle2 size={22} />
                      </div>
                      <h5 className="text-sm font-bold text-emerald-400">
                        Glad that answered your question!
                      </h5>
                      <p className="text-xs" style={{ color: t.txtSecondary }}>
                        You can close this wizard or continue if you still want to send a custom context inquiry.
                      </p>
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={handleClose}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          Close Wizard
                        </button>
                        <button
                          onClick={() => setSolvedByKb(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold border"
                          style={{ borderColor: hexToRgba(t.txtBody, 0.2), color: t.txtPrimary }}
                        >
                          I Still Need More Help →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs" style={{ color: t.txtGhost }}>
                        <span>Matching Knowledge Articles ({searchResults.length}):</span>
                        {isSearching && <span className="animate-pulse">Searching...</span>}
                      </div>

                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {searchResults.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-2xl border transition-all space-y-2"
                            style={{
                              background: hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.40),
                              borderColor: hexToRgba(t.txtBody, 0.08),
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="text-xs font-bold leading-snug" style={{ color: t.txtPrimary }}>
                                <BookOpen size={13} className="inline mr-1.5" style={{ color: t.accentPrimary }} />
                                {item.title}
                              </h5>
                              <button
                                onClick={() => setSolvedByKb(true)}
                                className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all hover:scale-105"
                                style={{
                                  background: hexToRgba(t.accentPrimary, 0.12),
                                  borderColor: hexToRgba(t.accentPrimary, 0.25),
                                  color: t.accentPrimary,
                                }}
                              >
                                Answers My Question
                              </button>
                            </div>

                            <p className="text-xs leading-relaxed" style={{ color: t.txtSecondary }}>
                              {item.snippet}
                            </p>

                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {item.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-mono px-2 py-0.5 rounded-md"
                                  style={{
                                    background: hexToRgba(t.txtBody, 0.06),
                                    color: t.txtGhost,
                                  }}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}

                        {searchResults.length === 0 && !isSearching && (
                          <div 
                            className="p-6 rounded-2xl border text-center text-xs"
                            style={{
                              background: hexToRgba(t.bgCard, t.isDark ? 0.08 : 0.20),
                              borderColor: hexToRgba(t.txtBody, 0.08),
                              color: t.txtSecondary
                            }}
                          >
                            No existing article matches your search query. Proceed to Step 3 to submit your custom question!
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* STEP 3: QUESTION & TECHNICAL CONTEXT COMPOSITION */}
              {step === 3 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <h4 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                      3. Compose Your Question & Technical Context
                    </h4>
                    <p className="text-xs" style={{ color: t.txtSecondary }}>
                      Provide specific details about your workflow, requirements, or architecture setup.
                    </p>
                  </div>

                  {/* Main Question Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                      <HelpCircle size={14} style={{ color: t.accentPrimary }} />
                      Primary Question <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g. How does the candidate scoring engine handle non-standard resume formats?"
                      className="w-full p-3 rounded-xl border text-xs bg-transparent outline-none transition-colors"
                      style={{
                        borderColor: hexToRgba(t.txtBody, 0.15),
                        color: t.txtPrimary
                      }}
                    />
                  </div>

                  {/* Deep Context Details */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                      <FileText size={14} style={{ color: t.accentPrimary }} />
                      Workflow / Technical Context (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={contextDetails}
                      onChange={(e) => setContextDetails(e.target.value)}
                      placeholder="Describe your target hiring volume, current ATS, candidate volume, or specific compliance constraints..."
                      className="w-full p-3 rounded-xl border text-xs bg-transparent outline-none transition-colors resize-none"
                      style={{
                        borderColor: hexToRgba(t.txtBody, 0.15),
                        color: t.txtPrimary
                      }}
                    />
                  </div>

                  {/* Candidate Volume Pills */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
                      Estimated Hiring Volume
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {VOLUME_OPTIONS.map((vol) => {
                        const isSelected = candidateVolume === vol;
                        return (
                          <button
                            key={vol}
                            type="button"
                            onClick={() => setCandidateVolume(vol)}
                            className="p-2.5 rounded-xl border text-[11px] font-medium transition-all text-center"
                            style={{
                              background: isSelected ? hexToRgba(t.accentPrimary, 0.15) : "transparent",
                              borderColor: isSelected ? t.accentPrimary : hexToRgba(t.txtBody, 0.10),
                              color: isSelected ? t.accentPrimary : t.txtSecondary
                            }}
                          >
                            {vol}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Urgency Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: t.txtPrimary }}>
                      <Clock size={14} style={{ color: t.accentPrimary }} />
                      Deployment Timeline / Urgency
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {URGENCY_LEVELS.map((u) => {
                        const isSelected = urgency === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setUrgency(u.id)}
                            className="p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all"
                            style={{
                              background: isSelected ? hexToRgba(u.color, 0.15) : "transparent",
                              borderColor: isSelected ? u.color : hexToRgba(t.txtBody, 0.10),
                              color: isSelected ? u.color : t.txtSecondary
                            }}
                          >
                            <span>{u.label}</span>
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0 ml-1"
                              style={{ background: u.color }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: CONTACT INFORMATION & PREFERENCES */}
              {step === 4 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <h4 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                      4. Your Contact Details & Follow-up Preferences
                    </h4>
                    <p className="text-xs" style={{ color: t.txtSecondary }}>
                      Where should our architecture team send your answer or technical analysis?
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Full Name */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold flex items-center gap-1" style={{ color: t.txtPrimary }}>
                        <User size={13} style={{ color: t.accentPrimary }} /> Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Sarah Jenkins"
                        className="w-full p-2.5 rounded-xl border text-xs bg-transparent outline-none"
                        style={{ borderColor: hexToRgba(t.txtBody, 0.15), color: t.txtPrimary }}
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold flex items-center gap-1" style={{ color: t.txtPrimary }}>
                        <Mail size={13} style={{ color: t.accentPrimary }} /> Work Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="sarah@company.com"
                        className="w-full p-2.5 rounded-xl border text-xs bg-transparent outline-none"
                        style={{ borderColor: hexToRgba(t.txtBody, 0.15), color: t.txtPrimary }}
                      />
                    </div>

                    {/* Company */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold flex items-center gap-1" style={{ color: t.txtPrimary }}>
                        <Building2 size={13} style={{ color: t.accentPrimary }} /> Company Name
                      </label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Acme Talent Solutions"
                        className="w-full p-2.5 rounded-xl border text-xs bg-transparent outline-none"
                        style={{ borderColor: hexToRgba(t.txtBody, 0.15), color: t.txtPrimary }}
                      />
                    </div>

                    {/* Role */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
                        Job Title / Role
                      </label>
                      <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Head of Talent Acquisition"
                        className="w-full p-2.5 rounded-xl border text-xs bg-transparent outline-none"
                        style={{ borderColor: hexToRgba(t.txtBody, 0.15), color: t.txtPrimary }}
                      />
                    </div>
                  </div>

                  {/* Preferred Follow-up Channel */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-semibold" style={{ color: t.txtPrimary }}>
                      Preferred Response Format
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "email", label: "Email Brief", icon: Mail },
                        { id: "call", label: "Live Demo Call", icon: Video },
                        { id: "async", label: "Async Loom Brief", icon: Send }
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = preferredContact === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPreferredContact(item.id)}
                            className="p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all"
                            style={{
                              background: isSelected ? hexToRgba(t.accentPrimary, 0.15) : "transparent",
                              borderColor: isSelected ? t.accentPrimary : hexToRgba(t.txtBody, 0.10),
                              color: isSelected ? t.accentPrimary : t.txtSecondary
                            }}
                          >
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: REVIEW & SUBMIT */}
              {step === 5 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <h4 className="text-base font-bold" style={{ color: t.txtPrimary }}>
                      5. Review & Confirm Submission
                    </h4>
                    <p className="text-xs" style={{ color: t.txtSecondary }}>
                      Review your inquiry summary before storing it in our database.
                    </p>
                  </div>

                  <div 
                    className="p-5 rounded-2xl border space-y-3.5 text-xs"
                    style={{
                      background: hexToRgba(t.bgCard, t.isDark ? 0.20 : 0.60),
                      borderColor: hexToRgba(t.accentPrimary, 0.25)
                    }}
                  >
                    <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: hexToRgba(t.txtBody, 0.10) }}>
                      <span className="font-semibold text-slate-400">Inquiry Domain:</span>
                      <span className="font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono" style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}>
                        {category}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold text-slate-400">Question:</span>
                      <p className="font-medium p-2.5 rounded-xl border" style={{ background: hexToRgba(t.txtBody, 0.03), borderColor: hexToRgba(t.txtBody, 0.08), color: t.txtPrimary }}>
                        "{question}"
                      </p>
                    </div>

                    {contextDetails && (
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-400">Workflow Context:</span>
                        <p className="text-slate-300 italic">
                          {contextDetails}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1 text-slate-400">
                      <div>Contact: <strong style={{ color: t.txtPrimary }}>{name}</strong> ({email})</div>
                      <div>Company: <strong style={{ color: t.txtPrimary }}>{company || "N/A"}</strong></div>
                      <div>Volume: <strong style={{ color: t.txtPrimary }}>{candidateVolume}</strong></div>
                      <div>Urgency: <strong className="uppercase" style={{ color: t.txtPrimary }}>{urgency}</strong></div>
                    </div>
                  </div>


                </motion.div>
              )}
            </>
          )}
        </div>

        {/* ── STICKY ACTION FOOTER ────────────────────────────────────────── */}
        {!isSubmitted && (
          <div 
            className="shrink-0 z-10 px-6 py-4 border-t flex items-center justify-between"
            style={{
              background: hexToRgba(t.bgCard, t.isDark ? 0.95 : 0.98),
              borderColor: hexToRgba(t.txtBody, 0.10)
            }}
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setErrorMessage(""); setStep(step - 1); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all"
                style={{
                  background: hexToRgba(t.txtBody, 0.05),
                  borderColor: hexToRgba(t.txtBody, 0.10),
                  color: t.txtSecondary
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              {step < 5 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 3 && !question.trim()) {
                      setErrorMessage("Please enter your question before continuing.");
                      return;
                    }
                    if (step === 4 && (!name.trim() || !email.trim() || !email.includes("@"))) {
                      setErrorMessage("Please enter a valid name and email address.");
                      return;
                    }
                    setErrorMessage("");
                    setStep(step + 1);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`,
                    color: t.accentText,
                    boxShadow: `0 4px 14px ${hexToRgba(t.accentPrimary, 0.35)}`
                  }}
                >
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`,
                    color: t.accentText,
                    boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.40)}`
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Saving Question...
                    </>
                  ) : (
                    <>
                      Submit Question <Send size={15} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function getStepTitle(step: number): string {
  switch (step) {
    case 1: return "Select Inquiry Domain";
    case 2: return "Research Knowledge Base";
    case 3: return "Compose Question Details";
    case 4: return "Contact Info & Preferences";
    case 5: return "Review & Confirm";
    default: return "";
  }
}

function getFallbackKnowledge(query: string, category: string): KnowledgeItem[] {
  const all: KnowledgeItem[] = [
    {
      id: "kb-1",
      category: "Screening Engine",
      title: "Multi-Criteria Resume & Profile Evaluation Engine",
      snippet: "hireagent utilizes LLM embeddings and deterministic hard filters to evaluate candidates against custom job descriptions with configurable strictness levels (lenient, moderate, strict).",
      tags: ["Screening", "Algorithms", "Scoring", "Strictness"]
    },
    {
      id: "kb-2",
      category: "Interview Workflows",
      title: "Dynamic Voice & Text Conversational Assessments",
      snippet: "Candidates receive securely tokenized invitations to complete interactive video/audio or text assessments. Questions adapt in real-time based on candidate responses.",
      tags: ["Interviews", "Adaptive Questions", "Candidate Experience"]
    },
    {
      id: "kb-3",
      category: "Data Privacy & Security",
      title: "SOC2 & GDPR Enterprise Privacy Standards",
      snippet: "All candidate data and resume embeddings are encrypted at rest and in transit. Supabase Row-Level Security (RLS) guarantees complete tenant isolation.",
      tags: ["Security", "GDPR", "Encryption", "RLS"]
    },
    {
      id: "kb-4",
      category: "System Integration & API",
      title: "ATS Synchronization & Custom Webhook Hooks",
      snippet: "Integrate seamlessly with Greenhouse, Lever, Workday, and custom backend systems via REST API endpoints and webhooks for status callbacks.",
      tags: ["API", "ATS", "Webhooks", "Integration"]
    },
    {
      id: "kb-5",
      category: "Enterprise Onboarding",
      title: "High-Volume Pipeline Automation & SLA",
      snippet: "Built for scale, hireagent processes thousands of applicants concurrently with distributed queue workers and dedicated priority infrastructure.",
      tags: ["Enterprise", "High-Volume", "SLA", "Workers"]
    }
  ];

  const q = (query || "").toLowerCase();
  return all.filter((item) => {
    const catMatch = !category || item.category === category;
    if (!q) return catMatch;
    const titleMatch = item.title.toLowerCase().includes(q);
    const snippetMatch = item.snippet.toLowerCase().includes(q);
    const tagMatch = item.tags.some((t) => t.toLowerCase().includes(q));
    return catMatch && (titleMatch || snippetMatch || tagMatch);
  });
}
