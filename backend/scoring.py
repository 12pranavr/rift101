"""
Score calculation for the DevOps Agent run.
"""
from datetime import datetime


def calculate_score(start_time: datetime, end_time: datetime, total_commits: int) -> dict:
    """
    Calculate the run score.
    
    - base_score:           Always 100
    - speed_bonus:          +10 if total duration < 5 minutes
    - efficiency_penalty:   -2 for each commit beyond 20
    """
    duration_seconds = (end_time - start_time).total_seconds()

    base_score = 100
    speed_bonus = 10 if duration_seconds < 300 else 0  # Under 5 minutes
    efficiency_penalty = max(0, (total_commits - 20) * 2)
    total = base_score + speed_bonus - efficiency_penalty

    return {
        "base": base_score,
        "speed_bonus": speed_bonus,
        "efficiency_penalty": efficiency_penalty,
        "total": total,
        "duration_seconds": int(duration_seconds),
    }
