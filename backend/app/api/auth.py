"""Multi-provider OAuth authentication (GitHub + GitLab).

Flow (per provider ``p`` in {github, gitlab}):
  GET  /api/auth/{p}/login     -> redirect to provider authorize
  GET  /api/auth/{p}/callback  -> exchange code, upsert user + token server-side
  POST /api/auth/logout        -> clear session
  GET  /api/auth/me            -> current user (no token exposed)
  GET  /api/auth/providers     -> which providers are configured

Access tokens are stored server-side on the ``users`` row and never returned to
the frontend. A ``state`` parameter guards against CSRF.
"""

from __future__ import annotations

import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN = "https://github.com/login/oauth/access_token"
GITHUB_USER = "https://api.github.com/user"


def _provider_config(provider: str) -> dict:
    if provider == "github":
        if not settings.github_oauth_configured:
            raise HTTPException(501, "GitHub OAuth is not configured on the server.")
        return {
            "authorize": GITHUB_AUTHORIZE,
            "token": GITHUB_TOKEN,
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "callback": settings.github_oauth_callback_url,
            "scope": "read:user repo",
        }
    if provider == "gitlab":
        if not settings.gitlab_oauth_configured:
            raise HTTPException(501, "GitLab OAuth is not configured on the server.")
        base = settings.gitlab_base_url.rstrip("/")
        return {
            "authorize": f"{base}/oauth/authorize",
            "token": f"{base}/oauth/token",
            "client_id": settings.gitlab_client_id,
            "client_secret": settings.gitlab_client_secret,
            "callback": settings.gitlab_oauth_callback_url,
            "scope": "read_api read_user read_repository",
        }
    raise HTTPException(404, "Unknown provider.")


@router.get("/providers")
def providers() -> JSONResponse:
    return JSONResponse(
        {
            "github": settings.github_oauth_configured,
            "gitlab": settings.gitlab_oauth_configured,
            "dev_mode": settings.environment == "development"
            and not settings.any_oauth_configured,
        }
    )


@router.get("/{provider}/login")
def login(provider: str, request: Request) -> RedirectResponse:
    cfg = _provider_config(provider)
    state = secrets.token_urlsafe(24)
    request.session["oauth_state"] = state
    request.session["oauth_provider"] = provider
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["callback"],
        "scope": cfg["scope"],
        "state": state,
        "response_type": "code",
    }
    return RedirectResponse(f"{cfg['authorize']}?{urlencode(params)}")


def _exchange_and_fetch_user(provider: str, cfg: dict, code: str) -> tuple[str, dict]:
    """Exchange the code for a token and fetch the provider user profile."""
    with httpx.Client(timeout=15.0) as client:
        token_resp = client.post(
            cfg["token"],
            headers={"Accept": "application/json"},
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "redirect_uri": cfg["callback"],
                "grant_type": "authorization_code",
            },
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(400, "Failed to obtain access token.")

        if provider == "github":
            user_url = GITHUB_USER
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            }
        else:  # gitlab
            base = settings.gitlab_base_url.rstrip("/")
            user_url = f"{base}/api/v4/user"
            headers = {"Authorization": f"Bearer {access_token}"}

        user_resp = client.get(user_url, headers=headers)
        if user_resp.status_code >= 400:
            raise HTTPException(400, "Failed to fetch provider user.")
        return access_token, user_resp.json()


@router.get("/{provider}/callback")
def callback(
    provider: str,
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    cfg = _provider_config(provider)
    expected = request.session.pop("oauth_state", None)
    if not expected or not secrets.compare_digest(expected, state):
        raise HTTPException(400, "Invalid OAuth state.")

    access_token, profile = _exchange_and_fetch_user(provider, cfg, code)

    provider_user_id = str(profile["id"])
    login_name = profile.get("login") or profile.get("username") or f"user-{provider_user_id}"
    avatar = profile.get("avatar_url")
    email = profile.get("email")

    user = (
        db.query(User)
        .filter(User.provider == provider, User.provider_user_id == provider_user_id)
        .first()
    )
    if user is None:
        user = User(provider=provider, provider_user_id=provider_user_id, login=login_name)
        db.add(user)
    user.login = login_name
    user.email = email
    user.avatar_url = avatar
    user.access_token = access_token  # server-side only
    db.commit()
    db.refresh(user)

    request.session["user_id"] = user.id
    return RedirectResponse(url=settings.frontend_base_url)


@router.post("/logout")
def logout(request: Request) -> JSONResponse:
    request.session.clear()
    return JSONResponse({"ok": True})


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    user_id = request.session.get("user_id")
    if user_id is None:
        if settings.environment == "development" and not settings.any_oauth_configured:
            return JSONResponse(
                {"authenticated": True, "login": "local-dev", "provider": "github", "dev_mode": True}
            )
        return JSONResponse({"authenticated": False})
    user = db.get(User, user_id)
    if user is None:
        return JSONResponse({"authenticated": False})
    return JSONResponse(
        {
            "authenticated": True,
            "login": user.login,
            "provider": user.provider,
            "avatar_url": user.avatar_url,
        }
    )
