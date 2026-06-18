"""Root URL configuration.

All API routes are mounted under ``/api/`` so the Vite dev proxy can forward
them cleanly to Django.
"""
from pathlib import Path

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse, FileResponse, Http404


def health(request):
    return JsonResponse({"status": "ok"})


def serve_spa(request, *args, **kwargs):
    """Serve the React index.html for any non-API, non-admin route."""
    index = Path(settings.FRONTEND_DIR) / "index.html"
    if not index.exists():
        raise Http404("Frontend not built yet.")
    return FileResponse(open(index, "rb"), content_type="text/html")


urlpatterns = [
    path("health/", health),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/chat/", include("global_app.chat_urls")),
    path("api/", include("global_app.urls")),
    path("api/", include("tenants.urls")),
    # Catch-all: hand every other path to React so client-side routing works.
    re_path(r"^(?!api/|admin/|static/|media/).*$", serve_spa),
]

# Serve media locally only in fallback mode (R2 serves its own URLs).
if not settings.R2_ENABLED and settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
