"""Repository walker and language dispatch.

Walks a cloned repository directory, applies sandbox limits, and dispatches each
supported source file to the appropriate static parser. In Phase 1 only Python
is deeply parsed; other recognised languages are recorded as files with a
detected language so the overview reflects the true language mix. Deep
multi-language parsing (Tree-sitter) lands in a later phase.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from app.analysis.models import ParsedFile
from app.analysis.python_parser import parse_python_source
from app.core.logging import get_logger
from app.core.security import is_within_base

logger = get_logger("devos.parser")

# Map file extension -> language label. Only python is deeply parsed for now.
LANGUAGE_BY_EXT: dict[str, str] = {
    ".py": "python",
    ".pyi": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
    ".java": "java",
    ".rb": "ruby",
    ".rs": "rust",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".php": "php",
}

# Directories that never contain first-party source worth analysing.
IGNORED_DIRS: frozenset[str] = frozenset(
    {
        ".git",
        "node_modules",
        "venv",
        ".venv",
        "__pycache__",
        "dist",
        "build",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".tox",
        ".next",
        "site-packages",
        "vendor",
        ".idea",
        ".vscode",
    }
)


def detect_language(path: Path) -> str | None:
    return LANGUAGE_BY_EXT.get(path.suffix.lower())


def iter_source_files(
    root: Path,
    max_files: int,
    max_file_bytes: int,
) -> Iterator[Path]:
    """Yield source file paths under ``root`` within sandbox limits.

    - Ignored directories are pruned.
    - Files larger than ``max_file_bytes`` are skipped (bounded resource use).
    - Every path is verified to remain inside ``root`` (no symlink escapes).
    - Yields at most ``max_files`` files.
    """
    count = 0
    for path in sorted(root.rglob("*")):
        if count >= max_files:
            logger.warning(
                "max_files limit reached",
                extra={"extra": {"max_files": max_files}},
            )
            break
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        if not path.is_file():
            continue
        if not is_within_base(root, path):
            # Symlink or traversal attempt pointing outside the sandbox.
            logger.warning(
                "skipping path outside sandbox",
                extra={"extra": {"path": str(path)}},
            )
            continue
        if detect_language(path) is None:
            continue
        try:
            if path.stat().st_size > max_file_bytes:
                continue
        except OSError:
            continue
        count += 1
        yield path


def parse_file(root: Path, path: Path) -> ParsedFile | None:
    """Parse a single file, returning ``None`` for unsupported languages.

    Only Python is deeply parsed in Phase 1. Other languages produce a
    ``ParsedFile`` with language set but no extracted symbols yet.
    """
    language = detect_language(path)
    if language is None:
        return None

    rel_path = path.relative_to(root).as_posix()
    try:
        data = path.read_bytes()
    except OSError as exc:
        logger.warning(
            "failed to read file",
            extra={"extra": {"path": rel_path, "error": str(exc)}},
        )
        return None

    if language == "python":
        return parse_python_source(rel_path, data)

    # Non-Python: record the file and language; deep parsing is a later phase.
    import hashlib

    source = data.decode("utf-8", errors="replace")
    loc = sum(1 for line in source.splitlines() if line.strip())
    return ParsedFile(
        path=rel_path,
        language=language,
        loc=loc,
        size_bytes=len(data),
        content_hash=hashlib.sha256(data).hexdigest(),
        is_test="/test" in f"/{rel_path}" or rel_path.startswith("test"),
    )
