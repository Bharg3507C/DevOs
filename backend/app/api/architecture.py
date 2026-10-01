"""Architecture and dependency graph endpoints.

GET /api/repositories/{id}/architecture
  Returns all file nodes and dependency edges for the repository, plus any
  detected circular dependency cycles. Used to power the graph visualisation.

Cycle detection uses an iterative DFS with a recursion-stack colour-set so it
scales to large graphs without hitting Python's recursion limit.
"""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_default
from app.db.base import get_db
from app.models import Class, Dependency, File, Function, Repository, User
from app.schemas import (
    ArchEdgeOut,
    ArchitectureOut,
    ArchNodeOut,
    CircularDependencyOut,
)

router = APIRouter(prefix="/api/repositories", tags=["architecture"])


def _find_cycles(adj: dict[int, list[int]], all_ids: list[int]) -> list[list[int]]:
    """Iterative DFS cycle detection. Returns one representative path per cycle."""
    WHITE, GRAY, BLACK = 0, 1, 2
    colour = {nid: WHITE for nid in all_ids}
    parent: dict[int, int | None] = {nid: None for nid in all_ids}
    cycles: list[list[int]] = []
    seen_cycles: set[frozenset[int]] = set()

    for start in all_ids:
        if colour[start] != WHITE:
            continue
        # Explicit stack: (node, iterator over neighbours, entered_gray)
        stack: list[tuple[int, int]] = [(start, 0)]
        colour[start] = GRAY
        path: list[int] = [start]

        while stack:
            node, idx = stack[-1]
            neighbours = adj.get(node, [])
            if idx < len(neighbours):
                stack[-1] = (node, idx + 1)
                nbr = neighbours[idx]
                if colour[nbr] == GRAY:
                    # Found a back-edge → extract the cycle
                    cycle_start = nbr
                    cycle_path = [cycle_start]
                    for n, _ in reversed(stack):
                        if n == cycle_start and len(cycle_path) > 1:
                            break
                        if n != cycle_start:
                            cycle_path.append(n)
                    cycle_path.append(cycle_start)
                    cycle_path.reverse()
                    key = frozenset(cycle_path)
                    if key not in seen_cycles:
                        seen_cycles.add(key)
                        cycles.append(cycle_path)
                elif colour[nbr] == WHITE:
                    colour[nbr] = GRAY
                    parent[nbr] = node
                    stack.append((nbr, 0))
                    path.append(nbr)
            else:
                colour[node] = BLACK
                stack.pop()
                if path and path[-1] == node:
                    path.pop()

    return cycles


@router.get("/{repo_id}/architecture", response_model=ArchitectureOut)
def get_architecture(
    repo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> ArchitectureOut:
    repo = db.get(Repository, repo_id)
    if repo is None or repo.connected_by_id != user.id:
        raise HTTPException(status_code=404, detail="Repository not found.")

    files = (
        db.query(File)
        .filter(File.repository_id == repo_id)
        .order_by(File.path)
        .all()
    )
    if not files:
        return ArchitectureOut(nodes=[], edges=[], circular_dependencies=[])

    file_ids = [f.id for f in files]
    file_map = {f.id: f for f in files}

    # Aggregate function and class counts per file
    from sqlalchemy import func, select

    fn_counts: dict[int, int] = dict(
        db.execute(
            select(Function.file_id, func.count(Function.id))
            .where(Function.repository_id == repo_id)
            .group_by(Function.file_id)
        ).all()
    )
    cls_counts: dict[int, int] = dict(
        db.execute(
            select(Class.file_id, func.count(Class.id))
            .where(Class.repository_id == repo_id)
            .group_by(Class.file_id)
        ).all()
    )

    # Dependency counts per file (out-degree = dependencies, in-degree = dependents)
    deps = (
        db.query(Dependency)
        .filter(Dependency.repository_id == repo_id)
        .all()
    )
    out_degree: dict[int, int] = defaultdict(int)
    in_degree: dict[int, int] = defaultdict(int)
    adj: dict[int, list[int]] = defaultdict(list)

    for d in deps:
        out_degree[d.source_file_id] += 1
        in_degree[d.target_file_id] += 1
        adj[d.source_file_id].append(d.target_file_id)

    # Build nodes
    nodes = [
        ArchNodeOut(
            id=str(f.id),
            path=f.path,
            language=f.language,
            loc=f.loc,
            is_test=f.is_test,
            num_functions=fn_counts.get(f.id, 0),
            num_classes=cls_counts.get(f.id, 0),
            dependency_count=out_degree.get(f.id, 0),
            dependent_count=in_degree.get(f.id, 0),
        )
        for f in files
    ]

    # Build edges
    edges = [
        ArchEdgeOut(
            source=str(d.source_file_id),
            target=str(d.target_file_id),
            via_module=d.via_module,
        )
        for d in deps
    ]

    # Detect cycles — map int IDs back to paths for readability
    raw_cycles = _find_cycles(dict(adj), file_ids)
    circular: list[CircularDependencyOut] = []
    for cycle in raw_cycles:
        paths = [file_map[nid].path for nid in cycle if nid in file_map]
        if paths:
            circular.append(CircularDependencyOut(cycle=paths))

    return ArchitectureOut(nodes=nodes, edges=edges, circular_dependencies=circular)
