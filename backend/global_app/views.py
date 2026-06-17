"""
Global API: hostel discovery, hostel management, and the booking pipeline.

The booking pipeline is the one place that deliberately spans both databases:
it reserves a ``BedSpace`` in the hostel's PER-TENANT database and records the
authoritative ``GlobalBooking`` + ``Payment`` in the GLOBAL database. The
global write is the source of truth; the tenant write is the operational
side-effect (marking the physical bed occupied).
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, filters
from rest_framework import viewsets, generics, status
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from tenants import tenant_manager
from tenants.context import set_current_tenant, clear_current_tenant

from .models import TenantHostel, GlobalBooking, Payment, PaymentProvider, PaymentStatus
from .serializers import (
    TenantHostelSerializer,
    GlobalBookingSerializer,
    CreateBookingSerializer,
    AdminUserSerializer,
)
from .permissions import IsManager, IsOwnerOrReadOnly, IsSuperAdmin
from . import payments as payment_gateway

# A pending reservation is held for this long before it may be expired.
RESERVATION_TTL = timedelta(minutes=30)

User = get_user_model()


class HostelFilter(FilterSet):
    """Discovery filters: campus, price range, and amenity presence."""

    min_price = filters.NumberFilter(field_name="base_price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="base_price", lookup_expr="lte")

    class Meta:
        model = TenantHostel
        fields = ["campus", "min_price", "max_price"]


class HostelViewSet(viewsets.ModelViewSet):
    """
    Public: list/retrieve hostels (with campus/price filtering).
    Managers: create/update their own hostels.
    """

    queryset = TenantHostel.objects.filter(is_active=True)
    serializer_class = TenantHostelSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_class = HostelFilter
    lookup_field = "slug"

    def get_permissions(self):
        # Only managers may create a hostel listing.
        if self.action == "create":
            return [IsManager()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class MyHostelsView(generics.ListAPIView):
    """Manager dashboard: the hostels owned by the current user."""

    serializer_class = TenantHostelSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        return TenantHostel.objects.filter(owner=self.request.user)


class BookingViewSet(viewsets.ReadOnlyModelViewSet):
    """A student's own bookings (with nested payment status)."""

    serializer_class = GlobalBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return GlobalBooking.objects.filter(
            student=self.request.user
        ).prefetch_related("payments")


class CancelBookingView(generics.GenericAPIView):
    """Cancel a pending booking and free the reserved bed."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(GlobalBooking, pk=pk, student=request.user)

        if booking.payment_status != PaymentStatus.PENDING:
            return Response(
                {"detail": "Only pending bookings can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Free the bed in the tenant DB, mirroring the CreateBookingView pattern.
        if booking.bed_space_ref:
            from tenants.models import BedSpace
            alias = tenant_manager.ensure_tenant_db(booking.hostel.slug)
            set_current_tenant(alias)
            try:
                with transaction.atomic(using=alias):
                    bed = (
                        BedSpace.objects.using(alias)
                        .select_for_update()
                        .filter(pk=booking.bed_space_ref)
                        .first()
                    )
                    if bed:
                        bed.is_occupied = False
                        bed.occupant_ref = None
                        bed.booking_ref = None
                        bed.save(using=alias)
                        tenant_manager.mark_dirty(booking.hostel.slug)
            finally:
                tenant_manager.sync_tenant_db(booking.hostel.slug)
                clear_current_tenant()

        booking.payment_status = PaymentStatus.EXPIRED
        booking.save(update_fields=["payment_status"])
        return Response(GlobalBookingSerializer(booking).data)


class CreateBookingView(generics.GenericAPIView):
    """
    Booking pipeline endpoint.

    Steps (atomic on the global DB):
      1. Resolve the hostel + activate its tenant database.
      2. Reserve the requested BedSpace in the tenant DB (guard against
         double-booking via a row-level check).
      3. Create the authoritative GlobalBooking (status=pending, with expiry).
      4. Create a pending Payment and initiate it with the chosen provider.
    """

    serializer_class = CreateBookingSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        hostel = self._get_hostel(data["hostel"])
        if hostel is None:
            return Response({"detail": "Hostel not found."}, status=404)

        # Import here to avoid loading tenant models before app registry is ready.
        from tenants.models import BedSpace

        # Activate the tenant DB for this hostel so tenant-model queries route
        # to the right file. We manage it manually here (rather than relying on
        # the X-Tenant-Slug header) because booking is a global endpoint.
        alias = tenant_manager.ensure_tenant_db(hostel.slug)
        set_current_tenant(alias)
        try:
            return self._reserve(request, hostel, data, BedSpace)
        finally:
            tenant_manager.sync_tenant_db(hostel.slug)
            clear_current_tenant()

    def _get_hostel(self, slug):
        return TenantHostel.objects.filter(slug=slug, is_active=True).first()

    def _reserve(self, request, hostel, data, BedSpace):
        provider = data["provider"]
        tenant_alias = tenant_manager.tenant_db_alias(hostel.slug)

        # Lock the bed row first so two concurrent requests cannot both pass the
        # is_occupied check before either one commits (TOCTOU double-booking).
        with transaction.atomic(using=tenant_alias):
            bed = (
                BedSpace.objects.using(tenant_alias)
                .select_related("room")
                .select_for_update()
                .filter(pk=data["bed_space_id"])
                .first()
            )
            if bed is None:
                return Response({"detail": "Bed space not found."}, status=404)
            if bed.is_occupied:
                return Response(
                    {"detail": "That bed space is already taken."},
                    status=status.HTTP_409_CONFLICT,
                )

            # Write the authoritative booking + payment to the global DB, then
            # flag the bed occupied in the tenant DB — all within the same scope
            # so a global-DB failure still rolls back the bed lock.
            with transaction.atomic(using="default"):
                booking = GlobalBooking.objects.create(
                    student=request.user,
                    hostel=hostel,
                    room_type=bed.room.room_type,
                    bed_space_ref=bed.pk,
                    amount=hostel.base_price,
                    expiry_timestamp=timezone.now() + RESERVATION_TTL,
                )
                payment = Payment.objects.create(
                    booking=booking,
                    provider=provider,
                    amount=hostel.base_price,
                )

            bed.is_occupied = True
            bed.occupant_ref = request.user.id
            bed.booking_ref = booking.pk
            bed.save(using=tenant_alias)
            tenant_manager.mark_dirty(hostel.slug)

        gateway_response = payment_gateway.initiate_payment(payment)

        return Response(
            {
                "booking": GlobalBookingSerializer(booking).data,
                "payment": gateway_response,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Manager views
# ---------------------------------------------------------------------------

class ManagerBookingsView(generics.ListAPIView):
    """All bookings for hostels owned by the current manager."""

    serializer_class = GlobalBookingSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        qs = GlobalBooking.objects.filter(
            hostel__owner=self.request.user
        ).select_related("hostel", "student").prefetch_related("payments")
        hostel_slug = self.request.query_params.get("hostel")
        if hostel_slug:
            qs = qs.filter(hostel__slug=hostel_slug)
        return qs


# ---------------------------------------------------------------------------
# Superadmin views
# ---------------------------------------------------------------------------

class AdminUserListView(generics.ListAPIView):
    """List all users — superadmin only."""

    serializer_class = AdminUserSerializer
    permission_classes = [IsSuperAdmin]
    queryset = User.objects.all().order_by("date_joined")


class AdminUserUpdateView(generics.UpdateAPIView):
    """Partial-update a user's role or active status — superadmin only."""

    serializer_class = AdminUserSerializer
    permission_classes = [IsSuperAdmin]
    queryset = User.objects.all()
    http_method_names = ["patch"]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class AdminHostelListView(generics.ListAPIView):
    """All hostels including inactive — superadmin only."""

    serializer_class = TenantHostelSerializer
    permission_classes = [IsSuperAdmin]
    queryset = TenantHostel.objects.all().select_related("owner")


class AdminHostelActivateView(generics.GenericAPIView):
    """Reactivate a deactivated hostel."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, slug):
        hostel = get_object_or_404(TenantHostel, slug=slug)
        hostel.is_active = True
        hostel.save(update_fields=["is_active"])
        return Response(TenantHostelSerializer(hostel).data)


class AdminHostelDeactivateView(generics.GenericAPIView):
    """Deactivate a hostel (soft delete — hides from public listing)."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, slug):
        hostel = get_object_or_404(TenantHostel, slug=slug)
        hostel.is_active = False
        hostel.save(update_fields=["is_active"])
        return Response(TenantHostelSerializer(hostel).data)


class AdminBookingsView(generics.ListAPIView):
    """All bookings across the platform — superadmin only."""

    serializer_class = GlobalBookingSerializer
    permission_classes = [IsSuperAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["payment_status"]

    def get_queryset(self):
        return GlobalBooking.objects.all().select_related(
            "hostel", "student"
        ).prefetch_related("payments")
