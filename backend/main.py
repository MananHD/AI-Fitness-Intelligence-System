"""
main.py – FastAPI application entry point.

Starts the FastAPI app, registers routes, configures CORS,
and initialises the database on startup.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import router
from database.db_manager import DatabaseManager
from utils.helpers import load_config, get_logger

logger = get_logger(__name__)


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB schema.  Shutdown: nothing to tear down."""
    logger.info("🚀  Starting AI Fitness Intelligence API …")
    db = DatabaseManager()
    db.init_db()
    logger.info("✅  Database ready.")
    yield
    logger.info("🛑  Shutting down.")


# ─── App Factory ──────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    cfg = load_config()
    app_cfg = cfg.get("app", {})

    app = FastAPI(
        title=app_cfg.get("name", "AI Fitness Intelligence"),
        version=app_cfg.get("version", "1.0.0"),
        description=(
            "Computer Vision–powered fitness system: "
            "pose analysis, exercise tracking, sport & diet recommendations."
        ),
        lifespan=lifespan,
    )

    # CORS – allow Streamlit frontend and any local dev origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    return app


app = create_app()


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cfg = load_config().get("backend", {})
    uvicorn.run(
        "backend.main:app",
        host=cfg.get("host", "127.0.0.1"),
        port=cfg.get("port", 8000),
        reload=True,
        log_level="info",
    )
