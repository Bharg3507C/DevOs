"""Git history endpoint.

GET /api/repositories/{id}/git-history
  Returns commits (paginated), top-changed files, contributors, and a
  commit-count-over-time series for charting. All data is read from the DB rows
  that were populated during the analysis job — no git CLI calls at query time.
"""

from __future__ import annotations

from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_default
from app.db.base import get_db
from app.models import ChangedFile, Commit, File, Repository, User
from app.schemas import (
    CommitOut,
    CommitsOverTimeOut,
    ContributorOut,
    FileChurnOut,
    GitHistoryOut,
)

router = APIRouter(prefix="/api/repositories", tags=["git-history"])


@router.get("/{repo_id}/git-history", response_model=GitHistoryOut)
def get_git_history(
    repo_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> GitHistoryOut:
    repo = db.get(Repository, repo_id)
    if repo is None or repo.connected_by_id != user.id:
        raise HTTPException(status_code=404, detail="Repository not found.")

    # --- Commits (paginated, newest first) ---
    total_commits = (
        db.scalar(
            select(func.count(Commit.id)).where(Commit.repository_id == repo_id)
        )
        or 0
    )

    commits_rows = (
        db.query(Commit)
        .filter(Commit.repository_id == repo_id)
        .order_by(Commit.committed_at.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Count changed files per commit in one query for the returned page
    commit_ids = [c.id for c in commits_rows]
    files_per_commit: dict[int, int] = {}
    if commit_ids:
        rows = db.execute(
            select(ChangedFile.commit_id, func.count(ChangedFile.id))
            .where(ChangedFile.commit_id.in_(commit_ids))
            .group_by(ChangedFile.commit_id)
        ).all()
        files_per_commit = dict(rows)

    commits_out = [
        CommitOut(
            sha=c.sha,
            author_name=c.author_name,
            author_email=c.author_email,
            message=c.message,
            committed_at=c.committed_at,
            files_changed=files_per_commit.get(c.id, 0),
        )
        for c in commits_rows
    ]

    # --- Top changed files (across ALL commits) ---
    churn_rows = db.execute(
        select(
            ChangedFile.path,
            func.count(ChangedFile.id).label("change_count"),
            func.sum(ChangedFile.insertions).label("total_ins"),
            func.sum(ChangedFile.deletions).label("total_del"),
        )
        .where(ChangedFile.repository_id == repo_id)
        .group_by(ChangedFile.path)
        .order_by(func.count(ChangedFile.id).desc())
        .limit(20)
    ).all()

    # Map paths to file IDs for linking to the file detail page
    churn_paths = [r.path for r in churn_rows]
    path_to_id: dict[str, int] = {}
    if churn_paths:
        id_rows = db.execute(
            select(File.path, File.id).where(
                File.repository_id == repo_id, File.path.in_(churn_paths)
            )
        ).all()
        path_to_id = dict(id_rows)

    top_changed = [
        FileChurnOut(
            path=r.path,
            file_id=path_to_id.get(r.path),
            change_count=r.change_count,
            total_insertions=int(r.total_ins or 0),
            total_deletions=int(r.total_del or 0),
        )
        for r in churn_rows
    ]

    # --- Contributors ---
    contributor_rows = db.execute(
        select(
            Commit.author_name,
            func.count(Commit.id).label("cnt"),
        )
        .where(Commit.repository_id == repo_id, Commit.author_name.isnot(None))
        .group_by(Commit.author_name)
        .order_by(func.count(Commit.id).desc())
        .limit(20)
    ).all()

    contributors = [
        ContributorOut(login=r.author_name, commit_count=r.cnt)
        for r in contributor_rows
    ]

    # --- Commits over time (daily buckets, last 90 days of data) ---
    all_commits_dates = db.execute(
        select(Commit.committed_at)
        .where(Commit.repository_id == repo_id, Commit.committed_at.isnot(None))
        .order_by(Commit.committed_at)
    ).scalars().all()

    date_counter: Counter[str] = Counter()
    for dt in all_commits_dates:
        date_counter[dt.strftime("%Y-%m-%d")] += 1

    commits_over_time = [
        CommitsOverTimeOut(date=d, count=c)
        for d, c in sorted(date_counter.items())
    ]

    return GitHistoryOut(
        commits=commits_out,
        top_changed_files=top_changed,
        contributors=contributors,
        commits_over_time=commits_over_time,
        total_commits=int(total_commits),
    )
