"""
AnalyzerAgent — clones repo, creates AI_Fix branch, discovers tests,
runs them in the sandbox, and uses Gemini to classify each failure.

New (extended features):
  - Detects languages in the repo via language_detector
  - Runs static analysis (flake8/mypy/eslint/staticcheck) via static_analysis
  - Scans for dependency vulnerabilities via vuln_scanner
  - Dispatches multi-language test runners via sandbox.run_all_language_tests
"""
import os
import glob
import logging
import fnmatch
import tempfile
from typing import TYPE_CHECKING

from gemini_client import ask_gemini
from sandbox import run_tests_in_sandbox, run_all_language_tests
from git_utils import clone_repo, create_and_checkout_branch, make_branch_name
from language_detector import detect_languages
from static_analysis import run_static_analysis
import vuln_scanner

logger = logging.getLogger("analyzer")

if TYPE_CHECKING:
    from graph import AgentState


VALID_BUG_TYPES = {
    "LINTING", "SYNTAX", "LOGIC", "TYPE_ERROR", "IMPORT",
    "INDENTATION", "VULNERABILITY",
}

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
        # Python
        "test_*.py",
        "*_test.py",
        "**/test_*.py",
        "**/*_test.py",
        # Ruby
        "spec/**/*_spec.rb",
        "**/*_spec.rb",
        # Go (go test discovers *_test.go automatically; we still list for reference)
        "**/*_test.go",
        # Java
        "**/*Test.java",
        "**/*Tests.java",
        "**/*IT.java",
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


def _is_ignored(path_rel: str, rules: list[str]) -> bool:
    """Return True if path_rel matches any of the ignore rules."""
    for rule in rules:
        rule = rule.strip()
        if not rule or rule.startswith('#'):
            continue
        if rule.startswith('/'):
            # Directory prefix match
            if path_rel.replace('\\', '/').startswith(rule.lstrip('/')):
                return True
        elif fnmatch.fnmatch(os.path.basename(path_rel), rule):
            return True
    return False


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

    # 3. Detect languages present in the repo
    detected_languages = detect_languages(local_path)
    logger.info(f"[analyzer] Detected languages: {detected_languages}")
    state["detected_languages"] = detected_languages

    # 4. Run static analysis BEFORE tests (pre-pended so fixer handles them first)
    print("[analyzer] Running static analysis…")
    static_failures = run_static_analysis(local_path, detected_languages)
    state["static_analysis_failures"] = static_failures
    logger.info(f"[analyzer] Static analysis found {len(static_failures)} issue(s).")

    # 5. Scan for dependency vulnerabilities
    print("[analyzer] Scanning dependencies for vulnerabilities…")
    vuln_findings = vuln_scanner.scan(local_path, detected_languages)
    state["vulnerability_findings"] = vuln_findings
    logger.info(f"[analyzer] Vulnerability scan found {len(vuln_findings)} finding(s).")

    # 6. Discover test files (multi-language patterns) — filtered by ignore_rules
    ignore_rules = state.get("ignore_rules") or []
    test_files = discover_test_files(local_path)
    if ignore_rules:
        before = len(test_files)
        test_files = [f for f in test_files if not _is_ignored(f, ignore_rules)]
        logger.info(f"[analyzer] Ignored {before - len(test_files)} test file(s) via ignore_rules.")
    logger.info(f"[analyzer] Discovered {len(test_files)} test file(s): {test_files}")

    # 7. Run tests in sandbox using multi-language dispatcher
    sandbox_result = run_all_language_tests(local_path, detected_languages, test_files)
    raw_failures = sandbox_result.get("failures", [])

    # 8. Enrich test failures with file content before batching
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

    # Single Gemini call to classify ALL test failures at once
    bug_types = classify_bugs_batch(enriched)

    classified_test_failures = [
        {
            "file": f["file"],
            "line_number": f.get("line_number", 0),
            "bug_type": bug_types[i],
            "error_message": f.get("error_message", ""),
            "file_content": f["file_content"],
        }
        for i, f in enumerate(enriched)
    ]

    # Merge: static analysis + vuln findings first, then test failures
    # This ensures structural/security issues are fixed before re-running tests
    all_failures = static_failures + vuln_findings + classified_test_failures

    state["branch_name"] = branch_name
    state["local_repo_path"] = local_path
    state["failures"] = all_failures
    return state
