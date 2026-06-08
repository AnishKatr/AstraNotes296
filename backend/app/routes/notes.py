from __future__ import annotations

from flask import Blueprint, Response, current_app, jsonify, request

from app.services.audio_service import AudioService, WrongNoteTypeError
from app.services.encryption_service import DecryptionFailedError
from app.services.note_service import InvalidNoteTypeError, NoteService
from app.services.version_history_service import VersionHistoryService

notes_bp = Blueprint("notes", __name__, url_prefix="/api/notes")
tags_bp = Blueprint("tags", __name__, url_prefix="/api/tags")
trash_bp = Blueprint("trash", __name__, url_prefix="/api/trash")


def _service() -> NoteService:
    db = current_app.extensions["mongo_db"]
    enc_svc = current_app.extensions.get("encryption_service")
    ver_svc = VersionHistoryService(db)
    return NoteService(db, enc_svc, ver_svc)


def _version_service() -> tuple[VersionHistoryService, object]:
    db = current_app.extensions["mongo_db"]
    enc_svc = current_app.extensions.get("encryption_service")
    return VersionHistoryService(db), enc_svc


def _audio_service() -> AudioService:
    db = current_app.extensions["mongo_db"]
    bucket = current_app.extensions["gridfs_bucket"]
    return AudioService(db, bucket)


_ALLOWED_AUDIO_EXTENSIONS = frozenset({"webm", "wav"})


@notes_bp.get("")
def list_notes():
    q = request.args.get("q", default=None)
    note_type = request.args.get("type", default=None)
    tag = request.args.get("tag", default=None)
    limit = max(1, min(request.args.get("limit", default=50, type=int), 100))
    cursor = request.args.get("cursor", default=None)
    try:
        items, total, next_cursor = _service().list_notes(
            q=q, note_type=note_type, tag=tag, limit=limit, cursor=cursor
        )
    except InvalidNoteTypeError:
        return jsonify({"error": "invalid note type", "code": "INVALID_TYPE"}), 400
    except ValueError:
        # Only the cursor _parse_id call raises ValueError here; genuine server errors propagate as 500.
        return jsonify({"error": "invalid pagination cursor", "code": "INVALID_PAGINATION"}), 400
    return jsonify({"notes": items, "total": total, "next_cursor": next_cursor, "limit": limit})


@notes_bp.post("")
def create_note():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "")
    body = data.get("body", "")
    note_type = data.get("note_type", "text")
    tags = data.get("tags", [])
    try:
        note = _service().create(title=title, body=body, note_type=note_type, tags=tags)
    except DecryptionFailedError:
        return jsonify({"error": "Decryption failed.", "code": "DECRYPTION_FAILED"}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(note), 201


@notes_bp.get("/<note_id>")
def get_note(note_id: str):
    try:
        note = _service().get(note_id)
    except DecryptionFailedError:
        return jsonify({"error": "Decryption failed.", "code": "DECRYPTION_FAILED"}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if not note:
        return jsonify({"error": "not found"}), 404
    return jsonify(note)


@notes_bp.patch("/<note_id>")
def patch_note(note_id: str):
    data = request.get_json(silent=True) or {}
    title = data["title"] if "title" in data else None
    body = data["body"] if "body" in data else None
    tags = data["tags"] if "tags" in data else None
    try:
        note = _service().update(note_id, title=title, body=body, tags=tags)
    except DecryptionFailedError:
        return jsonify({"error": "Decryption failed.", "code": "DECRYPTION_FAILED"}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if not note:
        return jsonify({"error": "not found"}), 404
    return jsonify(note)


@notes_bp.delete("/<note_id>")
def delete_note(note_id: str):
    try:
        ok = _service().soft_delete(note_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if not ok:
        return jsonify({"error": "not found"}), 404
    return "", 204


@notes_bp.post("/<note_id>/restore")
def restore_note(note_id: str):
    """Restore a trashed note to the active list."""
    try:
        note = _service().restore_note(note_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if note is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(note)


@notes_bp.delete("/<note_id>/permanent")
def permanent_delete_note(note_id: str):
    """Hard-delete a trashed note and its GridFS audio (if any)."""
    try:
        doc = _service().permanent_delete(note_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if doc is None:
        return jsonify({"error": "not found or not in trash"}), 404
    if doc.get("audio_file_id"):
        _audio_service().delete_audio(doc["audio_file_id"])
    return "", 204


@notes_bp.get("/<note_id>/versions")
def list_versions(note_id: str):
    ver_svc, enc_svc = _version_service()
    try:
        previews = ver_svc.list_version_previews(note_id, enc_svc)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if previews is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(previews)


@notes_bp.post("/<note_id>/restore/<snapshot_id>")
def restore_version(note_id: str, snapshot_id: str):
    try:
        note = _service().restore_version(note_id, snapshot_id)
    except DecryptionFailedError:
        return jsonify({"error": "Decryption failed.", "code": "DECRYPTION_FAILED"}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if note is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(note)


@notes_bp.post("/<note_id>/audio")
def upload_audio(note_id: str):
    if "audio" not in request.files:
        return jsonify({"error": "no audio field in request", "code": "MISSING_AUDIO"}), 400

    f = request.files["audio"]
    filename = f.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_AUDIO_EXTENSIONS:
        return (
            jsonify({"error": "unsupported audio format; use webm or wav", "code": "UNSUPPORTED_AUDIO_FORMAT"}),
            415,
        )

    data = f.read()
    try:
        file_id = _audio_service().store(note_id, data, filename, ext)
    except WrongNoteTypeError:
        return jsonify({"error": "audio upload only allowed for voice notes", "code": "WRONG_NOTE_TYPE"}), 400
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if file_id is None:
        return jsonify({"error": "not found"}), 404

    note = _service().get(note_id)
    return jsonify(note), 200


@notes_bp.get("/<note_id>/audio")
def get_audio(note_id: str):
    try:
        result = _audio_service().fetch(note_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if result is None:
        return jsonify({"error": "not found"}), 404

    content_type, data = result
    return Response(data, status=200, mimetype=content_type)


@tags_bp.get("")
def list_tags():
    db = current_app.extensions["mongo_db"]
    enc_svc = current_app.extensions.get("encryption_service")
    ver_svc = VersionHistoryService(db)
    tags = NoteService(db, enc_svc, ver_svc).list_tags()
    return jsonify({"tags": tags})


@trash_bp.get("")
def list_trash():
    limit = max(1, min(request.args.get("limit", default=50, type=int), 100))
    cursor = request.args.get("cursor", default=None)
    try:
        items, total, next_cursor = _service().list_trash(limit=limit, cursor=cursor)
    except ValueError:
        return jsonify({"error": "invalid pagination cursor", "code": "INVALID_PAGINATION"}), 400
    return jsonify({"notes": items, "total": total, "next_cursor": next_cursor, "limit": limit})


@trash_bp.delete("")
def empty_trash():
    """Permanently delete all trashed notes, including GridFS audio where present."""
    docs = _service().empty_trash()
    audio_svc = _audio_service()
    for doc in docs:
        if doc.get("audio_file_id"):
            audio_svc.delete_audio(doc["audio_file_id"])
    return "", 204
