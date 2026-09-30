# Contributing to DevOS

Thanks for your interest in DevOS. This guide covers local development, coding
standards, and the contribution workflow.

## Development setup

The fastest path is Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

For iterative work you can run each side natively:

**Backend**

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate   # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

## Coding standards

- **Python:** type hints on all public functions; `ruff` for lint/format;
  `mypy` for type checking. No repository code is ever executed — keep the
  parser static.
- **TypeScript:** strict mode; no `any` unless justified with a comment;
  functional React components.
- Keep components and modules small and focused.
- Add comments only for non-obvious engineering decisions.

## Tests

Every feature needs tests. Run before opening a PR:

```bash
# backend
cd backend && pytest

# frontend
cd frontend && npm run test
```

## Engineering rules

- No fake or hardcoded data in the product path. Every displayed statistic must
  come from real analysis.
- Prefer transparent, explainable algorithms. Use AI only where it genuinely
  adds value, and always ground it in repository data.
- Do not label something "AI detected" if a deterministic algorithm produced it.

## Commit and PR workflow

- Branch off `main`; use descriptive branch names.
- Keep PRs focused. Reference the phase and feature in the description.
- Ensure lint, type checks, and tests pass.
