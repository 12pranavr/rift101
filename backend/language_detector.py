"""
language_detector.py — Scan a cloned repo and return a list of detected languages.

Detects: python, javascript, ruby, go, java
Detection is based on file extensions AND manifest files (package.json, go.mod, etc.)
so the results are reliable even when extensions alone would be ambiguous.
"""
import os
from pathlib import Path

# Files/dirs to skip regardless
_SKIP_DIRS = {
    "node_modules", ".venv", "venv", ".git", "__pycache__",
    "dist", "build", ".gradle", "target",
}

# Extension → language mapping
_EXT_MAP = {
    ".py":   "python",
    ".js":   "javascript",
    ".ts":   "javascript",   # TypeScript is JS for testing purposes
    ".jsx":  "javascript",
    ".tsx":  "javascript",
    ".rb":   "ruby",
    ".go":   "go",
    ".java": "java",
}

# Manifest file → language (higher confidence than extensions)
_MANIFEST_MAP = {
    "package.json":   "javascript",
    "go.mod":         "go",
    "pom.xml":        "java",
    "build.gradle":   "java",
    "build.gradle.kts": "java",
    "Gemfile":        "ruby",
    "Gemfile.lock":   "ruby",
}


def detect_languages(repo_path: str) -> list[str]:
    """
    Walk *repo_path* and return a deduplicated, sorted list of detected
    programming languages, e.g. ['go', 'javascript', 'python'].
    """
    detected: set[str] = set()
    root = Path(repo_path)

    if not root.is_dir():
        return []

    for entry in root.rglob("*"):
        # Skip ignored directories
        if any(skip in entry.parts for skip in _SKIP_DIRS):
            continue

        if entry.is_file():
            # Check manifest filenames first (more reliable)
            if entry.name in _MANIFEST_MAP:
                detected.add(_MANIFEST_MAP[entry.name])

            # Check file extension
            lang = _EXT_MAP.get(entry.suffix.lower())
            if lang:
                detected.add(lang)

    result = sorted(detected)
    print(f"[language_detector] Detected languages in {os.path.basename(repo_path)}: {result}")
    return result
