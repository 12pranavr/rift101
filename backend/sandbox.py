"""
Sandbox runner — executes tests against a cloned repo.

Strategy:
  - LOCAL  → Docker container (proper isolation)
  - RAILWAY / CI → Direct subprocess in venv (Docker-in-Docker not supported)

The env var SANDBOX_MODE controls which path is taken.
Set SANDBOX_MODE=docker for local dev, leave unset (defaults to 'subprocess') for Railway.
"""
import os
import json
import subprocess
import tempfile
import shutil
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SANDBOX_MODE = os.getenv("SANDBOX_MODE", "subprocess")   # "docker" or "subprocess"
SANDBOX_TIMEOUT = int(os.getenv("SANDBOX_TIMEOUT", "60"))
SANDBOX_IMAGE = "devops-agent-sandbox"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_tests_in_sandbox(repo_path: str, test_files: list = None) -> dict:
    """Run the test suite in the repo and return a structured result dict."""
    if SANDBOX_MODE == "docker":
        return _run_docker(repo_path)
    return _run_subprocess(repo_path, test_files or [])


def run_all_language_tests(
    repo_path: str,
    detected_languages: list[str],
    test_files: list = None,
) -> dict:
    """
    Run the appropriate test suite per detected language and merge results.
    Returns the same {passed, total, failures, all_passed} dict shape as
    run_tests_in_sandbox() so all downstream code is compatible.
    """
    merged = {
        "passed": 0,
        "total": 0,
        "failures": [],
        "all_passed": True,
        "raw_stdout": "",
        "raw_stderr": "",
    }

    runners = []
    if "python" in detected_languages:
        runners.append(("python", run_tests_in_sandbox, repo_path, test_files))
    if "javascript" in detected_languages:
        runners.append(("javascript", _run_js_tests, repo_path, None))
    if "ruby" in detected_languages:
        runners.append(("ruby", _run_ruby_tests, repo_path, None))
    if "go" in detected_languages:
        runners.append(("go", _run_go_tests, repo_path, None))
    if "java" in detected_languages:
        runners.append(("java", _run_java_tests, repo_path, None))

    # If no specific language detected (or only python), fall back to default
    if not runners:
        return run_tests_in_sandbox(repo_path, test_files or [])

    for lang, runner_fn, rpath, tfiles in runners:
        print(f"[sandbox] Running {lang} tests in {os.path.basename(rpath)}…")
        try:
            result = runner_fn(rpath, tfiles) if tfiles is not None else runner_fn(rpath)
        except Exception as exc:
            print(f"[sandbox] {lang} test runner error: {exc}")
            continue
        merged["passed"] += result.get("passed", 0)
        merged["total"] += result.get("total", 0)
        merged["failures"].extend(result.get("failures", []))
        merged["raw_stdout"] += result.get("raw_stdout", "")
        merged["raw_stderr"] += result.get("raw_stderr", "")

    merged["all_passed"] = len(merged["failures"]) == 0
    return merged


# ---------------------------------------------------------------------------
# Docker mode (local dev)
# ---------------------------------------------------------------------------

def _run_docker(repo_path: str) -> dict:
    result = subprocess.run(
        [
            "docker", "run", "--rm",
            "-v", f"{repo_path}:/sandbox",
            "--memory=512m",
            "--cpus=1",
            "--network=none",
            SANDBOX_IMAGE,
        ],
        capture_output=True,
        text=True,
        timeout=SANDBOX_TIMEOUT + 60,
    )
    return _parse_test_output(result.stdout, result.stderr, repo_path)


# ---------------------------------------------------------------------------
# Subprocess mode (Railway / production)
# ---------------------------------------------------------------------------

def _run_subprocess(repo_path: str, test_files: list = None) -> dict:
    """
    Install dependencies from the repo, then run pytest with JSON report.
    Scans ALL .py files for 'def test_' so non-standard names like buggy.py are caught.
    """
    import logging
    logger = logging.getLogger("sandbox")
    result_file = os.path.join(repo_path, "test_results.json")

    # Install any requirements found in the repo
    for req_file in ["requirements.txt", "requirements-dev.txt"]:
        req_path = os.path.join(repo_path, req_file)
        if os.path.exists(req_path):
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", req_path, "-q"],
                capture_output=True,
                timeout=120,
            )

    # Ensure pytest-json-report is available
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "pytest", "pytest-json-report", "-q"],
        capture_output=True,
        timeout=60,
    )

    # Build list of target files for pytest
    # Priority: explicitly passed list (filtered to .py) → scan all .py files containing 'def test_'
    # We filter to .py because pytest only runs python files. If analyzer finds .js files, we shouldn't pass them.
    targets = [f for f in (test_files or []) if f.endswith(".py")]
    
    if not targets:
        print("[sandbox] No explicit .py test files found. Scanning for 'def test_'...")
        for py_file in Path(repo_path).rglob("*.py"):
            rel = str(py_file.relative_to(repo_path))
            if any(skip in rel for skip in ("node_modules", ".venv", "__pycache__", ".git")):
                continue
            try:
                content = py_file.read_text(encoding="utf-8", errors="replace")
                if "def test_" in content:
                    targets.append(rel)
            except Exception:
                pass
    
    print(f"[sandbox] Final test targets: {targets}")

    cmd = [
        sys.executable, "-m", "pytest",
        "--tb=short",
        "-v",
        "--json-report",
        f"--json-report-file={result_file}",
    ]
    if targets:
        cmd.extend(targets)

    proc = subprocess.run(
        cmd,
        cwd=repo_path,
        capture_output=True,
        text=True,
        timeout=SANDBOX_TIMEOUT,
    )
    logger.info(f"[sandbox] pytest exit={proc.returncode}\nSTDOUT:\n{proc.stdout[-3000:]}")
    if proc.stderr:
        logger.warning(f"[sandbox] pytest STDERR:\n{proc.stderr[-500:]}")
    return _parse_test_output(proc.stdout, proc.stderr, repo_path)


# ---------------------------------------------------------------------------
# Output parser
# ---------------------------------------------------------------------------

def _parse_test_output(stdout: str, stderr: str, repo_path: str) -> dict:
    """Parse pytest JSON report if available, otherwise fall back to stdout."""
    result_file = os.path.join(repo_path, "test_results.json")

    failures = []
    passed = 0
    total = 0

    if os.path.exists(result_file):
        try:
            with open(result_file) as f:
                data = json.load(f)

            summary = data.get("summary", {})
            passed = summary.get("passed", 0)
            total = summary.get("total", 0)

            for test in data.get("tests", []):
                if test.get("outcome") == "failed":
                    call = test.get("call", {})
                    longrepr = call.get("longrepr", "")
                    node_id = test.get("nodeid", "")

                    # Extract file path and line number from nodeid
                    file_path = node_id.split("::")[0] if "::" in node_id else node_id
                    line_number = _extract_line_number(longrepr)

                    failures.append({
                        "file": file_path,
                        "line_number": line_number,
                        "error_message": longrepr[:500],   # cap length
                        "bug_type": "UNKNOWN",              # classified later by Gemini
                        "file_content": _read_file_safe(os.path.join(repo_path, file_path)),
                    })
        except (json.JSONDecodeError, KeyError):
            failures = _parse_stdout_failures(stdout)
    else:
        failures = _parse_stdout_failures(stdout)

    return {
        "passed": passed,
        "total": total,
        "failures": failures,
        "all_passed": len(failures) == 0,
        "raw_stdout": stdout[-3000:],   # last 3k chars
        "raw_stderr": stderr[-1000:],
    }


def _extract_line_number(longrepr: str) -> int:
    """Try to extract a line number from pytest's longrepr string."""
    for line in longrepr.splitlines():
        if "line" in line.lower():
            parts = line.split()
            for i, part in enumerate(parts):
                if part.lower() == "line" and i + 1 < len(parts):
                    try:
                        return int(parts[i + 1].strip(","))
                    except ValueError:
                        pass
        # pattern like "file.py:42"
        if ":" in line:
            parts = line.split(":")
            for part in parts:
                try:
                    n = int(part.strip())
                    if 1 <= n <= 9999:
                        return n
                except ValueError:
                    pass
    return 0


def _parse_stdout_failures(stdout: str) -> list:
    """Fallback: extract failure info from raw pytest stdout."""
    failures = []
    lines = stdout.splitlines()
    current_failure = None

    for line in lines:
        if line.startswith("FAILED "):
            node_id = line.replace("FAILED ", "").split(" -")[0].strip()
            file_path = node_id.split("::")[0] if "::" in node_id else node_id
            current_failure = {
                "file": file_path,
                "line_number": 0,
                "error_message": "",
                "bug_type": "UNKNOWN",
                "file_content": "",
            }
            failures.append(current_failure)

    return failures


def _read_file_safe(path: str) -> str:
    """Read a file's content, returning empty string on error."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Per-language test runner helpers (called by run_all_language_tests)
# ---------------------------------------------------------------------------

def _empty_result(raw_stdout: str = "", raw_stderr: str = "") -> dict:
    return {
        "passed": 0, "total": 0,
        "failures": [], "all_passed": True,
        "raw_stdout": raw_stdout, "raw_stderr": raw_stderr,
    }


def _run_js_tests(repo_path: str) -> dict:
    """Run npm test / npx vitest and return structured result."""
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm or not os.path.exists(os.path.join(repo_path, "package.json")):
        return _empty_result()

    # Try npm test first
    proc = subprocess.run(
        [npm, "test", "--", "--reporter=json", "--passWithNoTests"],
        cwd=repo_path, capture_output=True, text=True, timeout=SANDBOX_TIMEOUT,
    )
    # If that fails, fall back to vitest
    if proc.returncode not in (0, 1):
        npx = shutil.which("npx") or shutil.which("npx.cmd")
        if npx:
            proc = subprocess.run(
                [npx, "vitest", "run", "--reporter=json"],
                cwd=repo_path, capture_output=True, text=True,
                timeout=SANDBOX_TIMEOUT,
            )

    failures = []
    try:
        data = json.loads(proc.stdout or "{}")
        test_results = data.get("testResults", data.get("results", []))
        passed = 0
        total = 0
        for suite in test_results:
            for t in suite.get("assertionResults", suite.get("tests", [])):
                total += 1
                if t.get("status") in ("passed", "pass"):
                    passed += 1
                else:
                    failures.append({
                        "file": suite.get("testFilePath", "unknown.js"),
                        "line_number": 0,
                        "bug_type": "UNKNOWN",
                        "error_message": " ".join(t.get("failureMessages", [t.get("name", "")])),
                        "file_content": _read_file_safe(suite.get("testFilePath", "")),
                    })
        return {
            "passed": passed, "total": total,
            "failures": failures,
            "all_passed": len(failures) == 0,
            "raw_stdout": proc.stdout[-2000:],
            "raw_stderr": proc.stderr[-500:],
        }
    except (json.JSONDecodeError, KeyError):
        return _empty_result(proc.stdout[-2000:], proc.stderr[-500:])


def _run_ruby_tests(repo_path: str) -> dict:
    """Run RSpec via bundler and return structured result."""
    bundle = shutil.which("bundle") or shutil.which("bundle.cmd")
    if not bundle or not os.path.exists(os.path.join(repo_path, "Gemfile")):
        return _empty_result()

    proc = subprocess.run(
        [bundle, "exec", "rspec", "--format", "json"],
        cwd=repo_path, capture_output=True, text=True, timeout=SANDBOX_TIMEOUT,
    )

    failures = []
    try:
        data = json.loads(proc.stdout or "{}")
        summary = data.get("summary", {})
        passed = summary.get("example_count", 0) - summary.get("failure_count", 0)
        total = summary.get("example_count", 0)
        for ex in data.get("examples", []):
            if ex.get("status") == "failed":
                failures.append({
                    "file": ex.get("file_path", "unknown.rb"),
                    "line_number": ex.get("line_number", 0),
                    "bug_type": "UNKNOWN",
                    "error_message": ex.get("exception", {}).get("message", ""),
                    "file_content": _read_file_safe(
                        os.path.join(repo_path, ex.get("file_path", ""))
                    ),
                })
        return {
            "passed": passed, "total": total,
            "failures": failures,
            "all_passed": len(failures) == 0,
            "raw_stdout": proc.stdout[-2000:],
            "raw_stderr": proc.stderr[-500:],
        }
    except (json.JSONDecodeError, KeyError):
        return _empty_result(proc.stdout[-2000:], proc.stderr[-500:])


def _run_go_tests(repo_path: str) -> dict:
    """Run `go test ./... -json` and return structured result."""
    go_bin = shutil.which("go")
    if not go_bin or not os.path.exists(os.path.join(repo_path, "go.mod")):
        return _empty_result()

    proc = subprocess.run(
        [go_bin, "test", "./...", "-json"],
        cwd=repo_path, capture_output=True, text=True, timeout=SANDBOX_TIMEOUT,
    )

    failures = []
    passed = 0
    total = 0
    for line in proc.stdout.splitlines():
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        action = obj.get("Action")
        if action == "pass":
            passed += 1
            total += 1
        elif action == "fail":
            total += 1
            failures.append({
                "file": obj.get("Package", "unknown.go"),
                "line_number": 0,
                "bug_type": "UNKNOWN",
                "error_message": obj.get("Output", ""),
                "file_content": "",
            })

    return {
        "passed": passed, "total": total,
        "failures": failures,
        "all_passed": len(failures) == 0,
        "raw_stdout": proc.stdout[-2000:],
        "raw_stderr": proc.stderr[-500:],
    }


def _run_java_tests(repo_path: str) -> dict:
    """Run Maven or Gradle tests and return structured result (best-effort)."""
    mvn = shutil.which("mvn") or shutil.which("mvn.cmd")
    gradle = shutil.which("gradle") or shutil.which("gradlew")

    if mvn and os.path.exists(os.path.join(repo_path, "pom.xml")):
        proc = subprocess.run(
            [mvn, "test", "-q"],
            cwd=repo_path, capture_output=True, text=True, timeout=SANDBOX_TIMEOUT * 2,
        )
    elif gradle and (
        os.path.exists(os.path.join(repo_path, "build.gradle"))
        or os.path.exists(os.path.join(repo_path, "build.gradle.kts"))
    ):
        proc = subprocess.run(
            [gradle, "test"],
            cwd=repo_path, capture_output=True, text=True, timeout=SANDBOX_TIMEOUT * 2,
        )
    else:
        return _empty_result()

    # Parse failures from stdout (Maven / Gradle don't have easy JSON output in basic mode)
    failures = []
    for line in proc.stdout.splitlines() + proc.stderr.splitlines():
        if "FAILED" in line or "BUILD FAILURE" in line:
            failures.append({
                "file": "unknown.java",
                "line_number": 0,
                "bug_type": "UNKNOWN",
                "error_message": line.strip(),
                "file_content": "",
            })

    success = proc.returncode == 0
    return {
        "passed": 0 if not success else 1,
        "total": max(1, len(failures)),
        "failures": failures,
        "all_passed": success,
        "raw_stdout": proc.stdout[-2000:],
        "raw_stderr": proc.stderr[-500:],
    }
