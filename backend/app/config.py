from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def require_env(key: str, config: dict) -> str:
    """Return config[key] or raise EnvironmentError with a clear message."""
    value = (config.get(key) or "").strip()
    if not value:
        raise EnvironmentError(
            f"Required environment variable '{key}' is not set. "
            "Copy .env.example to .env and fill in the values."
        )
    return value


class Config:
    """App configuration loaded from environment."""

    MONGODB_URI: str = os.environ.get("MONGODB_URI", "")
    MONGODB_DB: str = os.environ.get("MONGODB_DB", "astranotes")
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if o.strip()
    ]
