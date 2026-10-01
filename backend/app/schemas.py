"""Pydantic request/response schemas for the DevOS API.

Access tokens and other secrets are never included in any response schema.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Requests ---
class ConnectRepositoryRequest(BaseModel):
    owner: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    provider: str | None = Field(default=None, pattern="^(github|gitlab)$")


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class ImpactRequest(BaseModel):
    file_id: int


# --- Responses ---
class RepositoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    owner: str
    name: str
    full_name: str
    default_branch: str
    is_private: bool
    primary_language: str | None
    languages: dict[str, int] | None
    size_kb: int | None
    created_at: datetime


class JobStepOut(BaseModel):
    name: str
    status: str


class AnalysisJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    repository_id: int
    status: str
    steps: list[JobStepOut] | None
    error: str | None
    files_processed: int
    parsing_failures: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class ConnectRepositoryResponse(BaseModel):
    repository: RepositoryOut


class AnalyseResponse(BaseModel):
    job: AnalysisJobOut


class OverviewOut(BaseModel):
    total_files: int
    total_functions: int
    total_classes: int
    total_dependencies: int
    total_tests: int
    average_complexity: float
    languages: dict[str, int]
    last_analysed_at: datetime | None
    last_commit_sha: str | None


class FileSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path: str
    language: str | None
    loc: int
    is_test: bool
    parse_error: str | None


class PaginatedFiles(BaseModel):
    items: list[FileSummaryOut]
    total: int
    page: int
    page_size: int


class FunctionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    qualified_name: str | None
    start_line: int
    end_line: int
    loc: int
    num_params: int
    cyclomatic_complexity: int
    is_async: bool
    is_method: bool
    is_test: bool


class ClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    start_line: int
    end_line: int
    base_classes: list[str] | None
    num_methods: int


class ImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    module: str
    symbol: str | None
    alias: str | None
    is_relative: bool
    line: int


class FileDetailOut(BaseModel):
    id: int
    path: str
    language: str | None
    loc: int
    size_bytes: int
    is_test: bool
    parse_error: str | None
    functions: list[FunctionOut]
    classes: list[ClassOut]
    imports: list[ImportOut]
    dependents_count: int
    dependencies_count: int
    max_complexity: int


# --- Architecture / dependency graph ---

class ArchNodeOut(BaseModel):
    id: str
    path: str
    language: str | None
    loc: int
    is_test: bool
    num_functions: int
    num_classes: int
    dependency_count: int
    dependent_count: int


class ArchEdgeOut(BaseModel):
    source: str
    target: str
    via_module: str | None


class CircularDependencyOut(BaseModel):
    cycle: list[str]  # ordered list of file paths forming the cycle


class ArchitectureOut(BaseModel):
    nodes: list[ArchNodeOut]
    edges: list[ArchEdgeOut]
    circular_dependencies: list[CircularDependencyOut]


# --- Git history ---

class CommitOut(BaseModel):
    sha: str
    author_name: str | None
    author_email: str | None
    message: str | None
    committed_at: datetime | None
    files_changed: int


class FileChurnOut(BaseModel):
    path: str
    file_id: int | None
    change_count: int
    total_insertions: int
    total_deletions: int


class ContributorOut(BaseModel):
    login: str
    commit_count: int


class CommitsOverTimeOut(BaseModel):
    date: str   # ISO date YYYY-MM-DD
    count: int


class GitHistoryOut(BaseModel):
    commits: list[CommitOut]
    top_changed_files: list[FileChurnOut]
    contributors: list[ContributorOut]
    commits_over_time: list[CommitsOverTimeOut]
    total_commits: int


# --- Search ---

class SearchResultOut(BaseModel):
    file_id: int
    path: str
    language: str | None
    kind: str              # "file" | "function" | "class" | "import"
    symbol: str | None
    start_line: int | None
    end_line: int | None
    match_reason: str


class SearchOut(BaseModel):
    query: str
    results: list[SearchResultOut]
    total: int


# --- Change impact ---

class ImpactNodeOut(BaseModel):
    file_id: int
    path: str
    distance: int          # hops from the origin
    kind: str              # "direct" | "indirect" | "test"


class ImpactOut(BaseModel):
    origin_file_id: int
    origin_path: str
    directly_affected: int
    indirectly_affected: int
    related_tests: int
    nodes: list[ImpactNodeOut]


# --- Technical debt ---

class DebtFindingOut(BaseModel):
    file_id: int | None
    path: str | None
    severity: str           # "high" | "medium" | "low" | "info"
    score: float
    reasons: list[str]
    signals: dict | None


class TechnicalDebtOut(BaseModel):
    findings: list[DebtFindingOut]
    total_findings: int
    high_count: int
    medium_count: int
    low_count: int
