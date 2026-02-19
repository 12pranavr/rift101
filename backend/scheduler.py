"""
Scheduler — APScheduler-backed persistent job store for scheduled RIFT runs.

Usage (from main.py):
    from scheduler import add_schedule, cancel_schedule, list_schedules, start_scheduler
    start_scheduler(run_agent_graph_fn)  # call once at startup
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Awaitable

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger("scheduler")

SCHEDULES_FILE = Path(__file__).parent / "schedules.json"

_scheduler = BackgroundScheduler()
_run_fn: Callable | None = None   # set by start_scheduler()


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def _load_schedules() -> dict:
    try:
        if SCHEDULES_FILE.exists():
            return json.loads(SCHEDULES_FILE.read_text())
    except Exception as exc:
        logger.warning(f"Could not load schedules.json: {exc}")
    return {}


def _save_schedules(schedules: dict) -> None:
    try:
        SCHEDULES_FILE.write_text(json.dumps(schedules, indent=2))
    except Exception as exc:
        logger.warning(f"Could not save schedules.json: {exc}")


# ---------------------------------------------------------------------------
# Job function — called by APScheduler
# ---------------------------------------------------------------------------

def _fire_job(schedule_id: str) -> None:
    """Synchronous wrapper that runs _run_fn via asyncio."""
    import asyncio
    schedules = _load_schedules()
    entry = schedules.get(schedule_id)
    if not entry:
        return

    payload = entry["payload"]
    run_id = str(uuid.uuid4())

    logger.info(f"[scheduler] Firing scheduled run {schedule_id} → run_id={run_id}")

    # Update last_run in schedules file
    entry["last_run"] = datetime.now(timezone.utc).isoformat()
    _save_schedules(schedules)

    if _run_fn is None:
        logger.error("[scheduler] _run_fn not set — cannot fire job")
        return

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_run_fn(payload, run_id, {}))
        logger.info(f"[scheduler] Scheduled run complete: {run_id}")
    except Exception as exc:
        logger.error(f"[scheduler] Scheduled run failed: {exc}")
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def start_scheduler(run_agent_graph_fn: Callable) -> None:
    """Initialize APScheduler and re-register all saved schedules."""
    global _run_fn
    _run_fn = run_agent_graph_fn

    schedules = _load_schedules()
    for schedule_id, entry in schedules.items():
        _register_job(schedule_id, entry)

    _scheduler.start()
    logger.info(f"[scheduler] Started. {len(schedules)} schedule(s) restored.")


def _make_trigger(schedule: dict):
    """Build an APScheduler trigger from schedule dict."""
    freq = schedule.get("frequency", "once")
    time_str = schedule.get("time", "00:00")  # "HH:MM"
    day = schedule.get("day", "mon")           # mon/tue/wed/thu/fri/sat/sun

    try:
        hour, minute = [int(x) for x in time_str.split(":")]
    except Exception:
        hour, minute = 0, 0

    if freq == "daily":
        return CronTrigger(hour=hour, minute=minute)
    elif freq == "weekly":
        day_map = {"mon": "mon", "tue": "tue", "wed": "wed", "thu": "thu",
                   "fri": "fri", "sat": "sat", "sun": "sun"}
        dow = day_map.get(day.lower()[:3], "mon")
        return CronTrigger(day_of_week=dow, hour=hour, minute=minute)
    return None


def _register_job(schedule_id: str, entry: dict) -> None:
    trigger = _make_trigger(entry.get("schedule", {}))
    if trigger is None:
        return
    try:
        _scheduler.add_job(
            _fire_job,
            trigger=trigger,
            args=[schedule_id],
            id=schedule_id,
            replace_existing=True,
        )
    except Exception as exc:
        logger.warning(f"[scheduler] Could not register job {schedule_id}: {exc}")


def add_schedule(payload: dict, schedule: dict) -> dict:
    """
    Persist + register a new scheduled run.
    Returns the schedule entry including id and next_run.
    """
    schedule_id = str(uuid.uuid4())
    schedules = _load_schedules()

    entry = {
        "schedule_id": schedule_id,
        "payload": payload,
        "schedule": schedule,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_run": None,
    }
    schedules[schedule_id] = entry
    _save_schedules(schedules)
    _register_job(schedule_id, entry)

    next_run = _next_run_time(schedule_id)
    return {**entry, "next_run": next_run}


def cancel_schedule(schedule_id: str) -> bool:
    """Remove a scheduled job. Returns True if found."""
    schedules = _load_schedules()
    if schedule_id not in schedules:
        return False

    del schedules[schedule_id]
    _save_schedules(schedules)

    try:
        _scheduler.remove_job(schedule_id)
    except Exception:
        pass  # already gone

    return True


def list_schedules() -> list[dict]:
    """Return all active schedules with next_run_time."""
    schedules = _load_schedules()
    result = []
    for sid, entry in schedules.items():
        result.append({
            **entry,
            "next_run": _next_run_time(sid),
        })
    return result


def _next_run_time(schedule_id: str) -> str | None:
    try:
        job = _scheduler.get_job(schedule_id)
        if job and job.next_run_time:
            return job.next_run_time.isoformat()
    except Exception:
        pass
    return None
