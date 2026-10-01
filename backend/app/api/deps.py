"""Shared API dependencies: current user resolution and rate limiting.

Phase 1 wires the GitHub OAuth callback (see ``app.api.auth``) which populates a
server-side session with the authenticated user's id. For local development
without OAuth credentials configured, a deterministic local user is used so the
ingestion/parsing pipeline can be exercised end to end. The local fallback is
gated on ``environment == "development"`` and the absence of OAuth config.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import get_db
from app.models import User

settings = get_settings()


def _get_or_create_local_user(db: Session) -> User:
    user = (
        db.query(User)
        .filter(User.provider == "github", User.provider_user_id == "0")
        .first()
    )
    if user is None:
        user = User(
            provider="github",
            provider_user_id="0",
            login="local-dev",
            email=None,
            avatar_url=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Resolve the authenticated user from the session.

    Falls back to a local development user only when OAuth is not configured and
    the app runs in development mode.
    """
    session = request.session if hasattr(request, "session") else {}
    user_id = session.get("user_id")
    if user_id is not None:
        user = db.get(User, user_id)
        if user is not None:
            return user

    # After an explicit sign-out we do not silently re-issue the dev user; the
    # user must click sign in again. This makes logout meaningful in dev mode.
    if settings.dev_login_active and not session.get("signed_out"):
        return _get_or_create_local_user(db)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Connect your GitHub account first.",
    )


# --- Simple in-memory per-user rate limiter ---
# Sufficient for a single-process dev/demo deployment. Phase 6 moves this to
# Redis so it works across processes.
_WINDOW_SECONDS = 60
_MAX_REQUESTS = 60
_ANALYSE_MAX = 5
_buckets: dict[str, list[float]] = defaultdict(list)


def _rate_limit(key: str, limit: int) -> None:
    now = time.monotonic()
    window = _buckets[key]
    cutoff = now - _WINDOW_SECONDS
    window[:] = [t for t in window if t > cutoff]
    if len(window) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Try again shortly.",
        )
    window.append(now)


def rate_limit_default(user: User = Depends(get_current_user)) -> User:
    _rate_limit(f"default:{user.id}", _MAX_REQUESTS)
    return user


def rate_limit_analyse(user: User = Depends(get_current_user)) -> User:
    _rate_limit(f"analyse:{user.id}", _ANALYSE_MAX)
    return user
