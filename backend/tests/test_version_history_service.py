"""Phase 5: version history tests (US-04, FR-05)."""

import base64
import os

import mongomock
import pytest
from bson import ObjectId

from app import create_app

_VALID_KEY = base64.b64encode(os.urandom(32)).decode()


# ---------------------------------------------------------------------------
# Fixtures (encryption always enabled so secure note tests work without
# a separate fixture; text note tests are unaffected by having an enc key)
# ---------------------------------------------------------------------------

@pytest.fixture
def mongo_client():
    return mongomock.MongoClient()


@pytest.fixture
def app(mongo_client):
    return create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": mongo_client,
            "MONGODB_DB": "test",
            "SKIP_INDEXES": True,
            "ENCRYPTION_KEY": _VALID_KEY,
        }
    )


@pytest.fixture
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Snapshot creation on update
# ---------------------------------------------------------------------------

def test_update_body_creates_snapshot_of_previous_body(app, client):
    r = client.post("/api/notes", json={"title": "T", "body": "original", "note_type": "text"})
    nid = r.get_json()["id"]

    client.patch(f"/api/notes/{nid}", json={"body": "updated"})

    doc = app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(nid)})
    snapshots = doc.get("snapshots", [])
    assert len(snapshots) == 1
    assert snapshots[0]["body"] == "original"


def test_update_title_only_does_not_create_snapshot(app, client):
    r = client.post("/api/notes", json={"title": "T", "body": "original", "note_type": "text"})
    nid = r.get_json()["id"]

    client.patch(f"/api/notes/{nid}", json={"title": "New title"})

    doc = app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(nid)})
    assert doc.get("snapshots", []) == []


def test_multiple_body_updates_accumulate_snapshots(app, client):
    r = client.post("/api/notes", json={"title": "T", "body": "v0", "note_type": "text"})
    nid = r.get_json()["id"]

    client.patch(f"/api/notes/{nid}", json={"body": "v1"})
    client.patch(f"/api/notes/{nid}", json={"body": "v2"})

    doc = app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(nid)})
    bodies = [s["body"] for s in doc.get("snapshots", [])]
    assert "v0" in bodies
    assert "v1" in bodies


# ---------------------------------------------------------------------------
# Snapshot cap (FR-05: 50-snapshot limit)
# ---------------------------------------------------------------------------

def test_snapshot_cap_prunes_oldest_on_51st_update(app, client):
    r = client.post("/api/notes", json={"title": "T", "body": "v0", "note_type": "text"})
    nid = r.get_json()["id"]

    for i in range(1, 52):  # 51 updates create 51 snapshot attempts
        client.patch(f"/api/notes/{nid}", json={"body": f"v{i}"})

    doc = app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(nid)})
    snapshots = doc.get("snapshots", [])
    assert len(snapshots) == 50
    bodies = [s["body"] for s in snapshots]
    assert "v0" not in bodies   # oldest pruned
    assert "v1" in bodies       # second-oldest still present


# ---------------------------------------------------------------------------
# Secure note: snapshots store ciphertext (FR-03 + FR-05 interaction)
# ---------------------------------------------------------------------------

def test_secure_note_snapshot_stores_ciphertext_not_plaintext(app, client):
    plaintext = "top secret content"
    r = client.post(
        "/api/notes",
        json={"title": "S", "body": plaintext, "note_type": "secure"},
    )
    nid = r.get_json()["id"]

    client.patch(f"/api/notes/{nid}", json={"body": "new secret"})

    doc = app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(nid)})
    snapshots = doc.get("snapshots", [])
    assert len(snapshots) == 1
    # Snapshot body must be ciphertext, not the original plaintext
    assert snapshots[0]["body"] != plaintext
    assert plaintext not in snapshots[0]["body"]


# ---------------------------------------------------------------------------
# GET /api/notes/<id>/versions
# ---------------------------------------------------------------------------

def test_list_versions_returns_snapshot_ids_and_timestamps(client):
    r = client.post("/api/notes", json={"title": "T", "body": "v0", "note_type": "text"})
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "v1"})

    r = client.get(f"/api/notes/{nid}/versions")
    assert r.status_code == 200
    versions = r.get_json()
    assert len(versions) == 1
    assert "snapshot_id" in versions[0]
    assert "timestamp" in versions[0]
    assert "body_preview" in versions[0]


def test_list_versions_sorted_newest_first(client):
    r = client.post("/api/notes", json={"title": "T", "body": "v0", "note_type": "text"})
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "v1"})
    client.patch(f"/api/notes/{nid}", json={"body": "v2"})

    r = client.get(f"/api/notes/{nid}/versions")
    versions = r.get_json()
    assert len(versions) == 2
    # Most recently snapshotted (v1) appears first
    assert versions[0]["body_preview"] == "v1"
    assert versions[1]["body_preview"] == "v0"


def test_list_versions_empty_when_no_updates(client):
    r = client.post("/api/notes", json={"title": "T", "body": "x", "note_type": "text"})
    nid = r.get_json()["id"]

    r = client.get(f"/api/notes/{nid}/versions")
    assert r.status_code == 200
    assert r.get_json() == []


def test_list_versions_returns_404_for_unknown_note(client):
    fake_id = str(ObjectId())
    r = client.get(f"/api/notes/{fake_id}/versions")
    assert r.status_code == 404


def test_list_versions_decrypts_secure_note_preview(client):
    plaintext = "top secret content"
    r = client.post(
        "/api/notes",
        json={"title": "S", "body": plaintext, "note_type": "secure"},
    )
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "new secret"})

    r = client.get(f"/api/notes/{nid}/versions")
    assert r.status_code == 200
    versions = r.get_json()
    assert len(versions) == 1
    # Preview must be human-readable plaintext, not ciphertext
    assert versions[0]["body_preview"] == plaintext


def test_list_versions_tampered_snapshot_returns_could_not_decrypt(app, client):
    r = client.post(
        "/api/notes",
        json={"title": "S", "body": "secret", "note_type": "secure"},
    )
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "new secret"})

    # Overwrite the snapshot body with garbage ciphertext
    garbage = base64.b64encode(b"A" * 40).decode()
    app.extensions["mongo_db"].notes.update_one(
        {"_id": ObjectId(nid)},
        {"$set": {"snapshots.0.body": garbage}},
    )

    r = client.get(f"/api/notes/{nid}/versions")
    assert r.status_code == 200
    versions = r.get_json()
    assert versions[0]["body_preview"] == "[Could not decrypt]"


def test_list_versions_body_preview_capped_at_100_chars(client):
    long_body = "x" * 200
    r = client.post("/api/notes", json={"title": "T", "body": long_body, "note_type": "text"})
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "short"})

    r = client.get(f"/api/notes/{nid}/versions")
    assert len(r.get_json()[0]["body_preview"]) == 100


def test_list_versions_of_soft_deleted_note_is_allowed(client):
    """Soft-deleted notes still expose version history (FR-05)."""
    r = client.post("/api/notes", json={"title": "T", "body": "v0", "note_type": "text"})
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "v1"})
    client.delete(f"/api/notes/{nid}")

    r = client.get(f"/api/notes/{nid}/versions")
    assert r.status_code == 200
    assert len(r.get_json()) == 1


# ---------------------------------------------------------------------------
# POST /api/notes/<id>/restore/<snapshot_id>
# ---------------------------------------------------------------------------

def test_restore_copies_snapshot_body_to_note(client):
    r = client.post("/api/notes", json={"title": "T", "body": "original", "note_type": "text"})
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "updated"})

    snapshot_id = client.get(f"/api/notes/{nid}/versions").get_json()[0]["snapshot_id"]

    r = client.post(f"/api/notes/{nid}/restore/{snapshot_id}")
    assert r.status_code == 200
    assert r.get_json()["body"] == "original"


def test_restore_creates_snapshot_of_pre_restore_state(app, client):
    """After restore, the body that was overwritten appears as the newest snapshot."""
    r = client.post("/api/notes", json={"title": "T", "body": "original", "note_type": "text"})
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "updated"})

    snapshot_id = client.get(f"/api/notes/{nid}/versions").get_json()[0]["snapshot_id"]
    client.post(f"/api/notes/{nid}/restore/{snapshot_id}")

    doc = app.extensions["mongo_db"].notes.find_one({"_id": ObjectId(nid)})
    bodies = [s["body"] for s in doc.get("snapshots", [])]
    # "updated" (the body before restore) must appear as a snapshot so restore is reversible
    assert "updated" in bodies


def test_restore_secure_note_returns_decrypted_body(client):
    plaintext_v1 = "original secret"
    r = client.post(
        "/api/notes",
        json={"title": "S", "body": plaintext_v1, "note_type": "secure"},
    )
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "updated secret"})

    snapshot_id = client.get(f"/api/notes/{nid}/versions").get_json()[0]["snapshot_id"]

    r = client.post(f"/api/notes/{nid}/restore/{snapshot_id}")
    assert r.status_code == 200
    assert r.get_json()["body"] == plaintext_v1


def test_restore_returns_404_for_unknown_snapshot(client):
    r = client.post("/api/notes", json={"title": "T", "body": "x", "note_type": "text"})
    nid = r.get_json()["id"]

    r = client.post(f"/api/notes/{nid}/restore/nonexistent-snapshot-id")
    assert r.status_code == 404


def test_restore_returns_404_for_soft_deleted_note(client):
    """Restoring into a soft-deleted note is not allowed (consistent with GET behaviour)."""
    r = client.post("/api/notes", json={"title": "T", "body": "original", "note_type": "text"})
    nid = r.get_json()["id"]
    client.patch(f"/api/notes/{nid}", json={"body": "updated"})

    snapshot_id = client.get(f"/api/notes/{nid}/versions").get_json()[0]["snapshot_id"]
    client.delete(f"/api/notes/{nid}")

    r = client.post(f"/api/notes/{nid}/restore/{snapshot_id}")
    assert r.status_code == 404
