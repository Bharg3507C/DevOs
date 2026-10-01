"""Change impact analysis endpoint.

GET /api/repositories/{id}/impact?file_id=<id>

Runs a BFS from the target file over the *reverse* dependency graph (who
imports this file?) to find direct and indirect dependents. A second pass
marks test files in the reachable set. The result lets a developer understand
the blast radius of changing a file before touching it.

Algorithm:
  1. Build adjacency list: target_file_id -> [source_file_ids] (reverse edges).
  2. BFS from the chosen file. Distance 1 = direct dependents.
  3. Every reachable node with is_test=True is a related test.
  4. Return node list with distances so the frontend can render a layered graph.
"""

from __future__ import annotations

from collections import deque

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_default
from app.db.base import get_db
from app.models import Dependency, File, Repository, User
from app.schemas import ImpactNodeOut, ImpactOut

router = APIRouter(prefix="/api/repositories", tags=["impact"])


@router.get("/{repo_id}/impact", response_model=ImpactOut)
def get_impact(
    repo_id: int,
    file_id: int = Query(..., description="Origin file whose dependents to traverse"),
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> ImpactOut:
    repo = db.get(Repository, repo_id)
    if repo is None or repo.connected_by_id != user.id:
        raise HTTPException(status_code=404, detail="Repository not found.")

    origin = db.get(File, file_id)
    if origin is None or origin.repository_id != repo_id:
        raise HTTPException(status_code=404, detail="File not found.")

    # Build reverse adjacency: target -> list[source] (who imports this file?)
    deps = (
        db.query(Dependency.source_file_id, Dependency.target_file_id)
        .filter(Dependency.repository_id == repo_id)
        .all()
    )
    reverse_adj: dict[int, list[int]] = {}
    for source, target in deps:
        reverse_adj.setdefault(target, []).append(source)

    # Load file metadata for all files in this repo to check is_test
    all_files: dict[int, File] = {
        f.id: f
        for f in db.query(File).filter(File.repository_id == repo_id).all()
    }

    # BFS over reverse graph
    visited: dict[int, int] = {}  # file_id -> distance
    queue: deque[tuple[int, int]] = deque([(file_id, 0)])
    while queue:
        current, dist = queue.popleft()
        if current in visited:
            continue
        visited[current] = dist
        for nbr in reverse_adj.get(current, []):
            if nbr not in visited:
                queue.append((nbr, dist + 1))

    # Build result nodes (exclude the origin itself)
    nodes: list[ImpactNodeOut] = []
    direct = 0
    indirect = 0
    test_count = 0

    for fid, distance in sorted(visited.items(), key=lambda x: x[1]):
        if fid == file_id:
            continue
        f = all_files.get(fid)
        if f is None:
            continue
        if f.is_test:
            kind = "test"
            test_count += 1
        elif distance == 1:
            kind = "direct"
            direct += 1
        else:
            kind = "indirect"
            indirect += 1
        nodes.append(
            ImpactNodeOut(
                file_id=fid,
                path=f.path,
                distance=distance,
                kind=kind,
            )
        )

    return ImpactOut(
        origin_file_id=file_id,
        origin_path=origin.path,
        directly_affected=direct,
        indirectly_affected=indirect,
        related_tests=test_count,
        nodes=nodes,
    )
