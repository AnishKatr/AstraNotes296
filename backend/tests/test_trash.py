"""Tests for Phase 9 (trash): list trash, restore, permanent delete, empty trash."""

import io

import mongomock
import mongomock.gridfs
import pytest

mongomock.gridfs.enable_gridfs_integration()

from app import create_app  # noqa: E402


@pytest.fixture
def app():
    mc = mongomock.MongoClient()
    return create_app({
        "TESTING": True,
        "MONGO_CLIENT": mc,
        "MONGODB_DB": "test",
        "SKIP_INDEXES": True,
    })


@pytest.fixture
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create(client, title="Note", note_type="text"):
    resp = client.post("/api/notes", json={"title": title, "body": "body", "note_type": note_type})
    return resp.get_json()["id"]


def _delete(client, nid):
    client.delete(f"/api/notes/{nid}")


def _create_and_delete(client, title="Note"):
    nid = _create(client, title)
    _delete(client, nid)
    return nid


# ---------------------------------------------------------------------------
# GET /api/trash
# ---------------------------------------------------------------------------

class TestListTrash:
    def test_empty_when_no_deleted_notes(self, client):
        resp = client.get("/api/trash")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["notes"] == []
        assert data["total"] == 0

    def test_lists_deleted_notes(self, client):
        _create_and_delete(client, "Deleted A")
        resp = client.get("/api/trash")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 1
        assert data["notes"][0]["title"] == "Deleted A"

    def test_does_not_include_active_notes(self, client):
        _create(client, "Active")
        _create_and_delete(client, "Deleted")
        resp = client.get("/api/trash")
        data = resp.get_json()
        assert data["total"] == 1
        assert data["notes"][0]["title"] == "Deleted"

    def test_includes_deleted_at_timestamp(self, client):
        _create_and_delete(client, "Timed")
        note = client.get("/api/trash").get_json()["notes"][0]
        assert note["deleted_at"] is not None
        assert note["deleted_at"].endswith("Z")

    def test_deleted_flag_is_true_in_response(self, client):
        _create_and_delete(client)
        note = client.get("/api/trash").get_json()["notes"][0]
        assert note["deleted"] is True

    def test_multiple_trashed_notes(self, client):
        _create_and_delete(client, "A")
        _create_and_delete(client, "B")
        _create_and_delete(client, "C")
        data = client.get("/api/trash").get_json()
        assert data["total"] == 3

    def test_limit_param(self, client):
        for i in range(5):
            _create_and_delete(client, f"Note {i}")
        data = client.get("/api/trash?limit=2").get_json()
        assert len(data["notes"]) == 2
        assert data["next_cursor"] is not None


# ---------------------------------------------------------------------------
# POST /api/notes/<id>/restore
# ---------------------------------------------------------------------------

class TestRestoreNote:
    def test_restores_note_to_active(self, client):
        nid = _create_and_delete(client)
        resp = client.post(f"/api/notes/{nid}/restore")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["deleted"] is False
        assert data["deleted_at"] is None

    def test_restored_note_appears_in_active_list(self, client):
        nid = _create_and_delete(client, "Restored")
        client.post(f"/api/notes/{nid}/restore")
        resp = client.get("/api/notes")
        titles = [n["title"] for n in resp.get_json()["notes"]]
        assert "Restored" in titles

    def test_restored_note_gone_from_trash(self, client):
        nid = _create_and_delete(client)
        client.post(f"/api/notes/{nid}/restore")
        data = client.get("/api/trash").get_json()
        assert data["total"] == 0

    def test_restore_nonexistent_returns_404(self, client):
        resp = client.post("/api/notes/000000000000000000000001/restore")
        assert resp.status_code == 404

    def test_restore_active_note_returns_404(self, client):
        nid = _create(client)
        resp = client.post(f"/api/notes/{nid}/restore")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/notes/<id>/permanent
# ---------------------------------------------------------------------------

class TestPermanentDelete:
    def test_permanent_delete_returns_204(self, client):
        nid = _create_and_delete(client)
        resp = client.delete(f"/api/notes/{nid}/permanent")
        assert resp.status_code == 204

    def test_permanent_delete_removes_from_trash(self, client):
        nid = _create_and_delete(client)
        client.delete(f"/api/notes/{nid}/permanent")
        data = client.get("/api/trash").get_json()
        assert data["total"] == 0

    def test_permanent_delete_cannot_be_found_afterwards(self, client):
        nid = _create_and_delete(client)
        client.delete(f"/api/notes/{nid}/permanent")
        resp = client.get(f"/api/notes/{nid}")
        assert resp.status_code == 404

    def test_permanent_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/notes/000000000000000000000001/permanent")
        assert resp.status_code == 404

    def test_permanent_delete_active_note_returns_404(self, client):
        nid = _create(client)
        resp = client.delete(f"/api/notes/{nid}/permanent")
        assert resp.status_code == 404

    def test_permanent_delete_voice_note_removes_gridfs_audio(self, client):
        # Create and soft-delete a voice note with audio attached.
        nid = _create(client, "Voice", "voice")
        audio = io.BytesIO(b"RIFF" + b"\x00" * 40)
        client.post(
            f"/api/notes/{nid}/audio",
            data={"audio": (audio, "recording.wav")},
            content_type="multipart/form-data",
        )
        _delete(client, nid)

        resp = client.delete(f"/api/notes/{nid}/permanent")
        assert resp.status_code == 204
        # Audio endpoint should now return 404.
        audio_resp = client.get(f"/api/notes/{nid}/audio")
        assert audio_resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/trash  (empty trash)
# ---------------------------------------------------------------------------

class TestEmptyTrash:
    def test_empty_trash_returns_204(self, client):
        _create_and_delete(client)
        resp = client.delete("/api/trash")
        assert resp.status_code == 204

    def test_empty_trash_clears_all_deleted_notes(self, client):
        for i in range(3):
            _create_and_delete(client, f"N{i}")
        client.delete("/api/trash")
        data = client.get("/api/trash").get_json()
        assert data["total"] == 0

    def test_empty_trash_does_not_affect_active_notes(self, client):
        _create(client, "Active")
        _create_and_delete(client, "Trashed")
        client.delete("/api/trash")
        data = client.get("/api/notes").get_json()
        assert data["total"] == 1
        assert data["notes"][0]["title"] == "Active"

    def test_empty_trash_on_empty_trash_is_noop(self, client):
        resp = client.delete("/api/trash")
        assert resp.status_code == 204
