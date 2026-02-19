# 🤖 Autonomous DevOps Agent — RIFT 2026 Submission

**Live Dashboard:** [https://rift101.vercel.app](https://rift101.vercel.app)
**Backend API:** [https://devops-agent-backend-cdhu.onrender.com](https://devops-agent-backend-cdhu.onrender.com)
**GitHub Repo:** [https://github.com/12pranavr/rift101](https://github.com/12pranavr/rift101)

---

## 👥 Team

| Role | Name |
|------|------|
| **Team Leader** | Pranav Raghavan CM |
| **Team Member** | Shravani A Gowda |
| **Team Member** | Pooja K Reddy |

---

## 🔴 The Problem

Modern software teams face a continuous and costly challenge: **broken code ships faster than it gets fixed.**

- Developers spend **40–60% of their time debugging** instead of building new features
- CI/CD pipelines surface failures but leave remediation entirely to humans
- A failing test can block a team for hours or days
- Existing tools tell you *something is broken* — none of them **fix it for you**

---

## ✅ The Solution

The **Autonomous DevOps Agent** closes the gap between *detection* and *resolution*. Given a GitHub repository URL, it:

1. **Clones** the repository and creates an isolated `AI_Fix` branch (pushed immediately to GitHub)
2. **Analyzes** the codebase — static analysis, vulnerability scans, full test suite
3. **Classifies** every failure by bug type using an AI model
4. **Generates** targeted code fixes using large language models
5. **Commits and pushes** every fix with a `[AI-AGENT]` commit message
6. **Retries** automatically if fixes don't resolve all failures (up to 5 iterations)
7. **Opens a Pull Request** with a full fix summary
8. Displays everything **live** on the React dashboard

---

## 🏗️ Architecture Diagram

```
GitHub Repo URL (input via Dashboard)
       │
       ▼
┌──────────────────────────────────────────────────┐
│          FastAPI Backend (Render)                │
│                                                  │
│         LangGraph StateGraph Pipeline            │
│                                                  │
│   ┌─────────────┐                                │
│   │AnalyzerNode │  Clone → Branch → Static       │
│   │             │  Analysis → Vuln Scan →        │
│   │             │  Test Execution → Classify     │
│   └──────┬──────┘                                │
│          │ failures[]                            │
│          ▼                                       │
│   ┌─────────────┐                                │
│   │  FixerNode  │  Parallel AI fix generation → │
│   │             │  Sequential git commit+push    │
│   └──────┬──────┘                                │
│          │ fixes[]                               │
│          ▼                                       │
│   ┌──────────────┐                               │
│   │VerifierNode  │  Re-run test suite →          │
│   │              │  PASSED → end                 │
│   │              │  FAILED + retries → loop      │
│   └──────────────┘                               │
└──────────────────────────────────────────────────┘
       │
       ▼
React Dashboard (Vercel) ← polls /api/status every 2s
GitHub: AI_Fix Branch + Pull Request auto-created
```

---

## 🧠 Multi-Agent Architecture

### Analyzer Agent
- Clones repo into isolated temp directory
- Creates and **immediately pushes** `TEAM_LEADER_AI_Fix` branch to GitHub
- Runs language detection (Python, JS, Ruby, Go, Java)
- Runs static analysis (flake8, mypy, eslint, staticcheck)
- Runs vulnerability scan (pip-audit)
- Discovers and executes full test suite
- Classifies all failures via AI: `LINTING | SYNTAX | LOGIC | TYPE_ERROR | IMPORT | INDENTATION`

### Fixer Agent
- **Phase 1 (Parallel):** Concurrent AI fix generation via `ThreadPoolExecutor` (6 workers)
- **Phase 2 (Sequential):** Thread-safe git commit + push per fix with `[AI-AGENT]` prefix
- Fast-path optimizations: autopep8 for linting, regex for vulnerabilities (no AI call needed)
- Retry memory: tracks previous failed attempts per file so AI doesn't repeat mistakes

### Verifier Agent
- Re-runs complete test suite after each fix iteration
- Routes back to Fixer if failures remain and retries available
- Finalizes run as `PASSED` or `FAILED`

---

## 📊 React Dashboard

| Section | Details |
|---------|---------|
| **Input** | Repo URL, Team Name, Leader Name, Custom Instructions, Ignore Rules, Schedule |
| **Progress Bar** | Live step: Clone → Analyze → Fix → Verify → Done |
| **Run Summary** | Branch name, duration, failures detected vs fixes applied, CI/CD badge |
| **Score Breakdown** | Base 100 + Speed bonus (+10 if < 5 min) − Efficiency penalty (−2/commit over 20) + chart |
| **Fixes Table** | File, Bug Type, Line Number, Commit Message, Status (✓/✗) with color coding |
| **CI/CD Timeline** | Vertical timeline of iterations with pass/fail badges and timestamps |
| **PR Link** | Direct link to auto-created pull request |

---

## 🔀 Branch Naming

Format: `TEAM_NAME_LEADER_NAME_AI_Fix`

| Team Name | Leader Name | Branch |
|-----------|-------------|--------|
| JARVIS | PRANAV | `JARVIS_PRANAV_AI_Fix` |
| RIFT ORGANISERS | Saiyam Kumar | `RIFT_ORGANISERS_SAIYAM_KUMAR_AI_Fix` |

Rules: ALL UPPERCASE · spaces → underscores · ends with `_AI_Fix`

---

## 🌐 Supported Bug Types

| Type | Detection Method |
|------|-----------------|
| `LINTING` | flake8 / eslint |
| `SYNTAX` | parser errors from test runner |
| `LOGIC` | test failures classified by AI |
| `TYPE_ERROR` | mypy / runtime type errors |
| `IMPORT` | ModuleNotFoundError / import failures |
| `INDENTATION` | flake8 / autopep8 |
| `VULNERABILITY` | pip-audit / package.json scan |

---

## 🗂️ Project Structure

```
/
├── backend/
│   ├── main.py               # FastAPI app + REST endpoints
│   ├── graph.py              # LangGraph StateGraph pipeline
│   ├── gemini_client.py      # AI client (OpenRouter)
│   ├── scoring.py            # Score calculation
│   ├── sandbox.py            # Multi-language test runner (subprocess/Docker)
│   ├── git_utils.py          # Clone, branch, commit, push via GitPython
│   ├── language_detector.py  # File extension-based language detection
│   ├── static_analysis.py    # flake8, mypy, eslint, staticcheck
│   ├── vuln_scanner.py       # pip-audit + JS vulnerability scanning
│   ├── pr_creator.py         # GitHub API PR creation
│   ├── scheduler.py          # APScheduler scheduled runs
│   └── agents/
│       ├── analyzer.py       # Analyzer agent
│       ├── fixer.py          # Fixer agent
│       └── verifier.py       # Verifier agent
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store/agentStore.js        # Zustand global state
│   │   └── components/
│   │       ├── InputSection.jsx
│   │       ├── ProgressBar.jsx
│   │       ├── RunSummaryCard.jsx
│   │       ├── ScoreBreakdownPanel.jsx
│   │       ├── FixesAppliedTable.jsx
│   │       └── CICDTimeline.jsx
│   └── vercel.json
└── backend/render.yaml
```

---

## 🚀 Quick Start

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```env
OPENROUTER_API_KEY=your_key
GITHUB_TOKEN=your_github_pat
MAX_RETRIES=5
SANDBOX_TIMEOUT=60
SANDBOX_MODE=subprocess
```

```bash
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
```

---

## ⚙️ Environment Variables

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `OPENROUTER_API_KEY` | backend | ✅ | OpenRouter AI gateway key |
| `GITHUB_TOKEN` | backend | ✅ | GitHub PAT with `repo` write scope |
| `MAX_RETRIES` | backend | optional | Max fix iterations (default: `5`) |
| `SANDBOX_TIMEOUT` | backend | optional | Max seconds per test run (default: `60`) |
| `SANDBOX_MODE` | backend | optional | `subprocess` (default) or `docker` |
| `VITE_API_URL` | frontend | ✅ | Backend API base URL |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| AI / LLM | OpenRouter API (qwen-2.5-coder-32b-instruct) |
| Orchestration | LangGraph `StateGraph` |
| Backend | FastAPI + Uvicorn |
| Frontend | Vite + React + Zustand + Recharts |
| Styling | Tailwind CSS |
| Git Operations | GitPython |
| Static Analysis | flake8, mypy, eslint, staticcheck |
| Vulnerability | pip-audit |
| Scheduling | APScheduler |
| Sandbox | subprocess / Docker |
| Backend Hosting | Render |
| Frontend Hosting | Vercel |

---

## ⚠️ Known Limitations

- Free Render tier spins down after 15 min of inactivity — first request after sleep takes ~30s
- Docker sandbox mode requires Docker installed; defaults to `subprocess` on cloud
- Java test results parsing is best-effort (Maven/Gradle don't output easy JSON in basic mode)
- Large repos (>500 files) may hit the 60s sandbox timeout
- AI model responses are non-deterministic — retry may be needed for complex logic bugs
