import { 
  FileText, 
  Bot, 
  MessageSquareText, 
  CheckCircle,
  LayoutGrid,
  Target,
  ShieldCheck,
  UserCheck,
  SlidersHorizontal,
  Zap,
  Lock,
  HelpCircle,
  LucideIcon,
  FileCheck2,
  ShieldAlert,
  CalendarClock,
  MessageSquareCode,
  FileSearch
} from "lucide-react";

export interface LandingStep {
  num: number;
  badge: string;
  title: string;
  body: string;
  icon: LucideIcon;
  url: string;
  image: string;
  tags: string[];
  highlight: string;
}

export interface MetricSpec {
  label: string;
  value: string;
  tone: "pos" | "neg" | "mid" | "accent";
}

export interface ViewportTag {
  text: string;
  tone: "pos" | "neg" | "mid" | "accent";
}

export interface LandingDeckFeature {
  id: string;
  number: string;
  category: string;
  icon: LucideIcon;
  title: string;
  pillTitle: string;
  description: string;
  metrics: [MetricSpec, MetricSpec];
  viewport: {
    file: string;
    tag: ViewportTag;
    type: 
      | "verbatim-quote" 
      | "anti-cheat" 
      | "timeline-math" 
      | "ai-interviews" 
      | "radar-rubric" 
      | "adaptive-probing" 
      | "strictness-presets" 
      | "vision-ocr" 
      | "live-pipeline" 
      | "keyword-stuffer";
  };
}

export interface LandingStat {
  value: string;
  label: string;
}

export interface LandingFaq {
  category: string;
  q: string;
  a: string;
}

export const landingSteps: LandingStep[] = [
  { 
    num: 1, 
    badge: "Step 01",
    title: "Post a Campaign", 
    body: "Define job requirements, mandatory experience, and custom hard rules. hireagent instantly constructs your automated screening pipeline.", 
    icon: FileText,
    url: "app.hireagent.ai/setup",
    image: "/process/step-1.png",
    tags: ["JD Parsing", "Hard-Filter Rules", "Pipeline Setup"],
    highlight: "Zero LLM Cost Filtering"
  },
  { 
    num: 2, 
    badge: "Step 02",
    title: "Multi-Tier AI Funnel", 
    body: "PyMuPDF parsing, Python hard filters, pgvector semantic search (1536d), and Gemini Flash JD scoring screen applications in seconds.", 
    icon: Bot,
    url: "app.hireagent.ai/pipeline",
    image: "/process/step-2.png",
    tags: ["PyMuPDF Engine", "pgvector Semantic Search", "Gemini Flash Fit"],
    highlight: "10x Screening Velocity"
  },
  { 
    num: 3, 
    badge: "Step 03",
    title: "Asynchronous AI Interviews", 
    body: "Shortlisted candidates answer 3-5 tailored technical questions designed dynamically to probe their specific CV gaps — anytime, anywhere.", 
    icon: MessageSquareText,
    url: "app.hireagent.ai/interview/session",
    image: "/process/step-3.png",
    tags: ["CV Gap Detection", "Adaptive Follow-ups", "Async Candidate Portal"],
    highlight: "Zero Scheduling Delay"
  },
  { 
    num: 4, 
    badge: "Step 04",
    title: "Final Scorecard & Shortlist", 
    body: "Review Claude Sonnet transcript evaluations, multi-dimensional radar scores, per-candidate cost analytics, and make instant hiring decisions.", 
    icon: CheckCircle,
    url: "app.hireagent.ai/dashboard",
    image: "/process/step-4.png",
    tags: ["Multi-Axis Radar", "Claude Sonnet Grading", "Token Cost Tracker"],
    highlight: "Data-Driven Hiring"
  },
];

export const landingDeckFeatures: LandingDeckFeature[] = [
  {
    id: "verbatim-attribution",
    number: "01",
    category: "Zero-Hallucination",
    icon: FileCheck2,
    title: "4-Tier Verbatim Evidence Attribution",
    pillTitle: "01 Verbatim Quote",
    description: "Every fit score is backed by exact highlighted quotes in the candidate’s CV. We eliminate AI hallucinations by cross-verifying employment bullets, projects, and credentials with 4-tier string verification.",
    metrics: [
      { label: "VERIFICATION AUDIT", value: "100% Quote Traced", tone: "pos" },
      { label: "HALLUCINATION RATE", value: "0.0% Pure Math", tone: "pos" }
    ],
    viewport: {
      file: "CandidateInspectionDrawer.tsx // ScoreBreakdownPanel",
      tag: { text: "VERIFIED QUOTE", tone: "pos" },
      type: "verbatim-quote"
    }
  },
  {
    id: "anti-cheat-telemetry",
    number: "02",
    category: "Assessment Security",
    icon: ShieldAlert,
    title: "Multi-Signal Anti-Cheat Telemetry",
    pillTitle: "02 Anti-Cheat",
    description: "Monitors candidate browser events in real time during technical assessments. Tracks tab switches, copy-paste bursts, and robotic phrasing to calculate a transparent AI Risk Score.",
    metrics: [
      { label: "TELEMETRY METRICS", value: "Tab + Paste + Velocity", tone: "neg" },
      { label: "RISK CLASSIFICATION", value: "Low / Mod / High Flag", tone: "neg" }
    ],
    viewport: {
      file: "AntiCheatInspectionCard.tsx",
      tag: { text: "HIGH AI RISK: 85%", tone: "neg" },
      type: "anti-cheat"
    }
  },
  {
    id: "timeline-merging",
    number: "03",
    category: "Anti-Fraud Math",
    icon: CalendarClock,
    title: "Deterministic Timeline Merging",
    pillTitle: "03 Timeline Math",
    description: "Eliminates resume tenure inflation. Merges overlapping concurrent roles, internships, and side gigs into non-overlapping calendar intervals for authentic domain tenure.",
    metrics: [
      { label: "CLAIMED STACKED", value: "7.5 Years", tone: "neg" },
      { label: "AUTHENTIC DOMAIN", value: "4.8 Years Merged", tone: "pos" }
    ],
    viewport: {
      file: "timeline.py // IntervalMergingAlgorithm",
      tag: { text: "DISCRETE MATH", tone: "accent" },
      type: "timeline-math"
    }
  },
  {
    id: "ai-interviews",
    number: "04",
    category: "Dynamic Q&A",
    icon: MessageSquareCode,
    title: "Resume-Anchored Technical Questions",
    pillTitle: "04 AI Interviews",
    description: "Kills generic LeetCode and easily Googled questions. The generator formulates role-specific questions anchored to the candidate's exact CV project claims and recruiter requirements.",
    metrics: [
      { label: "QUESTION DEPTH", value: "CV Gap Anchored", tone: "accent" },
      { label: "ADAPTIVE PROBING", value: "Real-Time Follow-Ups", tone: "pos" }
    ],
    viewport: {
      file: "CandidateLiveInterviewPortal.tsx",
      tag: { text: "TIMER: 01:24", tone: "mid" },
      type: "ai-interviews"
    }
  },
  {
    id: "radar-scorecards",
    number: "05",
    category: "Decision Clarity",
    icon: Target,
    title: "Multi-Axis Radar Scorecards",
    pillTitle: "05 Radar Rubric",
    description: "Provides instant, multi-dimensional hiring clarity across Technical Depth, Communication Clarity, Cultural Fit, and Growth Velocity with itemized strength & gap lists.",
    metrics: [
      { label: "DECISION SPEED", value: "Instant Shortlist", tone: "pos" },
      { label: "RUBRIC STANDARD", value: "4-Axis Matrix", tone: "pos" }
    ],
    viewport: {
      file: "EvaluationRadarScorecard.tsx",
      tag: { text: "OVERALL FIT: 92%", tone: "pos" },
      type: "radar-rubric"
    }
  },
  {
    id: "adaptive-probing",
    number: "06",
    category: "Adaptive AI",
    icon: MessageSquareCode,
    title: "Adaptive Real-Time Probing",
    pillTitle: "06 Adaptive Probing",
    description: "Our conversational state machine evaluates answer completeness on the fly. If a candidate's answer is brief or vague, an intelligent follow-up probe is triggered instantly.",
    metrics: [
      { label: "TRIGGER LOGIC", value: "< 20 Words / Vague", tone: "accent" },
      { label: "INTERVIEW DEPTH", value: "Zero Surface Fluff", tone: "pos" }
    ],
    viewport: {
      file: "interviewer.py // AsyncProbingEngine",
      tag: { text: "PROBING ACTIVE", tone: "accent" },
      type: "adaptive-probing"
    }
  },
  {
    id: "strictness-presets",
    number: "07",
    category: "Calibration",
    icon: SlidersHorizontal,
    title: "Calibrated Strictness Presets",
    pillTitle: "07 Strictness Modes",
    description: "Switch between Lenient, Moderate, and Strict evaluation rules with mathematically guaranteed score consistency: Score_Lenient ≥ Score_Moderate ≥ Score_Strict.",
    metrics: [
      { label: "SCORING DRIFT", value: "0.0% Drift Guaranteed", tone: "pos" },
      { label: "PRESET MODES", value: "Lenient / Mod / Strict", tone: "accent" }
    ],
    viewport: {
      file: "scoring.py // StrictnessMultiplierMatrix",
      tag: { text: "LIVE PRESET", tone: "accent" },
      type: "strictness-presets"
    }
  },
  {
    id: "vision-ocr",
    number: "08",
    category: "Multi-Format Ingestion",
    icon: FileSearch,
    title: "Vision OCR Graphic Resume Parsing",
    pillTitle: "08 Vision OCR",
    description: "Zero lost applicants. Ingests standard PDFs, DOCX files, Canva templates, and scanned graphics by automatically falling back to multimodal Gemini Vision OCR when text layers are unreadable.",
    metrics: [
      { label: "FORMAT COVERAGE", value: "PDF, DOCX, Scan, Img", tone: "pos" },
      { label: "APPLICANT LOSS", value: "0% Missing Resumes", tone: "pos" }
    ],
    viewport: {
      file: "cv_parser.py // PyMuPDFVisionFallback",
      tag: { text: "VISION OCR @ 150 DPI", tone: "pos" },
      type: "vision-ocr"
    }
  },
  {
    id: "live-pipeline",
    number: "09",
    category: "Hiring Velocity",
    icon: LayoutGrid,
    title: "Live Real-Time Kanban Pipeline",
    pillTitle: "09 Live Pipeline",
    description: "Visual drag-and-drop dashboard powered by Supabase WebSockets. Track candidate progression from initial upload to final offer with instant team synchronization.",
    metrics: [
      { label: "PIPELINE LATENCY", value: "< 50ms Sync", tone: "pos" },
      { label: "TEAM COLLABORATION", value: "Multi-Seat Live", tone: "pos" }
    ],
    viewport: {
      file: "PipelinePage.tsx // KanbanStages",
      tag: { text: "REALTIME SYNC", tone: "pos" },
      type: "live-pipeline"
    }
  },
  {
    id: "keyword-stuffer-flag",
    number: "10",
    category: "Anti-Cheat Screening",
    icon: ShieldAlert,
    title: "Anti-Keyword Stuffing & Fluff Flag",
    pillTitle: "10 Keyword Stuffer Flag",
    description: "Traditional ATS screeners give 100% credit to candidates who dump 50+ keywords into a skills box. hireagent cross-verifies skills against actual project bullets, flagging unevidenced fluff and neutralizing inflated scores.",
    metrics: [
      { label: "KEYWORD TRAP DEFENSE", value: "100% Stuffer Immune", tone: "pos" },
      { label: "SCORE OVERRIDE", value: "Caps Fluff to 0 Pts", tone: "neg" }
    ],
    viewport: {
      file: "verification.py // KeywordStufferDetector",
      tag: { text: "STUFFER FLAGGED", tone: "neg" },
      type: "keyword-stuffer"
    }
  }
];

export const landingStats: LandingStat[] = [
  { value: "10×", label: "Faster candidate screening\nvs manual resume review" },
  { value: "4-Tier", label: "Automated candidate evaluation\n& AI interview funnel" },
  { value: "100%", label: "Standardized, objective\ncandidate fit scoring" },
  { value: "0 hrs", label: "Wasted reading unqualified\nor mismatched resumes" },
];

export const landingFaqs: LandingFaq[] = [
  {
    category: "Control & Governance",
    q: "Will the AI make automated hiring or rejection decisions without my review?",
    a: "No. hireagent operates as an intelligent hiring co-pilot, not an autonomous black box. While our multi-stage engine automatically screens, ranks candidates, and evaluates interviews, your hiring team retains 100% decision control. You can inspect fit scores, review full interview transcripts, manually move candidates across pipeline stages, and override any recommendation."
  },
  {
    category: "Candidate Experience",
    q: "What is the assessment experience like for job applicants?",
    a: "Applicants receive a seamless, web-based interview assessment link that requires zero app downloads or login setups. Candidates answer role-specific written questions tailored to their experience at their own pace. If a response is brief, our engine adaptively asks a targeted follow-up probe to ensure candidate depth is fully captured."
  },
  {
    category: "Screening & Rules",
    q: "Can I set mandatory hard filters and custom criteria for specific roles?",
    a: "Yes. When setting up a campaign, you configure mandatory experience thresholds, non-negotiable tech stacks, and custom hard rules. Applicants who do not meet your mandatory criteria are filtered out immediately before deep fit scoring occurs."
  },
  {
    category: "Cost & Efficiency",
    q: "How does hireagent process high volumes of CVs so cost-effectively?",
    a: "Instead of running full AI evaluations on every raw application upfront, hireagent uses an intelligent multi-stage cascade. Non-matching profiles and duplicates are filtered out early during initial qualification checks, reserving deep AI evaluations exclusively for viable candidates. This multi-tiered approach dramatically reduces overall processing overhead while accelerating screening."
  },
  {
    category: "Objectivity & Bias",
    q: "How does hireagent minimize bias and maintain objective candidate evaluation?",
    a: "Our evaluation engine grades candidates strictly against job description requirements, verified skills, and structured multi-axis rubric standards (Technical Depth, Communication, and Problem-Solving). Every candidate in a campaign is judged against the exact same rules, filters, and criteria set up by your hiring team, ensuring consistent and objective evaluations."
  },
  {
    category: "Security & Privacy",
    q: "Is candidate resume and assessment data kept private and secure?",
    a: "Yes. All data transmissions are encrypted using standard SSL/TLS, and data access is enforced with token-based authentication and account-level isolation. Your candidate profiles, resume data, and interview transcripts are strictly private to your team and isolated to your account. We never sell candidate data or share it across accounts."
  },
  {
    category: "AI Interview Depth",
    q: "Are the AI interview questions static templates or dynamically generated?",
    a: "Questions are dynamically formulated for each campaign and candidate. The engine analyzes your job description requirements alongside the candidate's parsed resume to ask targeted questions that probe real skills and candidate background gaps, complete with live follow-up probing."
  },
  {
    category: "Setup & Onboarding",
    q: "How quickly can our team set up a hiring campaign and start screening?",
    a: "You can launch a hiring campaign in under 5 minutes. Simply paste your job description, define your mandatory filter rules, and upload candidate resumes. hireagent parses the CVs, runs the multi-stage screening funnel, and populates your visual pipeline dashboard instantly."
  }
];

export const getFaqCategoryIcon = (category: string): LucideIcon => {
  switch (category) {
    case "Control & Governance": return ShieldCheck;
    case "Candidate Experience": return UserCheck;
    case "Screening & Rules": return SlidersHorizontal;
    case "Cost & Efficiency": return Zap;
    case "Objectivity & Bias": return Target;
    case "Security & Privacy": return Lock;
    case "AI Interview Depth": return MessageSquareText;
    case "Setup & Onboarding": return FileText;
    default: return HelpCircle;
  }
};
