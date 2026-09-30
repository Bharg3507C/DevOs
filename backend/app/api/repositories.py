"""Repository connection, analysis, and read endpoints (Phase 1).

Endpoints:
  POST /api/repositories/connect
  POST /api/repositories/{id}/analyse
  GET  /api/repositories
  GET  /api/repositories/{id}
  GET  /api/repositories/{id}/overview
  GET  /api/repositories/{id}/files
  GET  /api/repositories/{id}/files/{file_id}

Access control: every repository read verifies the repository belongs to the
current user. Analysis is dispatched as a background job.
"""

from __future__ import annotations

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, rate_limit_analyse, rate_limit_default
from app.core.logging import get_logger
from app.db.base import get_db
from app.models import (
    AnalysisJob,
    Class,
    Dependency,
    File,
    Function,
    Import,
    JobStatus,
    Repository,
    RepositoryAnalysis,
    User,
)
from app.schemas import (
    AnalyseResponse,
    AnalysisJobOut,
    ClassOut,
    ConnectRepositoryRequest,
    ConnectRepositoryResponse,
    FileDetailOut,
    FileSummaryOut,
    FunctionOut,
    ImportOut,
    OverviewOut,
    PaginatedFiles,
    RepositoryOut,
)
from app.services.analysis_service import run_analysis
from app.services.github_client import (
    GitHubClient,
    GitHubError,
    RepositoryAccessError,
)

router = APIRouter(prefix="/api/repositories", tags=["repositories"])
logger = get_logger("devos.api.repositories")


def _get_owned_repository(db: Session, repo_id: int, user: User) -> Repository:
    repo = db.get(Repository, repo_id)
    if repo is None or repo.connected_by_id != user.id:
        raise HTTPException(status_code=404, detail="Repository not found.")
    return repo


@router.post(
    "/connect",
    response_model=ConnectRepositoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def connect_repository(
    payload: ConnectRepositoryRequest,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> ConnectRepositoryResponse:
    """Connect a GitHub repository after verifying access and fetching metadata."""
    client = GitHubClient(token=user.access_token)
    try:
        meta = client.get_repo_metadata(payload.owner, payload.name)
        languages = client.get_languages(payload.owner, payload.name)
    except RepositoryAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except GitHubError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    repo = (
        db.query(Repository)
        .filter(
            Repository.owner == meta.owner,
            Repository.name == meta.name,
            Repository.connected_by_id == user.id,
        )
        .first()
    )
    if repo is None:
        repo = Repository(connected_by_id=user.id, owner=meta.owner, name=meta.name)
        db.add(repo)

    repo.github_repo_id = meta.github_repo_id
    repo.full_name = meta.full_name
    repo.default_branch = meta.default_branch
    repo.clone_url = meta.clone_url
    repo.is_private = meta.is_private
    repo.primary_language = meta.primary_language
    repo.languages = languages
    repo.size_kb = meta.size_kb
    db.commit()
    db.refresh(repo)

    logger.info(
        "repository connected",
        extra={"extra": {"repository": repo.full_name, "user_id": user.id}},
    )
    return ConnectRepositoryResponse(repository=RepositoryOut.model_validate(repo))


@router.post("/{repo_id}/analyse", response_model=AnalyseResponse)
def analyse_repository(
    repo_id: int,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_analyse),
) -> AnalyseResponse:
    """Trigger a background analysis job for a connected repository."""
    repo = _get_owned_repository(db, repo_id, user)

    active = (
        db.query(AnalysisJob)
        .filter(
            AnalysisJob.repository_id == repo.id,
            AnalysisJob.status.in_([JobStatus.QUEUED.value, JobStatus.RUNNING.value]),
        )
        .first()
    )
    if active is not None:
        raise HTTPException(
            status_code=409,
            detail="An analysis is already in progress for this repository.",
        )

    job = AnalysisJob(repository_id=repo.id, status=JobStatus.QUEUED.value)
    db.add(job)
    db.commit()
    db.refresh(job)

    background.add_task(run_analysis, job.id)
    return AnalyseResponse(job=AnalysisJobOut.model_validate(job))


@router.get("", response_model=list[RepositoryOut])
def list_repositories(
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> list[RepositoryOut]:
    repos = (
        db.query(Repository)
        .filter(Repository.connected_by_id == user.id)
        .order_by(Repository.created_at.desc())
        .all()
    )
    return [RepositoryOut.model_validate(r) for r in repos]


@router.get("/{repo_id}", response_model=RepositoryOut)
def get_repository(
    repo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> RepositoryOut:
    repo = _get_owned_repository(db, repo_id, user)
    return RepositoryOut.model_validate(repo)


@router.get("/{repo_id}/overview", response_model=OverviewOut)
def get_overview(
    repo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> OverviewOut:
    repo = _get_owned_repository(db, repo_id, user)
    latest = (
        db.query(RepositoryAnalysis)
        .filter(RepositoryAnalysis.repository_id == repo.id)
        .order_by(RepositoryAnalysis.created_at.desc())
        .first()
    )
    if latest is None:
        # Not analysed yet: return zeros rather than fabricated data.
        return OverviewOut(
            total_files=0,
            total_functions=0,
            total_classes=0,
            total_dependencies=0,
            total_tests=0,
            average_complexity=0.0,
            languages=repo.languages or {},
            last_analysed_at=None,
            last_commit_sha=None,
        )
    return OverviewOut(
        total_files=latest.total_files,
        total_functions=latest.total_functions,
        total_classes=latest.total_classes,
        total_dependencies=latest.total_dependencies,
        total_tests=latest.total_tests,
        average_complexity=latest.average_complexity,
        languages=repo.languages or {},
        last_analysed_at=latest.created_at,
        last_commit_sha=latest.commit_sha,
    )


@router.get("/{repo_id}/files", response_model=PaginatedFiles)
def list_files(
    repo_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = Query(None, max_length=255),
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> PaginatedFiles:
    """Paginated file listing so the browser never loads the whole repo."""
    repo = _get_owned_repository(db, repo_id, user)
    query = db.query(File).filter(File.repository_id == repo.id)
    if search:
        query = query.filter(File.path.ilike(f"%{search}%"))
    total = query.with_entities(func.count(File.id)).scalar() or 0
    items = (
        query.order_by(File.path)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaginatedFiles(
        items=[FileSummaryOut.model_validate(f) for f in items],
        total=int(total),
        page=page,
        page_size=page_size,
    )


@router.get("/{repo_id}/files/{file_id}", response_model=FileDetailOut)
def get_file_detail(
    repo_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(rate_limit_default),
) -> FileDetailOut:
    repo = _get_owned_repository(db, repo_id, user)
    file = db.get(File, file_id)
    if file is None or file.repository_id != repo.id:
        raise HTTPException(status_code=404, detail="File not found.")

    functions = (
        db.query(Function)
        .filter(Function.file_id == file.id)
        .order_by(Function.start_line)
        .all()
    )
    classes = (
        db.query(Class).filter(Class.file_id == file.id).order_by(Class.start_line).all()
    )
    imports = (
        db.query(Import).filter(Import.file_id == file.id).order_by(Import.line).all()
    )
    dependents_count = db.scalar(
        select(func.count(Dependency.id)).where(Dependency.target_file_id == file.id)
    ) or 0
    dependencies_count = db.scalar(
        select(func.count(Dependency.id)).where(Dependency.source_file_id == file.id)
    ) or 0
    max_complexity = db.scalar(
        select(func.max(Function.cyclomatic_complexity)).where(
            Function.file_id == file.id
        )
    ) or 0

    return FileDetailOut(
        id=file.id,
        path=file.path,
        language=file.language,
        loc=file.loc,
        size_bytes=file.size_bytes,
        is_test=file.is_test,
        parse_error=file.parse_error,
        functions=[FunctionOut.model_validate(f) for f in functions],
        classes=[ClassOut.model_validate(c) for c in classes],
        imports=[ImportOut.model_validate(i) for i in imports],
        dependents_count=int(dependents_count),
        dependencies_count=int(dependencies_count),
        max_complexity=int(max_complexity),
    )
