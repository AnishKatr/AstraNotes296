"""Note document schema and field constants."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


NOTE_TYPES = ("text", "voice", "secure")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Note:
    """Represents a note document as stored in MongoDB."""

    title: str
    body: str
    note_type: str
    is_deleted: bool = False
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "body": self.body,
            "note_type": self.note_type,
            "deleted": self.is_deleted,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
