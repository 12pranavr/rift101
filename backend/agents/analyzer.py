"""
AnalyzerAgent — clones repo, creates AI_Fix branch, discovers tests,
runs them in the sandbox, and uses Gemini to classify each failure.
"""
import os
import glob
import logging
import tempfile
from typing import TYPE_CHECKING

from gemini_client import ask_gemini
from sandbox import run_tests_in_sandbox
from git_utils import clone_repo, create_and_checkout_branch, make_branch_name

logger = logging.getLogger("analyzer")

if TYPE_CHECKING:
    from graph import AgentState


VALID_BUG_TYPES = {"LINTING", "SYNTAX", "LOGIC", "TYPE_ERROR", "IMPORT", "INDENTATION"}

# Use the system temp directory so repos are cloned OUTSIDE OneDrive.
# OneDrive syncs everything under Desktop/rift, which causes file locks that
# make git fail with "Permission denied" when writing .git/config.
import tempfile
REPOS_DIR = os.path.join(tempfile.gettempdir(), "rift_tmp_repos")


def classify_bugs_batch(failures: list) -> list[str]:
    """
    Classify ALL failures in a SINGLE Gemini call to minimise API usage.
    Returns a list of bug type strings in the same order as failures.
    """
    if not failures:
        return []

    lines = []
    for i, f in enumerate(failures, start=1):
        lines.append(
            f"Failure {i}:\n"
            f"  Error: {f.get('error_message', '')[:300]}\n"
            f"  File content (first 800 chars): {f.get('file_content', '')[:800]}"
        )
    combined = "\n\n".join(lines)

    prompt = f"""You are a code bug classifier. Classify each failure below as exactly one of:
LINTING, SYNTAX, LOGIC, TYPE_ERROR, IMPORT, INDENTATION

{combined}

Respond with ONLY a comma-separated list of bug types in the same order, nothing else.
Example for 3 failures: LOGIC,SYNTAX,TYPE_ERROR
"""
    raw = ask_gemini(prompt).strip().upper()
    parts = [p.strip() for p in raw.split(",")]

    result = []
    for p in parts:
        result.append(p if p in VALID_BUG_TYPES else "LOGIC")

    # Pad/trim to match number of failures
    while len(result) < len(failures):
        result.append("LOGIC")
    return result[:len(failures)]


def discover_test_files(repo_path: str) -> list[str]:
    """Auto-discover test files using standard patterns — no hardcoded paths."""
    from pathlib import Path
    patterns = [
        "test_*.py",
        "*_test.py",
        "**/test_*.py",
        "**/*_test.py",
    ]
    test_files = []
    repo = Path(repo_path)
    
    print(f"[analyzer] Scanning for tests in: {repo_path}")

    for pattern in patterns:
        # Use rglob for recursive patterns
        clean_pattern = pattern.replace("**/", "") if "**/" in pattern else pattern
        for path in repo.rglob(clean_pattern):
            if path.is_file():
                try:
                    rel_path = str(path.relative_to(repo))
                    if "node_modules" not in rel_path and ".venv" not in rel_path:
                        test_files.append(rel_path)
                except Exception:
                    pass

    # Deduplicate
    unique = list(set(test_files))
    print(f"[analyzer] Found test files: {unique}")
    return unique


def run(state: "AgentState") -> "AgentState":
    """Analyzer node — mutates and returns state."""
    repo_url = state["repo_url"]
    team_name = state["team_name"]
    leader_name = state["leader_name"]
    run_id = state["run_id"]

    # Unique local path per run
    local_path = os.path.join(REPOS_DIR, run_id)
    os.makedirs(REPOS_DIR, exist_ok=True)

    # 1. Clone repo
    repo = clone_repo(repo_url, local_path)

    # 2. Create & checkout AI_Fix branch
    branch_name = make_branch_name(team_name, leader_name)
    create_and_checkout_branch(repo, branch_name)

    # 3. Discover test files
    test_files = discover_test_files(local_path)
    logger.info(f"[analyzer] Discovered {len(test_files)} test file(s): {test_files}")

    # 4. Run tests in sandbox (pass discovered files so sandbox doesn't miss non-standard names)
    sandbox_result = run_tests_in_sandbox(local_path, test_files)
    raw_failures = sandbox_result.get("failures", [])

    # 5. Enrich failures with file content before batching
    enriched = []
    for failure in raw_failures:
        file_content = failure.get("file_content", "")
        if not file_content:
            full_path = os.path.join(local_path, failure["file"])
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    file_content = f.read()
            except Exception:
                file_content = ""
        enriched.append({**failure, "file_content": file_content})

    # Single Gemini call to classify ALL failures at once
    bug_types = classify_bugs_batch(enriched)

    classified_failures = [
        {
            "file": f["file"],
            "line_number": f.get("line_number", 0),
            "bug_type": bug_types[i],
            "error_message": f.get("error_message", ""),
            "file_content": f["file_content"],
        }
        for i, f in enumerate(enriched)
    ]

    state["branch_name"] = branch_name
    state["local_repo_path"] = local_path
    state["failures"] = classified_failures
    return state
