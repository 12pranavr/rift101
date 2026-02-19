"""
Sandbox runner — executes tests against a cloned repo.

Strategy:
  - LOCAL  → Docker container (proper isolation)
  - RAILWAY / CI → Direct subprocess in venv (Docker-in-Docker not supported)

The env var SANDBOX_MODE controls which path is taken.
Set SANDBOX_MODE=docker for local dev, leave unset (defaults to 'subprocess') for Railway.
"""
import os
import json
import subprocess
import tempfile
import shutil
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SANDBOX_MODE = os.getenv("SANDBOX_MODE", "subprocess")   # "docker" or "subprocess"
SANDBOX_TIMEOUT = int(os.getenv("SANDBOX_TIMEOUT", "60"))
SANDBOX_IMAGE = "devops-agent-sandbox"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_tests_in_sandbox(repo_path: str, test_files: list = None) -> dict:
    """Run the test suite in the repo and return a structured result dict."""
    if SANDBOX_MODE == "docker":
        return _run_docker(repo_path)
    return _run_subprocess(repo_path, test_files or [])


# ---------------------------------------------------------------------------
# Docker mode (local dev)
# ---------------------------------------------------------------------------

def _run_docker(repo_path: str) -> dict:
    result = subprocess.run(
        [
            "docker", "run", "--rm",
            "-v", f"{repo_path}:/sandbox",
            "--memory=512m",
            "--cpus=1",
            "--network=none",
            SANDBOX_IMAGE,
        ],
        capture_output=True,
        text=True,
        timeout=SANDBOX_TIMEOUT + 60,
    )
    return _parse_test_output(result.stdout, result.stderr, repo_path)


# ---------------------------------------------------------------------------
# Subprocess mode (Railway / production)
# ---------------------------------------------------------------------------

def _run_subprocess(repo_path: str, test_files: list = None) -> dict:
    """
    Install dependencies from the repo, then run pytest with JSON report.
    Scans ALL .py files for 'def test_' so non-standard names like buggy.py are caught.
    """
    import logging
    logger = logging.getLogger("sandbox")
    result_file = os.path.join(repo_path, "test_results.json")

    # Install any requirements found in the repo
    for req_file in ["requirements.txt", "requirements-dev.txt"]:
        req_path = os.path.join(repo_path, req_file)
        if os.path.exists(req_path):
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", req_path, "-q"],
                capture_output=True,
                timeout=120,
            )

    # Ensure pytest-json-report is available
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "pytest", "pytest-json-report", "-q"],
        capture_output=True,
        timeout=60,
    )

    # Build list of target files for pytest
    # Priority: explicitly passed list (filtered to .py) → scan all .py files containing 'def test_'
    # We filter to .py because pytest only runs python files. If analyzer finds .js files, we shouldn't pass them.
    targets = [f for f in (test_files or []) if f.endswith(".py")]
    
    if not targets:
        print("[sandbox] No explicit .py test files found. Scanning for 'def test_'...")
        for py_file in Path(repo_path).rglob("*.py"):
            rel = str(py_file.relative_to(repo_path))
            if any(skip in rel for skip in ("node_modules", ".venv", "__pycache__", ".git")):
                continue
            try:
                content = py_file.read_text(encoding="utf-8", errors="replace")
                if "def test_" in content:
                    targets.append(rel)
            except Exception:
                pass
    
    print(f"[sandbox] Final test targets: {targets}")

    cmd = [
        sys.executable, "-m", "pytest",
        "--tb=short",
        "-v",
        "--json-report",
        f"--json-report-file={result_file}",
    ]
    if targets:
        cmd.extend(targets)

    proc = subprocess.run(
        cmd,
        cwd=repo_path,
        capture_output=True,
        text=True,
        timeout=SANDBOX_TIMEOUT,
    )
    logger.info(f"[sandbox] pytest exit={proc.returncode}\nSTDOUT:\n{proc.stdout[-3000:]}")
    if proc.stderr:
        logger.warning(f"[sandbox] pytest STDERR:\n{proc.stderr[-500:]}")
    return _parse_test_output(proc.stdout, proc.stderr, repo_path)


# ---------------------------------------------------------------------------
# Output parser
# ---------------------------------------------------------------------------

def _parse_test_output(stdout: str, stderr: str, repo_path: str) -> dict:
    """Parse pytest JSON report if available, otherwise fall back to stdout."""
    result_file = os.path.join(repo_path, "test_results.json")

    failures = []
    passed = 0
    total = 0

    if os.path.exists(result_file):
        try:
            with open(result_file) as f:
                data = json.load(f)

            summary = data.get("summary", {})
            passed = summary.get("passed", 0)
            total = summary.get("total", 0)

            for test in data.get("tests", []):
                if test.get("outcome") == "failed":
                    call = test.get("call", {})
                    longrepr = call.get("longrepr", "")
                    node_id = test.get("nodeid", "")

                    # Extract file path and line number from nodeid
                    file_path = node_id.split("::")[0] if "::" in node_id else node_id
                    line_number = _extract_line_number(longrepr)

                    failures.append({
                        "file": file_path,
                        "line_number": line_number,
                        "error_message": longrepr[:500],   # cap length
                        "bug_type": "UNKNOWN",              # classified later by Gemini
                        "file_content": _read_file_safe(os.path.join(repo_path, file_path)),
                    })
        except (json.JSONDecodeError, KeyError):
            failures = _parse_stdout_failures(stdout)
    else:
        failures = _parse_stdout_failures(stdout)

    return {
        "passed": passed,
        "total": total,
        "failures": failures,
        "all_passed": len(failures) == 0,
        "raw_stdout": stdout[-3000:],   # last 3k chars
        "raw_stderr": stderr[-1000:],
    }


def _extract_line_number(longrepr: str) -> int:
    """Try to extract a line number from pytest's longrepr string."""
    for line in longrepr.splitlines():
        if "line" in line.lower():
            parts = line.split()
            for i, part in enumerate(parts):
                if part.lower() == "line" and i + 1 < len(parts):
                    try:
                        return int(parts[i + 1].strip(","))
                    except ValueError:
                        pass
        # pattern like "file.py:42"
        if ":" in line:
            parts = line.split(":")
            for part in parts:
                try:
                    n = int(part.strip())
                    if 1 <= n <= 9999:
                        return n
                except ValueError:
                    pass
    return 0


def _parse_stdout_failures(stdout: str) -> list:
    """Fallback: extract failure info from raw pytest stdout."""
    failures = []
    lines = stdout.splitlines()
    current_failure = None

    for line in lines:
        if line.startswith("FAILED "):
            node_id = line.replace("FAILED ", "").split(" -")[0].strip()
            file_path = node_id.split("::")[0] if "::" in node_id else node_id
            current_failure = {
                "file": file_path,
                "line_number": 0,
                "error_message": "",
                "bug_type": "UNKNOWN",
                "file_content": "",
            }
            failures.append(current_failure)

    return failures


def _read_file_safe(path: str) -> str:
    """Read a file's content, returning empty string on error."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""
