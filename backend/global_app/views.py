"""
Global API: hostel discovery, hostel management, and the booking pipeline.

The booking pipeline is the one place that deliberately spans both databases:
it reserves a ``BedSpace`` in the hostel's PER-TENANT database and records the
authoritative ``GlobalBooking`` + ``Payment`` in the GLOBAL database. The
global write is the source of truth; the tenant write is the operational
side-effect (marking the physical bed occupied).
"""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, filters
from rest_framework import viewsets, generics, status
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from tenants import tenant_manager
from tenants.context import set_current_tenant, clear_current_tenant

from .models import TenantHostel, GlobalBooking, Payment, PaymentProvider
from .serializers import (
    TenantHostelSerializer,
    GlobalBookingSerializer,
    CreateBookingSerializer,
)
from .permissions import IsManager, IsOwnerOrReadOnly
from . import payments as payment_gateway

# A pending reservation is held for this long before it may be expired.
RESERVATION_TTL = timedelta(minutes=30)


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
        return GlobalBooking.objects.filter(student=self.request.user)


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
        bed = (
            BedSpace.objects.select_related("room")
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

        provider = data["provider"]

        # The authoritative records (booking + payment) are written atomically
        # to the GLOBAL database. The tenant bed flag is updated alongside; if
        # the global transaction fails, we roll back the bed too.
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

            # Mark the physical bed occupied in the tenant DB.
            bed.is_occupied = True
            bed.occupant_ref = request.user.id
            bed.booking_ref = booking.pk
            bed.save(using=tenant_manager.tenant_db_alias(hostel.slug))
            tenant_manager.mark_dirty(hostel.slug)

        gateway_response = payment_gateway.initiate_payment(payment)

        return Response(
            {
                "booking": GlobalBookingSerializer(booking).data,
                "payment": gateway_response,
            },
            status=status.HTTP_201_CREATED,
        )
