"""Note type handler base class and SecureNoteHandler (FR-03)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.encryption_service import EncryptionService


class NoteTypeHandler:
    """Default passthrough handler used by text and voice note types."""

    def transform_write(
        self, body: str, enc_svc: EncryptionService | None
    ) -> tuple[str, bool]:
        """Return (body_to_store, is_encrypted)."""
        return body, False

    def transform_read(self, body: str, enc_svc: EncryptionService | None) -> str:
        """Return the readable body."""
        return body


class SecureNoteHandler(NoteTypeHandler):
    """Handler for note_type='secure'. Encrypts on write, decrypts on read.

    Ciphertext is stored in the same ``body`` field as plain text; the
    ``is_encrypted`` flag on the document distinguishes the two cases.
    EncryptionService is required — raises RuntimeError if not wired up.
    """

    def transform_write(
        self, body: str, enc_svc: EncryptionService | None
    ) -> tuple[str, bool]:
        if enc_svc is None:
            raise RuntimeError(
                "EncryptionService is not configured. "
                "Set ENCRYPTION_KEY in your environment."
            )
        return enc_svc.encrypt(body), True

    def transform_read(self, body: str, enc_svc: EncryptionService | None) -> str:
        if enc_svc is None:
            raise RuntimeError(
                "EncryptionService is not configured. "
                "Set ENCRYPTION_KEY in your environment."
            )
        return enc_svc.decrypt(body)
