"""
VerifierAgent — re-runs tests after fixes, records CI/CD timeline,
and decides whether to loop back to FixerAgent or end.
"""
import os
import git
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sandbox import run_tests_in_sandbox

if TYPE_CHECKING:
    from graph import AgentState


def run(state: "AgentState") -> "AgentState":
    """Verifier node — pull latest, re-run tests, update timeline."""
    local_repo_path = state["local_repo_path"]
    branch_name = state["branch_name"]
    iteration = state.get("iteration", 1)
    max_retries = state.get("max_retries", 5)
    cicd_timeline = state.get("cicd_timeline", [])

    # Pull latest from the AI_Fix branch
    try:
        repo = git.Repo(local_repo_path)
        repo.remotes.origin.pull(branch_name)
    except Exception:
        pass  # Pull may fail if no remote tracking; local state is authoritative

    # Re-run tests
    sandbox_result = run_tests_in_sandbox(local_repo_path)
    remaining_failures = sandbox_result.get("failures", [])
    all_passed = sandbox_result.get("all_passed", False) or len(remaining_failures) == 0

    status = "PASSED" if all_passed else "FAILED"

    # Record this iteration in the CI/CD timeline
    cicd_timeline.append({
        "iteration": iteration,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "failures_remaining": len(remaining_failures),
    })

    # Determine final status
    if all_passed:
        final_status = "PASSED"
    elif iteration >= max_retries:
        final_status = "FAILED"
    else:
        final_status = "IN_PROGRESS"

    state["cicd_timeline"] = cicd_timeline
    state["final_status"] = final_status
    state["iteration"] = iteration + 1
    # Update failures with only those remaining (for next fixer loop)
    state["failures"] = remaining_failures

    return state
