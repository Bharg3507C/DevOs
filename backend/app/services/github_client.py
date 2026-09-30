"""Thin GitHub REST API client.

Used to (a) verify that the authenticated user can access a repository before we
clone it, and (b) fetch repository metadata (languages, size, default branch).
Access tokens are passed per-call and never persisted here.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

GITHUB_API = "https://api.github.com"


class GitHubError(Exception):
    """Raised for GitHub API failures (auth, access, or transport)."""


class RepositoryAccessError(GitHubError):
    """Raised when the user cannot access the requested repository."""


@dataclass
class GitHubRepoMetadata:
    github_repo_id: int
    owner: str
    name: str
    full_name: str
    default_branch: str
    clone_url: str
    is_private: bool
    primary_language: str | None
    size_kb: int


def _headers(token: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


class GitHubClient:
    def __init__(self, token: str | None = None, timeout: float = 15.0) -> None:
        self._token = token
        self._timeout = timeout

    def get_repo_metadata(self, owner: str, name: str) -> GitHubRepoMetadata:
        """Fetch metadata and implicitly verify access.

        A 404/403 for a private repo the user cannot see surfaces as a
        :class:`RepositoryAccessError`, which the API maps to 403/404.
        """
        url = f"{GITHUB_API}/repos/{owner}/{name}"
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(url, headers=_headers(self._token))
        except httpx.HTTPError as exc:  # transport-level failure
            raise GitHubError(f"GitHub request failed: {exc}") from exc

        if resp.status_code in (403, 404):
            raise RepositoryAccessError(
                f"Repository {owner}/{name} is not accessible with the provided token."
            )
        if resp.status_code >= 400:
            raise GitHubError(
                f"GitHub API error {resp.status_code}: {resp.text[:200]}"
            )

        data = resp.json()
        return GitHubRepoMetadata(
            github_repo_id=data["id"],
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
                resp = client.get(url, headers=_headers(self._token))
        except httpx.HTTPError as exc:
            raise GitHubError(f"GitHub request failed: {exc}") from exc
        if resp.status_code >= 400:
            return {}
        return resp.json()
