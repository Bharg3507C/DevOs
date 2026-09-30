# DevOS

> Understand your codebase before you change it.

DevOS is a developer intelligence platform. It connects to a real **GitHub or
GitLab** repository, statically analyses the actual source code, builds a
structured knowledge graph of the project, and produces **traceable** insights
about architecture, dependencies, code changes, technical debt, and change
impact.

DevOS is **not** a chatbot and **not** a GitHub/GitLab dashboard. Every insight
it surfaces is derived from real repository data and can be traced back to a
file, a line number, or a metric. Where an algorithm can explain a result,
DevOS uses that algorithm rather than an opaque "AI score".

---

## Table of contents

1. [What DevOS is](#1-what-devos-is)
2. [Problem statement](#2-problem-statement)
3. [Architecture](#3-architecture)
4. [Screenshots](#4-screenshots)
5. [Tech stack](#5-tech-stack)
6. [How repository analysis works](#6-how-repository-analysis-works)
7. [Knowledge graph design](#7-knowledge-graph-design)
8. [Change impact algorithm](#8-change-impact-algorithm)
9. [Technical debt methodology](#9-technical-debt-methodology)
10. [Security considerations](#10-security-considerations)
11. [Performance considerations](#11-performance-considerations)
12. [Testing](#12-testing)
13. [Local setup](#13-local-setup)
14. [Future roadmap](#14-future-roadmap)

---

## 1. What DevOS is

DevOS ingests a repository, parses its source files statically (never executing
repository code), and stores the extracted structure — files, functions,
classes, imports, dependencies, commits, tests, and metrics — in a relational
knowledge graph. On top of that graph it runs deterministic analyses:

- Dependency analysis
- Change impact analysis (graph traversal)
- Complexity analysis
- Technical debt analysis
- Git history analysis
- Test coverage / relationship analysis
- Dead code and unused dependency detection

An optional AI layer sits **on top** of the deterministic layer and is only ever
allowed to answer using repository-derived context.

DevOS works with both **GitHub** and **GitLab** through a pluggable provider
layer: users authenticate with either host, and repositories from either can be
analysed.

## 2. Problem statement

Before changing code, engineers need to know: what depends on this file, what
breaks if I change this function, where is the risk concentrated, and why does
this module exist. This information is usually scattered across the code, the
Git history, and people's heads. DevOS reconstructs it directly from the
repository so it is explicit, queryable, and traceable.

GitHub and GitLab are excellent for hosting and shipping code. DevOS is a
different layer that works on top of the repositories you already keep there,
answering questions about structure and risk that a hosting platform is not
built to answer. The marketing homepage (`/`) includes a full DevOS vs GitHub vs
GitLab capability comparison.

## 3. Architecture

```
GitHub / GitLab
  ↓
OAuth / Repository Connector (pluggable provider layer)
  ↓
Repository Ingestion Service
  ↓
Code Parser (Python AST, Tree-sitter)
  ↓
Repository Knowledge Graph (PostgreSQL)
  ↓
Analysis Engine
  ├── Dependency Analysis
  ├── Change Impact Analysis
  ├── Complexity Analysis
  ├── Technical Debt Analysis
  ├── Git History Analysis
  ├── Test Coverage Analysis
  └── Dead Code / Unused Dependency Detection
  ↓
FastAPI Backend
  ↓
React Frontend
```

Repository analysis runs as a **background job** so large repositories do not
block API requests. See [ARCHITECTURE.md](./ARCHITECTURE.md) for detail.

## 4. Screenshots

The frontend ships a marketing homepage (animated 3D dependency-graph hero, a
DevOS vs GitHub vs GitLab comparison), a sign-in screen with GitHub and GitLab,
and the app shell (dashboard, repository, files, file intelligence, settings).
Screenshots will be added as later phases fill in the remaining analysis views.

## 5. Tech stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Recharts,
React Flow. The 3D hero visual is a dependency-free animated canvas that
respects `prefers-reduced-motion`.

**Backend:** Python, FastAPI, PostgreSQL, SQLAlchemy, Redis.

**Code analysis:** Python `ast`, Tree-sitter (multi-language), GitPython / Git CLI.

**Auth:** GitHub and GitLab OAuth, secure server-side sessions.

**Ops:** Docker, Docker Compose, structured logging, environment variables.

**Testing:** Pytest (backend), Vitest + React Testing Library (frontend).

## 6. How repository analysis works

1. The user signs in with GitHub or GitLab. The connector verifies access and
   fetches metadata via the provider's API.
2. The ingestion service clones the repository into a sandboxed, per-analysis
   working directory using a provider-authenticated clone URL (private repos use
   the connecting user's token). All paths are validated to prevent traversal
   outside the sandbox.
3. The parser walks the tree, statically parsing each supported source file.
   Python uses the standard-library `ast` module; other languages use
   Tree-sitter. **Repository code is never executed.**
4. Extracted symbols, imports, and metrics are written to the knowledge graph.
5. Git history is read (read-only) to compute change frequency and churn.
6. Downstream analyses read from the graph, not from the filesystem.

Analysis is **incremental** where possible: unchanged files (matched by content
hash) are not re-parsed on subsequent commits.

## 7. Knowledge graph design

The knowledge graph is a relational model in PostgreSQL. Nodes are files,
symbols (functions/classes), and commits; edges are imports and dependencies.
See the [database model](./ARCHITECTURE.md#database-model).

## 8. Change impact algorithm

Change impact is computed by BFS/DFS traversal over the dependency graph. Given
a file or symbol, DevOS finds direct dependents (one hop), indirect dependents
(transitive closure), related tests, and potentially affected APIs. Details in
[ARCHITECTURE.md](./ARCHITECTURE.md#change-impact).

## 9. Technical debt methodology

Technical debt is a **transparent, weighted combination of measurable signals** —
cyclomatic complexity, file/function size, dependency count and coupling, test
presence, change frequency, staleness, and TODO/FIXME markers. Every finding
records exactly which signals triggered it. There is no opaque score.

## 10. Security considerations

Repository contents are treated as untrusted input. See [SECURITY.md](./SECURITY.md).

## 11. Performance considerations

Pagination, lazy loading, Redis caching, background jobs, database indexes, and
incremental analysis. The full repository is never loaded into the browser.

## 12. Testing

Backend: parser, dependency graph, impact traversal, circular dependency,
provider abstraction, API, and auth tests. Frontend: homepage, dashboard,
search, and analysis-progress rendering tests. A small fixture repository
exercises A→B→C chains, cycles, unused code, high complexity, Git changes, and
test relationships.

## 13. Local setup

Requires Docker and Docker Compose.

```bash
cp .env.example .env
# edit .env: set GitHub and/or GitLab OAuth credentials + secrets
docker compose up --build
```

Frontend: http://localhost:5173  ·  Backend: http://localhost:8000  ·
API docs: http://localhost:8000/docs

Without OAuth credentials, the backend runs in development mode with a local
user so the pipeline can be exercised against public repositories. To run the
backend or frontend directly, see their READMEs in `backend/` and `frontend/`.

## 14. Future roadmap

- Multi-language deep analysis via Tree-sitter (JS/TS, Go, Java)
- Detected API endpoint mapping across frameworks
- Duplication detection
- Richer AI grounding and evidence citations
- Incremental re-analysis on webhooks
- Team-level dashboards and trends over time

---

DevOS is built in phases. **Phase 1** delivers project setup, GitHub/GitLab
repository ingestion, the Python parser, the database, and basic file/symbol
extraction, plus a marketing homepage and multi-provider authentication.
