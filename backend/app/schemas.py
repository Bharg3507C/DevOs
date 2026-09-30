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
