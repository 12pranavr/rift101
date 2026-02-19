"""
FixerAgent — for each failure, calls Gemini to generate a fix,
writes the fixed file, commits with [AI-AGENT] prefix, and pushes
to the AI_Fix branch (never to main).
"""
import os
import time
import logging
import git
from typing import TYPE_CHECKING

from gemini_client import ask_gemini
from git_utils import commit_file, push_branch

logger = logging.getLogger("fixer")

if TYPE_CHECKING:
    from graph import AgentState


def generate_fix(failure: dict, full_file_content: str) -> str:
    """Call Gemini 2.5 Pro for a complete corrected file."""
    prompt = f"""You are an expert Python/JavaScript developer. Fix the following bug.

Bug Type: {failure['bug_type']}
File: {failure['file']}
Line Number: {failure['line_number']}
Error Message: {failure['error_message']}

Current file content:
{full_file_content}

Instructions:
- Fix ONLY the specific bug mentioned
- Do not change anything else
- Return ONLY the complete fixed file content, no explanations
- Do not include markdown code fences in your response
- The fix must make the tests pass

Return the complete corrected file content:
"""
    return ask_gemini(prompt)


def fix_single_failure(
    failure: dict,
    local_repo_path: str,
    repo: git.Repo,
    repo_url: str,
    branch_name: str,
) -> dict:
    """
    Fix one failure: get Gemini fix → write file → commit → push.
    Returns a fix record dict.
    """
    file_rel_path = failure["file"]
    full_path = os.path.join(local_repo_path, file_rel_path)

    # Read current content
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            current_content = f.read()
    except FileNotFoundError:
        return {
            "file": file_rel_path,
            "bug_type": failure["bug_type"],
            "line_number": failure["line_number"],
            "commit_message": "",
            "status": "FAILED",
            "description": f"File not found: {file_rel_path}",
        }

    # Get fix from Gemini
    try:
        fixed_content = generate_fix(failure, current_content)
    except Exception as e:
        return {
            "file": file_rel_path,
            "bug_type": failure["bug_type"],
            "line_number": failure["line_number"],
            "commit_message": "",
            "status": "FAILED",
            "description": f"Gemini error: {str(e)}",
        }

    # Strip accidental markdown code fences
    fixed_content = _strip_code_fences(fixed_content)

    # Write fix to disk
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(fixed_content)

    # Commit with mandatory [AI-AGENT] prefix
    commit_msg = (
        f"[AI-AGENT] Fix {failure['bug_type']} in "
        f"{file_rel_path} line {failure['line_number']}"
    )
    commit_file(repo, file_rel_path, commit_msg)

    # Push to AI_Fix branch — NEVER to main
    try:
        push_branch(repo, repo_url, branch_name)
        push_status = "FIXED"
    except Exception as e:
        print(f"[fixer] Push FAILED for branch {branch_name}: {e}")
        push_status = "FIXED"   # Fix was applied locally even if push fails remotely
        commit_msg += f" (push failed: {str(e)[:80]})"

    return {
        "file": file_rel_path,
        "bug_type": failure["bug_type"],
        "line_number": failure["line_number"],
        "commit_message": commit_msg,
        "status": push_status,
        "description": f"Fixed {failure['bug_type']} error at line {failure['line_number']}",
    }


def _strip_code_fences(content: str) -> str:
    """Remove accidental ``` fences Gemini sometimes adds."""
    lines = content.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)


def run(state: "AgentState") -> "AgentState":
    """
    Fixer node — processes each failure sequentially and records fixes.
    (Parallel processing is handled via LangGraph Send API in graph.py)
    """
    failures = state.get("failures", [])
    local_repo_path = state["local_repo_path"]
    repo_url = state["repo_url"]
    branch_name = state["branch_name"]

    repo = git.Repo(local_repo_path)
    fixes = []

    for i, failure in enumerate(failures):
        # Small throttle between calls to respect free-tier RPM limits
        if i > 0:
            time.sleep(5)
        fix_result = fix_single_failure(
            failure, local_repo_path, repo, repo_url, branch_name
        )
        fixes.append(fix_result)

    state["fixes"] = state.get("fixes", []) + fixes
    return state
