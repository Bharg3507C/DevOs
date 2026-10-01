"""Pytest fixtures.

The DB-backed tests use an in-memory SQLite database so the suite runs without a
Postgres instance. The models use portable column types (JSON is supported by
SQLite in SQLAlchemy 2.x), so the schema creates cleanly.

Auth: the API tests rely on the dev-user fallback (no OAuth configured). We
explicitly blank out the OAuth credential vars and set environment=development
*before* importing the app so that ``dev_login_active`` is True and the
TestClient can reach authenticated endpoints without a real OAuth flow.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

# ---- Environment setup (must happen before any app import) -----------------

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SESSION_SECRET"] = "test-secret"
os.environ["environment"] = "development"

# Blank out OAuth credentials so dev_login_active = True in tests.
os.environ["GITHUB_CLIENT_ID"] = ""
os.environ["GITHUB_CLIENT_SECRET"] = ""
os.environ["GITLAB_CLIENT_ID"] = ""
os.environ["GITLAB_CLIENT_SECRET"] = ""
os.environ["DEVOS_DISABLE_DEV_LOGIN"] = "false"

FIXTURE_REPO = Path(__file__).parent / "fixtures" / "sample_repo"


@pytest.fixture
def fixture_repo_path() -> Path:
    return FIXTURE_REPO
