"""Pytest fixtures.

The DB-backed tests use an in-memory SQLite database so the suite runs without a
Postgres instance. The models use portable column types (JSON is supported by
SQLite in SQLAlchemy 2.x), so the schema creates cleanly.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

# Configure environment before importing the app/config.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "test-secret")
os.environ.setdefault("environment", "development")

FIXTURE_REPO = Path(__file__).parent / "fixtures" / "sample_repo"


@pytest.fixture
def fixture_repo_path() -> Path:
    return FIXTURE_REPO
