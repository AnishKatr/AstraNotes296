from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.services.note_service import NoteService

notes_bp = Blueprint("notes", __name__, url_prefix="/api/notes")


def _service() -> NoteService:
    return NoteService(current_app.extensions["mongo_db"])


@notes_bp.get("")
def list_notes():
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=50, type=int)
    try:
        items, total = _service().list_notes(page=page, limit=limit)
    except Exception:
        return jsonify({"error": "invalid pagination"}), 400
    return jsonify({"notes": items, "total": total, "page": page, "limit": limit})


@notes_bp.post("")
def create_note():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "")
    body = data.get("body", "")
    note_type = data.get("note_type", "text")
    try:
        note = _service().create(title=title, body=body, note_type=note_type)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(note), 201


@notes_bp.get("/<note_id>")
def get_note(note_id: str):
    try:
        note = _service().get(note_id)
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
    except ValueError as e:
        msg = str(e)
        code = 400 if "empty" in msg or "invalid" in msg else 400
        return jsonify({"error": msg}), code
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
