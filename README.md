# Recruitment Agent 🚀

> A cost-optimized, exponentially narrowing AI state machine workflow to process, filter, and interview candidates automatically.

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent_Framework-orange)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)

## Overview

The **Recruitment Agent** is an end-to-end AI-powered recruitment pipeline designed to evaluate a candidate's CV against a Campaign's Job Description (JD), filter them efficiently, and conditionally advance the best candidates to an automated interview phase. Built on top of **LangGraph**, the system employs a multi-tiered approach—starting from zero-cost hard logic filters to advanced LLM transcript evaluations—minimizing API costs while maximizing the quality of shortlisted candidates. 

## Key Features

- **Automated CV Parsing & Caching:** Extracts structured data from resumes (Name, Experience, Skills, etc.) and caches results using cryptographic hashes to prevent redundant LLM hits.
- **Multi-Stage Narrowing Funnel:**
  - *Hard Filters:* Zero-cost criteria matching (e.g., minimum experience).
  - *Embedding Matching:* Semantic similarity checks between the CV and JD using vector embeddings.
  - *JD Matching:* Fast-tier LLM scoring of the candidate profile against the full Job Description.
- **Automated AI Interviews:** Generates tailored technical and behavioral questions and conducts asynchronous Q&A with candidates.
- **Smart Evaluation:** Comprehensive analysis of the interview transcript providing scores across Technical, Communication, and Cultural Fit dimensions.
- **Human-in-the-Loop:** Pauses the graph to allow human recruiters to review and override decisions.
- **Asynchronous Processing:** Powered by **ARQ (Async Redis Queue)** to handle heavy concurrent CV processing without blocking the FastAPI web server.

## Architecture & Workflow

The system operates as a state machine where candidates traverse nodes sequentially. At each step, a candidate may be rejected, placed on hold, or advanced.

```mermaid
graph TD
    START((START)) --> cv_parser
    
    cv_parser --> hard_filters
    
    hard_filters --> |Passed| embedding_matcher
    hard_filters --> |Rejected| rejected
    
    embedding_matcher --> |Passed| jd_matcher
    embedding_matcher --> |Rejected| rejected
    
    jd_matcher --> |Advance| question_generator
    jd_matcher --> |Hold| human_override
    jd_matcher --> |Reject| rejected
    
    human_override --> |Override| question_generator
    human_override --> |Reject| rejected
    
    question_generator --> interviewer
    
    interviewer --> |Next Question| interviewer
    interviewer --> |Interview Complete| evaluator
    
    evaluator --> END((END))
    rejected --> END
```

### Pipeline Details
1. **`cv_parser`**: Extracts and structures CV data (caches in PostgreSQL).
2. **`hard_filters`**: Applies mandatory criteria logic (zero cost).
3. **`embedding_matcher`**: Compares `text-embedding-3-small` vectors via `pgvector`.
4. **`jd_matcher`**: Fast LLM assessment of the CV against the JD.
5. **`question_generator`**: Prepares bounded interview questions.
6. **`interviewer`**: Handles candidate interactions.
7. **`evaluator`**: Advanced AI review of the final interview transcript.

## Tech Stack

| Category | Technology |
| :--- | :--- |
| **Backend** | Python, FastAPI, Pydantic |
| **AI / Orchestration** | LangGraph, Langchain, OpenRouter (Gemini 2.5 Flash & Claude Sonnet) |
| **Database** | PostgreSQL (Supabase), Prisma ORM, `pgvector` |
| **Queue / Workers** | Redis (Upstash), ARQ (Async Redis Queue) |
| **Frontend** | React, Vite, TailwindCSS, shadcn/ui, Radix UI |
| **Document Processing** | PyPDF, PyMuPDF |

## Screenshots

<details>
<summary><b>Click to view Pipeline Architecture Diagram</b></summary>
<br>
<img src="./pipeline.png" alt="Pipeline Architecture" width="800"/>
</details>


## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── agent/         # LangGraph nodes, state, prompts, and config
│   │   ├── main.py        # FastAPI server entry point
│   │   └── worker.py      # ARQ Redis background worker
│   ├── prisma/            # Database schema and migrations
│   └── requirements.txt   # Backend dependencies
├── frontend/
│   ├── src/               # React UI components and pages
│   ├── vite.config.ts     # Vite configuration
│   └── package.json       # Frontend dependencies
├── functionality.md       # Detailed technical spec of pipeline
├── workflow.md            # Diagram and workflow explanations
└── pipeline.png           # Architecture graphic
```

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js & npm
- A PostgreSQL Database (e.g., Supabase) with `pgvector` enabled
- Redis instance (e.g., Upstash)
- OpenRouter API Key

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

2. **Environment Variables:** Create `backend/.env`
   ```env
   DATABASE_URL="postgresql://user:password@host:port/db?connection_limit=1"
   OPENROUTER_API_KEY_PAID="your_openrouter_api_key"
   REDIS_URL="redis://your_redis_host:6379"
   MAX_CONCURRENT_PIPELINES="3"
   ```

3. **Database Migration:**
   ```bash
   prisma generate
   prisma db push
   ```

4. **Start the Application Services:**
   - **Start the Redis Worker:**
     ```bash
     arq app.worker.WorkerSettings
     ```
   - **Start the FastAPI Server:**
     ```bash
     uvicorn app.main:app --reload
     ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the Dev Server:**
   ```bash
   npm run dev
   ```

## Usage
1. Open the frontend UI (typically `http://localhost:5173`).
2. Create a new **Campaign** by providing a Job Description, required hard filters, and toggling the interview stage.
3. Upload candidate CVs (PDFs).
4. The system will asynchronously process the candidates through the pipeline. Monitor the status on the Campaign dashboard.
5. Provide **Human Review** for candidates marked as "Hold" or review final evaluations.

## Recent Updates (Changelog Highlights)
- **Robust Pipeline:** Refactored CV processing into isolated background tasks via ARQ/Redis.
- **OCR Fallbacks:** Integrated PyMuPDF to extract text from image-based or unstructured PDFs.
- **Cost Optimization:** Migrated JD embeddings to the database to prevent redundant re-embedding.
- **Prompt Engineering:** Added Chain of Thought (CoT) to system prompts for more accurate evaluations.
- **Fail-Safes:** Implemented retry/fail mechanisms for broken tasks, accessible via `/api/campaigns/{id}/retry-failed`.


## License
*License not specified.*
