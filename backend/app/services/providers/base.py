"""Common provider types and protocol."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


class ProviderError(Exception):
    """Raised for provider API failures (auth, transport, unexpected status)."""


class RepositoryAccessError(ProviderError):
    """Raised when the user cannot access the requested repository."""


@dataclass
class RepoMetadata:
    """Provider-neutral repository metadata."""

    provider: str
    provider_repo_id: str
    owner: str
    name: str
    full_name: str
    default_branch: str
    clone_url: str
    is_private: bool
    primary_language: str | None
    size_kb: int


@runtime_checkable
class RepoProvider(Protocol):
    """Interface every git host implementation must satisfy."""

    name: str

    def get_repo_metadata(self, owner: str, name: str) -> RepoMetadata: ...

    def get_languages(self, owner: str, name: str) -> dict[str, int]: ...

    def authenticated_clone_url(self, clone_url: str, token: str | None) -> str:
        """Return a clone URL that carries auth for private repos, if a token
        is available. Public repos work without a token."""
        ...
