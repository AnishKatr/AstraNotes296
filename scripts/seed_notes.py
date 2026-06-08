#!/usr/bin/env python3
"""Seed MongoDB with realistic notes for NFR-01 performance validation.

Usage:
  python scripts/seed_notes.py [--count N] [--drop]

Reads MONGODB_URI, MONGODB_DB, and ENCRYPTION_KEY from the repo-root .env file.
Default count is 1500. Mix: ~60% text, ~25% secure (AES-256 encrypted), ~15% voice.
Timestamps are spread over the past 90 days so sorted queries look realistic.
"""

from __future__ import annotations

import argparse
import base64
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make backend/app importable.
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from bson import ObjectId
from pymongo import MongoClient

from app.services.encryption_service import EncryptionService


_TITLE_PREFIXES = [
    "Meeting notes", "Research", "Ideas for", "Draft", "Review of",
    "Summary", "Analysis", "Thoughts on", "Plan for", "Log",
    "Notes on", "Memo", "Report", "Brainstorm", "Outline",
]

_TITLE_TOPICS = [
    "Q3 goals", "backend refactor", "team sync", "product roadmap",
    "sprint retrospective", "user research", "deployment checklist",
    "database schema", "API design", "security audit",
    "onboarding flow", "marketing strategy", "bug triage",
    "architecture review", "design system", "release notes",
    "infrastructure upgrade", "client feedback", "competitive analysis",
    "personal learning", "reading list", "project kickoff",
    "quarterly planning", "weekly standup", "data migration",
]

_BODY_SENTENCES = [
    "The team agreed on a two-week timeline for the deliverable.",
    "Performance bottlenecks were identified in the query layer.",
    "We need to revisit the authentication flow before launch.",
    "User research revealed three key pain points in the onboarding experience.",
    "The database schema requires an additional index on the updated_at field.",
    "Action items were assigned to each team member at the end of the meeting.",
    "The new API endpoint handles pagination via keyset cursors for consistency.",
    "Security review flagged an unvalidated input in the file upload route.",
    "Deployment is gated on successful staging environment verification.",
    "The encryption key must be rotated before the Q4 compliance deadline.",
    "Next steps include writing integration tests and updating the documentation.",
    "Feedback from the product demo was overwhelmingly positive across the board.",
    "The migration script was tested against a production database replica.",
    "We decided to defer the voice feature to the next sprint iteration.",
    "Memory usage spiked during load testing with ten thousand concurrent users.",
    "The design system now includes dark mode color tokens for all components.",
    "Caching layer reduces average response time by forty percent under load.",
    "All routes now return consistent JSON error envelopes with machine-readable codes.",
    "The plugin registry supports three note types: text, voice, and secure.",
    "Snapshots are capped at fifty per note to control document growth over time.",
    "Search performance was validated against fifteen hundred notes in the collection.",
    "Markdown rendering happens client-side to keep the backend payload small.",
    "GridFS stores audio binaries separate from the note document to avoid size limits.",
    "The cursor-based pagination prevents duplicate results when notes are edited mid-page.",
    "AES-256-GCM encryption ensures ciphertext is authenticated and tamper-evident.",
    "Title text search is weighted ten times higher than body search matches.",
    "Soft delete preserves notes in the database while hiding them from all list views.",
    "Version history lets users restore any of the fifty most recent note snapshots.",
    "The record button is disabled with a tooltip on browsers without MediaRecorder support.",
    "Flask MAX_CONTENT_LENGTH enforces the ten megabyte audio upload size limit globally.",
]


def _random_title() -> str:
    return f"{random.choice(_TITLE_PREFIXES)}: {random.choice(_TITLE_TOPICS)}"


def _random_body() -> str:
    count = random.randint(2, 7)
    return " ".join(random.sample(_BODY_SENTENCES, min(count, len(_BODY_SENTENCES))))


def _random_updated_at(days_back: int = 90) -> datetime:
    delta = timedelta(seconds=random.randint(0, days_back * 86_400))
    return datetime.now(timezone.utc) - delta


def _build_doc(note_type: str, enc_svc: EncryptionService | None) -> dict:
    title = _random_title()
    plaintext_body = _random_body()
    ts = _random_updated_at()

    if note_type == "secure" and enc_svc:
        stored_body = enc_svc.encrypt(plaintext_body)
        is_encrypted = True
    else:
        stored_body = plaintext_body
        is_encrypted = False

    return {
        "_id": ObjectId(),
        "title": title,
        "body": stored_body,
        "note_type": note_type,
        "is_encrypted": is_encrypted,
        "deleted": False,
        "audio_file_id": None,
        "duration_seconds": None,
        "snapshots": [],
        "created_at": ts,
        "updated_at": ts,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed AstraNotes with realistic notes for NFR-01 validation."
    )
    parser.add_argument(
        "--count", type=int, default=1500,
        help="Number of notes to insert (default: 1500)"
    )
    parser.add_argument(
        "--drop", action="store_true",
        help="Drop the existing notes collection before seeding"
    )
    args = parser.parse_args()

    uri = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017")
    db_name = os.environ.get("MONGODB_DB", "astranotes")
    enc_key_b64 = os.environ.get("ENCRYPTION_KEY", "")

    enc_svc: EncryptionService | None = None
    if enc_key_b64:
        enc_svc = EncryptionService(base64.b64decode(enc_key_b64))
    else:
        print("Warning: ENCRYPTION_KEY not set; secure notes will use plaintext bodies.")

    client = MongoClient(uri)
    db = client[db_name]

    if args.drop:
        db.notes.drop()
        print(f"Dropped {db_name}.notes.")

    count = args.count
    n_text = round(count * 0.60)
    n_secure = round(count * 0.25)
    n_voice = count - n_text - n_secure

    types = (["text"] * n_text) + (["secure"] * n_secure) + (["voice"] * n_voice)
    random.shuffle(types)

    docs = [_build_doc(t, enc_svc) for t in types]

    batch_size = 200
    inserted = 0
    for i in range(0, len(docs), batch_size):
        db.notes.insert_many(docs[i : i + batch_size])
        inserted += min(batch_size, len(docs) - i)

    total = db.notes.count_documents({"deleted": False})
    print(f"Seeded {inserted} notes into {db_name}.notes (total non-deleted: {total})")
    print(f"  text:   {types.count('text')}")
    print(f"  secure: {types.count('secure')}")
    print(f"  voice:  {types.count('voice')}")
    client.close()


if __name__ == "__main__":
    main()
