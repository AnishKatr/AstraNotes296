from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient

from app.config import Config
from app.routes.health import health_bp
from app.routes.notes import notes_bp


def _ensure_indexes(db) -> None:
    notes = db.notes
    notes.create_index([("title", 1)])
    notes.create_index([("note_type", 1)])
    notes.create_index([("updated_at", -1)])
    # Prepared for FR-06 text search:
    try:
        notes.create_index([("title", "text"), ("body", "text")])
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
        client = MongoClient(app.config["MONGODB_URI"])
    db = client[app.config["MONGODB_DB"]]
    app.extensions["mongo_db"] = db

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
