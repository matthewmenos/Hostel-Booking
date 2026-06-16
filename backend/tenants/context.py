"""
Per-thread "active tenant" context.

Django's database router (:class:`tenants.routers.TenantRouter`) has no access
to the current request, so we stash the active tenant's connection alias in a
thread-local. The middleware sets it at the start of a request and clears it at
the end; the router reads it to decide where tenant-app models should read/write.

This is the standard, well-understood pattern for request-scoped routing in
Django and is safe for the sync (one-thread-per-request) WSGI server model.
"""
import threading

_state = threading.local()


def set_current_tenant(alias: str | None) -> None:
    """Set (or clear) the DB alias the router should target for tenant models."""
    _state.alias = alias


def get_current_tenant() -> str | None:
    """Return the active tenant DB alias, or None if no tenant is active."""
    return getattr(_state, "alias", None)


def clear_current_tenant() -> None:
    _state.alias = None
