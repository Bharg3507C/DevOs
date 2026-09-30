"""SQLAlchemy models forming the DevOS repository knowledge graph.

Nodes: files, symbols (functions/classes), commits.
Edges: imports (raw) and dependencies (resolved file->file).

Every table that is queried by repository carries an indexed ``repository_id``
so lookups stay fast on large repositories. Deleting a repository cascades to
all derived data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobStatus(str, PyEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    """An authenticated user, identified by the hosting provider + their id.

    A person who signs in with both GitHub and GitLab has two user rows (one per
    provider); each carries its own access token.
    """

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_user_provider_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(16), default="github", index=True)
    provider_user_id: Mapped[str] = mapped_column(String(64), index=True)
    login: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Server-side only; never serialised to the frontend.
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    repositories: Mapped[list["Repository"]] = relationship(
        back_populates="connected_by", cascade="all, delete-orphan"
    )


class Repository(Base):
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("owner", "name", "connected_by_id", name="uq_repo_owner_name_user"),
        Index("ix_repositories_owner_name", "owner", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(16), default="github", index=True)
    provider_repo_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    owner: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(512), index=True)
    default_branch: Mapped[str] = mapped_column(String(255), default="main")
    clone_url: Mapped[str] = mapped_column(String(1024))
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    primary_language: Mapped[str | None] = mapped_column(String(64), nullable=True)
    languages: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    size_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    connected_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    connected_by: Mapped["User"] = relationship(back_populates="repositories")
    analyses: Mapped[list["RepositoryAnalysis"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["AnalysisJob"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    files: Mapped[list["File"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )


class RepositoryAnalysis(Base):
    """A completed analysis snapshot of a repository at a given commit."""

    __tablename__ = "repository_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    total_functions: Mapped[int] = mapped_column(Integer, default=0)
    total_classes: Mapped[int] = mapped_column(Integer, default=0)
    total_dependencies: Mapped[int] = mapped_column(Integer, default=0)
    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    average_complexity: Mapped[float] = mapped_column(Float, default=0.0)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    repository: Mapped["Repository"] = relationship(back_populates="analyses")


class AnalysisJob(Base):
    """Lifecycle + progress of a background analysis run."""

    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(32), default=JobStatus.QUEUED.value, index=True)
    # Ordered list of {name, status} steps for progress display.
    steps: Mapped[list | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    files_processed: Mapped[int] = mapped_column(Integer, default=0)
    parsing_failures: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    repository: Mapped["Repository"] = relationship(back_populates="jobs")


class File(Base):
    __tablename__ = "files"
    __table_args__ = (
        Index("ix_files_repo_path", "repository_id", "path", unique=True),
        Index("ix_files_content_hash", "content_hash"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    path: Mapped[str] = mapped_column(String(1024))
    language: Mapped[str | None] = mapped_column(String(64), nullable=True)
    loc: Mapped[int] = mapped_column(Integer, default=0)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_test: Mapped[bool] = mapped_column(Boolean, default=False)
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_modified: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    repository: Mapped["Repository"] = relationship(back_populates="files")
    symbols: Mapped[list["Symbol"]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )
    functions: Mapped[list["Function"]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )
    classes: Mapped[list["Class"]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )
    imports: Mapped[list["Import"]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )


class Symbol(Base):
    """Generic symbol table entry (kind: function | class | method | variable)."""

    __tablename__ = "symbols"
    __table_args__ = (Index("ix_symbols_repo_name", "repository_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(512))
    kind: Mapped[str] = mapped_column(String(32))
    start_line: Mapped[int] = mapped_column(Integer, default=0)
    end_line: Mapped[int] = mapped_column(Integer, default=0)

    file: Mapped["File"] = relationship(back_populates="symbols")


class Function(Base):
    __tablename__ = "functions"
    __table_args__ = (Index("ix_functions_repo_name", "repository_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(512))
    qualified_name: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    start_line: Mapped[int] = mapped_column(Integer, default=0)
    end_line: Mapped[int] = mapped_column(Integer, default=0)
    loc: Mapped[int] = mapped_column(Integer, default=0)
    num_params: Mapped[int] = mapped_column(Integer, default=0)
    cyclomatic_complexity: Mapped[int] = mapped_column(Integer, default=1)
    is_async: Mapped[bool] = mapped_column(Boolean, default=False)
    is_method: Mapped[bool] = mapped_column(Boolean, default=False)
    is_test: Mapped[bool] = mapped_column(Boolean, default=False)

    file: Mapped["File"] = relationship(back_populates="functions")


class Class(Base):
    __tablename__ = "classes"
    __table_args__ = (Index("ix_classes_repo_name", "repository_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(512))
    start_line: Mapped[int] = mapped_column(Integer, default=0)
    end_line: Mapped[int] = mapped_column(Integer, default=0)
    base_classes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    num_methods: Mapped[int] = mapped_column(Integer, default=0)

    file: Mapped["File"] = relationship(back_populates="classes")


class Import(Base):
    """Raw import statement extracted from a file (pre-resolution)."""

    __tablename__ = "imports"
    __table_args__ = (Index("ix_imports_repo_module", "repository_id", "module"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), index=True)
    module: Mapped[str] = mapped_column(String(1024))
    symbol: Mapped[str | None] = mapped_column(String(512), nullable=True)
    alias: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_relative: Mapped[bool] = mapped_column(Boolean, default=False)
    level: Mapped[int] = mapped_column(Integer, default=0)
    line: Mapped[int] = mapped_column(Integer, default=0)

    file: Mapped["File"] = relationship(back_populates="imports")


class Dependency(Base):
    """Resolved file->file edge of the dependency graph."""

    __tablename__ = "dependencies"
    __table_args__ = (
        UniqueConstraint(
            "source_file_id", "target_file_id", name="uq_dependency_source_target"
        ),
        Index("ix_dependencies_source", "source_file_id"),
        Index("ix_dependencies_target", "target_file_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), index=True
    )
    target_file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), index=True
    )
    via_module: Mapped[str | None] = mapped_column(String(1024), nullable=True)


class Commit(Base):
    __tablename__ = "commits"
    __table_args__ = (
        UniqueConstraint("repository_id", "sha", name="uq_commit_repo_sha"),
        Index("ix_commits_repo_date", "repository_id", "committed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    sha: Mapped[str] = mapped_column(String(64))
    author_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    author_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    changed_files: Mapped[list["ChangedFile"]] = relationship(
        back_populates="commit", cascade="all, delete-orphan"
    )


class ChangedFile(Base):
    __tablename__ = "changed_files"
    __table_args__ = (Index("ix_changed_files_repo_path", "repository_id", "path"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    commit_id: Mapped[int] = mapped_column(
        ForeignKey("commits.id", ondelete="CASCADE"), index=True
    )
    path: Mapped[str] = mapped_column(String(1024))
    change_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    insertions: Mapped[int] = mapped_column(Integer, default=0)
    deletions: Mapped[int] = mapped_column(Integer, default=0)

    commit: Mapped["Commit"] = relationship(back_populates="changed_files")


class Test(Base):
    """A detected test and its target relationship (if resolvable)."""

    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    target_file_id: Mapped[int | None] = mapped_column(
        ForeignKey("files.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_symbol: Mapped[str | None] = mapped_column(String(512), nullable=True)


class Metric(Base):
    """A named computed metric scoped to a repository and optionally a file."""

    __tablename__ = "metrics"
    __table_args__ = (Index("ix_metrics_repo_name", "repository_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[int | None] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    value: Mapped[float] = mapped_column(Float, default=0.0)


class TechnicalDebtFinding(Base):
    """A single technical-debt finding with the exact triggering signals.

    ``signals`` stores the raw factor values and weights so the score is fully
    reconstructable and explainable. No opaque model.
    """

    __tablename__ = "technical_debt_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[int | None] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=True, index=True
    )
    severity: Mapped[str] = mapped_column(String(32), default="info")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    reasons: Mapped[list | None] = mapped_column(JSON, nullable=True)
    signals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
