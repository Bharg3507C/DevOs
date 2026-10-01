"""Application configuration, loaded from environment variables.

Secrets are read only from the environment and never hardcoded. See
``.env.example`` at the repository root for the full list of keys.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Look for .env in the backend working dir and the repository root, so the
    # same file works whether the app is started from ./backend or the root.
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), extra="ignore"
    )

    # --- Application ---
    app_name: str = "DevOS"
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # --- Database ---
    database_url: str = Field(
        default="postgresql+psycopg://devos:devos@localhost:5432/devos",
        alias="DATABASE_URL",
    )

    # --- Redis ---
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # --- Security / session ---
    session_secret: str = Field(default="dev-insecure-secret", alias="SESSION_SECRET")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")

    # --- Frontend base (where OAuth flows return the user) ---
    frontend_base_url: str = Field(
        default="http://localhost:5173", alias="FRONTEND_BASE_URL"
    )

    # --- GitHub OAuth ---
    github_client_id: str = Field(default="", alias="GITHUB_CLIENT_ID")
    github_client_secret: str = Field(default="", alias="GITHUB_CLIENT_SECRET")
    github_oauth_callback_url: str = Field(
        default="http://localhost:8000/api/auth/github/callback",
        alias="GITHUB_OAUTH_CALLBACK_URL",
    )

    # --- GitLab OAuth ---
    gitlab_base_url: str = Field(default="https://gitlab.com", alias="GITLAB_BASE_URL")
    gitlab_client_id: str = Field(default="", alias="GITLAB_CLIENT_ID")
    gitlab_client_secret: str = Field(default="", alias="GITLAB_CLIENT_SECRET")
    gitlab_oauth_callback_url: str = Field(
        default="http://localhost:8000/api/auth/gitlab/callback",
        alias="GITLAB_OAUTH_CALLBACK_URL",
    )

    # --- Dev convenience ---
    # When true (default in development, and only when no OAuth is configured), an
    # unauthenticated request is served a local user so the pipeline can be
    # exercised. Set DEVOS_DISABLE_DEV_LOGIN=true to force real sign-in.
    disable_dev_login: bool = Field(default=False, alias="DEVOS_DISABLE_DEV_LOGIN")

    # --- Analysis sandbox / limits ---
    workdir: str = Field(default="", alias="DEVOS_WORKDIR")
    max_file_bytes: int = Field(default=2_000_000, alias="DEVOS_MAX_FILE_BYTES")
    max_files: int = Field(default=50_000, alias="DEVOS_MAX_FILES")
    clone_timeout_seconds: int = Field(default=300, alias="DEVOS_CLONE_TIMEOUT_SECONDS")

    @property
    def resolved_workdir(self) -> str:
        """Return the workdir as an absolute path, using the system temp dir as
        base if the configured value is relative or empty."""
        import os, tempfile
        raw = self.workdir.strip()
        if not raw:
            return os.path.join(tempfile.gettempdir(), "devos-work")
        p = os.path.abspath(raw)
        return p

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def github_oauth_configured(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)

    @property
    def gitlab_oauth_configured(self) -> bool:
        return bool(self.gitlab_client_id and self.gitlab_client_secret)

    @property
    def any_oauth_configured(self) -> bool:
        return self.github_oauth_configured or self.gitlab_oauth_configured

    @property
    def dev_login_active(self) -> bool:
        """Whether the local-dev user fallback is in effect."""
        return (
            self.environment == "development"
            and not self.any_oauth_configured
            and not self.disable_dev_login
        )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
