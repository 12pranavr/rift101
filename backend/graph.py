"""
LangGraph orchestration — StateGraph with:
  analyzer_node → fixer_node → verifier_node → [loop OR end]

The conditional edge routes back to fixer if verifier reports IN_PROGRESS,
otherwise ends the graph.
"""
import os
import json
import asyncio
import shutil
from datetime import datetime, timezone
from typing import TypedDict, List, Optional, Annotated

from langgraph.graph import StateGraph, END

from agents import analyzer, fixer, verifier
from scoring import calculate_score
import pr_creator

# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    repo_url: str
    team_name: str
    leader_name: str
    branch_name: str
    local_repo_path: str
    failures: List[dict]
    fixes: List[dict]
    cicd_timeline: List[dict]
    iteration: int
    max_retries: int
    final_status: str
    start_time: str
    run_id: str
    _run_store: Optional[dict]    # reference to in-memory runs dict for progress updates
    # --- New fields for extended features ---
    detected_languages: List[str]          # e.g. ["python", "javascript", "go"]
    static_analysis_failures: List[dict]   # linter/type-checker findings
    vulnerability_findings: List[dict]     # CVE details per dependency file
    _fix_history: Optional[dict]           # {file_rel: last_generated_content} for retry context
    custom_prompt: Optional[str]           # user-supplied fix instructions (optional)
    ignore_rules: List[str]                # globs/prefixes to skip during analysis


# ---------------------------------------------------------------------------
# Node wrappers (sync → async compatible via run_in_executor)
# ---------------------------------------------------------------------------

def analyzer_node(state: AgentState) -> AgentState:
    _update_progress(state, 20, "Analyzing repository…")
    return analyzer.run(state)


def fixer_node(state: AgentState) -> AgentState:
    iteration = state.get("iteration", 1)
    _update_progress(state, 40 + iteration * 10, f"Applying fixes (iteration {iteration})…")
    return fixer.run(state)


def verifier_node(state: AgentState) -> AgentState:
    iteration = state.get("iteration", 1)
    _update_progress(state, 50 + iteration * 10, f"Verifying fixes (iteration {iteration})…")
    return verifier.run(state)


# ---------------------------------------------------------------------------
# Conditional routing
# ---------------------------------------------------------------------------

def should_continue(state: AgentState) -> str:
    """Return 'fix' to loop back, or END to finish."""
    if state.get("final_status") in ("PASSED", "FAILED"):
        return END
    return "fixer_node"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("analyzer_node", analyzer_node)
    graph.add_node("fixer_node", fixer_node)
    graph.add_node("verifier_node", verifier_node)

    graph.set_entry_point("analyzer_node")
    graph.add_edge("analyzer_node", "fixer_node")
    graph.add_edge("fixer_node", "verifier_node")
    graph.add_conditional_edges(
        "verifier_node",
        should_continue,
        {"fixer_node": "fixer_node", END: END},
    )

    return graph.compile()


_compiled_graph = build_graph()


# ---------------------------------------------------------------------------
# Entry point called by main.py
# ---------------------------------------------------------------------------

async def run_agent_graph(payload: dict, run_id: str, runs: dict) -> dict:
    """
    Run the full agent pipeline and write results_{run_id}.json.
    Returns the final results dict.
    """
    max_retries = int(os.getenv("MAX_RETRIES", "5"))
    start_dt = datetime.now(timezone.utc)

    initial_state: AgentState = {
        "repo_url": payload["repo_url"],
        "team_name": payload["team_name"],
        "leader_name": payload["leader_name"],
        "branch_name": "",
        "local_repo_path": "",
        "failures": [],
        "fixes": [],
        "cicd_timeline": [],
        "iteration": 1,
        "max_retries": max_retries,
        "final_status": "IN_PROGRESS",
        "start_time": start_dt.isoformat(),
        "run_id": run_id,
        "_run_store": runs,
        # Extended feature fields
        "detected_languages": [],
        "static_analysis_failures": [],
        "vulnerability_findings": [],
        "_fix_history": {},
        "custom_prompt": payload.get("custom_prompt") or None,
        "ignore_rules": payload.get("ignore_rules") or [],
    }

    # Run in thread executor so the async FastAPI loop isn't blocked
    loop = asyncio.get_event_loop()
    final_state: AgentState = await loop.run_in_executor(
        None, _compiled_graph.invoke, initial_state
    )

    end_dt = datetime.now(timezone.utc)
    total_time_seconds = int((end_dt - start_dt).total_seconds())

    # Calculate score based on actual results
    all_fixes = final_state.get("fixes", [])
    all_failures = final_state.get("failures", [])
    final_status_val = final_state.get("final_status", "COMPLETED")

    score = calculate_score(
        start_dt, end_dt,
        fixes=all_fixes,
        failures=all_failures,
        final_status=final_status_val,
    )


    # ---------------------------------------------------------------------------
    # Auto-create GitHub Pull Request from AI_Fix branch → default branch
    # ---------------------------------------------------------------------------
    pr_url = None
    if final_state.get("branch_name") and final_state.get("repo_url"):
        try:
            pr_url = pr_creator.create_pr(
                repo_url=final_state["repo_url"],
                branch_name=final_state["branch_name"],
                fixes=all_fixes,
                failures=all_failures,
                score=score,
                run_id=run_id,
                total_time_seconds=total_time_seconds,
            )
        except Exception as pr_exc:
            import logging as _log
            _log.getLogger("graph").warning(f"PR creation failed (non-fatal): {pr_exc}")

    results = {
        "run_id": run_id,
        "repo_url": final_state["repo_url"],
        "team_name": final_state["team_name"],
        "leader_name": final_state["leader_name"],
        "branch_name": final_state["branch_name"],
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat(),
        "total_time_seconds": total_time_seconds,
        "total_failures_detected": len(all_failures) + len(all_fixes),
        "total_fixes_applied": len([f for f in all_fixes if f.get("status") == "FIXED"]),
        "final_status": final_state.get("final_status", "FAILED"),
        "score": score,
        "pr_url": pr_url,
        "fixes": all_fixes,
        "cicd_timeline": final_state.get("cicd_timeline", []),
    }

    # Write results file
    results_path = os.path.join(os.path.dirname(__file__), f"results_{run_id}.json")
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    # Cleanup cloned repo to save disk space
    try:
        repo_path = final_state.get("local_repo_path", "")
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)
    except Exception:
        pass

    return results


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _update_progress(state: AgentState, progress: int, step: str) -> None:
    store = state.get("_run_store")
    run_id = state.get("run_id")
    if store and run_id and run_id in store:
        if hasattr(store, "update_field"):
            # PersistentRunStore — single atomic write to disk
            store.update_field(run_id, progress=progress, current_step=step)
        else:
            # Plain dict fallback
            store[run_id]["progress"] = progress
            store[run_id]["current_step"] = step
