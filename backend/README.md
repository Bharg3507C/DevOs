# DevOS Backend

FastAPI service that ingests a GitHub repository, statically parses its source,
and builds the repository knowledge graph in PostgreSQL.

## Layout

```
app/
  core/        config, structured logging, security primitives
  db/          SQLAlchemy engine + session
  analysis/    static parsers (Python AST) and the repo walker
  services/    providers (GitHub/GitLab), ingestion (sandboxed clone), analysis_service
  api/         auth (GitHub + GitLab OAuth), repositories, jobs, diagnostics
  models.py    knowledge-graph ORM models
  schemas.py   Pydantic request/response models
  main.py      app factory + middleware
tests/         pytest suite + fixture repository
```

## Run locally (without Docker)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Requires a reachable PostgreSQL for real use; the test suite uses in-memory
SQLite and needs no external services.

API docs: http://localhost:8000/docs

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Phase 1 endpoints

| Method | Path                                        | Purpose                       |
| ------ | ------------------------------------------- | ----------------------------- |
| POST   | `/api/repositories/connect`                 | Connect a repo (verifies access) |
| POST   | `/api/repositories/{id}/analyse`            | Trigger background analysis   |
| GET    | `/api/repositories`                         | List connected repos          |
| GET    | `/api/repositories/{id}`                    | Repo metadata                 |
| GET    | `/api/repositories/{id}/overview`           | Analysis totals               |
| GET    | `/api/repositories/{id}/files`              | Paginated file list           |
| GET    | `/api/repositories/{id}/files/{file_id}`    | File intelligence detail      |
| GET    | `/api/analysis-jobs/{id}`                   | Job status + progress steps   |
| GET    | `/api/_diagnostics`                         | Dev-only diagnostics          |

## Security notes

Repository code is never executed. Python is parsed with the standard-library
`ast` module (parse only). Clones are sandboxed and path-checked. See the
root `SECURITY.md`.
