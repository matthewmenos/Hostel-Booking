"""
Global DB sync middleware.

After every state-changing request (POST, PUT, PATCH, DELETE) this middleware
uploads global_system.db to Cloudflare R2 so the file survives an ephemeral
filesystem restart on Render (or any similar host).

GET / HEAD / OPTIONS never mutate the DB so they are skipped for performance.

Upload failures are logged but never raise an exception to the caller — a
failed backup must not break the user's request.
"""
import logging

from django.conf import settings

logger = logging.getLogger("global_app.middleware")

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class GlobalDbSyncMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not settings.R2_ENABLED:
            return response

        if request.method in _SAFE_METHODS:
            return response

        try:
            from core import r2_client
            r2_client.upload_global_db(str(settings.DATA_DIR / "global_system.db"))
        except Exception as exc:
            logger.error(
                "GlobalDbSyncMiddleware: failed to sync global DB after %s %s: %s",
                request.method,
                request.path,
                exc,
            )

        return response
