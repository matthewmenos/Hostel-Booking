"""
Global DB sync middleware.

After every state-changing request (POST, PUT, PATCH, DELETE) this middleware
uploads global_system.db to Cloudflare R2 so the file survives an ephemeral
filesystem restart on Render (or any similar host).

GET / HEAD / OPTIONS never mutate the DB so they are skipped for performance.

The upload runs in a daemon thread so it never blocks the HTTP response.
Upload failures are logged but never raise an exception to the caller.
"""
import logging
import threading

from django.conf import settings

logger = logging.getLogger("global_app.middleware")

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _upload_in_background(path: str) -> None:
    """Upload the global DB to R2 in a daemon thread."""
    try:
        from core import r2_client
        r2_client.upload_global_db(path)
    except Exception as exc:
        logger.error("GlobalDbSyncMiddleware: background upload failed: %s", exc)


class GlobalDbSyncMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not settings.R2_ENABLED:
            return response

        if request.method in _SAFE_METHODS:
            return response

        path = str(settings.DATA_DIR / "global_system.db")
        t = threading.Thread(
            target=_upload_in_background,
            args=(path,),
            daemon=True,
            name="global-db-sync",
        )
        t.start()

        return response
