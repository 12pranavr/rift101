"""
FastAPI entrypoint — DevOps Agent REST API.
"""
import os
import json
import uuid
import logging
import traceback
import threading
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from graph import run_agent_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("devops-agent")

load_dotenv()

app = FastAPI(title="Autonomous DevOps Agent API", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS — allows local frontend + Vercel production deployment
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Vercel URLs are dynamic; use * with token auth in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Persistent run state — survives uvicorn hot-reloads
# Files in tmp_repos trigger WatchFiles → server restart → in-memory dict wiped.
# Solution: back the runs dict with a JSON file on disk.
# ---------------------------------------------------------------------------

RUNS_FILE = Path(__file__).parent / "runs_state.json"
_runs_lock = threading.Lock()


def _load_runs() -> dict:
    """Load run state from disk, returning empty dict on any error."""
    try:
        if RUNS_FILE.exists():
            with open(RUNS_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_runs(runs: dict) -> None:
    """Persist run state to disk (best-effort, never raises)."""
    try:
        with open(RUNS_FILE, "w") as f:
            json.dump(runs, f)
    except Exception as exc:
        logger.warning(f"Could not persist runs state: {exc}")


class PersistentRunStore:
    """
    Thin wrapper around a JSON file so that run state survives server restarts
    caused by uvicorn's WatchFiles detecting changes inside tmp_repos/.
    Thread-safe for the single-process case (uvicorn --workers=1).
    """

    def __init__(self):
        self._cache: dict = _load_runs()

    # dict-like interface expected by graph.py / _execute_agent
    def __contains__(self, key: str) -> bool:
        return key in self._cache

    def __getitem__(self, key: str):
        return self._cache[key]

    def __setitem__(self, key: str, value):
        with _runs_lock:
            self._cache[key] = value
            _save_runs(self._cache)

    def get(self, key: str, default=None):
        return self._cache.get(key, default)

    def update_field(self, run_id: str, **kwargs):
        """Atomically update one or more fields of a run and persist."""
        with _runs_lock:
            if run_id in self._cache:
                self._cache[run_id].update(kwargs)
                _save_runs(self._cache)

    def reload(self):
        """Re-read from disk (called at startup after a restart)."""
        with _runs_lock:
            self._cache = _load_runs()


runs = PersistentRunStore()


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class RunAgentRequest(BaseModel):
    repo_url: str
    team_name: str
    leader_name: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
async def health():
    return {"status": "ok", "service": "Autonomous DevOps Agent"}


@app.post("/api/run-agent")
async def run_agent(payload: RunAgentRequest, background_tasks: BackgroundTasks):
    """Start an agent run in the background and return a run_id for polling."""
    run_id = str(uuid.uuid4())
    runs[run_id] = {
        "status": "running",
        "progress": 5,
        "current_step": "Initializing agent…",
        "error": None,
    }
    background_tasks.add_task(_execute_agent, run_id, payload.dict())
    return {"run_id": run_id, "status": "started"}


@app.get("/api/status/{run_id}")
async def get_status(run_id: str):
    """Poll agent progress. Returns progress (0-100) and current_step."""
    # Always re-read from disk so a restarted process can answer for runs
    # that were started before the restart.
    runs.reload()
    run = runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/api/results/{run_id}")
async def get_results(run_id: str):
    """Retrieve final results JSON for a completed run."""
    results_path = Path(__file__).parent / f"results_{run_id}.json"
    if not results_path.exists():
        raise HTTPException(status_code=404, detail="Results not ready yet")
    with open(results_path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Background task executor
# ---------------------------------------------------------------------------

async def _execute_agent(run_id: str, payload: dict):
    try:
        runs.update_field(run_id, current_step="Cloning repository…", progress=10)

        result = await run_agent_graph(payload, run_id, runs)

        runs.update_field(
            run_id,
            status="complete",
            progress=100,
            current_step="Done ✓",
        )

    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[Run {run_id}] Agent error:\n{tb}")
        runs.update_field(
            run_id,
            status="error",
            error=str(e),
            error_detail=tb,
            current_step=f"Error: {str(e)[:200]}",
        )
