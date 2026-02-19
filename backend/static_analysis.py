"""
static_analysis.py — Run linters per detected language and return
structured failure records ready for the FixerAgent.

Each record matches the existing failure shape:
  {file, line_number, bug_type, error_message, file_content}

Tools degrade gracefully: if a linter isn't installed the function
logs a warning and returns [] for that tool rather than crashing.
"""
import os
import sys
import json
import shutil
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger("static_analysis")

# Dirs to skip when reading file content for context
_SKIP_DIRS = {"node_modules", ".venv", "venv", "__pycache__", ".git", "dist", "build"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_file_safe(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""


def _tool_available(tool: str) -> bool:
    return shutil.which(tool) is not None


def _run(cmd: list[str], cwd: str, timeout: int = 60) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout
    )


# ---------------------------------------------------------------------------
# Python — flake8
# ---------------------------------------------------------------------------

def _run_flake8(repo_path: str) -> list[dict]:
    """Run flake8 and parse output into structured failures."""
    failures = []

    # Use the current Python interpreter's flake8 (installed via pip)
    flake8_cmd = [sys.executable, "-m", "flake8"]

    # Check if flake8 is available as a module
    check = subprocess.run(
        [sys.executable, "-m", "flake8", "--version"],
        capture_output=True, text=True
    )
    if check.returncode != 0:
        logger.warning("[static_analysis] flake8 not available, skipping Python linting.")
        return []

    proc = _run(
        flake8_cmd + [
            "--format=%(path)s:%(row)d:%(col)d: %(code)s %(text)s",
            "--max-line-length=120",
            "--extend-ignore=E501,W503",
            ".",
        ],
        cwd=repo_path,
    )

    for line in proc.stdout.splitlines():
        # Format: path/to/file.py:10:5: E302 expected 2 blank lines
        parts = line.split(":", 3)
        if len(parts) < 4:
            continue
        file_rel = parts[0].strip()
        # Make path relative to repo_path if absolute
        try:
            file_rel = str(Path(file_rel).relative_to(repo_path))
        except ValueError:
            pass
        try:
            line_no = int(parts[1])
        except ValueError:
            line_no = 0
        error_msg = parts[3].strip() if len(parts) > 3 else line

        # Skip non-Python files that may have leaked through
        if not file_rel.endswith(".py"):
            continue
        # Skip venv / hidden dirs
        if any(skip in file_rel for skip in _SKIP_DIRS):
            continue

        full_path = os.path.join(repo_path, file_rel)
        failures.append({
            "file": file_rel,
            "line_number": line_no,
            "bug_type": "LINTING",
            "error_message": f"[flake8] {error_msg}",
            "file_content": _read_file_safe(full_path),
        })

    logger.info(f"[static_analysis] flake8 found {len(failures)} issue(s).")
    return failures


# ---------------------------------------------------------------------------
# Python — mypy
# ---------------------------------------------------------------------------

def _run_mypy(repo_path: str) -> list[dict]:
    """Run mypy type checker."""
    failures = []

    check = subprocess.run(
        [sys.executable, "-m", "mypy", "--version"],
        capture_output=True, text=True
    )
    if check.returncode != 0:
        logger.warning("[static_analysis] mypy not available, skipping type checking.")
        return []

    proc = _run(
        [sys.executable, "-m", "mypy", "--ignore-missing-imports",
         "--no-error-summary", "."],
        cwd=repo_path,
    )

    for line in proc.stdout.splitlines():
        # Format: file.py:10: error: message  [error-code]
        if ": error:" not in line and ": note:" not in line:
            continue
        parts = line.split(":", 2)
        if len(parts) < 3:
            continue
        file_rel = parts[0].strip()
        try:
            file_rel = str(Path(file_rel).relative_to(repo_path))
        except ValueError:
            pass
        try:
            line_no = int(parts[1])
        except ValueError:
            line_no = 0
        error_msg = parts[2].strip()

        if not file_rel.endswith(".py"):
            continue
        if any(skip in file_rel for skip in _SKIP_DIRS):
            continue

        full_path = os.path.join(repo_path, file_rel)
        failures.append({
            "file": file_rel,
            "line_number": line_no,
            "bug_type": "TYPE_ERROR",
            "error_message": f"[mypy] {error_msg}",
            "file_content": _read_file_safe(full_path),
        })

    logger.info(f"[static_analysis] mypy found {len(failures)} issue(s).")
    return failures


# ---------------------------------------------------------------------------
# JavaScript — eslint
# ---------------------------------------------------------------------------

def _run_eslint(repo_path: str) -> list[dict]:
    """Run eslint with JSON output."""
    failures = []

    eslint_bin = shutil.which("eslint") or shutil.which("eslint.cmd")
    if not eslint_bin:
        # Try npx as fallback
        npx = shutil.which("npx") or shutil.which("npx.cmd")
        if not npx:
            logger.warning("[static_analysis] eslint not available, skipping JS linting.")
            return []
        eslint_cmd = [npx, "eslint"]
    else:
        eslint_cmd = [eslint_bin]

    proc = _run(
        eslint_cmd + ["--format=json", "--no-eslintrc",
                      "--rule", '{"no-undef": "warn", "no-unused-vars": "warn"}',
                      "**/*.js", "**/*.ts"],
        cwd=repo_path,
    )

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        logger.warning("[static_analysis] eslint JSON parse failed, skipping.")
        return []

    for file_result in data:
        file_abs = file_result.get("filePath", "")
        try:
            file_rel = str(Path(file_abs).relative_to(repo_path))
        except ValueError:
            file_rel = file_abs
        if any(skip in file_rel for skip in _SKIP_DIRS):
            continue

        for msg in file_result.get("messages", []):
            severity = msg.get("severity", 1)
            if severity < 1:
                continue
            failures.append({
                "file": file_rel,
                "line_number": msg.get("line", 0),
                "bug_type": "LINTING",
                "error_message": f"[eslint] {msg.get('ruleId', '')} — {msg.get('message', '')}",
                "file_content": _read_file_safe(file_abs),
            })

    logger.info(f"[static_analysis] eslint found {len(failures)} issue(s).")
    return failures


# ---------------------------------------------------------------------------
# Go — staticcheck
# ---------------------------------------------------------------------------

def _run_staticcheck(repo_path: str) -> list[dict]:
    """Run staticcheck for Go repos."""
    failures = []

    if not _tool_available("staticcheck"):
        logger.warning("[static_analysis] staticcheck not available, skipping Go linting.")
        return []

    proc = _run(["staticcheck", "-f=json", "./..."], cwd=repo_path)

    for line in proc.stdout.splitlines():
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        pos = obj.get("position", {})
        file_abs = pos.get("file", "")
        try:
            file_rel = str(Path(file_abs).relative_to(repo_path))
        except ValueError:
            file_rel = file_abs

        failures.append({
            "file": file_rel,
            "line_number": pos.get("line", 0),
            "bug_type": "LINTING",
            "error_message": f"[staticcheck] {obj.get('code', '')} — {obj.get('message', '')}",
            "file_content": _read_file_safe(file_abs),
        })

    logger.info(f"[static_analysis] staticcheck found {len(failures)} issue(s).")
    return failures


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_static_analysis(repo_path: str, detected_languages: list[str]) -> list[dict]:
    """
    Run all applicable linters for the given languages.
    Returns a merged list of failure dicts (may be empty).
    Failures are capped at 20 per tool to avoid overwhelming the fixer.
    """
    failures: list[dict] = []
    CAP = 20  # max issues per linter

    if "python" in detected_languages:
        failures.extend(_run_flake8(repo_path)[:CAP])
        failures.extend(_run_mypy(repo_path)[:CAP])

    if "javascript" in detected_languages:
        failures.extend(_run_eslint(repo_path)[:CAP])

    if "go" in detected_languages:
        failures.extend(_run_staticcheck(repo_path)[:CAP])

    logger.info(
        f"[static_analysis] Total static analysis findings: {len(failures)}"
    )
    return failures
