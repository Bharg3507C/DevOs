"""GitHub OAuth authentication routes.

Flow:
  GET  /api/auth/github/login     -> redirect to GitHub authorize
  GET  /api/auth/github/callback  -> exchange code, store user + token server-side
  POST /api/auth/logout           -> clear session
  GET  /api/auth/me               -> current user (no token exposed)

The access token is stored on the ``users`` row (server-side only) and is never
returned to the frontend. A ``state`` parameter guards against CSRF.
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


@router.get("/github/login")
def github_login(request: Request) -> RedirectResponse:
    if not settings.github_oauth_configured:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GitHub OAuth is not configured on the server.",
        )
    state = secrets.token_urlsafe(24)
    request.session["oauth_state"] = state
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_oauth_callback_url,
        "scope": "read:user repo",
        "state": state,
    }
    return RedirectResponse(f"{GITHUB_AUTHORIZE}?{urlencode(params)}")


@router.get("/github/callback")
def github_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    expected = request.session.pop("oauth_state", None)
    if not expected or not secrets.compare_digest(expected, state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    with httpx.Client(timeout=15.0) as client:
        token_resp = client.post(
            GITHUB_TOKEN,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_oauth_callback_url,
            },
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to obtain access token.")

        user_resp = client.get(
            GITHUB_USER,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if user_resp.status_code >= 400:
            raise HTTPException(status_code=400, detail="Failed to fetch GitHub user.")
        gh = user_resp.json()

    user = db.query(User).filter(User.github_id == gh["id"]).first()
    if user is None:
        user = User(github_id=gh["id"], login=gh["login"])
        db.add(user)
    user.login = gh["login"]
    user.email = gh.get("email")
    user.avatar_url = gh.get("avatar_url")
    user.access_token = access_token  # server-side only
    db.commit()
    db.refresh(user)

    request.session["user_id"] = user.id
    # Send the user back to the frontend.
    frontend = settings.cors_origin_list[0] if settings.cors_origin_list else "/"
    return RedirectResponse(url=frontend)


@router.post("/logout")
def logout(request: Request) -> JSONResponse:
    request.session.clear()
    return JSONResponse({"ok": True})


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    user_id = request.session.get("user_id")
    if user_id is None:
        if settings.environment == "development" and not settings.github_oauth_configured:
            return JSONResponse(
                {"login": "local-dev", "avatar_url": None, "dev_mode": True}
            )
        return JSONResponse({"authenticated": False}, status_code=200)
    user = db.get(User, user_id)
    if user is None:
        return JSONResponse({"authenticated": False}, status_code=200)
    return JSONResponse(
        {
            "authenticated": True,
            "login": user.login,
            "avatar_url": user.avatar_url,
        }
    )
