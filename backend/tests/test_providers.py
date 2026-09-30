"""Tests for the provider abstraction (GitHub + GitLab)."""

from __future__ import annotations

import pytest

from app.services.providers import (
    GitHubProvider,
    GitLabProvider,
    ProviderError,
    get_provider,
)


def test_get_provider_returns_correct_type():
    assert isinstance(get_provider("github"), GitHubProvider)
    assert isinstance(get_provider("gitlab"), GitLabProvider)
    # Default falls back to github.
    assert isinstance(get_provider(""), GitHubProvider)


def test_get_provider_rejects_unknown():
    with pytest.raises(ProviderError):
        get_provider("bitbucket")


def test_github_authenticated_clone_url_injects_token():
    provider = GitHubProvider()
    url = provider.authenticated_clone_url(
        "https://github.com/octocat/hello.git", "ghp_secret"
    )
    assert "x-access-token:ghp_secret@github.com" in url
    # Without a token the URL is unchanged.
    assert (
        provider.authenticated_clone_url("https://github.com/octocat/hello.git", None)
        == "https://github.com/octocat/hello.git"
    )


def test_gitlab_authenticated_clone_url_injects_token():
    provider = GitLabProvider()
    url = provider.authenticated_clone_url(
        "https://gitlab.com/group/project.git", "glpat_secret"
    )
    assert "oauth2:glpat_secret@gitlab.com" in url


def test_provider_names():
    assert GitHubProvider().name == "github"
    assert GitLabProvider().name == "gitlab"
