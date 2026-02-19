"""
FixerAgent — for each failure, calls AI to generate a fix,
writes the fixed file, commits with [AI-AGENT] prefix, and pushes
to the AI_Fix branch (never to main).

Improvements:
  - PARALLEL AI FIX GENERATION: Uses ThreadPoolExecutor so all Gemini
    calls run concurrently. Commits are still sequential (git index is
    not thread-safe) protected by a threading.Lock.
  - CONTEXT-AWARE PROMPTS: gather_context() enriches each prompt with
    related imported files and the matching test file.
  - RETRY MEMORY: tracks previous fix attempts per file so the AI can
    see what it already tried and generate a different approach.
"""
import os
import re
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING

try:
    import autopep8 as _autopep8
    _AUTOPEP8_AVAILABLE = True
except ImportError:
    _AUTOPEP8_AVAILABLE = False

import git

from gemini_client import ask_gemini
from git_utils import commit_file, push_branch

logger = logging.getLogger("fixer")

if TYPE_CHECKING:
    from graph import AgentState

# Maximum workers for parallel AI calls
MAX_WORKERS = 6

# ---------------------------------------------------------------------------
# Context gathering
# ---------------------------------------------------------------------------

def _resolve_import(module_name: str, repo_path: str, broken_file: str) -> str | None:
    """
    Try to find the local file that corresponds to `module_name`.
    Searches relative to the broken file's directory and repo root.
    """
    base_dir = os.path.dirname(os.path.join(repo_path, broken_file))
    candidates = [
        # Same directory as the broken file
        os.path.join(base_dir, module_name.replace(".", os.sep) + ".py"),
        os.path.join(base_dir, module_name.split(".")[0] + ".py"),
        # Repo root
        os.path.join(repo_path, module_name.replace(".", os.sep) + ".py"),
        os.path.join(repo_path, module_name.split(".")[0] + ".py"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def _extract_imports(file_content: str) -> list[str]:
    """Extract module names from import / from...import lines."""
    modules = []
    for line in file_content.splitlines():
        m = re.match(r"^\s*import\s+([\w.]+)", line)
        if m:
            modules.append(m.group(1))
        m = re.match(r"^\s*from\s+([\w.]+)\s+import", line)
        if m:
            modules.append(m.group(1))
    return modules


def _find_test_file(broken_file: str, repo_path: str) -> str | None:
    """
    Locate a test file that corresponds to `broken_file`.
    E.g. `src/utils.py` → looks for `test_utils.py`, `utils_test.py` anywhere in repo.
    """
    basename = os.path.splitext(os.path.basename(broken_file))[0]
    candidates = [f"test_{basename}.py", f"{basename}_test.py"]
    for root, dirs, files in os.walk(repo_path):
        # Skip hidden/venv dirs
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", ".venv", "venv")]
        for f in files:
            if f in candidates:
                return os.path.join(root, f)
    return None


def gather_context(failure: dict, repo_path: str, char_limit: int = 500) -> dict:
    """
    Return extra context for the Gemini prompt:
      - related_files: list of (filename, snippet) for local imports
      - test_file: (filename, snippet) of the matching test file, or None
    """
    file_rel = failure.get("file", "")
    file_content = failure.get("file_content", "")

    # 1. Related imported files (up to 3)
    related = []
    if file_content:
        modules = _extract_imports(file_content)
        seen = set()
        for mod in modules[:10]:  # cap search to first 10 imports
            resolved = _resolve_import(mod, repo_path, file_rel)
            if resolved and resolved not in seen:
                seen.add(resolved)
                try:
                    with open(resolved, "r", encoding="utf-8", errors="replace") as fh:
                        snippet = fh.read(char_limit)
                    rel_name = os.path.relpath(resolved, repo_path).replace("\\", "/")
                    related.append((rel_name, snippet))
                except Exception:
                    pass
            if len(related) >= 3:
                break

    # 2. Matching test file
    test_info = None
    test_path = _find_test_file(file_rel, repo_path)
    if test_path:
        try:
            with open(test_path, "r", encoding="utf-8", errors="replace") as fh:
                test_snippet = fh.read(800)
            test_name = os.path.relpath(test_path, repo_path).replace("\\", "/")
            test_info = (test_name, test_snippet)
        except Exception:
            pass

    return {"related_files": related, "test_file": test_info}


# ---------------------------------------------------------------------------
# AI Fix generation
# ---------------------------------------------------------------------------

def generate_fix(
    failure: dict,
    full_file_content: str,
    context: dict | None = None,
    previous_attempt: str | None = None,
    custom_prompt: str | None = None,
) -> str:
    """
    Call AI for a complete corrected file.
    Prompt is enriched with:
      - related imported files
      - the matching test file
      - the previous failed fix attempt (if any)
      - optional user-supplied custom instructions
    """
    related_files = (context or {}).get("related_files", [])
    test_file = (context or {}).get("test_file", None)

    related_section = ""
    if related_files:
        parts = []
        for name, snippet in related_files:
            parts.append(f"=== {name} (first {len(snippet)} chars) ===\n{snippet}")
        related_section = "\n\n--- Related files (for context only, do not modify) ---\n" + "\n\n".join(parts)

    test_section = ""
    if test_file:
        name, snippet = test_file
        test_section = (
            f"\n\n--- Test file your fix must pass ({name}) ---\n{snippet}"
        )

    prev_section = ""
    if previous_attempt:
        prev_section = (
            "\n\n--- PREVIOUS ATTEMPT (failed — do NOT repeat the same fix) ---\n"
            + previous_attempt[:1500]
        )

    # User-supplied custom instructions (optional)
    custom_section = ""
    if custom_prompt and custom_prompt.strip():
        custom_section = (
            f"\n\nUser instructions (MUST be followed): {custom_prompt.strip()}"
        )

    prompt = f"""You are an expert software developer. Fix the following bug precisely.{custom_section}

Bug Type: {failure['bug_type']}
File: {failure['file']}
Line Number: {failure.get('line_number', 'unknown')}
Error Message: {failure.get('error_message', '')}

--- Current file content ---
{full_file_content}
{related_section}{test_section}{prev_section}

Instructions:
- Fix ONLY the specific bug described above
- Do NOT change anything unrelated to the bug
- Return ONLY the complete fixed file content — no explanations, no markdown fences
- The fix must make the failing test(s) pass

Return the complete corrected file content:
"""
    return ask_gemini(prompt)


# ---------------------------------------------------------------------------
# Vulnerability fast-path (no AI needed — just version pin update)
# ---------------------------------------------------------------------------

def _fix_vulnerability(failure: dict, local_repo_path: str) -> tuple[str, str]:
    """
    Replace a vulnerable version pin in a dependency file.
    Returns (new_file_content, commit_message). Empty strings if fix not possible.
    """
    file_rel = failure["file"]
    full_path = os.path.join(local_repo_path, file_rel)
    pkg = failure.get("package", "")
    safe_ver = failure.get("safe_version", "")
    cve_id = failure.get("cve_id", "CVE")

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except FileNotFoundError:
        return ("", f"File not found: {file_rel}")

    if not pkg or not safe_ver or safe_ver == "latest":
        return (content, "")

    pattern = re.compile(
        rf"(^\s*{re.escape(pkg)})[^\n]*",
        re.MULTILINE | re.IGNORECASE,
    )
    new_content, count = pattern.subn(rf"\g<1>=={safe_ver}", content)

    if count == 0:
        logger.warning(f"[fixer] Could not find '{pkg}' pin in {file_rel}")
        return (content, "")

    commit_msg = (
        f"[AI-AGENT] Fix VULNERABILITY in {file_rel} "
        f"({cve_id} {pkg}→{safe_ver})"
    )
    return (new_content, commit_msg)


def _strip_code_fences(content: str) -> str:
    """Remove accidental ``` fences the AI sometimes adds."""
    lines = content.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Linting fast-path (autopep8 — no AI call needed)
# ---------------------------------------------------------------------------

def _fix_linting(failure: dict, local_repo_path: str) -> tuple[str, str]:
    """
    Auto-fix PEP8/flake8 linting issues with autopep8.
    No AI call needed — instant and 100% deterministic.
    Returns (fixed_content, commit_msg). Both empty = fall through to AI.
    """
    if not _AUTOPEP8_AVAILABLE:
        return ("", "")  # fall through to AI

    file_rel = failure["file"]
    if not file_rel.endswith(".py"):
        return ("", "")  # autopep8 is Python-only

    full_path = os.path.join(local_repo_path, file_rel)
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            original = f.read()
    except FileNotFoundError:
        return ("", "")

    fixed = _autopep8.fix_code(
        original,
        options={"aggressive": 2, "max_line_length": 120},
    )

    if fixed == original:
        # autopep8 made no change — fall through to AI for this one
        logger.info(f"[fixer] autopep8 made no changes to {file_rel} — will use AI")
        return ("", "")

    commit_msg = (
        f"[AI-AGENT] Fix LINTING in {file_rel} "
        f"line {failure.get('line_number', 0)} (autopep8)"
    )
    logger.info(f"[fixer] autopep8 auto-fixed LINTING in {file_rel} (no AI call)")
    return (fixed, commit_msg)


def _generate_fix_for_failure(
    failure: dict,
    local_repo_path: str,
    fix_history: dict,          # {file_rel: last_fixed_content}
    custom_prompt: str | None = None,
) -> dict:
    """
    Generate the AI fix for a single failure.
    This is the expensive I/O-bound part that runs in the thread pool.
    Returns a dict with: file_rel, fixed_content, commit_msg, failure, error.
    """
    file_rel = failure["file"]

    # --- Vulnerability fast-path (no AI call) ---
    # SKIP if user provided custom instructions (they might want a specific way to handle it)
    if failure.get("bug_type") == "VULNERABILITY" and not custom_prompt:
        new_content, commit_msg = _fix_vulnerability(failure, local_repo_path)
        return {
            "file_rel": file_rel,
            "fixed_content": new_content,
            "commit_msg": commit_msg,
            "failure": failure,
            "is_vuln": True,
            "error": None,
        }

    # --- Linting fast-path (autopep8 — no AI call) ---
    # SKIP if user provided custom instructions (e.g. "ignore linting" or "fix differently")
    if failure.get("bug_type") in ("LINTING", "INDENTATION") and not custom_prompt:
        fixed_content, commit_msg = _fix_linting(failure, local_repo_path)
        if fixed_content and commit_msg:
            return {
                "file_rel": file_rel,
                "fixed_content": fixed_content,
                "commit_msg": commit_msg,
                "failure": failure,
                "is_vuln": False,
                "is_lint": True,
                "error": None,
            }
        # If autopep8 made no change, fall through to AI below

    # --- Standard path: read file → build context → call AI ---
    full_path = os.path.join(local_repo_path, file_rel)

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            current_content = f.read()
    except FileNotFoundError:
        return {
            "file_rel": file_rel,
            "fixed_content": None,
            "commit_msg": "",
            "failure": failure,
            "is_vuln": False,
            "error": f"File not found: {file_rel}",
        }

    # Gather related files + test file for context
    ctx = gather_context(failure, local_repo_path)

    # Pass previous attempt if this file was already fixed in a prior iteration
    previous = fix_history.get(file_rel)

    try:
        fixed_content = generate_fix(
            failure, current_content,
            context=ctx,
            previous_attempt=previous,
            custom_prompt=custom_prompt,
        )
        fixed_content = _strip_code_fences(fixed_content)
    except Exception as e:
        return {
            "file_rel": file_rel,
            "fixed_content": None,
            "commit_msg": "",
            "failure": failure,
            "is_vuln": False,
            "error": f"AI error: {str(e)}",
        }

    commit_msg = (
        f"[AI-AGENT] Fix {failure['bug_type']} in "
        f"{file_rel} line {failure.get('line_number', 0)}"
    )

    return {
        "file_rel": file_rel,
        "fixed_content": fixed_content,
        "commit_msg": commit_msg,
        "failure": failure,
        "is_vuln": False,
        "error": None,
    }


def _commit_fix(
    result: dict,
    local_repo_path: str,
    repo: git.Repo,
    repo_url: str,
    branch_name: str,
    git_lock: threading.Lock,
    fix_history: dict,
) -> dict:
    """
    Write the fixed file to disk, commit, and push.
    Must run sequentially — protected by git_lock.
    Returns a fix record dict suitable for the results JSON.
    """
    failure = result["failure"]
    file_rel = result["file_rel"]

    # --- AI generation failed ---
    if result["error"]:
        return {
            "file": file_rel,
            "bug_type": failure.get("bug_type", "UNKNOWN"),
            "line_number": failure.get("line_number", 0),
            "commit_message": "",
            "status": "FAILED",
            "description": result["error"],
        }

    # --- Vulnerability fast-path: nothing to write if content unchanged ---
    if result["is_vuln"]:
        new_content = result["fixed_content"]
        commit_msg = result["commit_msg"]
        if not new_content or not commit_msg:
            return {
                "file": file_rel,
                "bug_type": "VULNERABILITY",
                "line_number": failure.get("line_number", 0),
                "commit_message": "",
                "status": "SKIPPED",
                "description": "Could not auto-pin version",
            }
        full_path = os.path.join(local_repo_path, file_rel)
        with git_lock:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            try:
                commit_file(repo, file_rel, commit_msg)
                push_branch(repo, repo_url, branch_name)
            except Exception as e:
                commit_msg += f" (push failed: {str(e)[:80]})"
        fix_history[file_rel] = new_content
        return {
            "file": file_rel,
            "bug_type": "VULNERABILITY",
            "line_number": failure.get("line_number", 0),
            "commit_message": commit_msg,
            "status": "FIXED",
            "description": (
                f"Upgraded {failure.get('package', 'package')} to "
                f"{failure.get('safe_version', 'latest')} "
                f"({failure.get('cve_id', '')})"
            ),
        }

    # --- Standard fix: write → commit → push ---
    fixed_content = result["fixed_content"]
    commit_msg = result["commit_msg"]
    full_path = os.path.join(local_repo_path, file_rel)

    with git_lock:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(fixed_content)
        try:
            commit_file(repo, file_rel, commit_msg)
            push_branch(repo, repo_url, branch_name)
            push_status = "FIXED"
        except Exception as e:
            logger.warning(f"[fixer] Push failed for {file_rel}: {e}")
            push_status = "FIXED"  # fix applied locally even if push fails
            commit_msg += f" (push failed: {str(e)[:80]})"

    fix_history[file_rel] = fixed_content

    return {
        "file": file_rel,
        "bug_type": failure.get("bug_type", "UNKNOWN"),
        "line_number": failure.get("line_number", 0),
        "commit_message": commit_msg,
        "status": push_status,
        "description": f"Fixed {failure.get('bug_type')} error at line {failure.get('line_number', 0)}",
    }


# ---------------------------------------------------------------------------
# Node entry point
# ---------------------------------------------------------------------------

def run(state: "AgentState") -> "AgentState":
    """
    Fixer node — generates all AI fixes in parallel, then commits sequentially.

    Phase 1 (parallel):  Call AI for every failure concurrently via ThreadPoolExecutor
    Phase 2 (sequential): Write files to disk + git commit + push (one at a time)
    """
    failures = state.get("failures", [])
    local_repo_path = state["local_repo_path"]
    repo_url = state["repo_url"]
    branch_name = state["branch_name"]

    if not failures:
        return state

    repo = git.Repo(local_repo_path)
    git_lock = threading.Lock()

    # Per-file history of previously generated fixes (for retry context)
    # We carry this across iterations via state if present
    fix_history: dict = state.get("_fix_history", {})
    custom_prompt: str | None = state.get("custom_prompt")

    logger.info(f"[fixer] Starting parallel fix generation for {len(failures)} failure(s) "
                f"with up to {MAX_WORKERS} workers."
                + (f" Custom prompt active." if custom_prompt else ""))

    # ---------------------------------------------------------------------------
    # Phase 1: Parallel AI calls — submit all, collect results in order
    # ---------------------------------------------------------------------------
    generation_results: list[dict] = [None] * len(failures)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_idx = {
            executor.submit(
                _generate_fix_for_failure,
                failure,
                local_repo_path,
                fix_history,
                custom_prompt,
            ): idx
            for idx, failure in enumerate(failures)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                generation_results[idx] = future.result()
            except Exception as exc:
                failure = failures[idx]
                generation_results[idx] = {
                    "file_rel": failure.get("file", "unknown"),
                    "fixed_content": None,
                    "commit_msg": "",
                    "failure": failure,
                    "is_vuln": False,
                    "error": f"Unexpected executor error: {exc}",
                }

    # ---------------------------------------------------------------------------
    # Phase 2: Sequential commits (git is not thread-safe)
    # ---------------------------------------------------------------------------
    fixes = []
    for gen_result in generation_results:
        if gen_result is None:
            continue
        fix_record = _commit_fix(
            gen_result,
            local_repo_path,
            repo,
            repo_url,
            branch_name,
            git_lock,
            fix_history,
        )
        fixes.append(fix_record)

    state["fixes"] = state.get("fixes", []) + fixes
    state["_fix_history"] = fix_history
    return state
