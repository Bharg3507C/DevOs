"""Application configuration, loaded from environment variables.

Secrets are read only from the environment and never hardcoded. See
``.env.example`` at the repository root for the full list of keys.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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

    # --- GitHub OAuth ---
    github_client_id: str = Field(default="", alias="GITHUB_CLIENT_ID")
    github_client_secret: str = Field(default="", alias="GITHUB_CLIENT_SECRET")
    github_oauth_callback_url: str = Field(
        default="http://localhost:8000/api/auth/github/callback",
        alias="GITHUB_OAUTH_CALLBACK_URL",
    )

    # --- Analysis sandbox / limits ---
    workdir: str = Field(default="/tmp/devos-work", alias="DEVOS_WORKDIR")
    max_file_bytes: int = Field(default=2_000_000, alias="DEVOS_MAX_FILE_BYTES")
    max_files: int = Field(default=50_000, alias="DEVOS_MAX_FILES")
    clone_timeout_seconds: int = Field(default=300, alias="DEVOS_CLONE_TIMEOUT_SECONDS")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def github_oauth_configured(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
