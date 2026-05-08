from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.services.encryption_service import DecryptionFailedError
from app.services.note_service import InvalidNoteTypeError, NoteService

notes_bp = Blueprint("notes", __name__, url_prefix="/api/notes")


def _service() -> NoteService:
    db = current_app.extensions["mongo_db"]
    enc_svc = current_app.extensions.get("encryption_service")
    return NoteService(db, enc_svc)


@notes_bp.get("")
def list_notes():
    q = request.args.get("q", default=None)
    note_type = request.args.get("type", default=None)
    limit = max(1, min(request.args.get("limit", default=50, type=int), 100))
    cursor = request.args.get("cursor", default=None)
    try:
        items, total, next_cursor = _service().list_notes(
            q=q, note_type=note_type, limit=limit, cursor=cursor
        )
    except InvalidNoteTypeError:
        return jsonify({"error": "invalid note type", "code": "INVALID_TYPE"}), 400
    except Exception:
        return jsonify({"error": "invalid pagination", "code": "INVALID_PAGINATION"}), 400
    return jsonify({"notes": items, "total": total, "next_cursor": next_cursor, "limit": limit})


@notes_bp.post("")
def create_note():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "")
    body = data.get("body", "")
    note_type = data.get("note_type", "text")
    try:
        note = _service().create(title=title, body=body, note_type=note_type)
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
    try:
        note = _service().update(note_id, title=title, body=body)
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
