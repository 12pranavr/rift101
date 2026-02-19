# 🤖 Autonomous DevOps Agent

An AI-powered system that autonomously detects, classifies, and fixes code bugs in any GitHub repository — without any human intervention. It clones the repository, runs the full test suite, generates AI-powered patches for every failing test, commits and pushes the fixes to a dedicated branch, and opens a pull request — all within minutes.

---

## 🔴 The Problem

Modern software teams face a continuous and costly challenge: **broken code ships faster than it gets fixed.**

- Developers spend **20–40% of their time debugging** instead of building new features.
- CI/CD pipelines surface failures but leave the remediation entirely to humans.
- Code reviews slow down the fix cycle — a failing test can block a team for hours or days.
- Onboarding engineers or reviewing unfamiliar repositories becomes a bottleneck when there's no automated triage.

The root issue is that existing tools tell you *something is broken*, but none of them **fix it for you**.

---

## ✅ The Solution

The **Autonomous DevOps Agent** closes the gap between *detection* and *resolution*. Given a GitHub repository URL, it:

1. **Clones** the repository and creates an isolated `AI_Fix` branch
2. **Analyzes** the codebase — running static analysis, vulnerability scans, and the full test suite
3. **Classifies** every failure by bug type using an AI model
4. **Generates** targeted code fixes for each failure using large language models
5. **Commits and pushes** every fix with a structured `[AI-AGENT]` commit message
6. **Retries** automatically if fixes don't resolve all failures (up to a configurable limit)
7. **Opens a Pull Request** with a full fix summary when the job is complete
8. Displays all of this **live** on a real-time React dashboard

The agent handles everything — no manual patching, no context switching, no blocked pipelines.

---

## 🏗️ System Architecture

```
GitHub Repo URL (input)
       │
       ▼
┌──────────────────────────────────────────────────┐
│               LangGraph Orchestration            │
│                                                  │
│   ┌─────────────┐                                │
│   │AnalyzerNode │  Clone → Branch → Static       │
│   │             │  Analysis → Vuln Scan →        │
│   │             │  Test Execution → Classify     │
│   └──────┬──────┘                                │
│          │ failures[]                             │
│          ▼                                       │
│   ┌─────────────┐                                │
│   │  FixerNode  │  Parallel AI fix generation → │
│   │             │  Sequential git commit+push    │
│   └──────┬──────┘                                │
│          │ fixes[]                               │
│          ▼                                       │
│   ┌──────────────┐                               │
│   │VerifierNode  │  Re-run full test suite →     │
│   │              │  PASSED → end                  │
│   │              │  FAILED + retries → loop back │
│   └──────────────┘                               │
└──────────────────────────────────────────────────┘
       │
       ▼
GitHub: AI_Fix Branch + Pull Request
React Dashboard: Live progress, results, score
```

The orchestration layer is built on **LangGraph** — a stateful graph execution engine that manages the analyzer → fixer → verifier pipeline with automatic retry loops and structured shared state.

---

## 🧠 How Each Agent Works

### 1. Analyzer Agent

The analyzer is responsible for understanding the full state of the repository before any fixes are attempted.

**Steps:**
- Clones the repository into an isolated temporary directory (outside any sync-monitored path)
- Creates and immediately pushes the `AI_Fix` branch to GitHub
- **Language detection** — scans file extensions to identify Python, JavaScript, Ruby, Go, Java
- **Static analysis** — runs `flake8` (Python linting), `mypy` (type checking), `eslint` (JS), `staticcheck` (Go) depending on detected languages
- **Vulnerability scanning** — runs `pip-audit` for Python dependency CVEs, scans JS `package.json` for known vulnerability signatures
- **Test discovery** — auto-discovers test files using standard naming patterns (`test_*.py`, `*_test.py`, `*_spec.rb`, `*_test.go`, `*Test.java`) without any hardcoded paths
- **Test execution** — runs the full test suite in a sandbox (subprocess or Docker mode)
- **AI classification** — sends all failures to the AI model in a single batched prompt to classify each as: `LINTING | SYNTAX | LOGIC | TYPE_ERROR | IMPORT | INDENTATION | VULNERABILITY`

### 2. Fixer Agent

The fixer generates and applies a code patch for every failure identified by the analyzer.

**Architecture — Two-phase parallel execution:**

- **Phase 1 (Parallel):** All AI fix-generation calls run concurrently via `ThreadPoolExecutor` with up to 6 workers. Each call sends the broken file, the error message, related imported files, and the matching test file as context.
- **Phase 2 (Sequential):** Once all fixes are generated, they are committed one at a time (git index is not thread-safe). Each fix is written to disk → staged → committed with an `[AI-AGENT] Fix <TYPE> in <file> line <N>` message → pushed to the AI_Fix branch.

**Fast-path optimizations:**
- **Linting/Indentation:** Automatically fixed using `autopep8` — no AI call needed, deterministic and instant
- **Vulnerabilities:** Dependency version pins are updated directly by regex replacement — no AI call needed
- **Retry memory:** If a file was already fixed in a previous iteration and still fails, the prior fix attempt is included in the prompt so the AI knows what *not* to repeat

### 3. Verifier Agent

After every fixer iteration, the verifier re-runs the complete test suite on the patched branch.

- If **all tests pass** → final status is set to `PASSED` and the graph ends
- If **failures remain** and retries are available → routes back to the fixer for another iteration
- If **max retries exhausted** → final status is set to `FAILED`

This loop ensures the agent keeps trying until the code is clean or the retry budget runs out.

---

## 🔍 Multi-Language Support

The agent supports polyglot repositories and dispatches the correct test runner per language:

| Language   | Test Runner         | Static Analysis | Package Manager |
|------------|---------------------|-----------------|-----------------|
| Python     | pytest              | flake8, mypy    | pip             |
| JavaScript | npm test / vitest   | eslint          | npm             |
| Ruby       | RSpec               | —               | bundler         |
| Go         | go test             | staticcheck     | go.mod          |
| Java       | Maven / Gradle      | —               | pom.xml         |

---

## 📊 Live Dashboard

The React frontend provides a real-time view of every agent run:

| Component             | Description                                                           |
|-----------------------|-----------------------------------------------------------------------|
| **Input Section**     | Repository URL, team name, leader name, ignore rules, custom prompt   |
| **Progress Bar**      | Live step indicator: Clone → Analyze → Fix → Verify → Done           |
| **Run Summary Card**  | Branch name, duration, failures detected vs. fixes applied            |
| **Score Breakdown**   | Base score (100) + Speed bonus (+10 if < 5 min) − Efficiency penalty (−2/commit over 20) |
| **Fixes Applied Table** | Color-coded bug type badges, commit messages, per-fix status        |
| **CI/CD Timeline**    | Vertical timeline of each test iteration with pass/fail indicators    |
| **PR Link**           | Direct link to the opened pull request on GitHub                      |

The frontend polls the backend every 2 seconds and displays live updates throughout the run.

---

## ⚙️ Advanced Features

### Scheduled Runs
Configure the agent to automatically analyze a repository on a **daily or weekly** schedule. Schedules are persisted to disk and survive server restarts. Managed via the dashboard's "Scheduled Runs" section.

### Custom Prompt / Instructions
Provide optional natural language instructions that override or extend the AI's fix behavior. For example: `"only fix syntax errors"`, `"add type hints to all functions"`, or `"refactor this module to use async/await"`.

### Ignore Rules
Specify glob patterns or directory prefixes to exclude from analysis. Files matching an ignore rule are skipped entirely during test discovery and static analysis.

### Retry Memory
Between iterations, the agent retains a history of previous fix attempts per file. If the same file fails again after a fix, the AI is shown its previous attempt and explicitly instructed not to repeat it — pushing it toward a genuinely different approach.

### Pull Request Auto-Creation
When the run completes, the agent automatically opens a GitHub pull request from the AI_Fix branch into the default branch. The PR description includes a full summary: branch name, duration, number of fixes applied, score, and a list of every commit.

---

## 🗂️ Project Structure

```
/
├── backend/
│   ├── main.py               # FastAPI application, route definitions, background task executor
│   ├── graph.py              # LangGraph StateGraph — analyzer → fixer → verifier pipeline
│   ├── gemini_client.py      # AI client (OpenRouter-compatible, with exponential backoff retry)
│   ├── scoring.py            # Run score calculation
│   ├── sandbox.py            # Test runner — subprocess mode and Docker mode, multi-language dispatch
│   ├── git_utils.py          # Clone, branch, commit, push utilities via GitPython
│   ├── language_detector.py  # File extension-based language detection
│   ├── static_analysis.py    # flake8, mypy, eslint, staticcheck integration
│   ├── vuln_scanner.py       # pip-audit and JS vulnerability scanning
│   ├── pr_creator.py         # GitHub API pull request creation
│   ├── scheduler.py          # APScheduler-based scheduled run management
│   └── agents/
│       ├── analyzer.py       # AnalyzerAgent — clone, branch, analyze, classify
│       ├── fixer.py          # FixerAgent — parallel AI fix generation, sequential commits
│       └── verifier.py       # VerifierAgent — re-run tests, decide loop/end
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Root component with polling and state management
│   │   ├── store/
│   │   │   └── agentStore.js # Zustand global state
│   │   └── components/
│   │       ├── InputSection.jsx        # Run configuration form
│   │       ├── ProgressBar.jsx         # Live step progress indicator
│   │       ├── RunSummaryCard.jsx      # Run metadata display
│   │       ├── ScoreBreakdownPanel.jsx # Score visualization with Recharts
│   │       ├── FixesAppliedTable.jsx   # Per-fix commit table
│   │       └── CICDTimeline.jsx        # Iteration timeline
│   └── package.json
└── docker/
    └── Dockerfile.sandbox    # Isolated Docker sandbox for test execution
```

---

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```env
OPENROUTER_API_KEY=your_openrouter_key
GITHUB_TOKEN=your_github_pat_with_repo_write_access
MAX_RETRIES=5
SANDBOX_TIMEOUT=60
SANDBOX_MODE=subprocess
```

Start the API:
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

Start the dev server:
```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## ⚙️ Environment Variables

| Variable            | Location  | Required | Description                                                  |
|---------------------|-----------|----------|--------------------------------------------------------------|
| `OPENROUTER_API_KEY`| backend   | ✅        | API key for the OpenRouter AI gateway                        |
| `GITHUB_TOKEN`      | backend   | ✅        | GitHub Personal Access Token with `repo` write scope         |
| `MAX_RETRIES`       | backend   | optional | Maximum fixer iterations before giving up (default: `5`)     |
| `SANDBOX_TIMEOUT`   | backend   | optional | Max seconds per test run (default: `60`)                     |
| `SANDBOX_MODE`      | backend   | optional | `subprocess` (default/cloud) or `docker` (local isolation)   |
| `VITE_API_URL`      | frontend  | ✅        | Base URL of the backend API                                  |

---

## 🌐 Deployment

### Backend → Railway / Render / Fly.io

1. Connect your repo to the platform and set **Root Directory** to `backend`
2. Add environment variables: `OPENROUTER_API_KEY`, `GITHUB_TOKEN`, `MAX_RETRIES=5`, `SANDBOX_MODE=subprocess`
3. The platform auto-detects FastAPI and deploys

### Frontend → Vercel / Netlify

1. Connect your repo and set **Root Directory** to `frontend`
2. Add environment variable: `VITE_API_URL=https://your-deployed-backend.url`
3. Deploy

---

## 🛠️ Tech Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| AI / LLM       | OpenRouter API (OpenAI-compatible, model-agnostic) |
| Orchestration  | LangGraph `StateGraph`                          |
| Backend        | FastAPI + Uvicorn                               |
| Frontend       | Vite + React + Zustand + Recharts               |
| Styling        | Tailwind CSS                                    |
| Git Operations | GitPython                                       |
| Static Analysis| flake8, mypy, eslint, staticcheck               |
| Vulnerability  | pip-audit                                       |
| Scheduling     | APScheduler                                     |
| Sandbox        | subprocess / Docker                             |
