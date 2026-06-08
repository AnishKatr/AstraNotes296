"""FR-01: note CRUD with soft delete. FR-03: transparent encrypt/decrypt. FR-06: search/filter. FR-05: version snapshots."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.database import Database

from app.models.note import Note
from app.services.plugin_registry import get_plugin_registry

if TYPE_CHECKING:
    from app.services.encryption_service import EncryptionService
    from app.services.version_history_service import VersionHistoryService


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


_UNSET = object()

_TAG_MAX_LENGTH = 30
_TAG_MAX_COUNT = 10


def _iso(dt: datetime) -> str:
    """Format a datetime as an ISO 8601 string always ending with 'Z'."""
    s = dt.isoformat()
    if s.endswith("+00:00"):
        return s[:-6] + "Z"
    if "+" not in s and not s.endswith("Z"):
        return s + "Z"
    return s


class InvalidNoteTypeError(ValueError):
    """Raised when an unrecognized note_type is used as a filter (FR-06)."""


def validate_tags(raw: Any) -> list[str]:
    """Normalize and validate a tag list.

    Each tag is trimmed and lowercased. Duplicate, empty, and whitespace-only
    tags are removed silently. Raises ValueError on type mismatches, tags
    exceeding 30 characters, or lists exceeding 10 entries.
    """
    if not isinstance(raw, list):
        raise ValueError("tags must be an array")
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            raise ValueError("each tag must be a string")
        tag = item.strip().lower()
        if not tag:
            continue
        if len(tag) > _TAG_MAX_LENGTH:
            raise ValueError(f"tag exceeds maximum length of {_TAG_MAX_LENGTH} characters")
        if tag not in seen:
            seen.add(tag)
            cleaned.append(tag)
    if len(cleaned) > _TAG_MAX_COUNT:
        raise ValueError(f"a note can have at most {_TAG_MAX_COUNT} tags")
    return cleaned


def _serialize(doc: dict[str, Any], body: Any = _UNSET) -> dict[str, Any]:
    deleted_at = doc.get("deleted_at")
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "body": doc["body"] if body is _UNSET else body,
        "note_type": doc["note_type"],
        "is_encrypted": doc.get("is_encrypted", False),
        "tags": doc.get("tags", []),
        "audio_file_id": str(doc["audio_file_id"]) if doc.get("audio_file_id") else None,
        "duration_seconds": doc.get("duration_seconds"),
        "created_at": _iso(doc["created_at"]),
        "updated_at": _iso(doc["updated_at"]),
        "deleted": doc.get("deleted", False),
        "deleted_at": _iso(deleted_at) if deleted_at else None,
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

    def create(self, title: str, body: str, note_type: str, tags: list | None = None) -> dict[str, Any]:
        t = (title or "").strip()
        if not t:
            raise ValueError("title cannot be empty")
        registry = get_plugin_registry()
        registry.validate_type_or_raise(note_type)
        handler = registry.get_handler(note_type)
        stored_body, is_encrypted = handler.transform_write(body or "", self._enc_svc)
        validated_tags = validate_tags(tags or [])
        now = _utc_now()
        doc = Note(
            title=t,
            body=stored_body,
            note_type=note_type,
            is_encrypted=is_encrypted,
            tags=validated_tags,
            created_at=now,
            updated_at=now,
        ).to_dict()
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
        self,
        note_id: str,
        title: str | None,
        body: str | None,
        tags: list | None = None,
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
            if self._version_svc:
                self._version_svc.create_snapshot(note_id, existing["body"], _utc_now())
            handler = get_plugin_registry().get_handler(existing["note_type"])
            stored_body, is_encrypted = handler.transform_write(body, self._enc_svc)
            updates["body"] = stored_body
            updates["is_encrypted"] = is_encrypted
        if tags is not None:
            updates["tags"] = validate_tags(tags)

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
        now = _utc_now()
        res = self._col.update_one(
            {"_id": oid, "deleted": {"$ne": True}},
            {"$set": {"deleted": True, "deleted_at": now, "updated_at": now}},
        )
        return res.modified_count > 0

    def list_trash(
        self,
        limit: int = 50,
        cursor: str | None = None,
    ) -> tuple[list[dict[str, Any]], int, str | None]:
        """List soft-deleted notes sorted by deletion time descending."""
        limit = max(1, min(limit, 100))
        base_filter: dict[str, Any] = {"deleted": True}
        total = self._col.count_documents(base_filter)

        page_filter = dict(base_filter)
        if cursor:
            cursor_oid = self._parse_id(cursor)
            cursor_doc = self._col.find_one({"_id": cursor_oid}, {"deleted_at": 1})
            if cursor_doc:
                cursor_time = cursor_doc.get("deleted_at")
                if cursor_time:
                    page_filter["$or"] = [
                        {"deleted_at": {"$lt": cursor_time}},
                        {"deleted_at": cursor_time, "_id": {"$lt": cursor_oid}},
                    ]

        sort = [("deleted_at", -1), ("_id", -1)]
        docs = list(self._col.find(page_filter).sort(sort).limit(limit))
        items = [_serialize(doc, None if doc.get("is_encrypted") else doc["body"]) for doc in docs]
        next_cursor = str(docs[-1]["_id"]) if len(docs) == limit else None
        return items, total, next_cursor

    def restore_note(self, note_id: str) -> dict[str, Any] | None:
        """Clear the deleted flag and return the note to the active list."""
        oid = self._parse_id(note_id)
        result = self._col.find_one_and_update(
            {"_id": oid, "deleted": True},
            {"$set": {"deleted": False, "updated_at": _utc_now()}, "$unset": {"deleted_at": ""}},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            return None
        return _serialize(result, self._decrypt_body(result))

    def permanent_delete(self, note_id: str) -> dict[str, Any] | None:
        """Hard-delete a trashed note. Returns the doc so the caller can clean GridFS.

        Only operates on documents where deleted=True. Returns None if not found
        or not in trash.
        """
        oid = self._parse_id(note_id)
        doc = self._col.find_one_and_delete({"_id": oid, "deleted": True})
        return doc

    def empty_trash(self) -> list[dict[str, Any]]:
        """Hard-delete all trashed notes. Returns the deleted docs for GridFS cleanup."""
        docs = list(self._col.find({"deleted": True}))
        if docs:
            self._col.delete_many({"deleted": True})
        return docs

    def list_notes(
        self,
        q: str | None = None,
        note_type: str | None = None,
        tag: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> tuple[list[dict[str, Any]], int, str | None]:
        """List notes with optional search, type/tag filter, and cursor pagination.

        Search uses the notes_text_search weighted text index (title: 10, body: 1).
        Full-word/token matching; substring queries do not match.
        Secure note bodies are AES-256-GCM ciphertext; no plaintext search matches
        there. Secure notes remain findable by title (FR-06, SPR-01).
        """
        limit = max(1, min(limit, 100))

        if note_type is not None and not get_plugin_registry().is_registered(note_type):
            raise InvalidNoteTypeError(f"Invalid note type: {note_type!r}")

        conditions: list[dict[str, Any]] = [{"deleted": {"$ne": True}}]
        if note_type:
            conditions.append({"note_type": note_type})
        if tag:
            conditions.append({"tags": tag})

        search_term = (q or "").strip()
        if search_term:
            conditions.append({"$text": {"$search": search_term}})

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

    def list_tags(self) -> list[dict[str, Any]]:
        """Return distinct tags with note counts across non-deleted notes."""
        pipeline = [
            {"$match": {"deleted": {"$ne": True}}},
            {"$unwind": "$tags"},
            {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
            {"$sort": {"count": -1, "_id": 1}},
            {"$project": {"_id": 0, "tag": "$_id", "count": 1}},
        ]
        return list(self._col.aggregate(pipeline))

    def restore_version(self, note_id: str, snapshot_id: str) -> dict[str, Any] | None:
        """Restore a snapshot body to the note, snapshotting the current state first."""
        oid = self._parse_id(note_id)
        existing = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
        if not existing:
            return None

        if self._version_svc is None:
            raise RuntimeError("VersionHistoryService is not configured.")

        snapshot = self._version_svc.get_snapshot(note_id, snapshot_id)
        if snapshot is None:
            return None

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
