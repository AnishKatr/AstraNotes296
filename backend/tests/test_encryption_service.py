"""Tests for EncryptionService (FR-03, SPR-01)."""

import base64
import os

import mongomock
import pytest

from app.config import load_encryption_key
from app.services.encryption_service import (
    DecryptionFailedError,
    EncryptionService,
    MissingEncryptionKeyError,
)


@pytest.fixture
def key() -> bytes:
    return os.urandom(32)


@pytest.fixture
def service(key: bytes) -> EncryptionService:
    return EncryptionService(key)


# --- core encrypt/decrypt ---

def test_encrypt_decrypt_roundtrip(service):
    plaintext = "Hello, secret world!"
    assert service.decrypt(service.encrypt(plaintext)) == plaintext


def test_encrypt_produces_different_ciphertext_each_call(service):
    ct1 = service.encrypt("same")
    ct2 = service.encrypt("same")
    assert ct1 != ct2


def test_decrypt_wrong_key_raises(key):
    svc_enc = EncryptionService(key)
    svc_dec = EncryptionService(os.urandom(32))
    ct = svc_enc.encrypt("secret")
    with pytest.raises(DecryptionFailedError):
        svc_dec.decrypt(ct)


def test_decrypt_corrupted_ciphertext_raises(service):
    ct = service.encrypt("secret")
    data = bytearray(base64.b64decode(ct))
    data[20] ^= 0xFF
    corrupted = base64.b64encode(bytes(data)).decode()
    with pytest.raises(DecryptionFailedError):
        service.decrypt(corrupted)


def test_decrypt_truncated_ciphertext_raises(service):
    with pytest.raises(DecryptionFailedError):
        service.decrypt(base64.b64encode(b"tooshort").decode())


# --- service initialization ---

def test_service_init_short_key_raises():
    with pytest.raises(MissingEncryptionKeyError):
        EncryptionService(b"only16bytes!!!!!")


def test_service_init_empty_key_raises():
    with pytest.raises(MissingEncryptionKeyError):
        EncryptionService(b"")


# --- config key loading ---

def test_load_encryption_key_missing_raises():
    with pytest.raises(MissingEncryptionKeyError):
        load_encryption_key({})


def test_load_encryption_key_empty_string_raises():
    with pytest.raises(MissingEncryptionKeyError):
        load_encryption_key({"ENCRYPTION_KEY": ""})


def test_load_encryption_key_invalid_base64_raises():
    with pytest.raises(MissingEncryptionKeyError):
        load_encryption_key({"ENCRYPTION_KEY": "not-valid-base64!!!"})


def test_load_encryption_key_wrong_length_raises():
    short = base64.b64encode(os.urandom(16)).decode()
    with pytest.raises(MissingEncryptionKeyError):
        load_encryption_key({"ENCRYPTION_KEY": short})


def test_load_encryption_key_valid_returns_bytes():
    valid = base64.b64encode(os.urandom(32)).decode()
    key = load_encryption_key({"ENCRYPTION_KEY": valid})
    assert isinstance(key, bytes) and len(key) == 32


# --- app startup fail-fast (SPR-01) ---

def test_app_startup_fails_without_encryption_key():
    from app import create_app
    with pytest.raises(MissingEncryptionKeyError):
        create_app(
            {
                "TESTING": False,
                "MONGO_CLIENT": mongomock.MongoClient(),
                "MONGODB_DB": "test",
                "SKIP_INDEXES": True,
                "ENCRYPTION_KEY": "",  # override any value loaded from .env
            }
        )
