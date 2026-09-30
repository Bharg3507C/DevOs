"""GitHub provider implementation."""

from __future__ import annotations

from urllib.parse import quote, urlparse, urlunparse

import httpx

from app.services.providers.base import (
    ProviderError,
    RepoMetadata,
    RepositoryAccessError,
)

GITHUB_API = "https://api.github.com"


class GitHubProvider:
    name = "github"

    def __init__(self, token: str | None = None, timeout: float = 15.0) -> None:
        self._token = token
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    def get_repo_metadata(self, owner: str, name: str) -> RepoMetadata:
        url = f"{GITHUB_API}/repos/{owner}/{name}"
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(url, headers=self._headers())
        except httpx.HTTPError as exc:
            raise ProviderError(f"GitHub request failed: {exc}") from exc

        if resp.status_code in (403, 404):
            raise RepositoryAccessError(
                f"Repository {owner}/{name} is not accessible with the provided token."
            )
        if resp.status_code >= 400:
            raise ProviderError(f"GitHub API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        return RepoMetadata(
            provider=self.name,
            provider_repo_id=str(data["id"]),
            owner=data["owner"]["login"],
            name=data["name"],
            full_name=data["full_name"],
            default_branch=data.get("default_branch", "main"),
            clone_url=data["clone_url"],
            is_private=data.get("private", False),
            primary_language=data.get("language"),
            size_kb=data.get("size", 0),
        )

    def get_languages(self, owner: str, name: str) -> dict[str, int]:
        url = f"{GITHUB_API}/repos/{owner}/{name}/languages"
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(url, headers=self._headers())
        except httpx.HTTPError as exc:
            raise ProviderError(f"GitHub request failed: {exc}") from exc
        if resp.status_code >= 400:
            return {}
        return resp.json()

    def authenticated_clone_url(self, clone_url: str, token: str | None) -> str:
        if not token:
            return clone_url
        parsed = urlparse(clone_url)
        # x-access-token is GitHub's recommended basic-auth username for tokens.
        netloc = f"x-access-token:{quote(token, safe='')}@{parsed.netloc}"
        return urlunparse(parsed._replace(netloc=netloc))
