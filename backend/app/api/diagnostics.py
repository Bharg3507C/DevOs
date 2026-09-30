"""Internal diagnostics for development (observability).

Exposes lightweight runtime and data counts. Gated to development mode so it is
never available in production deployments.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import get_db
from app.models import (
    AnalysisJob,
    Commit,
    Dependency,
    File,
    Function,
    Repository,
)

router = APIRouter(prefix="/api/_diagnostics", tags=["diagnostics"])
settings = get_settings()


@router.get("")
def diagnostics(db: Session = Depends(get_db)) -> dict:
    if settings.environment != "development":
        raise HTTPException(status_code=404, detail="Not found.")

    def count(model) -> int:
        return int(db.scalar(func.count(model.id)) or 0)

    jobs = db.query(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(10).all()
    return {
        "environment": settings.environment,
        "github_oauth_configured": settings.github_oauth_configured,
        "counts": {
            "repositories": count(Repository),
            "files": count(File),
            "functions": count(Function),
            "dependencies": count(Dependency),
            "commits": count(Commit),
            "jobs": count(AnalysisJob),
        },
        "recent_jobs": [
            {
                "id": j.id,
                "repository_id": j.repository_id,
                "status": j.status,
                "files_processed": j.files_processed,
                "parsing_failures": j.parsing_failures,
            }
            for j in jobs
        ],
    }
