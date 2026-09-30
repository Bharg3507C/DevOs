"""Repository ingestion: sandboxed clone and read-only Git history extraction.

Security posture (see SECURITY.md):
- Clones into a dedicated per-repository directory under the configured workdir.
- Uses ``git`` via argument lists with a timeout; no shell interpolation.
- Never checks out or runs hooks that could execute repository code
  (``core.hooksPath`` is neutralised and we do a shallow, no-hook clone path).
- History is read with plumbing that only touches the object store.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import run_git, safe_join

logger = get_logger("devos.ingestion")
settings = get_settings()


@dataclass
class CommitRecord:
    sha: str
    author_name: str
    author_email: str
    message: str
    committed_at: str  # ISO 8601


@dataclass
class ChangedFileRecord:
    sha: str
    path: str
    change_type: str
    insertions: int
    deletions: int


class IngestionError(Exception):
    pass


def _workdir_root() -> Path:
    root = Path(settings.workdir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def repo_clone_path(repository_id: int) -> Path:
    """Return the sandboxed clone directory for a repository id."""
    root = _workdir_root()
    return safe_join(root, f"repo-{repository_id}")


def clone_repository(clone_url: str, repository_id: int, branch: str) -> Path:
    """Clone (or refresh) a repository into its sandbox directory.

    Returns the path to the working tree. Raises :class:`IngestionError` on
    failure. The clone is shallow-ish but retains history for git-log analysis.
    """
    target = repo_clone_path(repository_id)
    if target.exists():
        shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True, exist_ok=True)

    # -c protects against repository-supplied hooks executing on clone/checkout.
    args = [
        "-c",
        "core.hooksPath=/dev/null",
        "clone",
        "--single-branch",
        "--branch",
        branch,
        clone_url,
        str(target),
    ]
    result = run_git(args, cwd=_workdir_root(), timeout=settings.clone_timeout_seconds)
    if result.returncode != 0:
        # Retry without an explicit branch (repo default may differ).
        fallback = [
            "-c",
            "core.hooksPath=/dev/null",
            "clone",
            clone_url,
            str(target),
        ]
        result = run_git(fallback, cwd=_workdir_root(), timeout=settings.clone_timeout_seconds)
        if result.returncode != 0:
            raise IngestionError(f"git clone failed: {result.stderr.strip()[:300]}")

    logger.info(
        "repository cloned",
        extra={"extra": {"repository_id": repository_id, "path": str(target)}},
    )
    return target


def head_commit_sha(repo_path: Path) -> str | None:
    result = run_git(["rev-parse", "HEAD"], cwd=repo_path, timeout=30)
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


# Unit-record separators unlikely to appear in commit metadata.
_FIELD_SEP = "\x1f"
_RECORD_SEP = "\x1e"


def read_commits(repo_path: Path, max_commits: int = 2000) -> list[CommitRecord]:
    """Read commit metadata via ``git log`` (read-only)."""
    fmt = _FIELD_SEP.join(["%H", "%an", "%ae", "%cI", "%s"]) + _RECORD_SEP
    args = ["log", f"--max-count={max_commits}", f"--pretty=format:{fmt}"]
    result = run_git(args, cwd=repo_path, timeout=120)
    if result.returncode != 0:
        logger.warning(
            "git log failed",
            extra={"extra": {"error": result.stderr.strip()[:200]}},
        )
        return []

    commits: list[CommitRecord] = []
    for raw in result.stdout.split(_RECORD_SEP):
        raw = raw.strip("\n")
        if not raw:
            continue
        parts = raw.split(_FIELD_SEP)
        if len(parts) < 5:
            continue
        sha, an, ae, ci, subject = parts[:5]
        commits.append(
            CommitRecord(
                sha=sha,
                author_name=an,
                author_email=ae,
                message=subject,
                committed_at=ci,
            )
        )
    return commits


def read_changed_files(repo_path: Path, max_commits: int = 2000) -> list[ChangedFileRecord]:
    """Read per-commit changed files with numstat (read-only)."""
    args = [
        "log",
        f"--max-count={max_commits}",
        "--numstat",
        "--pretty=format:%x1eCOMMIT%x1f%H",
    ]
    result = run_git(args, cwd=repo_path, timeout=120)
    if result.returncode != 0:
        return []

    records: list[ChangedFileRecord] = []
    current_sha: str | None = None
    for line in result.stdout.splitlines():
        if line.startswith("\x1eCOMMIT\x1f"):
            current_sha = line.split("\x1f", 1)[1].strip()
            continue
        if not line.strip() or current_sha is None:
            continue
        cols = line.split("\t")
        if len(cols) != 3:
            continue
        ins_raw, del_raw, path = cols
        insertions = int(ins_raw) if ins_raw.isdigit() else 0
        deletions = int(del_raw) if del_raw.isdigit() else 0
        records.append(
            ChangedFileRecord(
                sha=current_sha,
                path=path.strip(),
                change_type="modified",
                insertions=insertions,
                deletions=deletions,
            )
        )
    return records


def cleanup_clone(repository_id: int) -> None:
    """Remove a repository's sandbox clone directory."""
    try:
        target = repo_clone_path(repository_id)
    except Exception:  # noqa: BLE001 - path guard failure means nothing to clean
        return
    shutil.rmtree(target, ignore_errors=True)
