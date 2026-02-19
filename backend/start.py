"""
start.py — Launch uvicorn excluding tmp_repos from WatchFiles so that cloning
repos doesn't trigger a server restart and wipe the in-memory run state.

Usage:
    python start.py
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=[
            "tmp_repos",
            "tmp_repos/*",
            "runs_state.json",
            "results_*.json",
            "__pycache__",
            ".venv",
        ],
    )
