# Recruitment Agent 🚀

> **Exponentially Narrowing, Ultra-Cost-Optimized AI Screening & Automated Candidate Interview Engine**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent_Framework-FF6F00?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com/langgraph)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![pgvector](https://img.shields.io/badge/pgvector-1536_Dims-blue?style=for-the-badge)](https://github.com/pgvector/pgvector)
[![Redis ARQ](https://img.shields.io/badge/Redis_ARQ-Task_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

---

## 💡 Overview & Value Proposition

Traditional AI recruitment systems pass every resume directly to expensive LLM models, leading to prohibitive API costs, slow processing times, and poor throughput.

The **Recruitment Agent** is an end-to-end recruitment platform powered by **LangGraph state machines**, **FastAPI**, **ARQ (Async Redis Queue)**, and **PostgreSQL with `pgvector`**. It employs an **exponentially narrowing multi-tiered funnel** that filters non-qualifying resumes early using zero-cost Python logic and fast vector similarity, reserving high-cost frontier LLMs exclusively for shortlisted finalists.

### 💰 Cost Impact Benchmark (1,000 Candidates)
| Processing Stage | Cost per Candidate | Total Cost (1,000 Candidates) |
| :--- | :--- | :--- |
| **Best Case** (Rejected at Screening Stage) | **~$0.00031** | **~$0.31 USD** |
| **Worst Case** (Complete Q&A Interview & Transcript Evaluation) | **~$0.00062** | **~$0.62 USD** |

*Result: Up to **99.8% cost reduction** compared to monolithic single-prompt LLM evaluation systems.*

---

## 🏗️ System Architecture & Workflow

The platform operates as a state machine where candidate resumes pass sequentially through 8 specialized nodes. Candidates can be rejected, held for human recruiter intervention, or advanced to automated technical and behavioral Q&A interviews.

### 1. LangGraph State Machine Flow

```mermaid
graph TD
    classDef startNode fill:#059669,stroke:#047857,stroke-width:2px,color:#ffffff,font-weight:bold;
    classDef parseNode fill:#2563EB,stroke:#1D4ED8,stroke-width:2px,color:#ffffff;
    classDef ruleNode fill:#7C3AED,stroke:#6D28D9,stroke-width:2px,color:#ffffff;
    classDef vectorNode fill:#0891B2,stroke:#0E7490,stroke-width:2px,color:#ffffff;
    classDef llmNode fill:#D97706,stroke:#B45309,stroke-width:2px,color:#ffffff;
    classDef pauseNode fill:#DB2777,stroke:#BE185D,stroke-width:2px,color:#ffffff,font-weight:bold;
    classDef smartNode fill:#4F46E5,stroke:#4338CA,stroke-width:2px,color:#ffffff;
    classDef endSuccess fill:#059669,stroke:#047857,stroke-width:2px,color:#ffffff,font-weight:bold;
    classDef endReject fill:#DC2626,stroke:#B91C1C,stroke-width:2px,color:#ffffff,font-weight:bold;

    START(("🚀 START: CV Upload")):::startNode --> cv_parser

    cv_parser["1. 📄 cv_parser<br/><i>PyPDF + Vision OCR Fallback + SHA-256 Cache</i>"]:::parseNode --> hard_filters

    hard_filters["2. ⚡ hard_filters<br/><i>Zero-Cost Python Rule Check</i>"]:::ruleNode -->|Passed| embedding_matcher
    hard_filters -->|Rejected| rejected

    embedding_matcher["3. 🧬 embedding_matcher<br/><i>text-embedding-3-small + pgvector(1536)</i>"]:::vectorNode -->|Passed| jd_matcher
    embedding_matcher -->|Rejected| rejected

    jd_matcher["4. 🎯 jd_matcher<br/><i>Gemini Flash Fit Scoring (0-100)</i>"]:::llmNode -->|Advance & Interviews On| question_generator
    jd_matcher -->|Advance & Interviews Off| END_SHORTLIST
    jd_matcher -->|Hold Score| human_override
    jd_matcher -->|Reject Score| rejected

    human_override["5. ⏸️ human_override<br/><i>interrupt('hold_for_review')</i>"]:::pauseNode -->|Approve / Override| question_generator
    human_override -->|Reject| rejected

    question_generator["6. ❓ question_generator<br/><i>Tailored 3-Question Generation</i>"]:::llmNode --> interviewer

    interviewer["7. 💬 interviewer<br/><i>Turn-by-Turn Candidate Q&A Loop</i>"]:::llmNode -->|Next Turn| interviewer
    interviewer -->|Interview Complete| evaluator

    evaluator["8. 🧠 evaluator<br/><i>Claude Sonnet 4-Score Transcript Review</i>"]:::smartNode --> END_SUCCESS

    END_SHORTLIST(("✅ END: Shortlisted")):::endSuccess
    END_SUCCESS(("✅ END: Review Complete")):::endSuccess
    rejected["❌ rejected<br/><i>Terminal Filtered Node</i>"]:::endReject --> END_REJECTED(("🚫 END: Candidate Rejected")):::endReject
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
        UI["React 18 + Vite Dashboard<br/><i>Glassmorphic UI & Realtime Controls</i>"]:::clientStyle
    end

    subgraph Tier2 ["⚙️ API & Orchestration Engine"]
        API["FastAPI REST Server<br/><i>JWT Middleware & Route Handlers</i>"]:::apiStyle
        LG["LangGraph State Engine<br/><i>State Machines & Interrupt Checkpoints</i>"]:::apiStyle
    end

    subgraph Tier3 ["⚡ Distributed Task Queue"]
        Redis[("Upstash Redis Broker<br/><i>Task Persistence & Pub/Sub</i>")]:::queueStyle
        ARQ["ARQ Async Worker<br/><i>Max Jobs Throttle = 3</i>"]:::queueStyle
    end

    subgraph Tier4 ["🗄️ Persistence & Vector Data"]
        Prisma["Prisma ORM<br/><i>Schema Models</i>"]:::dbStyle
        PG[("PostgreSQL Database<br/><i>pgvector(1536) Embeddings</i>")]:::dbStyle
        SupaAuth["Supabase Infrastructure<br/><i>JWT Auth & WebSockets</i>"]:::dbStyle
    end

    subgraph Tier5 ["🧠 Multi-Tiered AI Router"]
        OpenRouter["OpenRouter Gateway"]:::aiStyle
        Gemini["Google Gemini 3.1 Flash Lite<br/><i>Fast Tier: Parsing & Screening</i>"]:::aiStyle
        Sonnet["Anthropic Claude Sonnet 4.6<br/><i>Frontier Tier: Transcript Review</i>"]:::aiStyle
        Embeddings["OpenAI text-embedding-3-small<br/><i>1536-Dimensional Vectors</i>"]:::aiStyle
    end

    UI <-->|REST API & WebSockets| API
    UI <-.->|Direct JWT Auth| SupaAuth
    API -->|Authenticate Token| SupaAuth
    API -->|Enqueue Processing Task| Redis
    Redis <--> ARQ
    ARQ --> LG
    LG <--> Prisma
    Prisma <--> PG
    LG <-->|Async HTTP Requests| OpenRouter
    OpenRouter --> Gemini
    OpenRouter --> Sonnet
    OpenRouter --> Embeddings
```

---

## ⚡ Deep-Dive Pipeline Node Engineering

| # | Node | Engine / Model | Execution Logic & Optimization |
| :-: | :--- | :--- | :--- |
| **1** | **`cv_parser`** | `google/gemini-3.1-flash-lite` + PyMuPDF | Extracts structured JSON (Experience, Skills, Education, Roles) from PDF resumes. If text extraction yields $<50$ characters, triggers Vision OCR fallback. Uses **SHA-256 cryptographic deduplication** against the `Resume` database table to bypass LLM parsing on identical resumes. |
| **2** | **`hard_filters`** | Zero-Cost Python Rule Check | Compares structured profile attributes against mandatory campaign rules (e.g., minimum years of experience, mandatory tech stack). Rejects unqualified candidates at **$0.00 cost**. |
| **3** | **`embedding_matcher`** | `text-embedding-3-small` + `pgvector` | Computes semantic similarity between candidate resume summary and distilled Job Description (JD). Leverages native PostgreSQL `pgvector(1536)` cosine distance (`<=>`) queries. Rejects candidates failing minimum vector threshold. |
| **4** | **`jd_matcher`** | `google/gemini-3.1-flash-lite` | Conducts fast-tier LLM screening against full JD with prompt caching. Generates fit score ($0-100$) and recommendation (`advance`, `hold`, `reject`). |
| **5** | **`human_override`** | LangGraph `interrupt()` | Pauses the state machine execution graph when candidates receive a `hold` score. Pauses execution until recruiter reviews candidate via dashboard. |
| **6** | **`question_generator`** | `google/gemini-3.1-flash-lite` | Formulates bounded set of 3 technical, behavioral, and situational questions tailored specifically to candidate weak spots and campaign criteria. |
| **7** | **`interviewer`** | Asynchronous REST Loop + `interrupt()` | Conducts interactive turn-by-turn interview with candidate over web UI, persisting transcript turns incrementally into database. |
| **8** | **`evaluator`** | `anthropic/claude-sonnet-4-6` | Frontier model performs final deep review of full interview transcript. Evaluates candidate across 4 dimensions: Technical, Communication, Cultural Fit, and Overall Score with Chain-of-Thought (CoT) reasoning. |

---

## 📊 Token Economics & Cost Breakdown

The system is configured via `backend/app/agent/config.py` using a tiered model strategy:

- **Fast Tier (`google/gemini-3.1-flash-lite`)**: $\$0.075 / 1\text{M input tokens}$, $\$0.30 / 1\text{M output tokens}$.
- **Frontier Tier (`anthropic/claude-sonnet-4-6`)**: Reserved strictly for shortlisted candidate final transcript evaluations.
- **Embedding Tier (`text-embedding-3-small`)**: $\$0.02 / 1\text{M tokens}$.

### Token Budget Breakdown per Candidate

```text
[CV Parser] ---------> 1,500 Input / 250 Output Tokens   (Fast LLM Tier)
[Embedding Matcher] -> 200 Input Tokens                  (Embedding Tier)
[JD Matcher] --------> 1,000 Input / 150 Output Tokens   (Fast LLM Tier)
----------------------------------------------------------------------
Best Case Screening Total: ~2,500 Input / 400 Output (~$0.00031 / candidate)

[Question Generator] -> 1,000 Input / 200 Output Tokens   (Fast LLM Tier)
[Evaluator] ----------> 1,600 Input / 200 Output Tokens   (Frontier LLM Tier)
----------------------------------------------------------------------
Worst Case Full Pipeline: ~5,100 Input / 800 Output (~$0.00062 / candidate)
```

---

## 🗄️ Data Architecture & Deduplication Strategy

To maintain database efficiency and prevent vector bloat, the system separates candidate submissions from parsed resume data:

```mermaid
erDiagram
    Campaign ||--o{ Candidate : "contains"
    Resume ||--o{ Candidate : "deduplicated against"
    Candidate ||--o| Evaluation : "evaluated by"

    Campaign {
        string id PK
        string userId FK
        string title
        string jobDescription
        string distilledJd
        vector jdEmbedding
        json hardFiltersConfig
        boolean enableInterviews
    }

    Resume {
        string id PK
        string fileHash UK "SHA-256 text hash"
        json structuredProfile
        string rawCvText
        vector embedding "pgvector(1536)"
    }

    Candidate {
        string id PK
        string campaignId FK
        string resumeId FK
        string status "pending | screening | interviewing | review | complete | rejected"
        float fitScore
        float apiCost
        string decision
    }

    Evaluation {
        string id PK
        string candidateId FK
        float overallScore
        float technicalScore
        float communicationScore
        float culturalFitScore
        json interviewTranscript
        json interviewQuestions
        string chainOfThought
    }
```

### Global SHA-256 Resume Deduplication Flow
1. When a resume PDF is uploaded, raw text is extracted and hashed via `SHA-256`.
2. The database performs a primary key lookup on `Resume.fileHash`.
3. **If Hash Exists:** Parsing and embedding steps are skipped entirely, saving $100\%$ of LLM parsing and embedding costs.
4. **If Hash Is New:** Resume is parsed, embedded, and stored in the global `Resume` table, then linked relationally to `Candidate`.

---

## ⚙️ Task Queue & Concurrency Infrastructure

Processing dozens or hundreds of candidate CVs concurrently can exhaust LLM rate limits and web server threads.

The application decouples processing using **ARQ (Async Redis Queue)** backed by **Upstash Redis**:

- **Crash Resilience:** Tasks enqueued to Redis persist across web server restarts. If a worker process fails, uncompleted candidate pipelines auto-resume upon worker boot.
- **Strict Concurrency Limits:** ARQ limits global concurrent jobs (`max_jobs=3` by default) to stay cleanly within OpenRouter API limits and PostgreSQL connection pool capacities.
- **Ephemeral Queue Data:** Worker tasks self-clean upon job completion, avoiding Redis memory growth.

---

## 🛡️ Security, Multi-Tenancy & Privacy

- **Supabase Auth & JWT Verification:** All administrative endpoints require `Authorization: Bearer <token>` authorization headers. FastAPI verifies JWT signatures on every request.
- **Multi-Tenant Data Scoping:** Database queries are filtered by the authenticated user's ID (`userId`), guaranteeing multi-tenant campaign data isolation.
- **Backend Database Centralization:** All database operations run strictly inside FastAPI via Prisma ORM. The frontend `supabase-js` client is restricted solely to Auth and WebSocket real-time updates.

---

## 📁 Repository Structure

```text
Recruitment-Agent/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── nodes/              # LangGraph pipeline nodes
│   │   │   │   ├── cv_parser.py
│   │   │   │   ├── hard_filters.py
│   │   │   │   ├── embedding_matcher.py
│   │   │   │   ├── jd_matcher.py
│   │   │   │   ├── question_generator.py
│   │   │   │   ├── interviewer.py
│   │   │   │   └── evaluator.py
│   │   │   ├── api.py             # LangGraph execution bridge
│   │   │   ├── config.py          # Model configuration & OpenRouter settings
│   │   │   ├── graph.py           # LangGraph workflow definition
│   │   │   ├── prompts.py         # Structured system prompts
│   │   │   ├── schemas.py         # Pydantic data schemas
│   │   │   └── state.py           # RecruitmentState definition
│   │   ├── main.py                # FastAPI server entry point
│   │   ├── security.py            # Supabase JWT authentication
│   │   ├── worker.py              # ARQ Redis background worker process
│   │   └── database.py            # Global Prisma database client instance
│   ├── prisma/
│   │   └── schema.prisma          # PostgreSQL schema with pgvector models
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── candidate/         # Detailed candidate review dashboard
│   │   │   ├── dashboard/         # Active campaign oversight UI
│   │   │   ├── interview/         # Candidate Q&A interview room
│   │   │   ├── pipeline/          # Stage-based candidate Kanban board
│   │   │   ├── setup/             # Campaign creation wizard
│   │   │   └── router.tsx         # Application routing setup
│   │   └── lib/                   # Supabase client & utility functions
│   ├── package.json               # Frontend dependencies
│   └── vite.config.ts             # Vite configuration
├── functionality.md               # Technical spec of graph pipeline
├── backend_workflow_audit.md      # Backend architecture audit report
├── frontend_Audit.md               # Frontend UI & workflow audit report
├── cost.md                        # Detailed token cost calculations
├── privacy_integration_inventory.md # PII & third-party data inventory
└── pipeline.png                   # Architecture graphic
```

---

## 🚀 Quickstart & Installation Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**
- **PostgreSQL Database** (e.g., [Supabase](https://supabase.com)) with `pgvector` extension enabled
- **Redis Instance** (e.g., [Upstash Redis](https://upstash.com))
- **OpenRouter API Key**

---

### 1. Environment Configuration

Create a `.env` file inside `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:password@db.supabase.co:6543/postgres?connection_limit=1"
OPENROUTER_API_KEY_PAID="sk-or-v1-your-openrouter-key"
REDIS_URL="redis://default:password@your-redis-instance:6379"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
MAX_CONCURRENT_PIPELINES="3"
```

Create a `.env` file inside `frontend/.env`:

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
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Generate Prisma Client & Run Database Migrations
prisma generate
prisma db push
```

---

### 3. Running Application Services

Open two terminal sessions to run the background worker and web server simultaneously:

#### Terminal 1: ARQ Background Task Worker
```bash
cd backend
arq app.worker.WorkerSettings
```

#### Terminal 2: FastAPI Server
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

# Start Vite Development Server
npm run dev
```

Visit `http://localhost:5173` in your browser to launch the dashboard.

---

## 📡 API Reference & Realtime Endpoints

### Core REST Endpoints

| Endpoint | Method | Auth | Description |
| :--- | :---: | :---: | :--- |
| `/api/campaigns` | `POST` | JWT | Creates campaign & enqueues candidates for async processing. |
| `/api/campaigns` | `GET` | JWT | Fetches recruiter's active campaigns & summary stats. |
| `/api/campaigns/{id}` | `GET` | JWT | Retrieves campaign details & candidate pipeline statuses. |
| `/api/campaigns/{id}/retry-failed` | `POST` | JWT | Re-enqueues failed candidate processing tasks. |
| `/api/candidates/{id}` | `GET` | Public | Returns candidate evaluation, summary, & interview progress. |
| `/api/candidates/{id}/interview/answer` | `POST` | Public | Submits candidate's interview answer turn to state machine. |
| `/api/candidates/{id}/review` | `POST` | JWT | Recruiter submits human review decision (`approve`, `reject`, `hold`). |
| `/api/health/db` | `GET` | Public | System database connection health check. |

---


