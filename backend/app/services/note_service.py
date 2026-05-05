"""FR-01: note CRUD with soft delete."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.database import Database

from app.services.plugin_registry import get_plugin_registry


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "body": doc["body"],
        "note_type": doc["note_type"],
        "created_at": doc["created_at"].isoformat().replace("+00:00", "Z"),
        "updated_at": doc["updated_at"].isoformat().replace("+00:00", "Z"),
        "deleted": doc.get("deleted", False),
    }


class NoteService:
    def __init__(self, db: Database) -> None:
        self._col = db.notes

    def create(self, title: str, body: str, note_type: str) -> dict[str, Any]:
        t = (title or "").strip()
        if not t:
            raise ValueError("title cannot be empty")
        get_plugin_registry().validate_type_or_raise(note_type)
        now = _utc_now()
        doc = {
            "title": t,
            "body": body or "",
            "note_type": note_type,
            "created_at": now,
            "updated_at": now,
            "deleted": False,
        }
        result = self._col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _serialize(doc)

    def get(self, note_id: str) -> dict[str, Any] | None:
        oid = self._parse_id(note_id)
        doc = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
        return _serialize(doc) if doc else None

    def update(self, note_id: str, title: str | None, body: str | None) -> dict[str, Any] | None:
        oid = self._parse_id(note_id)
        updates: dict[str, Any] = {"updated_at": _utc_now()}
        if title is not None:
            t = title.strip()
            if not t:
                raise ValueError("title cannot be empty")
            updates["title"] = t
        if body is not None:
            updates["body"] = body
        if len(updates) == 1:
            doc = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
            return _serialize(doc) if doc else None
        result = self._col.find_one_and_update(
            {"_id": oid, "deleted": {"$ne": True}},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        return _serialize(result) if result else None

    def soft_delete(self, note_id: str) -> bool:
        oid = self._parse_id(note_id)
        res = self._col.update_one(
            {"_id": oid, "deleted": {"$ne": True}},
            {"$set": {"deleted": True, "updated_at": _utc_now()}},
        )
        return res.modified_count > 0

    def list_notes(self, page: int = 1, limit: int = 50) -> tuple[list[dict[str, Any]], int]:
        limit = max(1, min(limit, 100))
        page = max(1, page)
        skip = (page - 1) * limit
        query = {"deleted": {"$ne": True}}
        total = self._col.count_documents(query)
        cursor = (
            self._col.find(query).sort("updated_at", -1).skip(skip).limit(limit)
        )
        return [_serialize(d) for d in cursor], total

    @staticmethod
    def _parse_id(note_id: str) -> ObjectId:
        try:
            return ObjectId(note_id)
        except InvalidId as e:
            raise ValueError("invalid note id") from e
