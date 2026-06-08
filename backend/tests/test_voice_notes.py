"""FR-04 Voice Notes: audio upload, retrieval, and validation tests."""

from __future__ import annotations

import base64
import io
import os

import mongomock
import mongomock.gridfs
import pytest

# Enable GridFS support on mongomock clients before importing the app.
mongomock.gridfs.enable_gridfs_integration()

from app import create_app  # noqa: E402

_SMALL_WEBM = b"RIFF" + b"\x00" * 64   # ~68 bytes; well under all limits
_SMALL_WAV = b"RIFF" + b"WAVEfmt " + b"\x00" * 64  # ~80 bytes; well under all limits
_LARGE_AUDIO = b"RIFF" + b"\x00" * 1200  # ~1204 bytes; over the size_app 1 KB limit


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def audio_app():
    """Standard app with GridFS enabled via mongomock."""
    mc = mongomock.MongoClient()
    return create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": mc,
            "MONGODB_DB": "test",
            "SKIP_INDEXES": True,
        }
    )


@pytest.fixture
def ac(audio_app):
    return audio_app.test_client()


@pytest.fixture
def enc_app():
    """App with encryption key for secure-note-related tests."""
    mc = mongomock.MongoClient()
    return create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": mc,
            "MONGODB_DB": "test",
            "SKIP_INDEXES": True,
            "ENCRYPTION_KEY": base64.b64encode(os.urandom(32)).decode(),
        }
    )


@pytest.fixture
def ec(enc_app):
    return enc_app.test_client()


@pytest.fixture
def size_app():
    """App with a 1 KB MAX_CONTENT_LENGTH to test the 413 handler.

    1024 bytes is large enough for JSON note-creation requests (~52 bytes) and
    the small test audio (~68 bytes + multipart overhead), but small enough to
    reject _LARGE_AUDIO (~1204 bytes + multipart overhead).
    """
    mc = mongomock.MongoClient()
    return create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": mc,
            "MONGODB_DB": "test",
            "SKIP_INDEXES": True,
            "MAX_CONTENT_LENGTH": 1024,
        }
    )


@pytest.fixture
def sc(size_app):
    return size_app.test_client()


def _create_voice_note(client):
    r = client.post("/api/notes", json={"title": "Recording", "body": "", "note_type": "voice"})
    assert r.status_code == 201
    return r.get_json()["id"]


def _upload(client, note_id, data, filename, mimetype="audio/webm"):
    return client.post(
        f"/api/notes/{note_id}/audio",
        data={"audio": (io.BytesIO(data), filename, mimetype)},
        content_type="multipart/form-data",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_create_voice_note_has_null_audio(ac):
    r = ac.post("/api/notes", json={"title": "My Voice Note", "note_type": "voice"})
    assert r.status_code == 201
    data = r.get_json()
    assert data["note_type"] == "voice"
    assert data["audio_file_id"] is None
    assert data["duration_seconds"] is None


def test_upload_webm_sets_audio_file_id(ac):
    nid = _create_voice_note(ac)
    r = _upload(ac, nid, _SMALL_WEBM, "rec.webm")
    assert r.status_code == 200
    note = r.get_json()
    assert note["audio_file_id"] is not None
    assert isinstance(note["audio_file_id"], str)


def test_upload_wav_sets_audio_file_id(ac):
    nid = _create_voice_note(ac)
    r = _upload(ac, nid, _SMALL_WAV, "rec.wav", mimetype="audio/wav")
    assert r.status_code == 200
    assert r.get_json()["audio_file_id"] is not None


def test_upload_mp3_returns_415(ac):
    nid = _create_voice_note(ac)
    r = _upload(ac, nid, b"fake mp3 data", "rec.mp3", mimetype="audio/mpeg")
    assert r.status_code == 415
    assert r.get_json()["code"] == "UNSUPPORTED_AUDIO_FORMAT"


def test_upload_png_returns_415(ac):
    nid = _create_voice_note(ac)
    r = _upload(ac, nid, b"\x89PNG\r\n", "photo.png", mimetype="image/png")
    assert r.status_code == 415
    assert r.get_json()["code"] == "UNSUPPORTED_AUDIO_FORMAT"


def test_upload_no_extension_returns_415(ac):
    nid = _create_voice_note(ac)
    r = _upload(ac, nid, _SMALL_WEBM, "recording", mimetype="audio/webm")
    assert r.status_code == 415
    assert r.get_json()["code"] == "UNSUPPORTED_AUDIO_FORMAT"


def test_upload_too_large_returns_413(sc):
    # size_app limits to 1024 bytes; _LARGE_AUDIO + multipart overhead exceeds that
    nid = _create_voice_note(sc)
    r = _upload(sc, nid, _LARGE_AUDIO, "rec.webm")
    assert r.status_code == 413
    assert r.get_json()["code"] == "AUDIO_TOO_LARGE"


def test_upload_to_text_note_returns_400(ac):
    r = ac.post("/api/notes", json={"title": "Text Note", "note_type": "text"})
    nid = r.get_json()["id"]
    r = _upload(ac, nid, _SMALL_WEBM, "rec.webm")
    assert r.status_code == 400
    assert r.get_json()["code"] == "WRONG_NOTE_TYPE"


def test_upload_to_secure_note_returns_400(ec):
    r = ec.post("/api/notes", json={"title": "Secret", "note_type": "secure", "body": "hidden"})
    nid = r.get_json()["id"]
    r = _upload(ec, nid, _SMALL_WEBM, "rec.webm")
    assert r.status_code == 400
    assert r.get_json()["code"] == "WRONG_NOTE_TYPE"


def test_get_audio_streams_exact_bytes(ac):
    nid = _create_voice_note(ac)
    _upload(ac, nid, _SMALL_WEBM, "rec.webm")
    r = ac.get(f"/api/notes/{nid}/audio")
    assert r.status_code == 200
    assert r.data == _SMALL_WEBM


def test_get_audio_content_type_webm(ac):
    nid = _create_voice_note(ac)
    _upload(ac, nid, _SMALL_WEBM, "rec.webm")
    r = ac.get(f"/api/notes/{nid}/audio")
    assert "audio/webm" in r.content_type


def test_get_audio_content_type_wav(ac):
    nid = _create_voice_note(ac)
    _upload(ac, nid, _SMALL_WAV, "rec.wav", mimetype="audio/wav")
    r = ac.get(f"/api/notes/{nid}/audio")
    assert "audio/wav" in r.content_type


def test_get_audio_no_audio_returns_404(ac):
    nid = _create_voice_note(ac)
    r = ac.get(f"/api/notes/{nid}/audio")
    assert r.status_code == 404


def test_get_audio_unknown_note_returns_404(ac):
    from bson import ObjectId
    fake_id = str(ObjectId())
    r = ac.get(f"/api/notes/{fake_id}/audio")
    assert r.status_code == 404


def test_soft_deleted_voice_note_audio_returns_404(ac):
    nid = _create_voice_note(ac)
    _upload(ac, nid, _SMALL_WEBM, "rec.webm")
    ac.delete(f"/api/notes/{nid}")
    r = ac.get(f"/api/notes/{nid}/audio")
    assert r.status_code == 404


def test_upload_returns_updated_note_with_all_fields(ac):
    nid = _create_voice_note(ac)
    r = _upload(ac, nid, _SMALL_WEBM, "rec.webm")
    note = r.get_json()
    for field in ("id", "title", "note_type", "audio_file_id", "duration_seconds", "created_at", "updated_at"):
        assert field in note


def test_note_list_includes_audio_file_id_field(ac):
    _create_voice_note(ac)
    r = ac.get("/api/notes")
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert "audio_file_id" in notes[0]
    assert notes[0]["audio_file_id"] is None
