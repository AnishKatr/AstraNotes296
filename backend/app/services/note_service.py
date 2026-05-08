"""FR-01: note CRUD with soft delete. FR-03: transparent encrypt/decrypt. FR-06: search/filter. FR-05: version snapshots."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.database import Database

from app.services.plugin_registry import get_plugin_registry

if TYPE_CHECKING:
    from app.services.encryption_service import EncryptionService
    from app.services.version_history_service import VersionHistoryService


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


_UNSET = object()


class InvalidNoteTypeError(ValueError):
    """Raised when an unrecognized note_type is used as a filter (FR-06)."""


def _serialize(doc: dict[str, Any], body: Any = _UNSET) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "body": doc["body"] if body is _UNSET else body,
        "note_type": doc["note_type"],
        "is_encrypted": doc.get("is_encrypted", False),
        "created_at": doc["created_at"].isoformat().replace("+00:00", "Z"),
        "updated_at": doc["updated_at"].isoformat().replace("+00:00", "Z"),
        "deleted": doc.get("deleted", False),
    }


class NoteService:
    def __init__(
        self,
        db: Database,
        enc_svc: EncryptionService | None = None,
        version_svc: VersionHistoryService | None = None,
    ) -> None:
        self._col = db.notes
        self._enc_svc = enc_svc
        self._version_svc = version_svc

    def create(self, title: str, body: str, note_type: str) -> dict[str, Any]:
        t = (title or "").strip()
        if not t:
            raise ValueError("title cannot be empty")
        registry = get_plugin_registry()
        registry.validate_type_or_raise(note_type)
        handler = registry.get_handler(note_type)
        stored_body, is_encrypted = handler.transform_write(body or "", self._enc_svc)
        now = _utc_now()
        doc = {
            "title": t,
            "body": stored_body,
            "note_type": note_type,
            "is_encrypted": is_encrypted,
            "created_at": now,
            "updated_at": now,
            "deleted": False,
        }
        result = self._col.insert_one(doc)
        doc["_id"] = result.inserted_id
        readable_body = handler.transform_read(stored_body, self._enc_svc)
        return _serialize(doc, readable_body)

    def get(self, note_id: str) -> dict[str, Any] | None:
        oid = self._parse_id(note_id)
        doc = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
        if not doc:
            return None
        body = self._decrypt_body(doc)
        return _serialize(doc, body)

    def update(
        self, note_id: str, title: str | None, body: str | None
    ) -> dict[str, Any] | None:
        oid = self._parse_id(note_id)
        existing = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
        if not existing:
            return None

        updates: dict[str, Any] = {"updated_at": _utc_now()}
        if title is not None:
            t = title.strip()
            if not t:
                raise ValueError("title cannot be empty")
            updates["title"] = t
        if body is not None:
            # Snapshot the current stored body before overwriting it.
            # For secure notes, existing["body"] is already AES-256-GCM ciphertext;
            # snapshots mirror storage format, so no extra encrypt/decrypt is needed here.
            if self._version_svc:
                self._version_svc.create_snapshot(note_id, existing["body"], _utc_now())
            handler = get_plugin_registry().get_handler(existing["note_type"])
            stored_body, is_encrypted = handler.transform_write(body, self._enc_svc)
            updates["body"] = stored_body
            updates["is_encrypted"] = is_encrypted

        if len(updates) == 1:
            return _serialize(existing, self._decrypt_body(existing))

        result = self._col.find_one_and_update(
            {"_id": oid, "deleted": {"$ne": True}},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            return None
        return _serialize(result, self._decrypt_body(result))

    def soft_delete(self, note_id: str) -> bool:
        oid = self._parse_id(note_id)
        res = self._col.update_one(
            {"_id": oid, "deleted": {"$ne": True}},
            {"$set": {"deleted": True, "updated_at": _utc_now()}},
        )
        return res.modified_count > 0

    def list_notes(
        self,
        q: str | None = None,
        note_type: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> tuple[list[dict[str, Any]], int, str | None]:
        """List notes with optional search, type filter, and cursor pagination.

        Search uses case-insensitive $regex on title and body, which handles
        partial, prefix, and substring matches. Secure note bodies are
        AES-256-GCM ciphertext; regex over base64 output will not match any
        plaintext term, so secure notes are only findable by title (FR-06, SPR-01).
        """
        limit = max(1, min(limit, 100))

        if note_type is not None and not get_plugin_registry().is_registered(note_type):
            raise InvalidNoteTypeError(f"Invalid note type: {note_type!r}")

        conditions: list[dict[str, Any]] = [{"deleted": {"$ne": True}}]
        if note_type:
            conditions.append({"note_type": note_type})

        search_term = (q or "").strip()
        if search_term:
            escaped = re.escape(search_term)
            conditions.append({"$or": [
                {"title": {"$regex": escaped, "$options": "i"}},
                {"body": {"$regex": escaped, "$options": "i"}},
            ]})

        def _q(conds: list[dict[str, Any]]) -> dict[str, Any]:
            return {"$and": conds} if len(conds) > 1 else conds[0]

        total = self._col.count_documents(_q(conditions))

        page_conditions = list(conditions)
        if cursor:
            cursor_oid = self._parse_id(cursor)
            cursor_doc = self._col.find_one({"_id": cursor_oid}, {"updated_at": 1})
            if cursor_doc:
                cursor_time = cursor_doc["updated_at"]
                page_conditions.append({"$or": [
                    {"updated_at": {"$lt": cursor_time}},
                    {"updated_at": cursor_time, "_id": {"$lt": cursor_oid}},
                ]})

        sort = [("updated_at", -1), ("_id", -1)]
        docs = list(self._col.find(_q(page_conditions)).sort(sort).limit(limit))

        items = []
        for doc in docs:
            body = None if doc.get("is_encrypted") else doc["body"]
            items.append(_serialize(doc, body))

        next_cursor = str(docs[-1]["_id"]) if len(docs) == limit else None
        return items, total, next_cursor

    def restore_version(self, note_id: str, snapshot_id: str) -> dict[str, Any] | None:
        """Restore a snapshot body to the note, snapshotting the current state first.

        The snapshot body is written directly without re-encryption; it is already
        in storage format (ciphertext for secure notes, plaintext otherwise).
        Returns None when the note or snapshot is not found (caller maps to 404).
        Soft-deleted notes are excluded: they return None here, same as GET.
        """
        oid = self._parse_id(note_id)
        existing = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
        if not existing:
            return None

        if self._version_svc is None:
            raise RuntimeError("VersionHistoryService is not configured.")

        snapshot = self._version_svc.get_snapshot(note_id, snapshot_id)
        if snapshot is None:
            return None

        # Snapshot the current body so the restore itself is reversible.
        self._version_svc.create_snapshot(note_id, existing["body"], _utc_now())

        now = _utc_now()
        result = self._col.find_one_and_update(
            {"_id": oid, "deleted": {"$ne": True}},
            {"$set": {"body": snapshot["body"], "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            return None
        return _serialize(result, self._decrypt_body(result))

    def _decrypt_body(self, doc: dict[str, Any]) -> str:
        """Decrypt body if is_encrypted, otherwise return as-is."""
        if doc.get("is_encrypted"):
            handler = get_plugin_registry().get_handler(doc["note_type"])
            return handler.transform_read(doc["body"], self._enc_svc)
        return doc["body"]

    @staticmethod
    def _parse_id(note_id: str) -> ObjectId:
        try:
            return ObjectId(note_id)
        except InvalidId as e:
            raise ValueError("invalid note id") from e
