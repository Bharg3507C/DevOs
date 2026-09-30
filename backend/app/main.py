"""DevOS FastAPI application entrypoint.

Wires configuration, structured logging, CORS, server-side sessions, request
latency logging, and the Phase 1 routers.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api import auth, diagnostics, jobs, repositories
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.base import init_db

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger("devos.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all is idempotent; production uses migrations.
    init_db()
    logger.info("DevOS API started", extra={"extra": {"env": settings.environment}})
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="DevOS API",
        version="0.1.0",
        description="Developer intelligence platform — understand your codebase before you change it.",
        lifespan=lifespan,
    )

    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        https_only=settings.environment != "development",
        same_site="lax",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_latency(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "request",
            extra={
                "extra": {
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "latency_ms": round(elapsed_ms, 2),
                }
            },
        )
        return response

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(repositories.router)
    app.include_router(jobs.router)
    app.include_router(diagnostics.router)
    return app


app = create_app()
