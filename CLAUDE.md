# CLAUDE.md — FindYourJob

## Project Overview

FindYourJob is a local-first job aggregation and comparison tool for job seekers. Users paste raw job posting text, the system extracts structured data via a local LLM (Ollama + Qwen2.5-3B), and presents a sortable/filterable interface for comparing opportunities. All data stays on the user's machine — no cloud APIs, no external databases, no authentication.

**Language**: The application UI and all user-facing strings are in **Traditional Chinese (zh-TW)**. Code comments are also predominantly in Chinese.

**Design philosophy**: "Data closed loop" — all intelligence comes from the user's own collected data. No market data, no crawlers, no external knowledge. See `DESIGN.md` for full rationale.

---

## Repository Structure

```
FindYourJob/
├── CLAUDE.md              # This file
├── DESIGN.md              # Design philosophy and architectural decisions (Chinese)
├── .gitignore
├── backend/               # Python FastAPI backend
│   ├── main.py            # FastAPI app, all API endpoints (~1,235 lines)
│   ├── models.py          # Pydantic data models
│   ├── database.py        # SQLite connection, schema, migrations
│   ├── llm_parser.py      # Ollama-based LLM job text parser
│   ├── mock_parser.py     # Regex fallback parser (when Ollama unavailable)
│   ├── extraction_schema.py  # Schema definitions + prompt generation
│   ├── company_normalizer.py # 3-layer company name normalization
│   ├── test_company_normalizer.py  # pytest unit tests
│   ├── requirements.txt   # Python dependencies
│   └── jobs.db            # SQLite database (auto-created, gitignored)
└── frontend/              # React + Vite frontend
    ├── package.json
    ├── vite.config.js     # Vite config with Tailwind + API proxy
    ├── eslint.config.js
    ├── index.html         # Entry point (zh-TW)
    └── src/
        ├── main.jsx       # React entry point
        ├── App.jsx        # Main app, tab-based navigation
        ├── api.js         # Centralized API client (fetch-based)
        ├── index.css      # Tailwind imports
        └── components/
            ├── JobInput.jsx        # Job text parsing interface
            ├── JobTable.jsx        # Job list with sort/filter (~891 lines)
            ├── JobEditModal.jsx    # Edit + supplement modal (~842 lines)
            ├── ProfileSettings.jsx # User profile/preferences
            ├── SkillPicker.jsx     # Skill classification (known/learning/none)
            └── CompanyManager.jsx  # Company CRUD + supplement (~1,162 lines)
```

---

## Tech Stack

### Backend
- **Language**: Python 3
- **Framework**: FastAPI 0.115.0
- **Server**: Uvicorn 0.30.6
- **Database**: SQLite (WAL mode, foreign keys enabled)
- **Validation**: Pydantic 2.9.2
- **LLM**: Ollama + Qwen2.5-3B (local, falls back to regex parser)
- **HTTP Client**: httpx 0.28.1 (for Ollama communication)
- **Fuzzy Matching**: rapidfuzz >= 3.0.0

### Frontend
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.3.1
- **Styling**: Tailwind CSS 4.1.18 (utility classes only, no CSS modules)
- **Animation**: Framer Motion 12.34.3
- **State Management**: React hooks only (no Redux/Zustand)
- **Linting**: ESLint 9.39.1

---

## Development Commands

### Backend

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run the development server (port 8000)
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run tests
cd backend && pytest test_company_normalizer.py -v

# Optional: Start Ollama for LLM parsing
ollama run qwen2.5:3b
```

### Frontend

```bash
# Install dependencies
cd frontend && npm install

# Run dev server (port 5173, proxies /api to backend:8000)
cd frontend && npm run dev

# Production build
cd frontend && npm run build

# Lint
cd frontend && npm run lint
```

### Environment Variables (Backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed CORS origins |
| `OLLAMA_BASE` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Ollama model to use |

---

## Architecture & Key Patterns

### Navigation
Tab-based view switching via React state (`view` in `App.jsx`), **not** URL-based routing. Views: `input`, `table`, `profile`, `companies`.

### API Communication
- Frontend `api.js` uses native `fetch` (no axios)
- Vite dev server proxies `/api` requests to `http://localhost:8000`
- All endpoints are under `/api/` prefix
- Error messages are in Chinese (user-facing)

### Database
- SQLite single file (`jobs.db`), auto-created on startup via `init_db()`
- WAL mode for concurrency
- Schema migrations run automatically on startup (adds new columns to existing tables)
- Three main tables: `companies`, `jobs`, `user_profile`, plus `user_skills`

### Data Flow: Job Parsing
1. User pastes raw job posting text
2. **Primary path**: Ollama LLM extracts structured JSON
3. **Fallback path**: Regex-based parser when Ollama unavailable
4. **Import path**: User can also paste pre-structured JSON from external LLMs (ChatGPT, Gemini, Claude)
5. Company is auto-created or matched; benefits split between company and job levels

### Company Normalization (3-layer pipeline)
1. String preprocessing (suffix removal, full/half-width normalization)
2. rapidfuzz fuzzy matching
3. Embedding-based cosine similarity (optional, requires sentence-transformers)

### Field Metadata & Edit History
Every field tracks its `source` (llm/import/user) and `updated_at`. Edit history is a JSON array of actions with timestamps. Supplement operations use non-destructive merge (fill NULLs only, conflicts require user resolution).

### Mismatch Checking
When user profile is set, each job is checked for mismatches (experience, education, job type, remote type). Mismatches show as warnings but **never hide or exclude** jobs — the user always decides.

### Skill Matching
Skills are aggregated from all jobs into a pool. Users classify each as known/learning/none. Match score per job: `(known * 1.0 + learning * 0.5) / total`.

---

## API Endpoints Summary

### Jobs
- `POST /api/jobs/parse` — Parse raw text via LLM/regex
- `POST /api/jobs/import` — Import pre-structured JSON
- `GET /api/jobs` — List jobs (supports `sort_by`, `order`, `cities` params)
- `GET /api/jobs/{id}` — Get single job with company data
- `PUT /api/jobs/{id}` — Update job
- `DELETE /api/jobs/{id}` — Delete job
- `DELETE /api/jobs` — Delete all jobs
- `POST /api/jobs/{id}/supplement/preview` — Preview data merge
- `POST /api/jobs/{id}/supplement` — Apply data merge

### Companies
- `GET /api/companies` — List companies with job counts
- `GET /api/companies/{id}` — Get company details
- `PUT /api/companies/{id}` — Update company
- `DELETE /api/companies/{id}` — Delete company (unlinks jobs)
- `GET /api/companies/{id}/jobs` — List jobs for company
- `POST /api/companies/{id}/supplement/preview` — Preview merge
- `POST /api/companies/{id}/supplement` — Apply merge
- `POST /api/companies/normalize` — Preview name normalization

### User Profile & Skills
- `GET /api/profile` — Get user profile
- `PUT /api/profile` — Update user profile
- `GET /api/skills/pool` — Get skill pool from all jobs
- `PUT /api/skills` — Batch update skill statuses

### Utility
- `GET /api/status` — Ollama availability check
- `GET /api/prompt-template` — LLM prompt for job extraction
- `GET /api/companies/prompt-template` — LLM prompt for company extraction
- `GET /api/cities` — Distinct city values for filtering

---

## Database Schema (Key Tables)

### companies
`id`, `name` (unique), `benefits`, `benefits_structured` (JSON: bonus/insurance/leave/subsidy/system/other), `contact_name`, `contact_title`, `contact_phone`, `contact_email`, `address`, `website`, `notes`, `interview_process`, `interview_questions`, `ai_notes`, `industry`, `company_size`, `culture`, `raw_text`, `field_metadata` (JSON), `edit_history` (JSON), `created_at`

### jobs
`id`, `title`, `company`, `company_id` (FK → companies), `salary_min`, `salary_max`, `salary_type` (monthly/yearly/hourly/negotiable), `salary_guaranteed_months`, `location`, `city` (auto-derived), `job_type` (full-time/part-time/contract/intern), `workload` (light/moderate/heavy), `description`, `skills` (comma-separated), `experience_years`, `education` (high_school/bachelor/master/phd/none), `remote_type` (onsite/hybrid/remote), `work_hours`, `leave_policy`, `benefits`, `benefits_structured` (JSON), `language`, `source_url`, `notes`, `status` (not_applied/applied/interviewing/offered/rejected), `priority` (1-5), `mismatches` (JSON), `skill_match` (JSON), `raw_text`, `field_metadata` (JSON), `edit_history` (JSON), `created_at`

### user_profile
Single row (`id = 1`): `experience_years`, `education`, `skills`, `preferred_job_types`, `preferred_remote_types`, `preferred_locations`, `min_salary`, `salary_type`

### user_skills
`skill` (PK), `status` (known/learning/none)

---

## Coding Conventions

### Git Commits
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `style:`, `revert:`
- Commit messages are in **Chinese** (matching the project's language)
- Example: `feat: 新增投遞狀態追蹤 (status) — 全端支援`

### Backend
- All endpoints defined in `main.py` (monolithic router)
- Pydantic models in `models.py` for request/response validation
- Database operations use raw SQL via `sqlite3` (no ORM)
- JSON fields stored as TEXT and serialized/deserialized manually
- Helper functions colocated in `main.py`

### Frontend
- Flat component structure (all in `src/components/`)
- JSX files (not TypeScript `.tsx`)
- Tailwind utility classes for all styling — no CSS modules, no styled-components
- Component state via `useState`/`useEffect` hooks
- No routing library — tab switching via state in `App.jsx`
- API calls centralized in `api.js`

### No Authentication
This is a single-user local application. There is no auth layer.

### No Frontend Tests
Backend has pytest tests for company normalization. Frontend has no test infrastructure.

---

## Important Warnings

- **`main.py` is large** (~1,235 lines) — all API routes, helpers, and business logic in one file
- **`jobs.db` is gitignored** — database is auto-created on first startup
- **Ollama is optional** — system falls back to regex parsing without it
- **All UI text is Traditional Chinese** — do not switch to English without explicit request
- **Benefits are split** between company level (shared) and job level (extras) — changing one affects display of the other
- **Field metadata tracks source** — when modifying data programmatically, set appropriate source values (llm/import/user)
