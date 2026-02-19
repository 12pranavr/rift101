"""
vuln_scanner.py — Scan dependency files for known CVEs.

Supported languages / tools:
  python     → pip-audit (JSON output)
  javascript → npm audit  (JSON output)
  ruby       → bundler-audit (JSON output)
  go         → nancy (JSON output)

Each finding is returned as a dict that matches the shared failure shape:
  {file, line_number, bug_type, error_message, file_content,
   cve_id, package, safe_version}

All tools degrade gracefully if not installed.
"""
import os
import sys
import json
import shutil
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger("vuln_scanner")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_file_safe(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""


def _run(cmd: list[str], cwd: str, timeout: int = 90) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout
    )


def _tool_available(tool: str) -> bool:
    return shutil.which(tool) is not None


# ---------------------------------------------------------------------------
# Python — pip-audit
# ---------------------------------------------------------------------------

def _scan_python(repo_path: str) -> list[dict]:
    findings = []
    dep_files = ["requirements.txt", "pyproject.toml", "setup.cfg"]
    dep_file = next(
        (f for f in dep_files if os.path.exists(os.path.join(repo_path, f))),
        None,
    )
    if not dep_file:
        return []

    # pip-audit installed as a Python module
    check = subprocess.run(
        [sys.executable, "-m", "pip_audit", "--version"],
        capture_output=True, text=True
    )
    if check.returncode != 0:
        logger.warning("[vuln_scanner] pip-audit not available, skipping Python vuln scan.")
        return []

    dep_path = os.path.join(repo_path, dep_file)
    proc = _run(
        [sys.executable, "-m", "pip_audit",
         "--requirement", dep_path,
         "--format=json",
         "--no-deps",
         "--progress-spinner=off"],
        cwd=repo_path,
    )

    try:
        data = json.loads(proc.stdout or proc.stderr)
    except json.JSONDecodeError:
        logger.warning(f"[vuln_scanner] pip-audit JSON parse failed: {proc.stderr[:200]}")
        return []

    dep_content = _read_file_safe(dep_path)
    for entry in data.get("dependencies", []):
        for vuln in entry.get("vulns", []):
            cve_id = vuln.get("id", "UNKNOWN")
            pkg = entry.get("name", "unknown")
            fix_versions = vuln.get("fix_versions", [])
            safe_ver = fix_versions[0] if fix_versions else "latest"
            findings.append({
                "file": dep_file,
                "line_number": 0,
                "bug_type": "VULNERABILITY",
                "error_message": (
                    f"{cve_id}: {pkg} vulnerable — {vuln.get('description', '')[:200]}. "
                    f"Fix: upgrade to {safe_ver}"
                ),
                "file_content": dep_content,
                "cve_id": cve_id,
                "package": pkg,
                "safe_version": safe_ver,
            })

    logger.info(f"[vuln_scanner] pip-audit found {len(findings)} vulnerability(ies).")
    return findings


# ---------------------------------------------------------------------------
# JavaScript — npm audit
# ---------------------------------------------------------------------------

def _scan_javascript(repo_path: str) -> list[dict]:
    findings = []
    pkg_json = os.path.join(repo_path, "package.json")
    if not os.path.exists(pkg_json):
        return []

    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        logger.warning("[vuln_scanner] npm not available, skipping JS vuln scan.")
        return []

    # npm audit requires node_modules to be installed first
    _run([npm, "install", "--prefer-offline", "--no-audit"], cwd=repo_path, timeout=120)

    proc = _run([npm, "audit", "--json"], cwd=repo_path)

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        logger.warning(f"[vuln_scanner] npm audit JSON parse failed.")
        return []

    dep_content = _read_file_safe(pkg_json)
    # npm audit v2 format uses "vulnerabilities" key
    vulnerabilities = data.get("vulnerabilities", {})
    for pkg, info in vulnerabilities.items():
        severity = info.get("severity", "low")
        if severity in ("low", "info"):
            continue  # only report medium+ severity
        via = info.get("via", [])
        for v in via:
            if not isinstance(v, dict):
                continue
            cve_id = v.get("cve", [None])[0] if isinstance(v.get("cve"), list) else "UNKNOWN"
            safe_ver = info.get("fixAvailable", {})
            safe_ver_str = safe_ver.get("version", "latest") if isinstance(safe_ver, dict) else "latest"
            findings.append({
                "file": "package.json",
                "line_number": 0,
                "bug_type": "VULNERABILITY",
                "error_message": (
                    f"{cve_id}: {pkg} ({severity}) — {v.get('title', '')}. "
                    f"Fix: upgrade to {safe_ver_str}"
                ),
                "file_content": dep_content,
                "cve_id": cve_id or "UNKNOWN",
                "package": pkg,
                "safe_version": safe_ver_str,
            })

    logger.info(f"[vuln_scanner] npm audit found {len(findings)} vulnerability(ies).")
    return findings


# ---------------------------------------------------------------------------
# Ruby — bundler-audit
# ---------------------------------------------------------------------------

def _scan_ruby(repo_path: str) -> list[dict]:
    findings = []
    gemfile_lock = os.path.join(repo_path, "Gemfile.lock")
    if not os.path.exists(gemfile_lock):
        return []

    if not _tool_available("bundle-audit") and not _tool_available("bundler-audit"):
        logger.warning("[vuln_scanner] bundler-audit not available, skipping Ruby vuln scan.")
        return []

    tool = "bundle-audit" if _tool_available("bundle-audit") else "bundler-audit"
    # Update the advisory DB first (may fail in offline env, ignore)
    _run([tool, "update"], cwd=repo_path, timeout=30)
    proc = _run([tool, "check", "--format", "json"], cwd=repo_path)

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        logger.warning("[vuln_scanner] bundler-audit JSON parse failed.")
        return []

    dep_content = _read_file_safe(gemfile_lock)
    for result in data.get("results", []):
        advisory = result.get("advisory", {})
        cve_id = advisory.get("cve", "UNKNOWN")
        pkg = result.get("gem", {}).get("name", "unknown")
        patched = advisory.get("patched_versions", ["latest"])
        safe_ver = patched[0] if patched else "latest"
        findings.append({
            "file": "Gemfile.lock",
            "line_number": 0,
            "bug_type": "VULNERABILITY",
            "error_message": (
                f"{cve_id}: {pkg} — {advisory.get('title', '')}. "
                f"Fix: upgrade to {safe_ver}"
            ),
            "file_content": dep_content,
            "cve_id": cve_id,
            "package": pkg,
            "safe_version": safe_ver,
        })

    logger.info(f"[vuln_scanner] bundler-audit found {len(findings)} vulnerability(ies).")
    return findings


# ---------------------------------------------------------------------------
# Go — nancy
# ---------------------------------------------------------------------------

def _scan_go(repo_path: str) -> list[dict]:
    findings = []
    go_sum = os.path.join(repo_path, "go.sum")
    if not os.path.exists(go_sum):
        return []

    if not _tool_available("nancy"):
        logger.warning("[vuln_scanner] nancy not available, skipping Go vuln scan.")
        return []

    go_bin = shutil.which("go")
    if not go_bin:
        logger.warning("[vuln_scanner] go binary not found, skipping Go vuln scan.")
        return []

    # nancy reads from stdin: `go list -json -m all | nancy sleuth`
    list_proc = _run([go_bin, "list", "-json", "-m", "all"], cwd=repo_path)
    nancy_proc = subprocess.run(
        ["nancy", "sleuth", "--format", "json"],
        input=list_proc.stdout,
        capture_output=True, text=True, timeout=60
    )

    try:
        data = json.loads(nancy_proc.stdout)
    except json.JSONDecodeError:
        logger.warning("[vuln_scanner] nancy JSON parse failed.")
        return []

    dep_content = _read_file_safe(go_sum)
    for item in data.get("vulnerable", []):
        pkg = item.get("Coordinates", "unknown")
        for vuln in item.get("Vulnerabilities", []):
            cve_id = vuln.get("CveList", [None])[0] or "UNKNOWN"
            safe_ver = vuln.get("VersionRanges", ["latest"])[0]
            findings.append({
                "file": "go.sum",
                "line_number": 0,
                "bug_type": "VULNERABILITY",
                "error_message": (
                    f"{cve_id}: {pkg} — {vuln.get('Title', '')}. "
                    f"Fix: upgrade to {safe_ver}"
                ),
                "file_content": dep_content,
                "cve_id": cve_id,
                "package": pkg,
                "safe_version": safe_ver,
            })

    logger.info(f"[vuln_scanner] nancy found {len(findings)} vulnerability(ies).")
    return findings


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def scan(repo_path: str, detected_languages: list[str]) -> list[dict]:
    """
    Scan dependency files for known vulnerabilities.
    Returns a list of finding dicts (empty list if nothing found or tools absent).
    """
    findings: list[dict] = []

    if "python" in detected_languages:
        findings.extend(_scan_python(repo_path))

    if "javascript" in detected_languages:
        findings.extend(_scan_javascript(repo_path))

    if "ruby" in detected_languages:
        findings.extend(_scan_ruby(repo_path))

    if "go" in detected_languages:
        findings.extend(_scan_go(repo_path))

    logger.info(f"[vuln_scanner] Total vulnerability findings: {len(findings)}")
    return findings
