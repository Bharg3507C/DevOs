"""Git hosting provider abstraction (GitHub, GitLab).

The rest of the app depends on the :class:`RepoProvider` protocol, not on any
one host, so adding a provider means adding one module here.
"""

from __future__ import annotations

from app.services.providers.base import (
    ProviderError,
    RepoMetadata,
    RepoProvider,
    RepositoryAccessError,
)
from app.services.providers.github import GitHubProvider
from app.services.providers.gitlab import GitLabProvider

PROVIDERS = {"github": GitHubProvider, "gitlab": GitLabProvider}


def get_provider(name: str, token: str | None = None) -> RepoProvider:
    """Return a provider instance by name (``github`` | ``gitlab``)."""
    key = (name or "github").lower()
    cls = PROVIDERS.get(key)
    if cls is None:
        raise ProviderError(f"Unsupported provider: {name!r}")
    return cls(token=token)


__all__ = [
    "ProviderError",
    "RepositoryAccessError",
    "RepoMetadata",
    "RepoProvider",
    "GitHubProvider",
    "GitLabProvider",
    "get_provider",
    "PROVIDERS",
]
