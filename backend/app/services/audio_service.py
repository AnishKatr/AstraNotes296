"""FR-04: GridFS upload and retrieval for voice note audio files."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.database import Database


_CONTENT_TYPES: dict[str, str] = {
    "webm": "audio/webm",
    "wav": "audio/wav",
}


class WrongNoteTypeError(ValueError):
    """Raised when audio upload is attempted on a non-voice note."""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AudioService:
    """Manages GridFS audio storage for voice notes (FR-04).

    Validates that the target note is a voice note, stores audio bytes in GridFS,
    and links the resulting file id back to the note document. Does not handle
    format or size validation — those live in the route layer.
    """

    def __init__(self, db: Database, bucket) -> None:
        self._col = db.notes
        self._bucket = bucket

    def store(
        self,
        note_id: str,
        data: bytes,
        filename: str,
        ext: str,
    ) -> ObjectId | None:
        """Store audio in GridFS and set audio_file_id on the note.

        Returns the GridFS file id, or None if the note does not exist.
        Raises WrongNoteTypeError if note_type is not 'voice'.
        """
        oid = self._parse_id(note_id)
        note = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
        if note is None:
            return None
        if note["note_type"] != "voice":
            raise WrongNoteTypeError("audio upload only allowed for voice notes")

        ct = _CONTENT_TYPES[ext]
        file_id = self._bucket.put(data, filename=filename, content_type=ct)
        self._col.update_one(
            {"_id": oid},
            {"$set": {"audio_file_id": file_id, "updated_at": _utc_now()}},
        )
        return file_id

    def delete_audio(self, file_id) -> None:
        """Remove a GridFS file by its ObjectId. No-op if the file does not exist."""
        try:
            self._bucket.delete(file_id)
        except Exception:
            pass

    def fetch(self, note_id: str) -> tuple[str, bytes] | None:
        """Return (content_type, bytes) for the note's audio, or None.

        Returns None if the note is missing, soft-deleted, or has no audio attached.
        """
        oid = self._parse_id(note_id)
        note = self._col.find_one({"_id": oid, "deleted": {"$ne": True}})
        if note is None or not note.get("audio_file_id"):
            return None
        try:
            f = self._bucket.get(note["audio_file_id"])
            return f.content_type or "application/octet-stream", f.read()
        except Exception:
            return None

    @staticmethod
    def _parse_id(note_id: str) -> ObjectId:
        try:
            return ObjectId(note_id)
        except InvalidId as e:
            raise ValueError("invalid note id") from e
