"""
Tenant resolution & sync middleware.

Responsibilities per request:
  1. Resolve the active tenant from the ``X-Tenant-Slug`` request header.
  2. Ensure that tenant's database is available (pull from R2 / init fresh /
     register connection / migrate) via ``tenant_manager.ensure_tenant_db``.
  3. Publish the tenant's connection alias to the thread-local so the router
     points tenant-model queries at the right file.
  4. After the view runs, sync the (possibly modified) ``.db`` back to R2 and
     release the per-tenant lock — always, even on error.

Requests without a tenant header (e.g. global hostel search, auth) pass
straight through; tenant models simply aren't queried on those requests.
"""
import logging

from django.http import JsonResponse

from tenants import tenant_manager
from tenants.context import set_current_tenant, clear_current_tenant

logger = logging.getLogger("tenants.middleware")

TENANT_HEADER = "HTTP_X_TENANT_SLUG"  # Django's WSGI form of "X-Tenant-Slug".


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        slug = (request.META.get(TENANT_HEADER) or "").strip()
        request.tenant_slug = slug or None

        if not slug:
            # No tenant context for this request; nothing to set up.
            return self.get_response(request)

        try:
            alias = tenant_manager.ensure_tenant_db(slug)
        except Exception as exc:
            logger.exception("Failed to prepare tenant DB for '%s'", slug)
            return JsonResponse(
                {"detail": f"Could not load hostel workspace '{slug}': {exc}"},
                status=503,
            )

        set_current_tenant(alias)
        try:
            response = self.get_response(request)
        finally:
            # Sync back to R2 + release the lock, regardless of success/failure.
            try:
                tenant_manager.sync_tenant_db(slug)
            finally:
                clear_current_tenant()
        return response
