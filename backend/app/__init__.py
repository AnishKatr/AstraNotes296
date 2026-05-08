from __future__ import annotations

from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient

from app.config import Config, load_encryption_key, require_env
from app.routes.health import health_bp
from app.routes.notes import notes_bp
from app.services.encryption_service import EncryptionService, MissingEncryptionKeyError


def _ensure_indexes(db) -> None:
    notes = db.notes
    notes.create_index([("title", 1)])
    notes.create_index([("note_type", 1)])
    notes.create_index([("updated_at", -1)])
    notes.create_index([("deleted", 1)])
    # FR-06: text search index. Title matches outrank body matches (weight 10 vs 1).
    # Secure note bodies are ciphertext and will never match; this is intentional.
    try:
        notes.create_index(
            [("title", "text"), ("body", "text")],
            weights={"title": 10, "body": 1},
            name="notes_text_search",
        )
    except Exception:
        pass


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    if app.config.get("MONGO_CLIENT"):
        client = app.config["MONGO_CLIENT"]
    else:
        uri = require_env("MONGODB_URI", app.config)
        client = MongoClient(uri)
    db = client[app.config["MONGODB_DB"]]
    app.extensions["mongo_db"] = db

    enc_key_raw = (app.config.get("ENCRYPTION_KEY") or "").strip()
    if enc_key_raw:
        key_bytes = load_encryption_key(app.config)
        app.extensions["encryption_service"] = EncryptionService(key_bytes)
    elif not app.testing:
        raise MissingEncryptionKeyError(
            "ENCRYPTION_KEY is not set. "
            "Generate one with: python -c \"import secrets, base64; "
            "print(base64.b64encode(secrets.token_bytes(32)).decode())\""
        )

    if app.testing or app.config.get("SKIP_INDEXES"):
        pass
    else:
        _ensure_indexes(db)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}},
        supports_credentials=True,
    )

    app.register_blueprint(health_bp)
    app.register_blueprint(notes_bp)

    return app
