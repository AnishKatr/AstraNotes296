from __future__ import annotations

import base64
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


def load_encryption_key(config: dict) -> bytes:
    """Decode and validate ENCRYPTION_KEY from config.

    Raises MissingEncryptionKeyError if the value is absent, not valid
    base64, or does not decode to exactly 32 bytes.
    """
    from app.services.encryption_service import MissingEncryptionKeyError

    raw = (config.get("ENCRYPTION_KEY") or "").strip()
    if not raw:
        raise MissingEncryptionKeyError(
            "ENCRYPTION_KEY is not set. Generate one with:\n"
            "  python -c \"import secrets, base64; "
            "print(base64.b64encode(secrets.token_bytes(32)).decode())\"\n"
            "Then add it to your .env file."
        )
    try:
        key_bytes = base64.b64decode(raw)
    except Exception as exc:
        raise MissingEncryptionKeyError(
            "ENCRYPTION_KEY is not valid base64."
        ) from exc
    if len(key_bytes) != 32:
        raise MissingEncryptionKeyError(
            f"ENCRYPTION_KEY must decode to 32 bytes for AES-256, got {len(key_bytes)}."
        )
    return key_bytes


class Config:
    """App configuration loaded from environment."""

    MONGODB_URI: str = os.environ.get("MONGODB_URI", "")
    MONGODB_DB: str = os.environ.get("MONGODB_DB", "astranotes")
    ENCRYPTION_KEY: str = os.environ.get("ENCRYPTION_KEY", "")
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if o.strip()
    ]
