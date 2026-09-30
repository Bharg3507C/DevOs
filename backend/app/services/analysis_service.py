"""Analysis orchestration.

Runs the Phase 1 pipeline as a background job:

  clone -> walk + parse files -> persist files/symbols/imports ->
  resolve internal dependencies -> read git history -> write analysis snapshot.

The job updates its ``analysis_jobs`` row with per-step progress so the frontend
can render the progress checklist. Import resolution builds the internal
dependency edge set (the foundation the later change-impact traversal reads).
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analysis.models import ParsedFile
from app.analysis.parser import iter_source_files, parse_file
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.base import SessionLocal
from app.models import (
    AnalysisJob,
    Class,
    Commit,
    Dependency,
    File,
    Function,
    Import,
    JobStatus,
    Metric,
    Repository,
    RepositoryAnalysis,
    Symbol,
    Test,
)
from app.services import ingestion

logger = get_logger("devos.analysis")
settings = get_settings()

STEP_NAMES = [
    "Reading files",
    "Building syntax tree",
    "Detecting dependencies",
    "Analysing Git history",
    "Building knowledge graph",
    "Calculating code metrics",
]


def _init_steps() -> list[dict[str, str]]:
    return [{"name": name, "status": "pending"} for name in STEP_NAMES]


def _set_step(job: AnalysisJob, name: str, status: str) -> None:
    steps = job.steps or _init_steps()
    for step in steps:
        if step["name"] == name:
            step["status"] = status
    job.steps = list(steps)


def _clear_repo_data(db: Session, repository_id: int) -> None:
    """Remove derived rows for a full re-analysis (Phase 1 = non-incremental).

    Incremental analysis (skip unchanged files by hash) lands in Phase 6; the
    ``content_hash`` column and this seam are in place for it.
    """
    for model in (Dependency, Import, Function, Class, Symbol, Test, Metric):
        db.query(model).filter(model.repository_id == repository_id).delete(
            synchronize_session=False
        )
    db.query(File).filter(File.repository_id == repository_id).delete(
        synchronize_session=False
    )
    db.commit()


def _persist_parsed_file(db: Session, repository_id: int, parsed: ParsedFile) -> File:
    file_row = File(
        repository_id=repository_id,
        path=parsed.path,
        language=parsed.language,
        loc=parsed.loc,
        size_bytes=parsed.size_bytes,
        content_hash=parsed.content_hash,
        is_test=parsed.is_test,
        parse_error=parsed.parse_error,
    )
    db.add(file_row)
    db.flush()  # assign file_row.id

    for fn in parsed.functions:
        db.add(
            Function(
                repository_id=repository_id,
                file_id=file_row.id,
                name=fn.name,
                qualified_name=fn.qualified_name,
                start_line=fn.start_line,
                end_line=fn.end_line,
                loc=fn.loc,
                num_params=fn.num_params,
                cyclomatic_complexity=fn.cyclomatic_complexity,
                is_async=fn.is_async,
                is_method=fn.is_method,
                is_test=fn.is_test,
            )
        )
        db.add(
            Symbol(
                repository_id=repository_id,
                file_id=file_row.id,
                name=fn.qualified_name,
                kind="method" if fn.is_method else "function",
                start_line=fn.start_line,
                end_line=fn.end_line,
            )
        )
    for cls in parsed.classes:
        db.add(
            Class(
                repository_id=repository_id,
                file_id=file_row.id,
                name=cls.name,
                start_line=cls.start_line,
                end_line=cls.end_line,
                base_classes=cls.base_classes,
                num_methods=cls.num_methods,
            )
        )
        db.add(
            Symbol(
                repository_id=repository_id,
                file_id=file_row.id,
                name=cls.name,
                kind="class",
                start_line=cls.start_line,
                end_line=cls.end_line,
            )
        )
    for imp in parsed.imports:
        db.add(
            Import(
                repository_id=repository_id,
                file_id=file_row.id,
                module=imp.module,
                symbol=imp.symbol,
                alias=imp.alias,
                is_relative=imp.is_relative,
                level=imp.level,
                line=imp.line,
            )
        )
    return file_row


def _module_path_candidates(module: str) -> list[str]:
    """Map a dotted module name to candidate repo-relative file paths."""
    dotted = module.replace(".", "/")
    return [f"{dotted}.py", f"{dotted}/__init__.py"]


def _resolve_relative(source_path: str, level: int, module: str) -> list[str]:
    """Resolve a relative import (``from ..pkg import x``) to candidate paths."""
    parts = source_path.split("/")[:-1]  # directory of the source file
    # level 1 == current package; each extra level goes up one directory
    up = level - 1
    if up > 0:
        parts = parts[: len(parts) - up] if up <= len(parts) else []
    if module:
        parts = parts + module.split(".")
    base = "/".join(p for p in parts if p)
    if not base:
        return []
    return [f"{base}.py", f"{base}/__init__.py"]


def _resolve_dependencies(db: Session, repository_id: int) -> int:
    """Resolve internal imports into file->file dependency edges.

    Only imports that map to a file inside the repository create edges;
    third-party / stdlib imports are retained on the imports table but produce
    no internal edge. Returns the number of edges created.
    """
    files = db.execute(
        select(File.id, File.path).where(File.repository_id == repository_id)
    ).all()
    path_to_id = {path: fid for fid, path in files}

    imports = db.execute(
        select(Import.file_id, Import.module, Import.is_relative, Import.level, File.path)
        .join(File, File.id == Import.file_id)
        .where(Import.repository_id == repository_id)
    ).all()

    seen: set[tuple[int, int]] = set()
    edges = 0
    for source_file_id, module, is_relative, level, source_path in imports:
        candidates: list[str] = []
        if is_relative:
            candidates = _resolve_relative(source_path, level or 1, module or "")
        elif module:
            candidates = _module_path_candidates(module)

        target_id: int | None = None
        for cand in candidates:
            if cand in path_to_id:
                target_id = path_to_id[cand]
                break

        if target_id is None or target_id == source_file_id:
            continue
        key = (source_file_id, target_id)
        if key in seen:
            continue
        seen.add(key)
        db.add(
            Dependency(
                repository_id=repository_id,
                source_file_id=source_file_id,
                target_file_id=target_id,
                via_module=module,
            )
        )
        edges += 1
    db.commit()
    return edges


def _persist_git_history(db: Session, repository_id: int, repo_path: Path) -> int:
    """Persist commits and changed files. Returns commit count."""
    db.query(Commit).filter(Commit.repository_id == repository_id).delete(
        synchronize_session=False
    )
    db.commit()

    commits = ingestion.read_commits(repo_path)
    changed = ingestion.read_changed_files(repo_path)
    changed_by_sha: dict[str, list] = {}
    for rec in changed:
        changed_by_sha.setdefault(rec.sha, []).append(rec)

    for c in commits:
        committed_at = None
        try:
            committed_at = datetime.fromisoformat(c.committed_at)
        except (ValueError, TypeError):
            committed_at = None
        commit_row = Commit(
            repository_id=repository_id,
            sha=c.sha,
            author_name=c.author_name,
            author_email=c.author_email,
            message=c.message,
            committed_at=committed_at,
        )
        db.add(commit_row)
        db.flush()
        for cf in changed_by_sha.get(c.sha, []):
            from app.models import ChangedFile

            db.add(
                ChangedFile(
                    repository_id=repository_id,
                    commit_id=commit_row.id,
                    path=cf.path,
                    change_type=cf.change_type,
                    insertions=cf.insertions,
                    deletions=cf.deletions,
                )
            )
    db.commit()
    return len(commits)


def _link_tests(db: Session, repository_id: int) -> int:
    """Create Test rows for detected test files. Target resolution is best-effort.

    A ``test_foo.py`` is heuristically linked to ``foo.py`` when such a file
    exists. Deeper test-to-symbol linking arrives in Phase 4.
    """
    files = db.execute(
        select(File.id, File.path, File.is_test).where(File.repository_id == repository_id)
    ).all()
    path_to_id = {path: fid for fid, path, _ in files}
    count = 0
    for fid, path, is_test in files:
        if not is_test:
            continue
        base = path.rsplit("/", 1)[-1]
        stem = base[len("test_") :] if base.startswith("test_") else base.replace("_test.py", ".py")
        target_id = None
        for cand_path, cand_id in path_to_id.items():
            if cand_path.rsplit("/", 1)[-1] == stem:
                target_id = cand_id
                break
        db.add(
            Test(
                repository_id=repository_id,
                file_id=fid,
                name=base,
                target_file_id=target_id,
            )
        )
        count += 1
    db.commit()
    return count


def run_analysis(job_id: int) -> None:
    """Entry point for the background analysis job.

    Opens its own DB session (it runs outside the request lifecycle) and updates
    the job row as it progresses. All failures are captured onto the job.
    """
    db = SessionLocal()
    started = time.perf_counter()
    try:
        job = db.get(AnalysisJob, job_id)
        if job is None:
            logger.error("analysis job not found", extra={"extra": {"job_id": job_id}})
            return
        repository = db.get(Repository, job.repository_id)
        if repository is None:
            job.status = JobStatus.FAILED.value
            job.error = "Repository not found"
            db.commit()
            return

        job.status = JobStatus.RUNNING.value
        job.started_at = datetime.now(timezone.utc)
        job.steps = _init_steps()
        db.commit()

        logger.info(
            "analysis started",
            extra={"extra": {"job_id": job_id, "repository": repository.full_name}},
        )

        # 1. Clone
        _set_step(job, "Reading files", "running")
        db.commit()
        repo_path = ingestion.clone_repository(
            repository.clone_url, repository.id, repository.default_branch
        )
        _clear_repo_data(db, repository.id)

        # 2. Parse
        parsed_files: list[ParsedFile] = []
        failures = 0
        for src in iter_source_files(repo_path, settings.max_files, settings.max_file_bytes):
            parsed = parse_file(repo_path, src)
            if parsed is None:
                continue
            if parsed.parse_error:
                failures += 1
            parsed_files.append(parsed)
        _set_step(job, "Reading files", "done")
        _set_step(job, "Building syntax tree", "done")
        job.files_processed = len(parsed_files)
        job.parsing_failures = failures
        db.commit()

        # 3. Persist knowledge graph
        _set_step(job, "Building knowledge graph", "running")
        db.commit()
        for parsed in parsed_files:
            _persist_parsed_file(db, repository.id, parsed)
        db.commit()

        # 4. Dependencies
        _set_step(job, "Detecting dependencies", "running")
        db.commit()
        edge_count = _resolve_dependencies(db, repository.id)
        _set_step(job, "Detecting dependencies", "done")
        db.commit()

        # 5. Tests
        _link_tests(db, repository.id)
        _set_step(job, "Building knowledge graph", "done")
        db.commit()

        # 6. Git history
        _set_step(job, "Analysing Git history", "running")
        db.commit()
        _persist_git_history(db, repository.id, repo_path)
        head_sha = ingestion.head_commit_sha(repo_path)
        _set_step(job, "Analysing Git history", "done")
        db.commit()

        # 7. Metrics + snapshot
        _set_step(job, "Calculating code metrics", "running")
        db.commit()
        totals = _compute_totals(db, repository.id, edge_count)
        _write_metrics(db, repository.id, totals)
        duration = time.perf_counter() - started
        db.add(
            RepositoryAnalysis(
                repository_id=repository.id,
                commit_sha=head_sha,
                total_files=totals["total_files"],
                total_functions=totals["total_functions"],
                total_classes=totals["total_classes"],
                total_dependencies=totals["total_dependencies"],
                total_tests=totals["total_tests"],
                average_complexity=totals["average_complexity"],
                duration_seconds=duration,
            )
        )
        _set_step(job, "Calculating code metrics", "done")

        job.status = JobStatus.COMPLETED.value
        job.finished_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            "analysis complete",
            extra={
                "extra": {
                    "job_id": job_id,
                    "repository": repository.full_name,
                    "duration_seconds": round(duration, 2),
                    "files_processed": totals["total_files"],
                    "parsing_failures": failures,
                }
            },
        )
    except Exception as exc:  # noqa: BLE001 - capture any failure onto the job
        logger.exception("analysis failed", extra={"extra": {"job_id": job_id}})
        db.rollback()
        job = db.get(AnalysisJob, job_id)
        if job is not None:
            job.status = JobStatus.FAILED.value
            job.error = str(exc)[:1000]
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        # Reclaim disk; the knowledge graph is fully persisted in the DB.
        if "job" in dir() and (job := db.get(AnalysisJob, job_id)) is not None:
            ingestion.cleanup_clone(job.repository_id)
        db.close()


def _compute_totals(db: Session, repository_id: int, edge_count: int) -> dict:
    from sqlalchemy import func

    total_files = db.scalar(
        select(func.count(File.id)).where(File.repository_id == repository_id)
    ) or 0
    total_functions = db.scalar(
        select(func.count(Function.id)).where(Function.repository_id == repository_id)
    ) or 0
    total_classes = db.scalar(
        select(func.count(Class.id)).where(Class.repository_id == repository_id)
    ) or 0
    total_tests = db.scalar(
        select(func.count(File.id)).where(
            File.repository_id == repository_id, File.is_test.is_(True)
        )
    ) or 0
    avg_complexity = db.scalar(
        select(func.avg(Function.cyclomatic_complexity)).where(
            Function.repository_id == repository_id
        )
    )
    return {
        "total_files": int(total_files),
        "total_functions": int(total_functions),
        "total_classes": int(total_classes),
        "total_dependencies": int(edge_count),
        "total_tests": int(total_tests),
        "average_complexity": round(float(avg_complexity or 0.0), 2),
    }


def _write_metrics(db: Session, repository_id: int, totals: dict) -> None:
    db.query(Metric).filter(
        Metric.repository_id == repository_id, Metric.file_id.is_(None)
    ).delete(synchronize_session=False)
    for name, value in totals.items():
        db.add(Metric(repository_id=repository_id, name=name, value=float(value)))
    db.commit()
