"""Technical debt analysis endpoint.

GET /api/repositories/{id}/technical-debt

Computes transparent, signal-based debt findings for every file. No opaque AI
score. Every finding lists the exact signals that produced it so the developer
can verify and act on the result.

Signals and their contribution to the score (0-100 scale):
  - high_complexity    Max cyclomatic complexity ≥ 10 in the file          +25
  - many_functions     > 20 functions in one file                          +10
  - many_dependents    > 10 files import this file                         +20
  - no_tests           No linked test file and not itself a test file       +15
  - high_churn         Changed in > 10 commits (hotspot)                   +20
  - large_file         LOC > 500                                            +10

Score ranges → severity:
  ≥ 60  →  high
  ≥ 30  →  medium
  ≥ 10  →  low
  <  10 →  info  (kept only if there are at least some signals)

Findings are sorted by score descending and capped at 200.
"""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_default
from app.db.base import get_db
from app.models import (
    ChangedFile,
    Class,
    Dependency,
    File,
    Function,
    Test,
    Repository,
    User,
)
from app.schemas import DebtFindingOut, TechnicalDebtOut

router = APIRouter(prefix="/api/repositories", tags=["technical-debt"])

# Thresholds
_CC_HIGH = 10
_MANY_FN = 20
_MANY_DEP = 10
_CHURN_HIGH = 10
_LOC_LARGE = 500


def _severity(score: float) -> str:
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    if score >= 10:
        return "low"
    return "info"


@router.get("/{repo_id}/technical-debt", response_model=TechnicalDebtOut)
def get_technical_debt(
    repo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> TechnicalDebtOut:
    repo = db.get(Repository, repo_id)
    if repo is None or repo.connected_by_id != user.id:
        raise HTTPException(status_code=404, detail="Repository not found.")

    files = (
        db.query(File)
        .filter(File.repository_id == repo_id, File.is_test.is_(False))
        .all()
    )
    if not files:
        return TechnicalDebtOut(
            findings=[],
            total_findings=0,
            high_count=0,
            medium_count=0,
            low_count=0,
        )

    file_ids = [f.id for f in files]

    # Max cyclomatic complexity per file
    max_cc: dict[int, int] = dict(
        db.execute(
            select(Function.file_id, func.max(Function.cyclomatic_complexity))
            .where(Function.file_id.in_(file_ids))
            .group_by(Function.file_id)
        ).all()
    )

    # Function count per file
    fn_count: dict[int, int] = dict(
        db.execute(
            select(Function.file_id, func.count(Function.id))
            .where(Function.file_id.in_(file_ids))
            .group_by(Function.file_id)
        ).all()
    )

    # Dependents count (in-degree) per file
    in_degree: dict[int, int] = dict(
        db.execute(
            select(Dependency.target_file_id, func.count(Dependency.id))
            .where(Dependency.target_file_id.in_(file_ids))
            .group_by(Dependency.target_file_id)
        ).all()
    )

    # Files with tests (target_file_id set in tests table)
    tested_file_ids: set[int] = set(
        db.execute(
            select(Test.target_file_id).where(
                Test.target_file_id.in_(file_ids),
                Test.target_file_id.isnot(None),
            )
        ).scalars().all()
    )

    # Commit churn per file path
    churn_rows = db.execute(
        select(ChangedFile.path, func.count(ChangedFile.id).label("cnt"))
        .where(ChangedFile.repository_id == repo_id)
        .group_by(ChangedFile.path)
    ).all()
    churn_by_path: dict[str, int] = {r.path: r.cnt for r in churn_rows}

    findings: list[DebtFindingOut] = []

    for f in files:
        score = 0.0
        reasons: list[str] = []
        signals: dict[str, object] = {}

        cc = max_cc.get(f.id, 0)
        if cc >= _CC_HIGH:
            score += 25
            reasons.append(f"Highest function complexity is {cc} (cyclomatic ≥ {_CC_HIGH})")
            signals["max_cyclomatic_complexity"] = cc

        fns = fn_count.get(f.id, 0)
        if fns > _MANY_FN:
            score += 10
            reasons.append(f"Contains {fns} functions (> {_MANY_FN})")
            signals["function_count"] = fns

        deps = in_degree.get(f.id, 0)
        if deps > _MANY_DEP:
            score += 20
            reasons.append(f"{deps} internal modules depend on this file (> {_MANY_DEP})")
            signals["dependent_count"] = deps

        if f.id not in tested_file_ids and fns > 0:
            score += 15
            reasons.append("No linked test file detected")
            signals["has_tests"] = False

        churn = churn_by_path.get(f.path, 0)
        if churn > _CHURN_HIGH:
            score += 20
            reasons.append(f"Changed in {churn} commits (hotspot, > {_CHURN_HIGH})")
            signals["commit_churn"] = churn

        if f.loc > _LOC_LARGE:
            score += 10
            reasons.append(f"File has {f.loc} lines of code (> {_LOC_LARGE})")
            signals["loc"] = f.loc

        if not reasons:
            continue

        findings.append(
            DebtFindingOut(
                file_id=f.id,
                path=f.path,
                severity=_severity(score),
                score=round(score, 1),
                reasons=reasons,
                signals=signals,
            )
        )

    # Sort by score descending, cap at 200
    findings.sort(key=lambda x: x.score, reverse=True)
    findings = findings[:200]

    high = sum(1 for f in findings if f.severity == "high")
    medium = sum(1 for f in findings if f.severity == "medium")
    low = sum(1 for f in findings if f.severity == "low")

    return TechnicalDebtOut(
        findings=findings,
        total_findings=len(findings),
        high_count=high,
        medium_count=medium,
        low_count=low,
    )
