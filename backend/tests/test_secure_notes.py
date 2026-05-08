"""Integration tests for secure note encryption/decryption (FR-03, SPR-01)."""

import base64
import os

import mongomock
import pytest
from bson import ObjectId

from app import create_app

_VALID_KEY = base64.b64encode(os.urandom(32)).decode()


@pytest.fixture
def mongo_client():
    return mongomock.MongoClient()


@pytest.fixture
def secure_app(mongo_client):
    app = create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": mongo_client,
            "MONGODB_DB": "test",
            "SKIP_INDEXES": True,
            "ENCRYPTION_KEY": _VALID_KEY,
        }
    )
    return app


@pytest.fixture
def secure_client(secure_app):
    return secure_app.test_client()


# --- encryption correctness ---

def test_secure_note_body_stored_as_ciphertext(secure_app, secure_client):
    """Body in MongoDB must be ciphertext, never the original plaintext."""
    plaintext = "my most secret thought"
    r = secure_client.post(
        "/api/notes",
        json={"title": "Secret", "body": plaintext, "note_type": "secure"},
    )
    assert r.status_code == 201
    note_id = r.get_json()["id"]

    doc = secure_app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(note_id)})
    assert doc["is_encrypted"] is True
    assert doc["body"] != plaintext
    assert plaintext not in doc["body"]


def test_secure_note_get_returns_plaintext(secure_client):
    """GET /api/notes/<id> must return decrypted plaintext."""
    plaintext = "my most secret thought"
    r = secure_client.post(
        "/api/notes",
        json={"title": "Secret", "body": plaintext, "note_type": "secure"},
    )
    note_id = r.get_json()["id"]

    r = secure_client.get(f"/api/notes/{note_id}")
    assert r.status_code == 200
    assert r.get_json()["body"] == plaintext


def test_secure_note_update_re_encrypts(secure_app, secure_client):
    """PATCH body of a secure note must store new ciphertext, not plaintext."""
    r = secure_client.post(
        "/api/notes",
        json={"title": "Secret", "body": "original", "note_type": "secure"},
    )
    note_id = r.get_json()["id"]

    r = secure_client.patch(f"/api/notes/{note_id}", json={"body": "updated secret"})
    assert r.status_code == 200
    assert r.get_json()["body"] == "updated secret"

    doc = secure_app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(note_id)})
    assert doc["is_encrypted"] is True
    assert "updated secret" not in doc["body"]


def test_secure_note_list_returns_null_body(secure_client):
    """List endpoint returns null body for encrypted notes (avoid bulk decrypt)."""
    secure_client.post(
        "/api/notes",
        json={"title": "Secret", "body": "hidden", "note_type": "secure"},
    )
    r = secure_client.get("/api/notes")
    note = r.get_json()["notes"][0]
    assert note["is_encrypted"] is True
    assert note["body"] is None


def test_secure_note_response_has_is_encrypted_true(secure_client):
    """API response for a secure note must include is_encrypted: true."""
    r = secure_client.post(
        "/api/notes",
        json={"title": "S", "body": "x", "note_type": "secure"},
    )
    assert r.get_json()["is_encrypted"] is True


# --- decryption failure (FR-03) ---

def test_tampered_ciphertext_returns_403(secure_app, secure_client):
    """Tampered ciphertext in DB must produce 403, never garbled content."""
    r = secure_client.post(
        "/api/notes",
        json={"title": "Secret", "body": "sensitive", "note_type": "secure"},
    )
    note_id = r.get_json()["id"]

    garbage = base64.b64encode(b"A" * 40).decode()
    secure_app.extensions["mongo_db"].notes.update_one(
        {"_id": ObjectId(note_id)},
        {"$set": {"body": garbage}},
    )

    r = secure_client.get(f"/api/notes/{note_id}")
    assert r.status_code == 403
    data = r.get_json()
    assert data["code"] == "DECRYPTION_FAILED"


# --- regression: other note types unaffected ---

def test_text_note_unaffected_by_encryption_service(secure_client):
    """Text notes must round-trip normally when encryption service is active."""
    r = secure_client.post(
        "/api/notes",
        json={"title": "Plain", "body": "hello world", "note_type": "text"},
    )
    assert r.status_code == 201
    note_id = r.get_json()["id"]

    r = secure_client.get(f"/api/notes/{note_id}")
    assert r.status_code == 200
    assert r.get_json()["body"] == "hello world"


def test_text_note_body_not_encrypted_in_db(secure_app, secure_client):
    """Text note body must be stored as plaintext with is_encrypted: false."""
    r = secure_client.post(
        "/api/notes",
        json={"title": "Plain", "body": "hello world", "note_type": "text"},
    )
    note_id = r.get_json()["id"]

    doc = secure_app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(note_id)})
    assert doc.get("is_encrypted", False) is False
    assert doc["body"] == "hello world"


def test_text_note_delete_still_works(secure_client):
    """Soft-delete of a text note must still return 204."""
    r = secure_client.post(
        "/api/notes",
        json={"title": "Gone", "body": "bye", "note_type": "text"},
    )
    note_id = r.get_json()["id"]
    assert secure_client.delete(f"/api/notes/{note_id}").status_code == 204
    assert secure_client.get(f"/api/notes/{note_id}").status_code == 404
