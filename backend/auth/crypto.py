# backend/auth/crypto.py
"""
Symmetric encryption for sensitive data (API tokens, secrets).
Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography library.

The encryption key is derived from SECRET_KEY via PBKDF2.
"""

import base64
import hashlib
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from decouple import config

logger = logging.getLogger(__name__)

# Derive a stable Fernet key from SECRET_KEY using PBKDF2
_SECRET_KEY = config("SECRET_KEY", default="")
_SALT = b"ragleaf-token-encryption-v1"


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a 32-byte URL-safe base64-encoded key from the secret."""
    dk = hashlib.pbkdf2_hmac("sha256", secret.encode(), _SALT, iterations=100_000)
    return base64.urlsafe_b64encode(dk)


def _get_fernet() -> Optional[Fernet]:
    """Get the Fernet cipher instance. Returns None if SECRET_KEY is not set."""
    if not _SECRET_KEY:
        logger.warning("SECRET_KEY not set — token encryption disabled")
        return None
    try:
        key = _derive_fernet_key(_SECRET_KEY)
        return Fernet(key)
    except Exception as e:
        logger.error(f"Failed to initialize Fernet cipher: {e}")
        return None


def encrypt_token(plaintext: str) -> str:
    """
    Encrypt a plaintext token.
    Returns the encrypted string (base64-encoded).
    Falls back to returning plaintext if encryption is unavailable.
    """
    if not plaintext:
        return plaintext

    f = _get_fernet()
    if f is None:
        return plaintext

    try:
        return f.encrypt(plaintext.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return plaintext


def decrypt_token(ciphertext: str) -> str:
    """
    Decrypt an encrypted token.
    Returns the plaintext string.
    If decryption fails (e.g. the value was stored before encryption was enabled),
    returns the original value unchanged — this allows a graceful migration.
    """
    if not ciphertext:
        return ciphertext

    f = _get_fernet()
    if f is None:
        return ciphertext

    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        # Value was not encrypted (legacy data) — return as-is
        logger.debug("Token appears to be unencrypted (legacy). Returning as-is.")
        return ciphertext
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return ciphertext


def is_encrypted(value: str) -> bool:
    """Check if a value looks like a Fernet-encrypted token."""
    if not value:
        return False
    try:
        # Fernet tokens are base64-encoded and start with "gAAAAA"
        return value.startswith("gAAAAA") and len(value) > 100
    except Exception:
        return False
