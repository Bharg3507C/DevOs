"""Tests for repository walking and dependency-edge resolution.

These build the knowledge graph directly from the fixture repo (parsing on
disk, no git clone) and verify that internal imports become file->file edges,
including the A->B->C chain and the circular dependency.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import select

from app.analysis.parser import iter_source_files, parse_file
from app.db.base import Base, SessionLocal, engine
from app.models import Dependency, File
from app.services.analysis_service import (
    _persist_parsed_file,
    _resolve_dependencies,
)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def _ingest_fixture(db, repo_root: Path, repository_id: int = 1) -> dict[str, int]:
    """Parse and persist every source file in the fixture repo."""
    path_to_id: dict[str, int] = {}
    for src in iter_source_files(repo_root, max_files=1000, max_file_bytes=2_000_000):
        parsed = parse_file(repo_root, src)
        if parsed is None:
            continue
        file_row = _persist_parsed_file(db, repository_id, parsed)
        db.flush()
        path_to_id[parsed.path] = file_row.id
    db.commit()
    return path_to_id


def test_iter_source_files_finds_python(fixture_repo_path):
    files = list(
        iter_source_files(fixture_repo_path, max_files=1000, max_file_bytes=2_000_000)
    )
    names = {p.name for p in files}
    assert {"a.py", "b.py", "c.py", "cycle_x.py", "test_a.py"} <= names


def test_abc_dependency_chain_resolves(db_session, fixture_repo_path):
    ids = _ingest_fixture(db_session, fixture_repo_path)
    edges_created = _resolve_dependencies(db_session, repository_id=1)
    assert edges_created > 0

    deps = db_session.execute(
        select(Dependency.source_file_id, Dependency.target_file_id).where(
            Dependency.repository_id == 1
        )
    ).all()
    edge_set = set(deps)

    a, b, c = ids["pkg/a.py"], ids["pkg/b.py"], ids["pkg/c.py"]
    # A imports B, B imports C  => edges a->b and b->c
    assert (a, b) in edge_set
    assert (b, c) in edge_set


def test_circular_dependency_edges_present(db_session, fixture_repo_path):
    ids = _ingest_fixture(db_session, fixture_repo_path)
    _resolve_dependencies(db_session, repository_id=1)
    deps = db_session.execute(
        select(Dependency.source_file_id, Dependency.target_file_id).where(
            Dependency.repository_id == 1
        )
    ).all()
    edge_set = set(deps)

    x = ids["pkg/cycle_x.py"]
    y = ids["pkg/cycle_y.py"]
    z = ids["pkg/cycle_z.py"]
    # x->y->z->x forms a cycle in the edge set
    assert (x, y) in edge_set
    assert (y, z) in edge_set
    assert (z, x) in edge_set


def test_high_complexity_function_detected(db_session, fixture_repo_path):
    _ingest_fixture(db_session, fixture_repo_path)
    from app.models import Function

    high = (
        db_session.query(Function)
        .filter(Function.name == "high_complexity")
        .one()
    )
    assert high.cyclomatic_complexity >= 8


def test_test_file_flagged(db_session, fixture_repo_path):
    _ingest_fixture(db_session, fixture_repo_path)
    test_files = db_session.query(File).filter(File.is_test.is_(True)).all()
    assert any(f.path.endswith("test_a.py") for f in test_files)
