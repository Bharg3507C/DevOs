"""Security primitives used across the analysis pipeline.

These helpers enforce the boundary described in SECURITY.md: repository content
is untrusted, paths must stay inside the sandbox, and subprocesses must be
launched safely (argument lists, fixed executables, timeouts).
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Sequence


class PathTraversalError(ValueError):
    """Raised when a path escapes its allowed base directory."""


def is_within_base(base: Path, target: Path) -> bool:
    """Return True if ``target`` resolves to a location inside ``base``.

    Both paths are fully resolved (following ``..`` and symlinks) before the
    containment check, which defeats ``../`` traversal and symlink escapes.
    """
    try:
        base_resolved = base.resolve(strict=False)
        target_resolved = target.resolve(strict=False)
    except OSError:
        return False
    return base_resolved == target_resolved or base_resolved in target_resolved.parents


def safe_join(base: Path, *parts: str) -> Path:
    """Join ``parts`` onto ``base`` and verify the result stays inside ``base``.

    Raises :class:`PathTraversalError` if the joined path would escape.
    """
    candidate = base.joinpath(*parts)
    if not is_within_base(base, candidate):
        raise PathTraversalError(f"Path escapes sandbox: {candidate!r}")
    return candidate


def run_git(
    args: Sequence[str],
    cwd: Path,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    """Run a git command safely.

    - The executable is fixed (``git``) and arguments are passed as a list, so no
      shell interpolation of untrusted data is possible.
    - ``shell=False`` (the default) prevents shell metacharacter injection.
    - A timeout bounds execution.

    Repository code is never executed by these commands; only git plumbing/
    porcelain that reads or writes the object store is used.
    """
    return subprocess.run(  # noqa: S603 - args are a fixed list, shell=False
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
