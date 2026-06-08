"""Tests for Phase 9: tags feature."""

import mongomock
import mongomock.gridfs
import pytest

mongomock.gridfs.enable_gridfs_integration()

from app import create_app  # noqa: E402
from app.services.note_service import validate_tags  # noqa: E402


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
# validate_tags unit tests
# ---------------------------------------------------------------------------

class TestValidateTags:
    def test_empty_list(self):
        assert validate_tags([]) == []

    def test_trims_and_lowercases(self):
        assert validate_tags(["  Work  ", "HOME"]) == ["work", "home"]

    def test_deduplicates(self):
        result = validate_tags(["python", "Python", "PYTHON"])
        assert result == ["python"]

    def test_skips_blank_strings(self):
        assert validate_tags(["", "  ", "tag"]) == ["tag"]

    def test_max_10_tags(self):
        tags = [str(i) for i in range(10)]
        assert validate_tags(tags) == tags

    def test_exceeds_max_tags_raises(self):
        with pytest.raises(ValueError, match="at most 10"):
            validate_tags([str(i) for i in range(11)])

    def test_max_length_tag_accepted(self):
        tag = "a" * 30
        assert validate_tags([tag]) == [tag]

    def test_tag_too_long_raises(self):
        with pytest.raises(ValueError, match="exceeds maximum length"):
            validate_tags(["a" * 31])

    def test_non_string_item_raises(self):
        with pytest.raises(ValueError, match="each tag must be a string"):
            validate_tags([123])

    def test_non_list_raises(self):
        with pytest.raises(ValueError, match="tags must be an array"):
            validate_tags("python")

    def test_dedup_after_normalize(self):
        result = validate_tags(["  Python  ", "python"])
        assert result == ["python"]


# ---------------------------------------------------------------------------
# Create note with tags
# ---------------------------------------------------------------------------

class TestCreateNoteWithTags:
    def test_create_note_with_tags(self, client):
        resp = client.post(
            "/api/notes",
            json={"title": "Tagged note", "body": "hello", "note_type": "text", "tags": ["work", "dev"]},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["tags"] == ["work", "dev"]

    def test_tags_are_normalized_on_create(self, client):
        resp = client.post(
            "/api/notes",
            json={"title": "Norm", "body": "", "note_type": "text", "tags": ["  Work  ", "DEV"]},
        )
        assert resp.status_code == 201
        assert resp.get_json()["tags"] == ["work", "dev"]

    def test_create_without_tags_defaults_to_empty(self, client):
        resp = client.post("/api/notes", json={"title": "No tags", "body": "", "note_type": "text"})
        assert resp.status_code == 201
        assert resp.get_json()["tags"] == []

    def test_create_with_invalid_tags_returns_400(self, client):
        resp = client.post(
            "/api/notes",
            json={"title": "Bad tags", "body": "", "note_type": "text", "tags": [1, 2, 3]},
        )
        assert resp.status_code == 400

    def test_create_with_too_many_tags_returns_400(self, client):
        resp = client.post(
            "/api/notes",
            json={"title": "Too many", "body": "", "note_type": "text", "tags": [str(i) for i in range(11)]},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Update note tags
# ---------------------------------------------------------------------------

class TestUpdateNoteTags:
    def _make_note(self, client, tags=None):
        payload = {"title": "Note", "body": "body", "note_type": "text"}
        if tags is not None:
            payload["tags"] = tags
        resp = client.post("/api/notes", json=payload)
        return resp.get_json()["id"]

    def test_update_tags(self, client):
        nid = self._make_note(client)
        resp = client.patch(f"/api/notes/{nid}", json={"tags": ["updated"]})
        assert resp.status_code == 200
        assert resp.get_json()["tags"] == ["updated"]

    def test_update_tags_normalizes(self, client):
        nid = self._make_note(client)
        resp = client.patch(f"/api/notes/{nid}", json={"tags": ["  NEW  ", "NEW"]})
        assert resp.status_code == 200
        assert resp.get_json()["tags"] == ["new"]

    def test_update_clears_tags(self, client):
        nid = self._make_note(client, tags=["old"])
        resp = client.patch(f"/api/notes/{nid}", json={"tags": []})
        assert resp.status_code == 200
        assert resp.get_json()["tags"] == []

    def test_update_invalid_tags_returns_400(self, client):
        nid = self._make_note(client)
        resp = client.patch(f"/api/notes/{nid}", json={"tags": [42]})
        assert resp.status_code == 400

    def test_patch_without_tags_key_does_not_change_tags(self, client):
        nid = self._make_note(client, tags=["keep"])
        resp = client.patch(f"/api/notes/{nid}", json={"title": "New title"})
        assert resp.status_code == 200
        assert "keep" in resp.get_json()["tags"]


# ---------------------------------------------------------------------------
# GET /api/tags
# ---------------------------------------------------------------------------

class TestGetTags:
    def test_returns_empty_when_no_notes(self, client):
        resp = client.get("/api/tags")
        assert resp.status_code == 200
        assert resp.get_json()["tags"] == []

    def test_returns_tags_with_counts(self, client):
        client.post("/api/notes", json={"title": "A", "body": "", "note_type": "text", "tags": ["python", "web"]})
        client.post("/api/notes", json={"title": "B", "body": "", "note_type": "text", "tags": ["python"]})
        resp = client.get("/api/tags")
        assert resp.status_code == 200
        tags = {t["tag"]: t["count"] for t in resp.get_json()["tags"]}
        assert tags["python"] == 2
        assert tags["web"] == 1

    def test_deleted_notes_excluded(self, client):
        r = client.post("/api/notes", json={"title": "Del", "body": "", "note_type": "text", "tags": ["gone"]})
        nid = r.get_json()["id"]
        client.delete(f"/api/notes/{nid}")
        resp = client.get("/api/tags")
        tags = [t["tag"] for t in resp.get_json()["tags"]]
        assert "gone" not in tags

    def test_no_tags_notes_not_listed(self, client):
        client.post("/api/notes", json={"title": "No tag note", "body": "", "note_type": "text"})
        resp = client.get("/api/tags")
        assert resp.get_json()["tags"] == []


# ---------------------------------------------------------------------------
# GET /api/notes?tag= filter
# ---------------------------------------------------------------------------

class TestTagFilter:
    def _create(self, client, title, tags):
        return client.post(
            "/api/notes",
            json={"title": title, "body": "", "note_type": "text", "tags": tags},
        ).get_json()["id"]

    def test_filter_by_tag_returns_matching_notes(self, client):
        self._create(client, "Python note", ["python"])
        self._create(client, "Web note", ["web"])
        resp = client.get("/api/notes?tag=python")
        data = resp.get_json()
        assert data["total"] == 1
        assert data["notes"][0]["title"] == "Python note"

    def test_filter_by_tag_no_match_returns_empty(self, client):
        self._create(client, "Note", ["other"])
        resp = client.get("/api/notes?tag=python")
        assert resp.get_json()["total"] == 0

    def test_tag_filter_combines_with_type_filter(self, client):
        self._create(client, "Text+python", ["python"])
        r = client.post(
            "/api/notes",
            json={"title": "Secure+python", "body": "", "note_type": "secure", "tags": ["python"]},
        )
        resp = client.get("/api/notes?tag=python&type=text")
        data = resp.get_json()
        assert data["total"] == 1
        assert data["notes"][0]["title"] == "Text+python"

    def test_no_tag_param_returns_all(self, client):
        self._create(client, "A", ["x"])
        self._create(client, "B", ["y"])
        resp = client.get("/api/notes")
        assert resp.get_json()["total"] == 2
