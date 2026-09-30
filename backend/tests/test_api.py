"""API tests for the Phase 1 endpoints.

GitHub network calls and the background analysis job are patched so the tests
run offline and deterministically. Auth uses the development local-user
fallback (OAuth not configured in the test env).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base, engine
from app.services.providers.base import RepoMetadata


@pytest.fixture
def client(monkeypatch):
    # Fresh schema per test module run.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Patch provider metadata + languages so no network is used.
    def fake_meta(self, owner, name):
        return RepoMetadata(
            provider=self.name,
            provider_repo_id="123",
            owner=owner,
            name=name,
            full_name=f"{owner}/{name}",
            default_branch="main",
            clone_url=f"https://github.com/{owner}/{name}.git",
            is_private=False,
            primary_language="Python",
            size_kb=42,
        )

    def fake_langs(self, owner, name):
        return {"Python": 1000}

    monkeypatch.setattr(
        "app.services.providers.github.GitHubProvider.get_repo_metadata", fake_meta
    )
    monkeypatch.setattr(
        "app.services.providers.github.GitHubProvider.get_languages", fake_langs
    )

    from app.main import app

    with TestClient(app) as c:
        yield c


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_connect_repository(client):
    resp = client.post(
        "/api/repositories/connect", json={"owner": "octocat", "name": "hello"}
    )
    assert resp.status_code == 201
    body = resp.json()["repository"]
    assert body["full_name"] == "octocat/hello"
    assert body["primary_language"] == "Python"
    # Secret token must never be present in the response.
    assert "access_token" not in body


def test_connect_validation_error(client):
    resp = client.post("/api/repositories/connect", json={"owner": "", "name": ""})
    assert resp.status_code == 422


def test_overview_before_analysis_is_zeroed(client):
    connect = client.post(
        "/api/repositories/connect", json={"owner": "octocat", "name": "hello"}
    )
    repo_id = connect.json()["repository"]["id"]
    resp = client.get(f"/api/repositories/{repo_id}/overview")
    assert resp.status_code == 200
    body = resp.json()
    # No fabricated stats before analysis has run.
    assert body["total_files"] == 0
    assert body["last_analysed_at"] is None


def test_analyse_dispatches_job(client, monkeypatch):
    # Replace the real analysis with a no-op so no clone/network occurs.
    called = {}

    def fake_run(job_id):
        called["job_id"] = job_id

    monkeypatch.setattr("app.api.repositories.run_analysis", fake_run)

    connect = client.post(
        "/api/repositories/connect", json={"owner": "octocat", "name": "hello"}
    )
    repo_id = connect.json()["repository"]["id"]

    resp = client.post(f"/api/repositories/{repo_id}/analyse")
    assert resp.status_code == 200
    job = resp.json()["job"]
    assert job["status"] == "queued"
    assert job["repository_id"] == repo_id

    # Job is retrievable.
    job_resp = client.get(f"/api/analysis-jobs/{job['id']}")
    assert job_resp.status_code == 200


def test_access_control_unknown_repository(client):
    resp = client.get("/api/repositories/9999")
    assert resp.status_code == 404


def test_files_pagination_shape(client):
    connect = client.post(
        "/api/repositories/connect", json={"owner": "octocat", "name": "hello"}
    )
    repo_id = connect.json()["repository"]["id"]
    resp = client.get(f"/api/repositories/{repo_id}/files?page=1&page_size=10")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"items", "total", "page", "page_size"}
    assert body["page"] == 1
