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
