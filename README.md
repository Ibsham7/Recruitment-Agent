# Recruitment Agent 🚀

> **Production-Grade AI Screening & Multi-Tenant Automated Technical Interview Engine**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-State_Machine-FF6F00?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com/langgraph)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![pgvector](https://img.shields.io/badge/pgvector-1536_Dims-blue?style=for-the-badge)](https://github.com/pgvector/pgvector)
[![Redis ARQ](https://img.shields.io/badge/Redis_ARQ-Task_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

---

## 💡 Overview & Architectural Vision

Traditional AI recruitment systems suffer from hallucinated qualifications, unverified CV claims, score inflation, and single-prompt LLM latency.

The **Recruitment Agent** is an enterprise-grade recruitment platform powered by **LangGraph state machines**, **FastAPI**, **ARQ (Async Redis Queue)**, and **PostgreSQL with `pgvector`**. It combines qualitative LLM semantic extraction with deterministic Python verification engines to guarantee:

- **100% Auditability**: Every candidate evidence claim is verified against exact raw CV text via a **4-tier verbatim quote verification engine**.
- **Zero Mathematical Drift**: Numerical scoring, timeline calculation, partial credit multipliers, and penalty deductions are calculated strictly via deterministic algorithms.
- **Monotonic Scoring Guarantees**: Multi-mode evaluation strictness (Lenient, Moderate, Strict) reuses cached neutral qualitative assessments, guaranteeing $Score_{\text{Lenient}} \ge Score_{\text{Moderate}} \ge Score_{\text{Strict}}$.
- **Multi-Layered Anti-Cheat Protection**: Real-time browser telemetry, burst-paste analysis, per-question timers, resume-anchored questions, and a dual heuristic-and-LLM AI likelihood detector safeguard written technical assessments.

---

## 🏗️ System Architecture & Autonomous Workflows

The platform is engineered around **two decoupled, autonomous state-machine workflows**:

### 1. Dual Autonomous Workflow Topology

```mermaid
graph TD
    classDef startNode fill:#059669,stroke:#047857,stroke-width:2px,color:#ffffff,font-weight:bold;
    classDef parseNode fill:#2563EB,stroke:#1D4ED8,stroke-width:2px,color:#ffffff;
    classDef ruleNode fill:#7C3AED,stroke:#6D28D9,stroke-width:2px,color:#ffffff;
    classDef vectorNode fill:#0891B2,stroke:#0E7490,stroke-width:2px,color:#ffffff;
    classDef llmNode fill:#D97706,stroke:#B45309,stroke-width:2px,color:#ffffff;
    classDef smartNode fill:#4F46E5,stroke:#4338CA,stroke-width:2px,color:#ffffff;
    classDef endSuccess fill:#059669,stroke:#047857,stroke-width:2px,color:#ffffff,font-weight:bold;
    classDef endReject fill:#DC2626,stroke:#B91C1C,stroke-width:2px,color:#ffffff,font-weight:bold;

    subgraph WF1 ["Workflow 1: JD Screening & Evidence Attribution Engine (/api/campaigns)"]
        START1(("🚀 CV Upload")):::startNode --> cv_parser
        cv_parser["1. 📄 cv_parser<br/><i>PyPDF + PyMuPDF Vision OCR + SHA-256 Cache</i>"]:::parseNode --> hard_filters
        hard_filters["2. ⚡ hard_filters<br/><i>Zero-Cost Rule & Skill Evaluator</i>"]:::ruleNode -->|Passed| embedding_matcher
        hard_filters -->|Rejected| rejected
        embedding_matcher["3. 🧬 embedding_matcher<br/><i>text-embedding-3-small + pgvector (1536d)</i>"]:::vectorNode -->|Passed| jd_matcher
        embedding_matcher -->|Rejected| rejected
        jd_matcher["4. 🎯 jd_matcher & Verbatim Engine<br/><i>Canonical Spec + 4-Tier Verification + Scoring</i>"]:::llmNode -->|Shortlisted| END_SHORTLIST(("✅ Shortlisted (fitScore)")):::endSuccess
        jd_matcher -->|Awaiting Review| human_override["human_override<br/><i>LangGraph interrupt('hold_for_review')</i>"]:::smartNode
        jd_matcher -->|Rejected| rejected
        human_override -->|Approved| END_SHORTLIST
        human_override -->|Rejected| rejected
        rejected["❌ rejected<br/><i>Terminal Screening Node</i>"]:::endReject --> END_REJECTED(("🚫 Rejected")):::endReject
    end

    subgraph WF2 ["Workflow 2: Technical Interview & Anti-Cheat Engine (/api/candidates/{id}/interview)"]
        START2(("📩 Token Access")):::startNode --> question_generator
        question_generator["5. ❓ question_generator<br/><i>Resume-Anchored Tailored Questions</i>"]:::llmNode --> interviewer
        interviewer["6. 💬 process_interview_turn<br/><i>Turn-by-Turn Q&A + Async Background Probing</i>"]:::llmNode -->|Completed| evaluator
        evaluator["7. 🧠 evaluator & Anti-Cheat<br/><i>Transcript Review + Telemetry Dual Risk Score</i>"]:::smartNode --> END_INTERVIEW(("✅ Assessment Complete")):::endSuccess
    end
```

---

### 2. Full-Stack Distributed System Topology

```mermaid
flowchart TB
    classDef clientStyle fill:#0284C7,stroke:#0369A1,stroke-width:2px,color:#fff;
    classDef apiStyle fill:#0D9488,stroke:#0F766E,stroke-width:2px,color:#fff;
    classDef queueStyle fill:#DC2626,stroke:#B91C1C,stroke-width:2px,color:#fff;
    classDef dbStyle fill:#7C3AED,stroke:#6D28D9,stroke-width:2px,color:#fff;
    classDef aiStyle fill:#D97706,stroke:#B45309,stroke-width:2px,color:#fff;

    subgraph Tier1 ["🖥️ Client Tier"]
        UI["React 18 + Vite Dashboard<br/><i>Glassmorphic UI, Kanban Pipeline & Telemetry Tracker</i>"]:::clientStyle
    end

    subgraph Tier2 ["⚙️ API & Orchestration Engine"]
        API["FastAPI REST & WebSocket Server<br/><i>JWT Security Middleware & Router Handlers</i>"]:::apiStyle
        LG["LangGraph State Engine<br/><i>StateGraph & Interrupt Checkpoints</i>"]:::apiStyle
    end

    subgraph Tier3 ["⚡ Distributed Task Queue"]
        Redis[("Upstash Redis / Redis Broker<br/><i>Task Persistence & Event Broker</i>")]:::queueStyle
        ARQ["ARQ Async Worker<br/><i>Concurrency Limit MAX_CONCURRENT_PIPELINES = 3</i>"]:::queueStyle
    end

    subgraph Tier4 ["🗄️ Persistence & Vector Data"]
        Prisma["Prisma ORM (prisma-client-py)<br/><i>Relational Models & Direct Pool Management</i>"]:::dbStyle
        PG[("PostgreSQL Database<br/><i>pgvector (1536) Embeddings & HNSW Indexing</i>")]:::dbStyle
        SupaAuth["Supabase Infrastructure<br/><i>JWT Verification & WebSockets Realtime</i>"]:::dbStyle
    end

    subgraph Tier5 ["🧠 OpenRouter Multi-Tier AI Gateway"]
        OpenRouter["OpenRouter Gateway"]:::aiStyle
        Gemini["Google Gemini 3.1 Flash Lite<br/><i>Fast Tier: CV Parsing, Distillation & Screening</i>"]:::aiStyle
        GeminiVision["Google Gemini 3.1 Flash Lite<br/><i>Vision Tier: PyMuPDF OCR Fallback</i>"]:::aiStyle
        Sonnet["Anthropic Claude Sonnet 4.6 / 3.7<br/><i>Frontier Tier: Transcript Review & Evaluation</i>"]:::aiStyle
        Embeddings["OpenAI text-embedding-3-small<br/><i>1536-Dimensional Dense Vectors</i>"]:::aiStyle
    end

    UI <-->|REST API & WebSockets| API
    UI <-.->|Direct JWT Auth| SupaAuth
    API -->|Verify Bearer Token| SupaAuth
    API -->|Enqueue Candidate Tasks| Redis
    Redis <--> ARQ
    ARQ --> LG
    LG <--> Prisma
    Prisma <--> PG
    LG <-->|Async HTTP Requests| OpenRouter
    OpenRouter --> Gemini
    OpenRouter --> GeminiVision
    OpenRouter --> Sonnet
    OpenRouter --> Embeddings
```

---

## ⚡ Deep-Dive Core Mechanisms & Engineering

### 1. Verbatim Mechanism & 4-Tier Evidence Verification
The **Verbatim Mechanism** (`backend/app/agent/nodes/jd_matcher.py`, `verification.py`, `scoring.py`) eliminates LLM paraphrasing bias and hallucinated candidate claims.

```
Stage 1: Upfront Canonical JD Verification (verify_and_clean_quote)
   └─> Verifies every distilled requirement quote against raw JD text via Substring, Whitespace Normalization, and 4-Word N-Gram matching. Purges unverified LLM requirements.

Stage 2: 4-Tier Candidate Verbatim Quote Verification (verify_verbatim_cv_quote)
   ├── Tier 1: Exact Substring Matching
   ├── Tier 2: Internal Whitespace Normalization (\s+ -> single space)
   ├── Tier 3: Punctuation-Stripped Matching ([^\w\s] stripped)
   └── Tier 4: 4-Word N-Gram Window Partial Match & Snippet Truncation

Stage 3: Quote-Seeded Ranked Line Recovery (extract_verbatim_sentence_for_requirement)
   └─> Extracts substantive tokens & category aliases (cloud, container, database, api), ranks raw CV lines using structural section weights (Employment: 1.5x, Project: 1.2x, Education: 1.0x, Skills: 0.5x), and substitutes verbatim line.

Stage 4: Structural Evidence Source Classification (classify_evidence_source)
   └─> Classifies verified quotes into: 'employment', 'project', 'education', 'skills_list_only', 'unverified', 'inferred', or 'absent'.

Stage 5: Evidence Sanitization & Hedging Proficiency Capping (_sanitize_match_val)
   └─> Scans evidence for low-proficiency hedging terms ("assisted with", "some exposure", "learning", "personal project", "basic knowledge"). Caps 'full' match credit to 'partial' (50%), and overrides unevidenced skill-list items to 'none' (0%).
```

---

### 2. Hybrid Deterministic-Probabilistic Screening & Multi-Mode Scoring
Qualitative language understanding is isolated within LLMs, while numerical calculation is strictly deterministic.

#### Category Weight Distribution (`WEIGHTS_CONFIG`)
$$\text{Raw Fit Score} = (S_{\text{must}} \times 0.50) + (S_{\text{exp}} \times 0.25) + (S_{\text{nice}} \times 0.15) + (S_{\text{traj}} \times 0.10)$$

| Category Component | Weight ($W$) | Description |
| :--- | :---: | :--- |
| **Must-Have Skills ($S_{\text{must}}$)** | **50%** | Percentage of mandatory qualitative skills matched |
| **Experience Depth ($S_{\text{exp}}$)** | **25%** | Ratio of relevant experience vs. required experience |
| **Nice-To-Have Skills ($S_{\text{nice}}$)** | **15%** | Percentage of preferred/optional skills matched |
| **Growth Trajectory ($S_{\text{traj}}$)** | **10%** | Structural evidence of career velocity, project depth & degree |

#### Multi-Mode Evaluation Multipliers & Monotonic Scoring Guarantee
Candidate CVs are assessed **ONCE** using a neutral prompt and cached in `_MATCH_ASSESSMENT_CACHE`. The deterministic scoring engine applies strictness multipliers in Python, guaranteeing $Score_{\text{Lenient}} \ge Score_{\text{Moderate}} \ge Score_{\text{Strict}}$:

| Evaluation Mode | Full Match (`full`) | Partial Match (`partial`) | No Match (`none`) | Mode Bonus / Constraints |
| :--- | :---: | :---: | :---: | :--- |
| **Lenient** | $100\%$ ($1.00$) | **$75\%$ ($0.75$)** | $0\%$ ($0.00$) | $+4.0$ pts bonus (if $S_{\text{must}} \ge 15\%$) |
| **Moderate (Default)** | $100\%$ ($1.00$) | **$50\%$ ($0.50$)** | $0\%$ ($0.00$) | Standard baseline credit |
| **Strict** | $100\%$ ($1.00$) | **$25\%$ ($0.25$)** | $0\%$ ($0.00$) | Strict credit penalty |

---

### 3. Deterministic CV Timeline Engine (`timeline.py`)
Prevents tenure inflation caused by overlapping concurrent roles or vague date strings:
1. **Date Normalization**: Converts dates (`YYYY-MM`, `MM/YYYY`, `Present`) into discrete month indices:
   $$\text{Month Index} = (\text{Year} \times 12) + \text{Month}$$
2. **Interval Merging**: Overlapping intervals $[Start_i, End_i]$ are merged into non-overlapping blocks:
   $$\text{If } Start_{i+1} \le End_i + 1 \implies \text{Merge to } [Start_i, \max(End_i, End_{i+1})]$$
3. **Domain Filtering**: Calculates `relevant_experience_years` strictly for matching domain keywords.

---

### 4. Global SHA-256 Resume Deduplication & Multi-Format Ingestion
- **Document Extractors**: Supports `.pdf` (`pypdf`), `.docx` (`python-docx` + `zipfile` XML fallback), `.doc` (ASCII OLE stream filtering), and `.txt`.
- **PyMuPDF Vision OCR Fallback**: If PDF text extraction returns $<50$ characters (scanned images/graphics), renders up to 3 pages to JPEG images @ 150 DPI and invokes Gemini 2.5 Flash Lite Vision to extract structured profile JSON.
- **SHA-256 Cache**: Raw text is hashed (`hashlib.sha256`). If `fileHash` exists in the `Resume` database table, parsing and embedding steps are skipped entirely.

---

### 5. Multi-Layered Anti-Cheat & Session Integrity System
Monitors candidate behavior during written technical assessment sessions:

```mermaid
flowchart TD
    subgraph Client ["Client Browser Telemetry (Interview Page)"]
        TabBlur["👁️ Page Visibility & Blur Detection<br/><i>Tracks window.onblur & visibilitychange</i>"]
        PasteTrack["📋 Paste & Burst Telemetry<br/><i>Monitors paste count, chars & pasteRatio</i>"]
        Timer["⏱️ Per-Question Countdown Clock<br/><i>Enforces 60s-90s limit & auto-submits</i>"]
    end

    subgraph Backend ["FastAPI & LangGraph Engine"]
        API["POST /api/candidates/{id}/interview/answer<br/><i>Ingests normalized telemetry payload</i>"]
        QuestionGen["🎯 Resume-Anchored Generator<br/><i>Forces candidate CV specificity</i>"]
        Evaluator["🧠 Evaluator Node<br/><i>Calculates aiGeneratedLikelihoodScore (0-100%)</i>"]
    end

    subgraph Recruiter ["Recruiter Oversight UI"]
        UI["Candidate Inspection Drawer<br/><i>Risk badges (Low/Med/High) & audit trail</i>"]
    end

    TabBlur & PasteTrack & Timer --> API --> Evaluator
    QuestionGen --> Timer
    Evaluator --> UI
```

- **Client Telemetry**: Captures `blurCount`, `focusDurationSeconds`, `pasteCount`, `totalPastedChars`, `pasteRatio` ($\frac{\text{Pasted Chars}}{\text{Total Answer Chars}}$), paste timestamps, and auto-submits upon timer expiration.
- **Dual Heuristic & LLM Risk Detector**:
  - **Deterministic Heuristics**: Detects markdown overuse ($\ge 2$ headers, $\ge 4$ bullets, $\ge 6$ bold tags), robotic LLM transitions (*"in summary"*, *"furthermore"*, *"as an ai"*), high paste ratio ($>30\%$), and excessive tab blurs ($\ge 3$).
  - **LLM Pattern Evaluator**: Evaluates semantic phrasing, reasoning consistency, and populates `aiGeneratedLikelihoodScore` (0-100%).
  - **Composite Score**: `aiGeneratedLikelihoodScore = max(llm_score, heuristic_score)`.
- **Recruiter Inspection Card**: Displays risk severity badges (**Low Risk** $<20\%$, **Moderate Risk** $20-69\%$, **High AI Risk** $\ge 70\%$) with complete telemetry audit logs.

---

### 6. Autonomous Technical Interview & Async Probing Engine
- **Resume-Anchored Question Generator**: Formulates 3 targeted technical questions anchored directly to candidate CV gaps and recruiter instructions.
- **Client-Side Zero-Latency Iteration**: Questions array is loaded upfront, allowing instant transitions between questions.
- **Asynchronous Background Probing**: On each turn submission, background task (`asyncio.create_task`) evaluates response quality. If answers are short ($<20$ words) or vague, an adaptive follow-up probe is appended to the candidate's pending probes queue.
- **Frontier Evaluation**: `anthropic/claude-sonnet-4-6` performs final deep transcript evaluation across 4 dimensions: Technical (0-100), Communication (0-100), Cultural Fit (0-100), and Overall Score.

---

## 🛠️ Technology Stack Inventory

### Backend Tier (`backend/`)
- **Core Runtime**: Python 3.10+
- **API Framework**: FastAPI, Starlette, Uvicorn (ASGI server)
- **Agent Orchestration**: LangGraph (`StateGraph`, `MemorySaver`, `AsyncPostgresSaver`, `interrupt`)
- **Background Queue & Concurrency**: ARQ (Async Redis Queue), `redis-py`, Upstash Redis
- **Database & ORM**: PostgreSQL, `pgvector` extension (1536-dim vector distance `<=>`), Prisma ORM (`prisma-client-py`), `psycopg` connection pool
- **AI Gateway & LLM Models**: OpenRouter API Gateway (`httpx` async client)
  - Fast Tier: `google/gemini-3.1-flash-lite`
  - Vision Tier: `google/gemini-3.1-flash-lite`
  - Frontier Tier: `anthropic/claude-sonnet-4-6` / `claude-3.7-sonnet`
  - Embedding Tier: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Document Parsing & Vision**: PyPDF (`pypdf`), PyMuPDF (`fitz`), `python-docx`, `zipfile`, ASCII OLE stream filter
- **Validation & Security**: Pydantic v2, PyJWT (`HS256`), Supabase Auth GoTrue API, passlib
- **Logging & Tracing**: Custom structured JSON logging, Correlation ID middleware

### Frontend Tier (`frontend/`)
- **Core Framework**: React 18.3.1, TypeScript 5.0+
- **Build Tooling**: Vite, PostCSS, Autoprefixer
- **UI & Styling**: Tailwind CSS, Lucide React, Framer Motion
- **Authentication & Realtime**: `@supabase/supabase-js` (Auth sessions & WebSockets realtime subscriptions)
- **State & Router**: React Router DOM, Custom Glassmorphic Kanban & Telemetry components

---

## 🗄️ Database Architecture & Data Models

```mermaid
erDiagram
    Campaign ||--o{ Candidate : "contains"
    Resume ||--o{ Candidate : "deduplicated against"
    Candidate ||--o| Evaluation : "evaluated by"

    Campaign {
        string id PK
        string userId FK "Supabase Auth ID"
        string title
        string jobDescription
        string distilledJd
        vector jdEmbedding "pgvector(1536)"
        json canonicalJdSpec
        json hardFiltersConfig
        boolean enableInterviews
        string evaluationStrictness "lenient | moderate | strict"
    }

    Resume {
        string id PK
        string fileHash UK "SHA-256 raw text hash"
        json structuredProfile
        string rawCvText
        vector embedding "pgvector(1536)"
    }

    Candidate {
        string id PK
        string campaignId FK
        string resumeId FK
        string name
        string email
        string status "pending | screening | screening_hold | shortlisted | invited | interviewing | interview_completed | finalized | rejected"
        float fitScore
        string decision "approve | reject | hold"
        string rejectionReason
        float totalExperienceYears
    }

    Evaluation {
        string id PK
        string candidateId FK
        float overallScore
        float technicalScore
        float communicationScore
        float culturalFitScore
        string recommendation
        json scoreBreakdown
        json interviewTranscript
        json interviewQuestions
        float aiGeneratedLikelihoodScore
        json antiCheatFlags
        json antiCheatMetadata
    }
```

---

## 📁 Repository Structure

```text
Recruitment-Agent/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── nodes/              # LangGraph state machine nodes
│   │   │   │   ├── cv_parser.py           # Document ingestion & Vision OCR fallback
│   │   │   │   ├── hard_filters.py        # Zero-cost rule evaluator
│   │   │   │   ├── embedding_matcher.py   # pgvector semantic similarity matcher
│   │   │   │   ├── jd_matcher.py          # Canonical spec & Verbatim engine
│   │   │   │   ├── question_generator.py  # Resume-anchored question generator
│   │   │   │   ├── interviewer.py         # Q&A turn handler & interrupt logic
│   │   │   │   └── evaluator.py           # Deep transcript review & anti-cheat
│   │   │   ├── tools/              # Deterministic execution tools
│   │   │   │   ├── scoring.py             # Weighted fit scoring & sanitization
│   │   │   │   ├── timeline.py            # Experience date merging calculator
│   │   │   │   ├── verification.py        # Substring, n-gram & evidence classifier
│   │   │   │   └── skills.py              # Skill alias expansion
│   │   │   ├── api.py              # Pipeline execution bridge
│   │   │   ├── config.py           # OpenRouter model tier configurations
│   │   │   ├── graph.py            # LangGraph workflow definition & routing
│   │   │   ├── prompts.py          # Structured system prompts
│   │   │   ├── schemas.py          # Pydantic v2 schemas & telemetry normalizer
│   │   │   └── state.py            # RecruitmentState definition
│   │   ├── core/                   # Logging & correlation ID middleware
│   │   ├── middleware/             # Request correlation tracing
│   │   ├── services/               # Email & invitation dispatch
│   │   ├── database.py             # Global Prisma database client instance
│   │   ├── main.py                 # FastAPI server & route handlers
│   │   ├── security.py             # Supabase JWT authentication middleware
│   │   └── worker.py               # ARQ Redis background worker process
│   ├── prisma/
│   │   └── schema.prisma           # PostgreSQL schema with pgvector models
│   └── requirements.txt            # Backend Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── candidate/          # Inspection drawer & score breakdown UI
│   │   │   ├── dashboard/          # Campaign oversight dashboard
│   │   │   ├── interview/          # Candidate Q&A interview room & timer
│   │   │   ├── pipeline/           # Glassmorphic Kanban candidate board
│   │   │   ├── setup/              # Campaign creation wizard
│   │   │   └── router.tsx          # Application routing setup
│   │   └── lib/                    # Supabase client & utility functions
│   ├── package.json                # Frontend Node dependencies
│   └── vite.config.ts              # Vite configuration
├── AntiCheat.md                    # Anti-cheat technical specification
├── JD_SCREENING_AND_SCORE_BREAKDOWN.md # Screening engine architecture doc
├── VERBATIM_MECHANISM_IN_JD_SCREENING.md # Verbatim mechanism reference
├── PRODUCTION_AUDIT_REPORT.md       # Full production readiness audit
└── pipeline.png                    # System topology graphic
```

---

## 🚀 Installation & Quickstart Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**
- **PostgreSQL Database** (e.g. Supabase) with `pgvector` extension enabled
- **Redis Instance** (e.g. Upstash Redis or local Redis server)
- **OpenRouter API Key**

---

### 1. Environment Configuration

Create `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:password@db.supabase.co:6543/postgres?connection_limit=5"
DIRECT_URL="postgresql://postgres:password@db.supabase.co:5432/postgres"
OPENROUTER_API_KEY_PAID="sk-or-v1-your-openrouter-key"
REDIS_URL="redis://default:password@your-redis-instance:6379"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_JWT_SECRET="your-supabase-jwt-secret"
MAX_CONCURRENT_PIPELINES="3"
FRONTEND_URL="http://localhost:5173"
```

Create `frontend/.env`:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
VITE_API_URL="http://localhost:8000"
```

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv

# macOS/Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Generate Prisma Client & push schema migrations
prisma generate
prisma db push
```

---

### 3. Execution (Concurrent Terminal Services)

Open two terminal sessions:

#### Terminal 1: ARQ Redis Background Task Worker
```bash
cd backend
arq app.worker.WorkerSettings
```

#### Terminal 2: FastAPI Web Server
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

---

### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Visit `http://localhost:5173` to launch the application.

---

## 📡 API Reference

### Core Endpoints

| Endpoint | Method | Auth | Description |
| :--- | :---: | :---: | :--- |
| `/api/campaigns` | `POST` | JWT | Creates campaign, distills canonical spec/embedding, and enqueues candidate jobs. |
| `/api/campaigns` | `GET` | JWT | Fetches recruiter's active campaigns & summary metrics. |
| `/api/campaigns/{id}` | `GET` | JWT | Retrieves campaign details and candidate pipeline states. |
| `/api/campaigns/{id}/retry-failed` | `POST` | JWT | Re-enqueues failed or pending candidate processing tasks. |
| `/api/candidates/{id}` | `GET` | Public | Returns candidate evaluation, verbatim quotes, score breakdown, and raw CV. |
| `/api/candidates/{id}/interview/answer` | `POST` | Public | Ingests candidate interview turn and normalized anti-cheat telemetry. |
| `/api/candidates/{id}/review` | `POST` | JWT | Recruiter submits review decision (`approve`, `reject`, `hold`). |
| `/api/health/db` | `GET` | Public | Database pool connection health check. |
