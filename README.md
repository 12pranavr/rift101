# 🤖 Autonomous DevOps Agent

An AI-powered full-stack DevOps agent that automatically detects bugs in a GitHub repository, fixes them using Google Gemini, and opens an **AI_Fix** branch with the patched code — all visible in a live React dashboard.

Built for the **RIFT Hackathon** using Google Gemini 2.5 Pro + LangGraph multi-agent orchestration.

---

## 🏗️ Architecture

```
GitHub Repo URL
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│                    LangGraph Pipeline                   │
│                                                         │
│  AnalyzerAgent → FixerAgent → VerifierAgent             │
│       │               │             │                   │
│  Clone + branch    Gemini AI    Re-run tests            │
│  Discover tests    fix + commit   → loop / end          │
│  Classify bugs     [AI-AGENT]                           │
└─────────────────────────────────────────────────────────┘
      │
      ▼
React Dashboard (real-time polling)
```

**Tech stack:**
- **AI**: Google Gemini (`gemini-3-pro-preview`) via `google-generativeai`
- **Orchestration**: LangGraph `StateGraph` (analyzer → fixer → verifier loop)
- **Backend**: FastAPI + uvicorn
- **Frontend**: Vite + React + Tailwind CSS + Zustand + Recharts
- **Git**: GitPython (auto-creates `TEAM_LEADER_AI_Fix` branch)
- **Sandbox**: subprocess (Railway) / Docker (local)

---

## 🚀 Quick Start

### 1. Clone this repo

```bash
git clone https://github.com/your-org/rift-devops-agent
cd rift-devops-agent
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GITHUB_TOKEN=your_github_pat_here
MAX_RETRIES=5
SANDBOX_TIMEOUT=60
SANDBOX_MODE=subprocess       # Use "docker" for local Docker mode
```

Start the API:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

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

## 🧠 How It Works

1. **AnalyzerAgent** — Clones the repo, creates `TEAM_LEADER_AI_Fix` branch, auto-discovers test files (Python + JS/TS), runs them in the sandbox, and asks Gemini to classify each failure as one of: `LINTING | SYNTAX | LOGIC | TYPE_ERROR | IMPORT | INDENTATION`

2. **FixerAgent** — For each failure, sends the full file + error context to Gemini 2.5 Pro to generate a fix, writes the corrected file, and commits with the exact format: `[AI-AGENT] Fix <BUG_TYPE> in <file> line <N>`

3. **VerifierAgent** — Re-runs the full test suite. If all pass → `PASSED`. If not and retries remain → loop back to FixerAgent.

---

## 📊 Dashboard Features

| Component | Description |
|---|---|
| **InputSection** | Repo URL, team name, leader name form with live branch preview |
| **ProgressBar** | Real-time progress with step indicators (Clone → Analyze → Fix → Verify → Done) |
| **RunSummaryCard** | Branch name, time taken, failures detected vs fixes applied |
| **ScoreBreakdownPanel** | Total score + Recharts bar chart (base / speed bonus / penalty) |
| **FixesAppliedTable** | Color-coded bug type badges, commit messages, fix status |
| **CICDTimeline** | Vertical timeline of each test iteration |

---

## 🧪 Scoring

```
Base Score:         100
Speed Bonus:        +10  (if total time < 5 minutes)
Efficiency Penalty: -2   (per commit beyond 20)
```

---

## 🌐 Deployment

### Backend → Railway

1. Create new Railway project, connect this repo
2. Set `Root Directory` to `backend`
3. Add env vars: `GEMINI_API_KEY`, `GITHUB_TOKEN`, `MAX_RETRIES=5`, `SANDBOX_MODE=subprocess`
4. Railway auto-detects FastAPI and deploys

### Frontend → Vercel

1. Create new Vercel project, connect this repo
2. Set `Root Directory` to `frontend`
3. Add env var: `VITE_API_URL=https://your-railway-backend.railway.app`
4. Deploy

---

## ⚙️ Environment Variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | backend | ✅ | Google AI Studio API key |
| `GITHUB_TOKEN` | backend | ✅ | GitHub PAT with repo write access |
| `MAX_RETRIES` | backend | optional | Max fix iterations (default: 5) |
| `SANDBOX_TIMEOUT` | backend | optional | Test timeout seconds (default: 60) |
| `SANDBOX_MODE` | backend | optional | `subprocess` (Railway) or `docker` (local) |
| `VITE_API_URL` | frontend | ✅ | Backend URL |

---

## ✅ Hackathon Checklist

- [x] Every commit starts with `[AI-AGENT]` prefix
- [x] Branch name is `ALL_UPPERCASE_WITH_UNDERSCORES_AI_Fix`
- [x] Never pushes to `main`
- [x] Test files auto-discovered (no hardcoded paths)
- [x] `results_{run_id}.json` generated after every run
- [x] Max 5 retries (configurable)
- [x] Gemini used for ALL AI decisions (classification + fixes)
- [x] Bug types: `LINTING`, `SYNTAX`, `LOGIC`, `TYPE_ERROR`, `IMPORT`, `INDENTATION`
- [x] Frontend polling every 2s with 5-minute timeout
- [x] Responsive mobile + desktop layout

---

## 📁 Project Structure

```
/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── graph.py             # LangGraph StateGraph
│   ├── gemini_client.py     # Gemini 2.5 Pro SDK
│   ├── scoring.py           # Score calculation
│   ├── sandbox.py           # Test runner (Docker or subprocess)
│   ├── git_utils.py         # Clone / branch / commit / push
│   ├── agents/
│   │   ├── analyzer.py      # AnalyzerAgent
│   │   ├── fixer.py         # FixerAgent
│   │   └── verifier.py      # VerifierAgent
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main with polling
│   │   ├── store/agentStore.js
│   │   └── components/
│   │       ├── InputSection.jsx
│   │       ├── ProgressBar.jsx
│   │       ├── RunSummaryCard.jsx
│   │       ├── ScoreBreakdownPanel.jsx
│   │       ├── FixesAppliedTable.jsx
│   │       └── CICDTimeline.jsx
│   └── package.json
└── docker/
    └── Dockerfile.sandbox   # Isolated test execution
```
