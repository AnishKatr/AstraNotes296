from __future__ import annotations

import gridfs

from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.exceptions import RequestEntityTooLarge

from app.config import Config, load_encryption_key, require_env
from app.routes.health import health_bp
from app.routes.notes import notes_bp, tags_bp, trash_bp
from app.services.encryption_service import EncryptionService, MissingEncryptionKeyError


def _ensure_indexes(db) -> None:
    notes = db.notes
    notes.create_index([("title", 1)])
    notes.create_index([("note_type", 1)])
    notes.create_index([("updated_at", -1)])
    notes.create_index([("deleted", 1)])
    notes.create_index([("tags", 1)])
    notes.create_index([("deleted_at", -1)])
    # FR-06: weighted text search index. Title matches outrank body matches (10 vs 1).
    # Secure note bodies are ciphertext and will never match; this is intentional.
    # Drop the pre-Phase-4 unweighted index if it still exists before recreating.
    existing = {idx["name"] for idx in notes.list_indexes()}
    if "title_text_body_text" in existing:
        notes.drop_index("title_text_body_text")
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
    app.extensions["gridfs_bucket"] = gridfs.GridFS(db, collection="audio_files")

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

    if not app.config.get("SKIP_INDEXES"):
        _ensure_indexes(db)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}},
        supports_credentials=True,
    )

    @app.errorhandler(RequestEntityTooLarge)
    def handle_too_large(_e):
        return jsonify({"error": "audio file exceeds 10 MB limit", "code": "AUDIO_TOO_LARGE"}), 413

    app.register_blueprint(health_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(tags_bp)
    app.register_blueprint(trash_bp)

    return app
