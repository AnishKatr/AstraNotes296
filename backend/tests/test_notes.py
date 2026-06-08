"""Route and service tests for notes: CRUD (Phase 1) and search/filter (Phase 4)."""

import base64
import os
import uuid

import mongomock
import pymongo
import pytest

from app import create_app

_VALID_KEY = base64.b64encode(os.urandom(32)).decode()
_MONGO_URI = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# Basic fixtures without encryption or text search (from conftest.py):
#   app  → Flask app, no enc key, SKIP_INDEXES
#   client → Flask test client


@pytest.fixture
def search_app():
    """Mongomock app with encryption key for tests that need secure notes but NOT $text."""
    mc = mongomock.MongoClient()
    return create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": mc,
            "MONGODB_DB": "test",
            "SKIP_INDEXES": True,
            "ENCRYPTION_KEY": _VALID_KEY,
        }
    )


@pytest.fixture
def sc(search_app):
    return search_app.test_client()


@pytest.fixture(scope="module")
def real_mongo_client():
    """Real MongoDB client shared across the module's text-search tests.

    Skips the entire module if MongoDB is unreachable so CI without a running
    MongoDB still passes the mongomock-based tests.
    """
    try:
        client = pymongo.MongoClient(_MONGO_URI, serverSelectionTimeoutMS=2000)
        client.server_info()
    except Exception:
        pytest.skip("Real MongoDB not reachable; skipping $text search tests", allow_module_level=True)
        return None
    yield client
    client.close()


@pytest.fixture
def real_search_app(real_mongo_client):
    """Real MongoDB app with text index and encryption for $text search tests."""
    db_name = f"astranotes_test_{uuid.uuid4().hex[:8]}"
    app = create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": real_mongo_client,
            "MONGODB_DB": db_name,
            # SKIP_INDEXES intentionally absent so _ensure_indexes() creates the text index.
            "ENCRYPTION_KEY": _VALID_KEY,
        }
    )
    yield app
    real_mongo_client.drop_database(db_name)


@pytest.fixture
def rsc(real_search_app):
    """Test client backed by a real MongoDB database with the text index active."""
    return real_search_app.test_client()


# ---------------------------------------------------------------------------
# Phase 1 regression: basic CRUD round-trip
# ---------------------------------------------------------------------------

def test_create_list_patch_delete_roundtrip(client):
    r = client.post(
        "/api/notes",
        json={"title": "Hello", "body": "World", "note_type": "text"},
    )
    assert r.status_code == 201
    note = r.get_json()
    assert note["title"] == "Hello"
    nid = note["id"]

    r = client.get("/api/notes")
    assert r.status_code == 200
    data = r.get_json()
    assert data["total"] == 1
    assert len(data["notes"]) == 1

    r = client.patch(f"/api/notes/{nid}", json={"body": "Updated"})
    assert r.status_code == 200
    assert r.get_json()["body"] == "Updated"

    r = client.delete(f"/api/notes/{nid}")
    assert r.status_code == 204

    r = client.get(f"/api/notes/{nid}")
    assert r.status_code == 404


def test_create_empty_title_400(client):
    r = client.post("/api/notes", json={"title": "  ", "body": "x"})
    assert r.status_code == 400


def test_create_unknown_type_400(client):
    r = client.post(
        "/api/notes",
        json={"title": "T", "body": "x", "note_type": "hologram"},
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Phase 4: type filter validation (FR-06)
# ---------------------------------------------------------------------------

def test_invalid_type_filter_returns_400(client):
    r = client.get("/api/notes?type=xyz")
    assert r.status_code == 400
    data = r.get_json()
    assert data["code"] == "INVALID_TYPE"


def test_invalid_type_filter_empty_collection_still_400(client):
    r = client.get("/api/notes?type=hologram")
    assert r.status_code == 400
    assert r.get_json()["code"] == "INVALID_TYPE"


def test_filter_by_type_text(client):
    client.post("/api/notes", json={"title": "A", "body": "alpha", "note_type": "text"})
    client.post("/api/notes", json={"title": "B", "body": "beta", "note_type": "voice"})

    r = client.get("/api/notes?type=text")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["note_type"] == "text"


def test_filter_by_type_voice(client):
    client.post("/api/notes", json={"title": "A", "body": "alpha", "note_type": "text"})
    client.post("/api/notes", json={"title": "B", "body": "beta", "note_type": "voice"})

    r = client.get("/api/notes?type=voice")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["note_type"] == "voice"


def test_filter_by_type_secure(sc):
    sc.post("/api/notes", json={"title": "Open", "body": "plain", "note_type": "text"})
    sc.post("/api/notes", json={"title": "Locked", "body": "secret", "note_type": "secure"})

    r = sc.get("/api/notes?type=secure")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["note_type"] == "secure"


# ---------------------------------------------------------------------------
# Phase 4: soft-delete exclusion
# ---------------------------------------------------------------------------

def test_soft_deleted_notes_excluded_from_list(client):
    r = client.post("/api/notes", json={"title": "Gone", "body": "bye", "note_type": "text"})
    nid = r.get_json()["id"]
    client.delete(f"/api/notes/{nid}")

    r = client.get("/api/notes")
    assert r.get_json()["total"] == 0
    assert r.get_json()["notes"] == []


def test_soft_deleted_excluded_from_type_filter(client):
    r = client.post("/api/notes", json={"title": "Gone", "body": "bye", "note_type": "text"})
    nid = r.get_json()["id"]
    client.delete(f"/api/notes/{nid}")

    r = client.get("/api/notes?type=text")
    assert r.status_code == 200
    assert r.get_json()["notes"] == []


# ---------------------------------------------------------------------------
# Phase 4: empty / missing q returns all notes
# ---------------------------------------------------------------------------

def test_empty_q_returns_all_notes(client):
    client.post("/api/notes", json={"title": "First", "body": "one", "note_type": "text"})
    client.post("/api/notes", json={"title": "Second", "body": "two", "note_type": "voice"})

    r = client.get("/api/notes?q=")
    assert r.status_code == 200
    assert r.get_json()["total"] == 2


def test_missing_q_returns_all_notes(client):
    client.post("/api/notes", json={"title": "First", "body": "one", "note_type": "text"})
    client.post("/api/notes", json={"title": "Second", "body": "two", "note_type": "text"})

    r = client.get("/api/notes")
    assert r.status_code == 200
    assert r.get_json()["total"] == 2


# ---------------------------------------------------------------------------
# Phase 4: text search (US-05 AC-2)
# ---------------------------------------------------------------------------

def test_search_by_title_matches_text_note(rsc):
    rsc.post("/api/notes", json={"title": "Unique xylophone", "body": "music", "note_type": "text"})
    rsc.post("/api/notes", json={"title": "Other note", "body": "stuff", "note_type": "text"})

    r = rsc.get("/api/notes?q=xylophone")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["title"] == "Unique xylophone"


def test_search_by_title_matches_secure_note(rsc):
    """Secure notes are findable by title since titles are stored in plaintext."""
    rsc.post(
        "/api/notes",
        json={"title": "Unique xylophone", "body": "secret content", "note_type": "secure"},
    )
    rsc.post("/api/notes", json={"title": "Other note", "body": "stuff", "note_type": "text"})

    r = rsc.get("/api/notes?q=xylophone")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["title"] == "Unique xylophone"
    assert notes[0]["note_type"] == "secure"


def test_search_body_matches_text_note(rsc):
    rsc.post("/api/notes", json={"title": "Note A", "body": "xylophoneword inside", "note_type": "text"})
    rsc.post("/api/notes", json={"title": "Note B", "body": "unrelated", "note_type": "text"})

    r = rsc.get("/api/notes?q=xylophoneword")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["title"] == "Note A"


def test_search_body_does_not_match_secure_note(rsc):
    """Body search must not return secure notes: their bodies are AES-256-GCM ciphertext.

    This is intentional by design (FR-06, SPR-01). The text index operates on stored
    values; since the body is base64 ciphertext, no plaintext search term will match.
    Secure notes are only findable by title, which is always stored in plaintext.
    """
    rsc.post(
        "/api/notes",
        json={"title": "SecureDoc", "body": "xylophoneword inside", "note_type": "secure"},
    )
    rsc.post(
        "/api/notes",
        json={"title": "PlainDoc", "body": "xylophoneword inside", "note_type": "text"},
    )

    r = rsc.get("/api/notes?q=xylophoneword")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    titles = {n["title"] for n in notes}
    assert "PlainDoc" in titles
    assert "SecureDoc" not in titles


def test_search_and_type_filter_combined(rsc):
    rsc.post("/api/notes", json={"title": "Keyword note", "body": "x", "note_type": "text"})
    rsc.post("/api/notes", json={"title": "Keyword note", "body": "x", "note_type": "voice"})

    r = rsc.get("/api/notes?q=Keyword&type=voice")
    assert r.status_code == 200
    notes = r.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["note_type"] == "voice"


def test_search_no_match_returns_empty(rsc):
    rsc.post("/api/notes", json={"title": "Hello", "body": "world", "note_type": "text"})

    r = rsc.get("/api/notes?q=zzznomatchzzz")
    assert r.status_code == 200
    assert r.get_json()["notes"] == []
    assert r.get_json()["total"] == 0


# ---------------------------------------------------------------------------
# Phase 4: cursor-based pagination (FR-06)
# ---------------------------------------------------------------------------

def test_pagination_limit(client):
    for i in range(3):
        client.post("/api/notes", json={"title": f"Note {i}", "body": "x", "note_type": "text"})

    r = client.get("/api/notes?limit=2")
    assert r.status_code == 200
    data = r.get_json()
    assert len(data["notes"]) == 2
    assert data["total"] == 3
    assert data["next_cursor"] is not None


def test_pagination_cursor_advances_to_next_page(client):
    for i in range(3):
        client.post("/api/notes", json={"title": f"Note {i}", "body": "x", "note_type": "text"})

    r1 = client.get("/api/notes?limit=2")
    data1 = r1.get_json()
    assert len(data1["notes"]) == 2
    next_cursor = data1["next_cursor"]
    assert next_cursor is not None

    r2 = client.get(f"/api/notes?limit=2&cursor={next_cursor}")
    data2 = r2.get_json()
    assert len(data2["notes"]) == 1
    assert data2["next_cursor"] is None

    ids_page1 = {n["id"] for n in data1["notes"]}
    ids_page2 = {n["id"] for n in data2["notes"]}
    assert ids_page1.isdisjoint(ids_page2)


def test_pagination_no_next_cursor_on_last_page(client):
    client.post("/api/notes", json={"title": "Solo", "body": "x", "note_type": "text"})

    r = client.get("/api/notes?limit=50")
    assert r.get_json()["next_cursor"] is None


def test_pagination_total_unchanged_across_pages(client):
    for i in range(4):
        client.post("/api/notes", json={"title": f"Note {i}", "body": "x", "note_type": "text"})

    r1 = client.get("/api/notes?limit=2")
    data1 = r1.get_json()
    total = data1["total"]

    r2 = client.get(f"/api/notes?limit=2&cursor={data1['next_cursor']}")
    assert r2.get_json()["total"] == total


def test_soft_deleted_excluded_from_search(rsc):
    r = rsc.post("/api/notes", json={"title": "xylophone gone", "body": "x", "note_type": "text"})
    nid = r.get_json()["id"]
    rsc.delete(f"/api/notes/{nid}")

    r = rsc.get("/api/notes?q=xylophone")
    assert r.status_code == 200
    assert r.get_json()["total"] == 0


def test_limit_clamped_to_100(client):
    for i in range(5):
        client.post("/api/notes", json={"title": f"N{i}", "body": "x", "note_type": "text"})

    r = client.get("/api/notes?limit=999")
    assert r.status_code == 200
    assert r.get_json()["limit"] == 100
