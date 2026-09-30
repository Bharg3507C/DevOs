# DevOS Architecture

This document describes the system architecture, the knowledge graph / database
model, and the core algorithms. It is kept in sync with the implementation as
phases land.

## System overview

```
GitHub
  ↓  (OAuth, REST API)
Repository Connector  ──────────────┐
  ↓                                 │  metadata
Ingestion Service (sandboxed clone) │
  ↓                                 │
Code Parser (Python AST / Tree-sitter)
  ↓
Knowledge Graph (PostgreSQL via SQLAlchemy)
  ↓
Analysis Engine (deterministic)
  ↓
FastAPI Backend  ──►  Redis (cache + job coordination)
  ↓
React + TypeScript Frontend
```

The backend is split into layers:

| Layer          | Package                    | Responsibility                                   |
| -------------- | -------------------------- | ------------------------------------------------ |
| API            | `app.api`                  | HTTP routes, request/response schemas            |
| Services       | `app.services`             | Business logic: connect, ingest, run analysis    |
| Analysis       | `app.analysis`             | Parsers and deterministic analysers              |
| Persistence    | `app.db`, `app.models`     | SQLAlchemy models, session management            |
| Core           | `app.core`                 | Config, logging, security primitives             |

## Background jobs

Repository analysis is long-running, so it is dispatched as a background job.
An `analysis_jobs` row tracks status (`queued`, `running`, `completed`,
`failed`), progress steps, and timing. In Phase 1 the job runs via FastAPI
`BackgroundTasks`; from Phase 6 it is coordinated through Redis so it can be
distributed and observed independently of the API process. Job status is polled
via `GET /analysis-jobs/{id}`.

## Database model

The knowledge graph is relational. Core tables and their key relationships:

- **users** — authenticated GitHub users (id, github_id, login, email, avatar).
- **repositories** — connected repos (owner, name, default_branch, languages,
  size, connected_by → users).
- **repository_analysis** — one row per completed analysis snapshot of a repo
  (commit_sha, totals, timing). Enables historical comparison.
- **analysis_jobs** — lifecycle of an analysis run (status, steps, error).
- **files** — every source file in an analysis (path, language, loc, size,
  content_hash). Indexed by (repository_id, path).
- **symbols** — generic symbol table (file_id, name, kind, start/end line).
- **functions** — function-specific detail (name, file_id, params, loc,
  cyclomatic_complexity, is_test).
- **classes** — class detail (name, file_id, base classes, method count).
- **imports** — raw import statements (file_id, module, symbol, is_relative).
- **dependencies** — resolved file→file edges (source_file_id, target_file_id).
  This is the edge set of the dependency graph.
- **commits** — Git commits (sha, author, message, committed_at).
- **changed_files** — files touched per commit (commit_id, file path,
  insertions, deletions).
- **tests** — detected test files/functions and their target relationships.
- **metrics** — per-file and per-repo computed metrics (name, value).
- **technical_debt_findings** — one row per finding with the exact triggering
  signals recorded as structured JSON.

Foreign keys cascade on repository deletion. Hot lookup columns
(`repository_id`, `file_id`, `path`, `content_hash`) are indexed.

## Dependency graph

Nodes are files; edges are resolved imports (`dependencies` table). Import
resolution maps an `imports` row to a concrete `files` row within the same
repository when possible; unresolved imports (third-party / stdlib) are retained
on the `imports` table but do not create internal edges.

## Change impact

Given a start file:

- **Direct dependents** — files with an edge pointing at the start file
  (reverse adjacency, one hop).
- **Indirect dependents** — transitive closure over reverse edges, computed with
  BFS. Depth is recorded so the UI can show the chain.
- **Related tests** — tests whose target set intersects the affected files.
- **Potentially affected APIs** — affected files that expose detected endpoints.

Cycle-safe traversal (visited set) guarantees termination even with circular
dependencies.

## Circular dependency detection

Cycles are found with DFS colouring (white/grey/black). A back-edge to a grey
node closes a cycle; the grey stack yields the cycle path. Reported as a
**structural finding**, not automatically a bug.

## Technical debt scoring

Each signal is normalised to `[0, 1]` and combined with documented weights. A
finding stores the raw signal values and the weights used, so any score is fully
reconstructable and explainable. No hidden model.

## Security boundary

See [SECURITY.md](./SECURITY.md). Key points: sandboxed clone directory, path
traversal validation, static parsing only (no `exec`/`import` of repo code),
server-side token storage, and rate limiting.
