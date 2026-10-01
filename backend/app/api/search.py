"""Code-aware search endpoint.

GET /api/repositories/{id}/search?q=<query>&limit=<n>

Searches across:
  - File paths (substring match)
  - Function/class names (substring match)
  - Import modules (exact prefix match)

Every result carries a file_id, path, line range, kind, and a human-readable
explanation of why it matched. No AI — purely deterministic string matching
against the knowledge graph.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_default
from app.db.base import get_db
from app.models import Class, File, Function, Import, Repository, Symbol, User
from app.schemas import SearchOut, SearchResultOut

router = APIRouter(prefix="/api/repositories", tags=["search"])

_MAX_RESULTS = 100


@router.get("/{repo_id}/search", response_model=SearchOut)
def search(
    repo_id: int,
    q: str = Query(..., min_length=1, max_length=255, alias="q"),
    limit: int = Query(40, ge=1, le=_MAX_RESULTS),
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> SearchOut:
    repo = db.get(Repository, repo_id)
    if repo is None or repo.connected_by_id != user.id:
        raise HTTPException(status_code=404, detail="Repository not found.")

    results: list[SearchResultOut] = []
    term = q.strip()
    ilike = f"%{term}%"

    # 1. File paths
    file_hits = (
        db.query(File)
        .filter(File.repository_id == repo_id, File.path.ilike(ilike))
        .order_by(File.path)
        .limit(limit)
        .all()
    )
    for f in file_hits:
        results.append(
            SearchResultOut(
                file_id=f.id,
                path=f.path,
                language=f.language,
                kind="file",
                symbol=None,
                start_line=None,
                end_line=None,
                match_reason=f'File path contains "{term}"',
            )
        )

    remaining = limit - len(results)

    # 2. Functions
    if remaining > 0:
        fn_hits = (
            db.query(Function, File)
            .join(File, File.id == Function.file_id)
            .filter(
                Function.repository_id == repo_id,
                Function.name.ilike(ilike),
            )
            .order_by(Function.name)
            .limit(remaining)
            .all()
        )
        for fn, f in fn_hits:
            kind = "method" if fn.is_method else "function"
            results.append(
                SearchResultOut(
                    file_id=f.id,
                    path=f.path,
                    language=f.language,
                    kind=kind,
                    symbol=fn.qualified_name or fn.name,
                    start_line=fn.start_line,
                    end_line=fn.end_line,
                    match_reason=f'{kind.capitalize()} name matches "{term}"',
                )
            )

    remaining = limit - len(results)

    # 3. Classes
    if remaining > 0:
        cls_hits = (
            db.query(Class, File)
            .join(File, File.id == Class.file_id)
            .filter(
                Class.repository_id == repo_id,
                Class.name.ilike(ilike),
            )
            .order_by(Class.name)
            .limit(remaining)
            .all()
        )
        for cls, f in cls_hits:
            results.append(
                SearchResultOut(
                    file_id=f.id,
                    path=f.path,
                    language=f.language,
                    kind="class",
                    symbol=cls.name,
                    start_line=cls.start_line,
                    end_line=cls.end_line,
                    match_reason=f'Class name matches "{term}"',
                )
            )

    remaining = limit - len(results)

    # 4. Imports (module name)
    if remaining > 0:
        imp_hits = (
            db.query(Import, File)
            .join(File, File.id == Import.file_id)
            .filter(
                Import.repository_id == repo_id,
                Import.module.ilike(ilike),
            )
            .order_by(Import.module)
            .limit(remaining)
            .all()
        )
        seen_import_files: set[tuple[int, str]] = set()
        for imp, f in imp_hits:
            key = (f.id, imp.module)
            if key in seen_import_files:
                continue
            seen_import_files.add(key)
            sym_label = f"{imp.module}.{imp.symbol}" if imp.symbol else imp.module
            results.append(
                SearchResultOut(
                    file_id=f.id,
                    path=f.path,
                    language=f.language,
                    kind="import",
                    symbol=sym_label,
                    start_line=imp.line,
                    end_line=imp.line,
                    match_reason=f'Import of module "{imp.module}" matches "{term}"',
                )
            )

    # Deduplicate: if the same file appears as both a path hit and a symbol
    # hit, keep both — they carry different information.
    return SearchOut(query=term, results=results[:limit], total=len(results))
