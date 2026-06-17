"""Root URL configuration.

All API routes are mounted under ``/api/`` so the Vite dev proxy can forward
them cleanly to Django.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", health),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("global_app.urls")),
    path("api/", include("tenants.urls")),
]

# Serve media locally only in fallback mode (R2 serves its own URLs).
if not settings.R2_ENABLED and settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
