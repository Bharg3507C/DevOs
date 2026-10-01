"""GitLab provider implementation."""

from __future__ import annotations

from urllib.parse import quote, urlparse, urlunparse

import httpx

from app.core.config import get_settings
from app.services.providers.base import (
    ProviderError,
    RepoMetadata,
    RepositoryAccessError,
)

settings = get_settings()


class GitLabProvider:
    name = "gitlab"

    def __init__(self, token: str | None = None, timeout: float = 15.0) -> None:
        self._token = token
        self._timeout = timeout
        self._base = settings.gitlab_base_url.rstrip("/")
        self._api = f"{self._base}/api/v4"

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    def _project_id(self, owner: str, name: str) -> str:
        return quote(f"{owner}/{name}", safe="")

    def get_repo_metadata(self, owner: str, name: str) -> RepoMetadata:
        pid = self._project_id(owner, name)
        url = f"{self._api}/projects/{pid}"
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(url, headers=self._headers())
        except httpx.HTTPError as exc:
            raise ProviderError(f"GitLab request failed: {exc}") from exc

        if resp.status_code in (401, 403, 404):
            raise RepositoryAccessError(
                f"Project {owner}/{name} is not accessible with the provided token."
            )
        if resp.status_code >= 400:
            raise ProviderError(f"GitLab API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        namespace = data.get("namespace", {}).get("full_path") or owner
        return RepoMetadata(
            provider=self.name,
            provider_repo_id=str(data["id"]),
            owner=namespace,
            name=data["path"],
            full_name=data.get("path_with_namespace", f"{owner}/{name}"),
            default_branch=data.get("default_branch") or "main",
            clone_url=data["http_url_to_repo"],
            is_private=data.get("visibility", "private") != "public",
            primary_language=None,
            size_kb=int((data.get("statistics", {}) or {}).get("repository_size", 0)) // 1024,
        )

    def get_languages(self, owner: str, name: str) -> dict[str, int]:
        pid = self._project_id(owner, name)
        url = f"{self._api}/projects/{pid}/languages"
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(url, headers=self._headers())
        except httpx.HTTPError as exc:
            raise ProviderError(f"GitLab request failed: {exc}") from exc
        if resp.status_code >= 400:
            return {}
        raw = resp.json()
        return {lang: int(round(pct * 100)) for lang, pct in raw.items()}

    def list_user_repos(self, per_page: int = 100) -> list[RepoMetadata]:
        """List projects the authenticated user has access to."""
        if not self._token:
            return []
        url = f"{self._api}/projects"
        params = {
            "membership": "true",
            "per_page": str(per_page),
            "order_by": "last_activity_at",
            "direction": "desc",
        }
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(url, headers=self._headers(), params=params)
        except httpx.HTTPError as exc:
            raise ProviderError(f"GitLab request failed: {exc}") from exc
        if resp.status_code >= 400:
            return []
        repos: list[RepoMetadata] = []
        for data in resp.json():
            namespace = data.get("namespace", {}).get("full_path") or ""
            repos.append(
                RepoMetadata(
                    provider=self.name,
                    provider_repo_id=str(data["id"]),
                    owner=namespace,
                    name=data["path"],
                    full_name=data.get("path_with_namespace", data["path"]),
                    default_branch=data.get("default_branch") or "main",
                    clone_url=data["http_url_to_repo"],
                    is_private=data.get("visibility", "private") != "public",
                    primary_language=None,
                    size_kb=0,
                )
            )
        return repos

    def authenticated_clone_url(self, clone_url: str, token: str | None) -> str:
        if not token:
            return clone_url
        parsed = urlparse(clone_url)
        netloc = f"oauth2:{quote(token, safe='')}@{parsed.netloc}"
        return urlunparse(parsed._replace(netloc=netloc))
