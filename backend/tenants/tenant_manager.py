"""
Dynamic per-tenant SQLite database lifecycle manager.
=====================================================

This module is the core of the multi-tenant mechanism. Each hostel ("tenant")
gets its own SQLite ``.db`` file holding its private operational data (rooms,
bed spaces, announcements). Those connections are NOT declared in
``settings.DATABASES`` — they are created and registered at runtime here.

Lifecycle of a tenant DB on a request (driven by ``tenants.middleware``):

    1. ensure_tenant_db(slug)
         a. Acquire the per-tenant lock (serializes access to that one file
            within this process, preventing concurrent-write clobber).
         b. Make sure a local copy exists at ``local_db_path(slug)``:
              - if the file is already on disk, use it;
              - else try to pull it from Cloudflare R2;
              - else create an empty file and flag it for schema creation.
         c. Register the connection in ``connections.databases[alias]`` so the
            ORM can use it (this is how we "inject the connection string into
            Django's runtime").
         d. If the file was freshly created, run ``migrate`` against it so the
            tenant schema exists (auto-migrate on first access).
    2. ... the view does its reads/writes, calling ``mark_dirty(slug)`` on write.
    3. sync_tenant_db(slug)
         a. If dirty, upload the local file back to R2 (durable backup/source).
         b. Release the per-tenant lock.

Concurrency model & limitations
-------------------------------
The per-tenant ``threading.Lock`` makes writes to a single tenant file safe
*within one server process*. It does NOT coordinate across multiple processes
or hosts — two workers could still race on the same file. This is acceptable
here because the high-concurrency path (bookings/payments) lives entirely in
the GLOBAL database and never touches tenant files; tenant files hold
low-frequency, manager-owned configuration. This trade-off is documented in
the project plan.
"""
from __future__ import annotations

import logging
import os
import threading

from django.conf import settings
from django.core.management import call_command
from django.db import connections

from core import r2_client

logger = logging.getLogger("tenants.tenant_manager")

# The Django app whose models live in tenant databases.
TENANT_APP_LABEL = "tenants"

# --- Per-tenant lock & dirty-flag registries --------------------------------
# A lock guarding the *registry dicts* themselves (not the per-tenant files).
_registry_lock = threading.Lock()
# slug -> threading.Lock (one re-usable lock per tenant file).
_tenant_locks: dict[str, threading.Lock] = {}
# slug -> bool, set when the tenant DB was written during the current request.
_dirty: dict[str, bool] = {}


def tenant_db_alias(slug: str) -> str:
    """Deterministic Django connection alias for a tenant slug."""
    return f"tenant_{slug}"


def tenant_db_filename(slug: str) -> str:
    """The on-disk / R2 filename for a tenant's database."""
    return f"tenant_{slug}.db"


def local_db_path(slug: str) -> str:
    """Absolute local path of the tenant's SQLite file.

    Uses the project's ``data/db_store`` directory (configured in settings).
    NOTE: we deliberately do not hardcode ``/tmp`` — that does not exist on
    Windows. ``DB_STORE_DIR`` is created at startup.
    """
    return str(settings.DB_STORE_DIR / tenant_db_filename(slug))


def _get_tenant_lock(slug: str) -> threading.Lock:
    with _registry_lock:
        lock = _tenant_locks.get(slug)
        if lock is None:
            lock = threading.Lock()
            _tenant_locks[slug] = lock
        return lock


def mark_dirty(slug: str) -> None:
    """Flag a tenant DB as modified so it will be synced back to R2."""
    _dirty[slug] = True


def is_dirty(slug: str) -> bool:
    return _dirty.get(slug, False)


def _register_connection(slug: str) -> str:
    """Inject the tenant's SQLite connection into Django's runtime config.

    This is the dynamic equivalent of declaring the DB in settings.DATABASES.
    Idempotent: re-registering the same alias just refreshes the config dict.
    """
    alias = tenant_db_alias(slug)
    connections.databases[alias] = {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": local_db_path(slug),
        "ATOMIC_REQUESTS": False,
        "AUTOCOMMIT": True,
        "CONN_MAX_AGE": 0,
        "CONN_HEALTH_CHECKS": False,
        "OPTIONS": {},
        "TIME_ZONE": settings.TIME_ZONE,
        "USER": "",
        "PASSWORD": "",
        "HOST": "",
        "PORT": "",
        "TEST": {"CHARSET": None, "COLLATION": None, "MIGRATE": True, "NAME": None},
    }
    return alias


def _migrate_tenant(alias: str) -> None:
    """Create the tenant schema by running migrations for the tenants app.

    Runs only the ``tenants`` app's migrations against this one alias. The
    router's ``allow_migrate`` keeps global apps out of tenant files.
    """
    logger.info("Auto-migrating tenant schema on alias '%s'", alias)
    call_command(
        "migrate",
        TENANT_APP_LABEL,
        database=alias,
        run_syncdb=False,
        interactive=False,
        verbosity=0,
    )


def ensure_tenant_db(slug: str) -> str:
    """Make a tenant DB available for use and return its connection alias.

    Acquires the per-tenant lock (released later by ``sync_tenant_db``),
    ensures a local file exists (pulling from R2 or initializing fresh),
    registers the connection, and migrates the schema on first creation.
    """
    if not slug:
        raise ValueError("A tenant slug is required to resolve a tenant database.")

    lock = _get_tenant_lock(slug)
    lock.acquire()
    try:
        path = local_db_path(slug)
        alias = tenant_db_alias(slug)
        needs_schema = False

        if not os.path.exists(path):
            key = r2_client.db_object_key(tenant_db_filename(slug))
            pulled = r2_client.download_db(key, path) if r2_client.object_exists(key) else False
            if not pulled:
                # No local file and no R2 backup -> brand new tenant.
                # Touch an empty file; migrations will build the schema.
                open(path, "a").close()
                needs_schema = True
                logger.info("Initialized fresh tenant DB for '%s' at %s", slug, path)

        _register_connection(slug)

        if needs_schema:
            _migrate_tenant(alias)
            # Mark dirty so sync_tenant_db uploads the freshly-migrated schema
            # to R2 on this same request — without this the new file never reaches
            # R2 and would be re-created (empty) on every restart.
            mark_dirty(slug)

        return alias
    except Exception:
        # Never hold the lock if setup failed.
        lock.release()
        raise


def sync_tenant_db(slug: str) -> None:
    """Sync a modified tenant DB back to R2 and release its lock.

    Always releases the per-tenant lock, even if the upload fails, so a
    transient R2 error cannot deadlock future requests. Upload failures are
    logged (and the local copy is preserved for a later retry).
    """
    if not slug:
        return
    try:
        if is_dirty(slug):
            # Close the connection so SQLite flushes its WAL/journal to the
            # main file before we copy it up to R2.
            alias = tenant_db_alias(slug)
            if alias in connections.databases:
                connections[alias].close()
            key = r2_client.db_object_key(tenant_db_filename(slug))
            try:
                r2_client.upload_db(local_db_path(slug), key)
                _dirty[slug] = False
            except r2_client.R2SyncError:
                # Keep the dirty flag so the next request retries the backup.
                logger.error("Deferring R2 sync for '%s'; will retry next request.", slug)
    finally:
        # Release the lock acquired in ensure_tenant_db.
        lock = _tenant_locks.get(slug)
        if lock is not None and lock.locked():
            lock.release()
