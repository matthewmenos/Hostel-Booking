"""
Cloudflare R2 client wrapper.

R2 exposes an S3-compatible API, so we use ``boto3`` against the R2 endpoint.
This module manages the per-tenant SQLite ``.db`` files, which live in their
own dedicated bucket (``settings.R2_DB_BUCKET``) — separate from the media
bucket used by ``core.storage``. It is intentionally thin and defensive: every
network operation is wrapped so that R2 outages degrade gracefully rather than
crashing requests.

Two failure philosophies are applied:

* **Reads** (``download_db`` / ``object_exists``): on transient R2 errors we
  treat the object as "not available" and let the caller fall back to a fresh
  local database. Losing the ability to *read* a backup must never block a
  manager from working.

* **Writes** (``upload_db``): we raise a clear, catchable :class:`R2SyncError`
  so the middleware can log the failed sync and keep the (still-correct) local
  copy, retrying on a later request. We never silently swallow a failed backup.

When R2 is not configured (no credentials in ``.env``) the client operates in
**local-fallback mode**: ``object_exists`` returns ``False`` and the sync calls
are no-ops, so the tenant ``.db`` files simply live on local disk.
"""
from __future__ import annotations

import logging
import threading

from django.conf import settings

logger = logging.getLogger("core.r2_client")


class R2SyncError(RuntimeError):
    """Raised when a write/upload to R2 fails and the caller should be told."""


# boto3 clients are thread-safe for calls but we build one lazily and cache it.
_client_lock = threading.Lock()
_client = None


def _get_client():
    """Return a cached boto3 S3 client pointed at the R2 endpoint, or None."""
    global _client
    if not settings.R2_ENABLED:
        return None
    if _client is None:
        with _client_lock:
            if _client is None:  # double-checked locking
                import boto3
                from botocore.config import Config

                _client = boto3.client(
                    "s3",
                    endpoint_url=settings.R2_ENDPOINT_URL,
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    # R2 ignores region but boto3 wants one; "auto" is conventional.
                    region_name="auto",
                    config=Config(
                        retries={"max_attempts": 3, "mode": "standard"},
                        # Fail fast rather than hanging the request thread.
                        connect_timeout=5,
                        read_timeout=30,
                    ),
                )
    return _client


def db_object_key(filename: str) -> str:
    """Build the R2 object key for a tenant database file."""
    prefix = settings.R2_DB_PREFIX.strip("/")
    return f"{prefix}/{filename}"


def object_exists(key: str) -> bool:
    """Return True if an object exists in the bucket. False on miss OR R2 error.

    Used to decide whether to pull an existing tenant DB or initialize a fresh
    one. A network error here is treated as "not available" so the caller can
    safely create a new local database.
    """
    client = _get_client()
    if client is None:
        return False
    try:
        client.head_object(Bucket=settings.R2_DB_BUCKET, Key=key)
        return True
    except Exception as exc:
        # botocore ClientError carries a .response dict; a 404 is the normal
        # "no backup yet" case and should not be logged as a warning.
        response = getattr(exc, "response", None)
        http_status = (
            response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if isinstance(response, dict)
            else None
        )
        if http_status != 404:
            logger.warning("R2 head_object failed for %s: %s", key, exc)
        return False


def download_db(key: str, local_path: str) -> bool:
    """Download an object from R2 to ``local_path``.

    Returns True on success, False if the object is missing or R2 is
    unreachable (caller should then initialize a fresh schema).
    """
    client = _get_client()
    if client is None:
        return False
    try:
        client.download_file(settings.R2_DB_BUCKET, key, local_path)
        logger.info("Pulled tenant DB from R2: %s", key)
        return True
    except Exception as exc:
        logger.warning("R2 download failed for %s -> %s: %s", key, local_path, exc)
        return False


def upload_db(local_path: str, key: str) -> None:
    """Upload a tenant DB file to R2.

    Raises :class:`R2SyncError` on failure so the caller can surface/retry the
    failed backup without losing the authoritative local copy. No-op when R2 is
    not configured.
    """
    client = _get_client()
    if client is None:
        return
    try:
        client.upload_file(local_path, settings.R2_DB_BUCKET, key)
        logger.info("Synced tenant DB to R2: %s", key)
    except Exception as exc:
        logger.error("R2 upload failed for %s -> %s: %s", local_path, key, exc)
        raise R2SyncError(f"Failed to sync {key} to R2: {exc}") from exc
