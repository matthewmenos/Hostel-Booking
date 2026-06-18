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
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants import tenant_manager
from .models import Room, BedSpace, TenantAnnouncement, CAPACITY_MAP, BED_LETTER
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

    def perform_create(self, serializer):
        self._check_manager()
        room = serializer.save()
        cap = CAPACITY_MAP.get(room.room_type, 1)
        beds = [
            BedSpace(room=room, bed_label=f"{room.room_number}{BED_LETTER[i]}")
            for i in range(cap)
        ]
        BedSpace.objects.using(self.request.tenant_slug and
            tenant_manager.tenant_db_alias(self.request.tenant_slug)
        ).bulk_create(beds)
        self._mark_dirty()


class BedSpaceViewSet(_TenantScopedViewSet):
    queryset = BedSpace.objects.all()
    serializer_class = BedSpaceSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_create(self, serializer):
        self._check_manager()
        room = serializer.validated_data["room"]
        cap = CAPACITY_MAP.get(room.room_type, 1)
        existing = BedSpace.objects.filter(room=room).count()
        if existing >= cap:
            raise ValidationError(
                f"This room type ({room.get_room_type_display()}) only allows {cap} bed(s). "
                f"All {cap} beds are already present."
            )
        serializer.save()
        self._mark_dirty()

    def perform_update(self, serializer):
        self._check_manager()
        instance = serializer.instance
        new_occupied = serializer.validated_data.get("is_occupied", instance.is_occupied)
        if instance.is_occupied and not new_occupied:
            serializer.save(is_occupied=False, occupant_ref=None, booking_ref=None)
        else:
            serializer.save()
        self._mark_dirty()


class AnnouncementViewSet(_TenantScopedViewSet):
    queryset = TenantAnnouncement.objects.all()
    serializer_class = TenantAnnouncementSerializer


class BulkBedCreateView(APIView):
    """
    POST /api/tenant/rooms/<room_id>/bulk-beds/
    Body: { "count": 10, "label_prefix": "Bed" }
    Creates count beds named "<label_prefix> 1", "<label_prefix> 2", …
    Requires manager role and X-Tenant-Slug header (resolved by TenantMiddleware).
    """

    def post(self, request, room_id):
        if not getattr(request, "tenant_slug", None):
            raise PermissionDenied("Missing X-Tenant-Slug header.")
        if not getattr(request.user, "is_manager", False):
            raise PermissionDenied("Only hostel managers may use bulk bed creation.")

        alias = tenant_manager.tenant_db_alias(request.tenant_slug)

        try:
            room = Room.objects.using(alias).get(pk=room_id)
        except Room.DoesNotExist:
            return Response({"detail": "Room not found."}, status=404)

        count = int(request.data.get("count", 0))
        prefix = request.data.get("label_prefix", "Bed").strip() or "Bed"
        cap = CAPACITY_MAP.get(room.room_type, 1)
        existing_count = BedSpace.objects.using(alias).filter(room=room).count()
        available_slots = cap - existing_count

        if available_slots <= 0:
            raise ValidationError(
                f"This room type ({room.get_room_type_display()}) is already at full capacity ({cap} beds)."
            )
        if count < 1 or count > available_slots:
            raise ValidationError(f"count must be between 1 and {available_slots} (remaining capacity).")

        existing_labels = set(
            BedSpace.objects.using(alias).filter(room=room).values_list("bed_label", flat=True)
        )

        created = []
        i = 1
        while len(created) < count:
            label = f"{prefix} {i}"
            if label not in existing_labels:
                bed = BedSpace.objects.using(alias).create(room=room, bed_label=label)
                created.append(bed)
                existing_labels.add(label)
            i += 1

        tenant_manager.mark_dirty(request.tenant_slug)
        return Response(BedSpaceSerializer(created, many=True).data, status=201)
