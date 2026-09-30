"""Analysis job status endpoint: GET /api/analysis-jobs/{id}."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_default
from app.db.base import get_db
from app.models import AnalysisJob, Repository, User
from app.schemas import AnalysisJobOut

router = APIRouter(prefix="/api/analysis-jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=AnalysisJobOut)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> AnalysisJobOut:
    job = db.get(AnalysisJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    repo = db.get(Repository, job.repository_id)
    if repo is None or repo.connected_by_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return AnalysisJobOut.model_validate(job)
