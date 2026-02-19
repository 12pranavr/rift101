"""
Score calculation for the DevOps Agent run.

Formula:
  BASE              100 pts  (always)
  SPEED BONUS        +10     if total duration < 5 minutes
  EFFICIENCY PENALTY  -2     per commit beyond 20
"""
from datetime import datetime


def calculate_score(
    start_time: datetime,
    end_time: datetime,
    fixes: list,
    failures: list,
    final_status: str = "COMPLETED",
) -> dict:
    duration_seconds = int((end_time - start_time).total_seconds())

    # -----------------------------------------------------------------------
    # BASE — always 100
    # -----------------------------------------------------------------------
    base = 100

    # -----------------------------------------------------------------------
    # SPEED BONUS — +10 if completed in under 5 minutes (300 s)
    # -----------------------------------------------------------------------
    speed_bonus = 10 if duration_seconds < 300 else 0
    speed_tier = "< 5 min" if speed_bonus else ">= 5 min"

    # -----------------------------------------------------------------------
    # EFFICIENCY PENALTY — -2 per commit over 20
    # Commits == number of FIXED items (each fix = 1 commit by the agent)
    # -----------------------------------------------------------------------
    total_commits = len([f for f in fixes if f.get("status") == "FIXED"])
    excess_commits = max(0, total_commits - 20)
    efficiency_penalty = excess_commits * 2

    # -----------------------------------------------------------------------
    # TOTAL
    # -----------------------------------------------------------------------
    total = max(0, base + speed_bonus - efficiency_penalty)

    return {
        # fields the frontend reads
        "base": base,
        "speed_bonus": speed_bonus,
        "efficiency_penalty": efficiency_penalty,
        "total": total,
        "duration_seconds": duration_seconds,
        # extra context for UI
        "total_commits": total_commits,
        "excess_commits": excess_commits,
        "speed_tier": speed_tier,
        "max_possible": 110,   # 100 + 10
    }
