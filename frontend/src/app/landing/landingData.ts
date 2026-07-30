import { 
  FileText, 
  Bot, 
  MessageSquareText, 
  CheckCircle,
  LayoutGrid,
  Target,
  TrendingUp,
  Layers,
  Clock,
  ShieldCheck,
  UserCheck,
  SlidersHorizontal,
  Zap,
  Lock,
  HelpCircle,
  LucideIcon
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

export interface LandingFeature {
  title: string;
  desc: string;
  icon: LucideIcon;
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

export const landingFeatures: LandingFeature[] = [
  { title: "Live Pipeline View", desc: "Kanban board across five distinct stages — Pending, Screening, Interviewing, Shortlisted, Rejected. Drag, filter, decide.", icon: LayoutGrid },
  { title: "Multi-Dimensional Radar Scoring", desc: "Evaluate candidates across Technical, Communication, Cultural Fit, and Overall Fit dimensions.", icon: Target },
  { title: "Turn-by-Turn Transcripts", desc: "Full AI-generated written interview transcripts with timestamped Q&A and adaptive follow-up probing.", icon: FileText },
  { title: "Campaign Analytics & Velocity", desc: "Track candidate fit scores, shortlist velocity, screening progress, and multi-dimensional candidate evaluation metrics.", icon: TrendingUp },
  { title: "Multi-Campaign Pipelines", desc: "Run Engineering, Product, and Operations searches simultaneously with completely isolated candidate pools.", icon: Layers },
  { title: "SHA-256 CV Deduplication", desc: "Cryptographic hashing automatically detects duplicate resume uploads and reuses cached parse data instantly.", icon: Clock },
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
