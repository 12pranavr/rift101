"""
Score calculation for the DevOps Agent run.

Formula (max 200 pts):
  BASE (100 pts max)
    +10  per bug fixed (test failure / logic bug)
    +5   per linting issue auto-fixed
    +15  if ALL detected tests pass after fixing
    +10  if ZERO issues remain (perfect clean-up)
    capped at 100

  SPEED BONUS (40 pts max)
    +40  if completed in < 2 minutes
    +30  if completed in < 4 minutes
    +20  if completed in < 6 minutes
    +10  if completed in < 10 minutes
    +0   otherwise

  SEVERITY BONUS (30 pts max)
    +10  per CRITICAL / VULNERABILITY fixed
    capped at 30

  PENALTY
    -5   per bug detected but NOT fixed
    -3   per retry (wasted AI call on same file)
    -15  if final_status == "FAILED" (agent bailed out)
"""
from datetime import datetime


def calculate_score(
    start_time: datetime,
    end_time: datetime,
    fixes: list,
    failures: list,
    final_status: str = "COMPLETED",
) -> dict:
    """
    Calculate the run score from actual agent results.

    Parameters
    ----------
    fixes    : list of fix dicts from the fixer agent
    failures : list of failure dicts from the analyzer
    """
    duration_seconds = int((end_time - start_time).total_seconds())

    # -----------------------------------------------------------------------
    # Classify fixes by type
    # -----------------------------------------------------------------------
    fixed = [f for f in fixes if f.get("status") == "FIXED"]
    not_fixed = [f for f in fixes if f.get("status") != "FIXED" and f.get("status") != "SKIPPED"]

    logic_fixed   = [f for f in fixed if f.get("bug_type") not in ("LINTING", "VULNERABILITY")]
    linting_fixed = [f for f in fixed if f.get("bug_type") == "LINTING"]
    vuln_fixed    = [f for f in fixed if f.get("bug_type") == "VULNERABILITY"]
    critical_fixed = [f for f in fixed if f.get("severity", "").upper() == "CRITICAL"]

    total_detected = len(failures) + len(fixes)  # failures from initial scan + fixes attempted

    # -----------------------------------------------------------------------
    # BASE SCORE (cap 100)
    # -----------------------------------------------------------------------
    base = 0
    base += min(len(logic_fixed) * 10, 60)    # +10 per logic/syntax bug fixed, max 60
    base += min(len(linting_fixed) * 5, 25)   # +5 per linting fix, max 25

    all_tests_pass = (
        final_status == "COMPLETED"
        and len(not_fixed) == 0
        # and len(fixed) > 0  <-- REMOVED: legitimate to have 0 fixes if all were skipped or clean
    )
    if all_tests_pass:
        base += 15                             # +15 all tests green

    zero_issues_remain = all_tests_pass and total_detected == len(fixed)
    if zero_issues_remain:
        base += 10                             # +10 perfect clean repo

    base = min(base, 100)

    # -----------------------------------------------------------------------
    # SPEED BONUS (cap 40)
    # -----------------------------------------------------------------------
    if duration_seconds < 120:
        speed_bonus = 40
        speed_tier = "< 2 min"
    elif duration_seconds < 240:
        speed_bonus = 30
        speed_tier = "< 4 min"
    elif duration_seconds < 360:
        speed_bonus = 20
        speed_tier = "< 6 min"
    elif duration_seconds < 600:
        speed_bonus = 10
        speed_tier = "< 10 min"
    else:
        speed_bonus = 0
        speed_tier = "> 10 min"

    # -----------------------------------------------------------------------
    # SEVERITY BONUS (cap 30)
    # -----------------------------------------------------------------------
    severity_bonus = min(
        (len(vuln_fixed) + len(critical_fixed)) * 10,
        30,
    )

    # -----------------------------------------------------------------------
    # PENALTIES
    # -----------------------------------------------------------------------
    unfixed_penalty = len(not_fixed) * 5       # -5 per unresolved bug
    failed_penalty  = 15 if final_status == "FAILED" else 0
    total_penalty   = unfixed_penalty + failed_penalty

    # -----------------------------------------------------------------------
    # TOTAL
    # -----------------------------------------------------------------------
    total = max(0, base + speed_bonus + severity_bonus - total_penalty)

    return {
        # fields the frontend already reads
        "base": base,
        "speed_bonus": speed_bonus,
        "efficiency_penalty": total_penalty,
        "total": total,
        "duration_seconds": duration_seconds,
        # extra breakdown for rich UI
        "severity_bonus": severity_bonus,
        "logic_bugs_fixed": len(logic_fixed),
        "linting_fixed": len(linting_fixed),
        "vulnerabilities_fixed": len(vuln_fixed),
        "bugs_not_fixed": len(not_fixed),
        "all_tests_pass": all_tests_pass,
        "speed_tier": speed_tier,
        "max_possible": 170,   # 100 + 40 + 30
    }
