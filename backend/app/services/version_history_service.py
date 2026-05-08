"""FR-05: snapshot creation, listing, and restore for version history."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.database import Database

if TYPE_CHECKING:
    from app.services.encryption_service import EncryptionService


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _sort_snapshots(snapshots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort snapshots newest first using (timestamp, insertion_index) as the key.

    The insertion index tie-breaker ensures stable ordering when two snapshots
    share the same microsecond timestamp, which can happen in fast test suites.
    MongoDB's $push preserves insertion order (oldest at index 0), so a higher
    index means a newer snapshot.
    """
    indexed = list(enumerate(snapshots))
    indexed.sort(key=lambda x: (x[1]["timestamp"], x[0]), reverse=True)
    return [snap for _, snap in indexed]


class VersionHistoryService:
    """Manages note snapshots: create, list, and restore (FR-05).

    Snapshots are stored as embedded subdocuments on the note document,
    capped at 50 per note. The cap is enforced atomically via $push with $slice
    so no separate pruning step is needed.
    """

    MAX_SNAPSHOTS = 50

    def __init__(self, db: Database) -> None:
        self._col = db.notes

    def create_snapshot(
        self, note_id: str, body: str, timestamp: datetime | None = None
    ) -> dict[str, Any]:
        """Append a snapshot and prune to keep only the 50 most recent.

        The body stored here mirrors the note's current storage format: plaintext
        for text/voice notes, AES-256-GCM ciphertext for secure notes. This service
        never re-encrypts or decodes; callers are responsible for that distinction.
        """
        oid = self._parse_id(note_id)
        ts = timestamp or _utc_now()
        snapshot: dict[str, Any] = {
            "snapshot_id": str(uuid.uuid4()),
            "body": body,
            "timestamp": ts,
        }
        # $each + $slice: -50 appends to the array and retains only the last 50
        # elements, atomically pruning the oldest snapshot when the 51st is added.
        self._col.update_one(
            {"_id": oid},
            {
                "$push": {
                    "snapshots": {
                        "$each": [snapshot],
                        "$slice": -self.MAX_SNAPSHOTS,
                    }
                }
            },
        )
        return snapshot

    def list_versions(self, note_id: str) -> list[dict[str, Any]] | None:
        """Return snapshots sorted newest first, or None if note not found.

        Intentionally does not filter by deleted so users can view history
        of soft-deleted notes (per FR-05 spec).
        """
        oid = self._parse_id(note_id)
        doc = self._col.find_one({"_id": oid}, {"snapshots": 1})
        if doc is None:
            return None
        return _sort_snapshots(doc.get("snapshots", []))

    def list_version_previews(
        self, note_id: str, enc_svc: EncryptionService | None
    ) -> list[dict[str, Any]] | None:
        """Return snapshot metadata with body_preview for the API response.

        For secure notes each snapshot body is decrypted before the 100-char
        preview is generated. Corrupted ciphertext yields "[Could not decrypt]"
        rather than propagating an exception.
        """
        from app.services.encryption_service import DecryptionFailedError

        oid = self._parse_id(note_id)
        doc = self._col.find_one({"_id": oid}, {"snapshots": 1, "is_encrypted": 1})
        if doc is None:
            return None

        is_encrypted = doc.get("is_encrypted", False)
        snapshots = _sort_snapshots(doc.get("snapshots", []))

        result: list[dict[str, Any]] = []
        for snap in snapshots:
            if is_encrypted and enc_svc:
                try:
                    plaintext = enc_svc.decrypt(snap["body"])
                    preview = plaintext[:100]
                except (DecryptionFailedError, Exception):
                    preview = "[Could not decrypt]"
            else:
                preview = snap["body"][:100]
            result.append(
                {
                    "snapshot_id": snap["snapshot_id"],
                    "timestamp": snap["timestamp"].isoformat().replace("+00:00", "Z"),
                    "body_preview": preview,
                }
            )
        return result

    def get_snapshot(self, note_id: str, snapshot_id: str) -> dict[str, Any] | None:
        """Return a specific snapshot by ID, or None if not found."""
        oid = self._parse_id(note_id)
        doc = self._col.find_one({"_id": oid}, {"snapshots": 1})
        if not doc:
            return None
        return next(
            (s for s in doc.get("snapshots", []) if s["snapshot_id"] == snapshot_id),
            None,
        )

    @staticmethod
    def _parse_id(note_id: str) -> ObjectId:
        try:
            return ObjectId(note_id)
        except InvalidId as e:
            raise ValueError("invalid note id") from e
