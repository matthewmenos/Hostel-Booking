"""
Tenant-scoped API: rooms, bed spaces, and announcements for a single hostel.

These endpoints operate on the PER-TENANT database. The active tenant is
resolved by ``TenantMiddleware`` from the ``X-Tenant-Slug`` request header, so
every request to these routes MUST include that header. Reads are open (so
students can view availability on the hostel detail page); writes require the
authenticated manager.

Because writes mutate the tenant ``.db``, each create/update flags it dirty via
``tenant_manager.mark_dirty`` so the middleware syncs it back to R2.
"""
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from tenants import tenant_manager
from .models import Room, BedSpace, TenantAnnouncement
from .serializers import (
    RoomSerializer,
    BedSpaceSerializer,
    TenantAnnouncementSerializer,
)


class _TenantScopedViewSet(viewsets.ModelViewSet):
    """Base class: requires a tenant header and marks the DB dirty on write."""

    permission_classes = [IsAuthenticatedOrReadOnly]

    def initial(self, request, *args, **kwargs):
        if not getattr(request, "tenant_slug", None):
            raise PermissionDenied(
                "Missing X-Tenant-Slug header; this resource is hostel-scoped."
            )
        super().initial(request, *args, **kwargs)

    def _check_manager(self):
        if not getattr(self.request.user, "is_manager", False):
            raise PermissionDenied("Only hostel managers may modify this resource.")

    def _mark_dirty(self):
        tenant_manager.mark_dirty(self.request.tenant_slug)

    def perform_create(self, serializer):
        self._check_manager()
        serializer.save()
        self._mark_dirty()

    def perform_update(self, serializer):
        self._check_manager()
        serializer.save()
        self._mark_dirty()

    def perform_destroy(self, instance):
        self._check_manager()
        instance.delete()
        self._mark_dirty()


class RoomViewSet(_TenantScopedViewSet):
    queryset = Room.objects.all().prefetch_related("beds")
    serializer_class = RoomSerializer


class BedSpaceViewSet(_TenantScopedViewSet):
    queryset = BedSpace.objects.all()
    serializer_class = BedSpaceSerializer


class AnnouncementViewSet(_TenantScopedViewSet):
    queryset = TenantAnnouncement.objects.all()
    serializer_class = TenantAnnouncementSerializer
