"""AES-256-GCM encryption for secure notes (FR-03, SPR-01)."""

from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_BYTES = 12
_KEY_BYTES = 32


class MissingEncryptionKeyError(Exception):
    """Raised when the encryption key is absent or malformed."""


class DecryptionFailedError(Exception):
    """Raised when decryption fails due to a wrong key or corrupted ciphertext."""


class EncryptionService:
    """Stateless AES-256-GCM encrypt/decrypt.

    The 12-byte random nonce is prepended to the ciphertext before base64
    encoding, so each call to encrypt produces a unique output even for
    identical plaintexts.
    """

    def __init__(self, key: bytes) -> None:
        if len(key) != _KEY_BYTES:
            raise MissingEncryptionKeyError(
                f"Encryption key must be {_KEY_BYTES} bytes, got {len(key)}."
            )
        self._aesgcm = AESGCM(key)

    def encrypt(self, plaintext: str) -> str:
        """Return base64-encoded nonce + ciphertext."""
        nonce = os.urandom(_NONCE_BYTES)
        ct = self._aesgcm.encrypt(nonce, plaintext.encode(), None)
        return base64.b64encode(nonce + ct).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decode and decrypt a value produced by encrypt().

        Raises DecryptionFailedError on any failure so callers never see
        garbled plaintext (FR-03).
        """
        try:
            data = base64.b64decode(ciphertext)
            nonce, ct = data[:_NONCE_BYTES], data[_NONCE_BYTES:]
            return self._aesgcm.decrypt(nonce, ct, None).decode()
        except (InvalidTag, Exception) as exc:
            raise DecryptionFailedError("Decryption failed.") from exc
