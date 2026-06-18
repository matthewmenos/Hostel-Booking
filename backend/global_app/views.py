"""
Global API: hostel discovery, hostel management, and the booking pipeline.

The booking pipeline is the one place that deliberately spans both databases:
it reserves a ``BedSpace`` in the hostel's PER-TENANT database and records the
authoritative ``GlobalBooking`` + ``Payment`` in the GLOBAL database. The
global write is the source of truth; the tenant write is the operational
side-effect (marking the physical bed occupied).
"""
import io
import json
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, filters
from rest_framework import viewsets, generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants import tenant_manager
from tenants.context import set_current_tenant, clear_current_tenant

from .models import (
    TenantHostel, HostelImage, GlobalBooking, Payment, PaymentProvider, PaymentStatus,
    ManagerVerification, VerificationStatus, Notification, NotifType,
)
from .serializers import (
    TenantHostelSerializer,
    HostelImageSerializer,
    GlobalBookingSerializer,
    CreateBookingSerializer,
    AdminUserSerializer,
    ManagerVerificationSerializer,
    ManagerVerificationAdminSerializer,
    NotificationSerializer,
)
from .notifications import notify, notify_many
from .permissions import IsManager, IsOwnerOrReadOnly, IsSuperAdmin
from . import payments as payment_gateway

logger = logging.getLogger("global_app.views")

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

    queryset = TenantHostel.objects.filter(is_active=True).prefetch_related("gallery")
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
        if not self.request.user.is_verified:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Complete identity verification before listing a hostel."
            )
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
# Manager: identity verification
# ---------------------------------------------------------------------------

class ManagerVerificationView(generics.GenericAPIView):
    """
    GET  — return the manager's existing verification record (404 if none).
    POST — create/update the verification record and initiate the GHS 5
           Paystack activation payment.
    """
    serializer_class = ManagerVerificationSerializer
    permission_classes = [IsManager]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        try:
            verif = ManagerVerification.objects.get(manager=request.user)
        except ManagerVerification.DoesNotExist:
            return Response({"detail": "No verification record found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ManagerVerificationSerializer(verif).data)

    def post(self, request):
        # If a record already exists (e.g. resubmission after rejection) update it.
        existing = ManagerVerification.objects.filter(manager=request.user).first()

        serializer = ManagerVerificationSerializer(
            existing, data=request.data, partial=bool(existing)
        )
        serializer.is_valid(raise_exception=True)

        verif = serializer.save(manager=request.user)

        # Initiate GHS 5 Paystack payment.
        import uuid
        import requests as http_requests
        from .payments import PAYSTACK_SECRET, _paystack_headers, PAYSTACK_BASE

        ref = f"verif_{uuid.uuid4().hex[:16]}"
        verif.payment_ref = ref
        verif.payment_confirmed = False
        verif.status = VerificationStatus.PENDING
        verif.save(update_fields=["payment_ref", "payment_confirmed", "status"])

        authorization_url = None
        if PAYSTACK_SECRET:
            try:
                resp = http_requests.post(
                    f"{PAYSTACK_BASE}/transaction/initialize",
                    headers=_paystack_headers(),
                    json={
                        "email": request.user.email,
                        "amount": 500,  # GHS 5 = 500 pesewas
                        "reference": ref,
                        "currency": "GHS",
                        "metadata": {
                            "type": "verification",
                            "manager_id": request.user.pk,
                            "verification_id": verif.pk,
                        },
                        "callback_url": f"{getattr(settings, 'FRONTEND_URL', '')}/manager/verification/callback",
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                resp_data = resp.json().get("data", {})
                authorization_url = resp_data.get("authorization_url")
            except Exception as exc:
                logger.error("Paystack verification payment init failed: %s", exc)
        else:
            # Stub: auto-confirm payment in dev mode so the flow can be tested.
            verif.payment_confirmed = True
            verif.save(update_fields=["payment_confirmed"])

        return Response({
            "verification": ManagerVerificationSerializer(verif).data,
            "authorization_url": authorization_url,
            "stub": not bool(PAYSTACK_SECRET),
        }, status=status.HTTP_201_CREATED)


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
        notify(
            hostel.owner,
            notif_type=NotifType.HOSTEL_ACTIVATED,
            title=f"{hostel.name} Reactivated",
            body="Your hostel listing has been reactivated and is visible to students.",
            link="/manager",
        )
        return Response(TenantHostelSerializer(hostel).data)


class AdminHostelDeactivateView(generics.GenericAPIView):
    """Deactivate a hostel (soft delete — hides from public listing)."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, slug):
        hostel = get_object_or_404(TenantHostel, slug=slug)
        hostel.is_active = False
        hostel.save(update_fields=["is_active"])
        notify(
            hostel.owner,
            notif_type=NotifType.HOSTEL_DEACTIVATED,
            title=f"{hostel.name} Deactivated",
            body="Your hostel listing has been deactivated by the admin and is no longer visible to students.",
            link="/manager",
        )
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


class AdminRefundBookingView(generics.GenericAPIView):
    """Mark a paid booking as refunded — superadmin only."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        booking = get_object_or_404(GlobalBooking, pk=pk)
        if booking.payment_status not in (PaymentStatus.PAID, PaymentStatus.PAID_AWAITING_APPROVAL):
            return Response(
                {"detail": "Only paid bookings can be marked refunded."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.payment_status = PaymentStatus.REFUNDED
        booking.save(update_fields=["payment_status"])

        notify(
            booking.student,
            notif_type=NotifType.BOOKING_CANCELLED,
            title="Booking Refunded",
            body=f"Your booking at {booking.hostel.name} has been refunded by the admin.",
            link="/dashboard",
        )

        return Response(GlobalBookingSerializer(booking).data)


# ---------------------------------------------------------------------------
# Admin: manager verification decisions
# ---------------------------------------------------------------------------

class AdminVerificationListView(generics.ListAPIView):
    """List all manager verification submissions — superadmin only."""

    permission_classes = [IsSuperAdmin]
    serializer_class = ManagerVerificationAdminSerializer
    queryset = ManagerVerification.objects.all().select_related("manager").order_by("-submitted_at")


class AdminVerificationDecideView(generics.GenericAPIView):
    """Approve or reject a manager verification — superadmin only."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk, action):
        verif = get_object_or_404(ManagerVerification, pk=pk)

        if action == "approve":
            verif.status = VerificationStatus.APPROVED
            verif.rejection_reason = ""
            verif.reviewed_at = timezone.now()
            verif.save(update_fields=["status", "rejection_reason", "reviewed_at"])
            verif.manager.is_verified = True
            verif.manager.save(update_fields=["is_verified"])
            notify(
                verif.manager,
                notif_type=NotifType.VERIF_APPROVED,
                title="Identity Verification Approved!",
                body="Your identity has been verified. You can now list hostels on HostelHub.",
                link="/manager",
            )

        elif action == "reject":
            reason = request.data.get("rejection_reason", "").strip()
            if not reason:
                return Response(
                    {"detail": "rejection_reason is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            verif.status = VerificationStatus.REJECTED
            verif.rejection_reason = reason
            verif.reviewed_at = timezone.now()
            verif.save(update_fields=["status", "rejection_reason", "reviewed_at"])
            verif.manager.is_verified = False
            verif.manager.save(update_fields=["is_verified"])
            notify(
                verif.manager,
                notif_type=NotifType.VERIF_REJECTED,
                title="Identity Verification Rejected",
                body=f"Your verification was rejected. Reason: {reason}",
                link="/manager/verification",
            )

        else:
            return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ManagerVerificationAdminSerializer(verif).data)


# ---------------------------------------------------------------------------
# Paystack webhook
# ---------------------------------------------------------------------------

class PaystackWebhookView(APIView):
    """
    Receive Paystack charge.success events.

    Verifies the HMAC-SHA512 signature, matches the payment by reference,
    and advances the booking to paid_awaiting_approval.
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # no JWT needed — webhook is server-to-server

    def post(self, request):
        signature = request.META.get("HTTP_X_PAYSTACK_SIGNATURE", "")
        if not payment_gateway.verify_paystack_signature(request.body, signature):
            return HttpResponse(status=400)

        try:
            event = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponse(status=400)

        if event.get("event") != "charge.success":
            return HttpResponse(status=200)  # acknowledge but ignore other events

        data = event.get("data", {})
        reference = data.get("reference", "")
        metadata = data.get("metadata") or {}

        # Verification activation payment.
        if metadata.get("type") == "verification":
            try:
                verif = ManagerVerification.objects.get(
                    pk=metadata["verification_id"], payment_ref=reference
                )
                verif.payment_confirmed = True
                verif.save(update_fields=["payment_confirmed"])
                logger.info("Webhook: verification #%s payment confirmed", verif.pk)
            except (ManagerVerification.DoesNotExist, KeyError):
                logger.warning("Webhook: verification not found for reference %s", reference)
            return HttpResponse(status=200)

        # Regular booking payment.
        payment = Payment.objects.filter(reference=reference).select_related(
            "booking__hostel__owner", "booking__student"
        ).first()

        if not payment:
            logger.warning("Webhook: no payment found for reference %s", reference)
            return HttpResponse(status=200)

        booking = payment.booking

        if booking.payment_status != PaymentStatus.PENDING:
            return HttpResponse(status=200)  # already processed

        payment.status = PaymentStatus.PAID_AWAITING_APPROVAL
        payment.save(update_fields=["status"])

        booking.payment_status = PaymentStatus.PAID_AWAITING_APPROVAL
        booking.save(update_fields=["payment_status"])

        # Send confirmation email to student.
        _send_booking_confirmation(booking, payment)

        # Notify hostel manager that a student has paid.
        notify(
            booking.hostel.owner,
            notif_type=NotifType.BOOKING_PAID,
            title="New Booking Payment Received",
            body=f"{booking.student.get_full_name() or booking.student.username} paid GHS {payment.amount} for a bed at {booking.hostel.name}.",
            link="/manager",
        )

        logger.info("Webhook: booking #%s moved to paid_awaiting_approval", booking.pk)
        return HttpResponse(status=200)


def _send_booking_confirmation(booking, payment):
    student = booking.student
    name = student.get_full_name() or student.username
    try:
        send_mail(
            subject=f"Booking #{booking.pk} confirmed — HostelHub Ghana",
            message=(
                f"Hi {name},\n\n"
                f"Your payment of GHS {payment.amount} for a bed at {booking.hostel.name} "
                f"has been received.\n\n"
                f"Booking ID: #{booking.pk}\n"
                f"Room type: {booking.room_type}\n"
                f"Reference: {payment.reference}\n\n"
                f"Your booking is now awaiting admin approval. "
                f"You will be notified once it is approved.\n\n"
                f"— HostelHub Ghana"
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@hostelhub.gh"),
            recipient_list=[student.email],
            fail_silently=True,
        )
    except Exception as exc:
        logger.error("Failed to send booking confirmation email: %s", exc)


# ---------------------------------------------------------------------------
# Admin: approve booking + payout
# ---------------------------------------------------------------------------

class AdminApproveBookingView(generics.GenericAPIView):
    """
    Approve a paid-awaiting-approval booking and initiate manager payout.

    1. Validates booking is in paid_awaiting_approval state.
    2. Calls payment_gateway.initiate_payout() → Paystack Transfer API.
    3. Advances booking to paid (fully approved).
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        booking = get_object_or_404(
            GlobalBooking.objects.select_related("hostel__owner").prefetch_related("payments"),
            pk=pk,
        )
        if booking.payment_status != PaymentStatus.PAID_AWAITING_APPROVAL:
            return Response(
                {"detail": "Booking must be in paid_awaiting_approval state to approve."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = booking.payments.order_by("-created_at").first()
        if not payment:
            return Response({"detail": "No payment record found."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payout_result = payment_gateway.initiate_payout(payment)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        booking.payment_status = PaymentStatus.PAID
        booking.approved_at = timezone.now()
        booking.save(update_fields=["payment_status", "approved_at"])

        payment.status = PaymentStatus.PAID
        payment.save(update_fields=["status"])

        notify(
            booking.student,
            notif_type=NotifType.BOOKING_APPROVED,
            title="Booking Approved!",
            body=f"Your booking at {booking.hostel.name} has been approved and your bed is confirmed.",
            link="/dashboard",
        )

        return Response({
            "booking": GlobalBookingSerializer(booking).data,
            "payout": payout_result,
        })


# ---------------------------------------------------------------------------
# Hostel image gallery
# ---------------------------------------------------------------------------

class HostelImageListView(generics.ListCreateAPIView):
    """List gallery images for a hostel; managers upload new ones."""

    serializer_class = HostelImageSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticatedOrReadOnly()]
        return [IsManager()]

    def get_queryset(self):
        hostel = get_object_or_404(TenantHostel, slug=self.kwargs["slug"])
        return hostel.gallery.all()

    def perform_create(self, serializer):
        hostel = get_object_or_404(TenantHostel, slug=self.kwargs["slug"])
        if hostel.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not own this hostel.")
        serializer.save(hostel=hostel)


class HostelImageDeleteView(generics.DestroyAPIView):
    """Delete a single gallery image — owner manager only."""

    serializer_class = HostelImageSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        return HostelImage.objects.filter(hostel__owner=self.request.user)


# ---------------------------------------------------------------------------
# Booking receipt (plain-text — PDF needs reportlab which may not be installed)
# ---------------------------------------------------------------------------

class BookingReceiptView(APIView):
    """
    Return a downloadable text receipt for a paid or approved booking.
    The frontend triggers a browser download by setting Content-Disposition.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        booking = get_object_or_404(
            GlobalBooking.objects.select_related("hostel", "student").prefetch_related("payments"),
            pk=pk,
            student=request.user,
        )
        if booking.payment_status not in (
            PaymentStatus.PAID_AWAITING_APPROVAL, PaymentStatus.PAID
        ):
            return Response(
                {"detail": "Receipt is only available for paid bookings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = booking.payments.order_by("-created_at").first()
        student = booking.student
        name = student.get_full_name() or student.username

        try:
            from reportlab.pdfgen import canvas as rl_canvas
            from reportlab.lib.pagesizes import A4
            buf = io.BytesIO()
            c = rl_canvas.Canvas(buf, pagesize=A4)
            w, h = A4
            c.setFont("Helvetica-Bold", 18)
            c.drawString(50, h - 60, "HostelHub Ghana — Booking Receipt")
            c.setFont("Helvetica", 12)
            lines = [
                f"Booking ID:   #{booking.pk}",
                f"Date:         {booking.created_at.strftime('%d %B %Y')}",
                f"Student:      {name} ({student.email})",
                f"Hostel:       {booking.hostel.name}",
                f"Campus:       {booking.hostel.get_campus_display()}",
                f"Room type:    {booking.room_type}",
                f"Amount paid:  GHS {booking.amount}",
                f"Reference:    {payment.reference if payment else 'N/A'}",
                f"Status:       {booking.get_payment_status_display()}",
            ]
            y = h - 110
            for line in lines:
                c.drawString(50, y, line)
                y -= 24
            c.setFont("Helvetica-Oblique", 10)
            c.drawString(50, 60, "Thank you for booking with HostelHub Ghana.")
            c.save()
            buf.seek(0)
            response = HttpResponse(buf, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="receipt_booking_{booking.pk}.pdf"'
            return response
        except ImportError:
            pass

        # Plain-text fallback when reportlab is not installed.
        lines = [
            "HostelHub Ghana — Booking Receipt",
            "=" * 40,
            f"Booking ID:   #{booking.pk}",
            f"Date:         {booking.created_at.strftime('%d %B %Y')}",
            f"Student:      {name} ({student.email})",
            f"Hostel:       {booking.hostel.name}",
            f"Campus:       {booking.hostel.get_campus_display()}",
            f"Room type:    {booking.room_type}",
            f"Amount paid:  GHS {booking.amount}",
            f"Reference:    {payment.reference if payment else 'N/A'}",
            f"Status:       {booking.get_payment_status_display()}",
            "",
            "Thank you for booking with HostelHub Ghana.",
        ]
        content = "\n".join(lines)
        response = HttpResponse(content, content_type="text/plain")
        response["Content-Disposition"] = f'attachment; filename="receipt_booking_{booking.pk}.txt"'
        return response


# ---------------------------------------------------------------------------
# Manager analytics
# ---------------------------------------------------------------------------

class ManagerAnalyticsView(APIView):
    """
    Returns occupancy stats, revenue totals, and monthly booking trends
    for all hostels owned by the current manager.
    """
    permission_classes = [IsManager]

    def get(self, request):
        hostels = TenantHostel.objects.filter(owner=request.user)
        hostel_slugs = list(hostels.values_list("slug", flat=True))

        paid_statuses = [PaymentStatus.PAID_AWAITING_APPROVAL, PaymentStatus.PAID]

        # Total revenue (paid bookings only).
        revenue_qs = GlobalBooking.objects.filter(
            hostel__in=hostels, payment_status__in=paid_statuses
        ).aggregate(total=Sum("amount"))
        total_revenue = float(revenue_qs["total"] or 0)

        # Total bookings by status.
        status_counts = (
            GlobalBooking.objects.filter(hostel__in=hostels)
            .values("payment_status")
            .annotate(count=Count("id"))
        )
        by_status = {row["payment_status"]: row["count"] for row in status_counts}

        # Monthly revenue for the last 12 months.
        twelve_months_ago = timezone.now() - timedelta(days=365)
        monthly = (
            GlobalBooking.objects.filter(
                hostel__in=hostels,
                payment_status__in=paid_statuses,
                created_at__gte=twelve_months_ago,
            )
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(revenue=Sum("amount"), bookings=Count("id"))
            .order_by("month")
        )
        monthly_data = [
            {
                "month": row["month"].strftime("%b %Y"),
                "revenue": float(row["revenue"] or 0),
                "bookings": row["bookings"],
            }
            for row in monthly
        ]

        # Per-hostel stats (we get bed counts from the global booking table
        # since per-tenant DBs are not queried here).
        hostel_stats = []
        for h in hostels:
            h_bookings = GlobalBooking.objects.filter(hostel=h)
            h_paid = h_bookings.filter(payment_status__in=paid_statuses).count()
            h_revenue = float(
                h_bookings.filter(payment_status__in=paid_statuses)
                .aggregate(t=Sum("amount"))["t"] or 0
            )
            hostel_stats.append({
                "slug": h.slug,
                "name": h.name,
                "total_capacity": h.total_capacity,
                "paid_bookings": h_paid,
                "revenue": h_revenue,
                "occupancy_pct": round(h_paid / h.total_capacity * 100, 1) if h.total_capacity else 0,
            })

        return Response({
            "total_revenue": total_revenue,
            "by_status": by_status,
            "monthly": monthly_data,
            "hostels": hostel_stats,
        })


# ---------------------------------------------------------------------------
# Admin: verify hostel
# ---------------------------------------------------------------------------

class AdminVerifyHostelView(generics.GenericAPIView):
    """Toggle verified badge on a hostel — superadmin only."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, slug):
        hostel = get_object_or_404(TenantHostel, slug=slug)
        hostel.is_verified = not hostel.is_verified
        hostel.save(update_fields=["is_verified"])
        if hostel.is_verified:
            notify(
                hostel.owner,
                notif_type=NotifType.HOSTEL_VERIFIED,
                title=f"{hostel.name} is now Verified",
                body="Your hostel has been granted the verified badge by the admin.",
                link="/manager",
            )
        return Response(TenantHostelSerializer(hostel).data)


# ---------------------------------------------------------------------------
# Admin: platform-wide overview stats
# ---------------------------------------------------------------------------

class AdminOverviewView(APIView):
    """Platform-wide KPI snapshot — superadmin only."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        paid_statuses = [PaymentStatus.PAID_AWAITING_APPROVAL, PaymentStatus.PAID]
        twelve_months_ago = timezone.now() - timedelta(days=365)

        total_users    = User.objects.count()
        total_students = User.objects.filter(role="student").count()
        total_managers = User.objects.filter(role="manager").count()
        total_hostels  = TenantHostel.objects.count()
        active_hostels = TenantHostel.objects.filter(is_active=True).count()

        total_bookings  = GlobalBooking.objects.count()
        paid_bookings   = GlobalBooking.objects.filter(payment_status__in=paid_statuses).count()
        pending_bookings = GlobalBooking.objects.filter(payment_status=PaymentStatus.PENDING).count()
        awaiting_approval = GlobalBooking.objects.filter(
            payment_status=PaymentStatus.PAID_AWAITING_APPROVAL
        ).count()

        total_revenue = float(
            GlobalBooking.objects.filter(payment_status__in=paid_statuses)
            .aggregate(t=Sum("amount"))["t"] or 0
        )
        pending_revenue = float(
            GlobalBooking.objects.filter(payment_status=PaymentStatus.PAID_AWAITING_APPROVAL)
            .aggregate(t=Sum("amount"))["t"] or 0
        )

        # Monthly bookings + revenue (last 12 months).
        monthly = (
            GlobalBooking.objects.filter(
                payment_status__in=paid_statuses,
                created_at__gte=twelve_months_ago,
            )
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(revenue=Sum("amount"), bookings=Count("id"))
            .order_by("month")
        )
        monthly_data = [
            {
                "month": row["month"].strftime("%b %Y"),
                "revenue": float(row["revenue"] or 0),
                "bookings": row["bookings"],
            }
            for row in monthly
        ]

        # New users in the last 30 days.
        thirty_days_ago = timezone.now() - timedelta(days=30)
        new_users_30d = User.objects.filter(date_joined__gte=thirty_days_ago).count()

        # Top 5 hostels by revenue.
        top_hostels = (
            GlobalBooking.objects.filter(payment_status__in=paid_statuses)
            .values("hostel__name", "hostel__slug")
            .annotate(revenue=Sum("amount"), bookings=Count("id"))
            .order_by("-revenue")[:5]
        )

        return Response({
            "users": {
                "total": total_users,
                "students": total_students,
                "managers": total_managers,
                "new_last_30d": new_users_30d,
            },
            "hostels": {
                "total": total_hostels,
                "active": active_hostels,
            },
            "bookings": {
                "total": total_bookings,
                "paid": paid_bookings,
                "pending": pending_bookings,
                "awaiting_approval": awaiting_approval,
            },
            "revenue": {
                "total": total_revenue,
                "pending_approval": pending_revenue,
            },
            "monthly": monthly_data,
            "top_hostels": list(top_hostels),
        })


# ---------------------------------------------------------------------------
# Admin: Paystack balance + transfer history
# ---------------------------------------------------------------------------

class AdminPaystackBalanceView(APIView):
    """Fetch the platform's current Paystack balance — superadmin only."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        import requests as http_requests
        from .payments import PAYSTACK_SECRET, _paystack_headers, PAYSTACK_BASE
        if not PAYSTACK_SECRET:
            return Response({"detail": "Paystack not configured.", "stub": True, "balances": []})
        try:
            resp = http_requests.get(
                f"{PAYSTACK_BASE}/balance",
                headers=_paystack_headers(),
                timeout=10,
            )
            resp.raise_for_status()
            return Response(resp.json().get("data", []))
        except Exception as exc:
            logger.error("Paystack balance fetch failed: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class AdminPaystackTransfersView(APIView):
    """List all transfers made from the platform balance — superadmin only."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        import requests as http_requests
        from .payments import PAYSTACK_SECRET, _paystack_headers, PAYSTACK_BASE
        if not PAYSTACK_SECRET:
            # Return local Payment records that have transfer data.
            transfers = Payment.objects.exclude(transfer_code="").select_related(
                "booking__hostel__owner", "booking__student"
            ).order_by("-created_at")[:50]
            data = [
                {
                    "transfer_code": p.transfer_code,
                    "reference":     p.transfer_reference,
                    "amount":        float(p.manager_payout or 0),
                    "commission":    float(p.platform_commission or 0),
                    "manager":       p.booking.hostel.owner.username,
                    "hostel":        p.booking.hostel.name,
                    "booking_id":    p.booking.pk,
                    "stub":          True,
                }
                for p in transfers
            ]
            return Response(data)

        page = request.query_params.get("page", 1)
        perPage = request.query_params.get("perPage", 50)
        try:
            resp = http_requests.get(
                f"{PAYSTACK_BASE}/transfer",
                headers=_paystack_headers(),
                params={"page": page, "perPage": perPage},
                timeout=15,
            )
            resp.raise_for_status()
            return Response(resp.json())
        except Exception as exc:
            logger.error("Paystack transfers fetch failed: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


# ---------------------------------------------------------------------------
# Admin: manager payout recipient management
# ---------------------------------------------------------------------------

class AdminManagerListView(generics.ListAPIView):
    """List all managers with their payout recipient codes — superadmin only."""

    permission_classes = [IsSuperAdmin]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return User.objects.filter(role="manager").order_by("username")


class AdminSetRecipientView(generics.GenericAPIView):
    """Set or clear a manager's Paystack recipient code — superadmin only."""

    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        manager = get_object_or_404(User, pk=pk, role="manager")
        code = request.data.get("paystack_recipient_code", "").strip()
        manager.paystack_recipient_code = code
        manager.save(update_fields=["paystack_recipient_code"])
        return Response(AdminUserSerializer(manager).data)


# ---------------------------------------------------------------------------
# Admin: platform settings (read from / write to env-backed Django settings)
# ---------------------------------------------------------------------------

class AdminSettingsView(APIView):
    """
    GET  — return current platform settings.
    PATCH — update in-memory settings for this process lifetime.

    NOTE: Persisting settings across deploys requires updating the Render
    environment variables. The PATCH here gives instant effect for the current
    process and returns the updated values so the UI can reflect them.
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response(self._current())

    def patch(self, request):
        allowed = {"PLATFORM_NAME", "PLATFORM_CONTACT_EMAIL", "PLATFORM_COMMISSION_RATE"}
        updated = {}
        for key, value in request.data.items():
            if key not in allowed:
                continue
            if key == "PLATFORM_COMMISSION_RATE":
                try:
                    value = float(value)
                    if not (0 <= value <= 1):
                        return Response(
                            {"detail": "PLATFORM_COMMISSION_RATE must be between 0 and 1."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                except (TypeError, ValueError):
                    return Response(
                        {"detail": "PLATFORM_COMMISSION_RATE must be a number."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            setattr(settings, key, value)
            # Also update the payments module constant so new payouts use the new rate.
            if key == "PLATFORM_COMMISSION_RATE":
                import global_app.payments as _pm
                _pm.COMMISSION_RATE = float(value)
            updated[key] = value

        return Response({**self._current(), "updated": list(updated.keys())})

    @staticmethod
    def _current():
        from global_app.payments import COMMISSION_RATE
        return {
            "PLATFORM_NAME":           getattr(settings, "PLATFORM_NAME", "HostelHub Ghana"),
            "PLATFORM_CONTACT_EMAIL":  getattr(settings, "PLATFORM_CONTACT_EMAIL", ""),
            "PLATFORM_COMMISSION_RATE": COMMISSION_RATE,
            "PAYSTACK_CONFIGURED":     bool(getattr(settings, "R2_ENABLED", False) or
                                            __import__("os").getenv("PAYSTACK_SECRET_KEY")),
            "R2_ENABLED":              getattr(settings, "R2_ENABLED", False),
            "DEBUG":                   getattr(settings, "DEBUG", False),
            "ADMIN_USERNAME":          __import__("os").getenv("ADMIN_USERNAME", ""),
            "ADMIN_EMAIL":             __import__("os").getenv("ADMIN_EMAIL", ""),
        }


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationListView(generics.ListAPIView):
    """Return the current user's notifications, newest first."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        notif_type = self.request.query_params.get("type")
        if notif_type:
            qs = qs.filter(notif_type=notif_type)
        unread = self.request.query_params.get("unread")
        if unread == "1":
            qs = qs.filter(is_read=False)
        return qs


class NotificationUnreadCountView(APIView):
    """Lightweight endpoint for the bell badge count."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({"count": count})


class NotificationMarkReadView(generics.GenericAPIView):
    """Mark a single notification as read."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if not notif.is_read:
            notif.is_read = True
            notif.save(update_fields=["is_read"])
        return Response({"id": notif.pk, "is_read": True})


class NotificationMarkAllReadView(APIView):
    """Mark all of the current user's unread notifications as read."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"marked_read": updated})


class SendNotificationView(APIView):
    """
    Manager sends a message to their hostel tenants.

    Body: { type: "broadcast"|"direct", hostel_slug, title, body, student_id? }
    """

    permission_classes = [IsManager]

    def post(self, request):
        msg_type   = request.data.get("type", "broadcast")
        hostel_slug = request.data.get("hostel_slug", "")
        title      = request.data.get("title", "").strip()
        body       = request.data.get("body", "").strip()
        student_id = request.data.get("student_id")

        if not title:
            return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)

        hostel = get_object_or_404(TenantHostel, slug=hostel_slug, owner=request.user)

        paid_statuses = [PaymentStatus.PAID_AWAITING_APPROVAL, PaymentStatus.PAID]

        if msg_type == "broadcast":
            student_ids = GlobalBooking.objects.filter(
                hostel=hostel, payment_status__in=paid_statuses
            ).values_list("student_id", flat=True).distinct()
            recipients = User.objects.filter(pk__in=student_ids)
            notify_many(
                recipients,
                notif_type=NotifType.MSG_BROADCAST,
                title=title,
                body=body,
                sender=request.user,
                link="/dashboard",
            )
            return Response({"sent_to": recipients.count()})

        elif msg_type == "direct":
            if not student_id:
                return Response({"detail": "student_id is required for direct messages."}, status=status.HTTP_400_BAD_REQUEST)
            # Verify the student is booked at this hostel.
            booked = GlobalBooking.objects.filter(
                hostel=hostel,
                student_id=student_id,
                payment_status__in=paid_statuses,
            ).exists()
            if not booked:
                return Response({"detail": "Student has no active booking at this hostel."}, status=status.HTTP_400_BAD_REQUEST)
            recipient = get_object_or_404(User, pk=student_id)
            notify(
                recipient,
                notif_type=NotifType.MSG_DIRECT,
                title=title,
                body=body,
                sender=request.user,
                link="/dashboard",
            )
            return Response({"sent_to": 1})

        return Response({"detail": "type must be 'broadcast' or 'direct'."}, status=status.HTTP_400_BAD_REQUEST)


class SendReportView(APIView):
    """
    Student reports a maintenance/problem issue.
    Auto-detects their hostel from the latest active booking.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        title = request.data.get("title", "").strip()
        body  = request.data.get("body", "").strip()

        if not title:
            return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)

        paid_statuses = [PaymentStatus.PAID_AWAITING_APPROVAL, PaymentStatus.PAID]
        booking = (
            GlobalBooking.objects.filter(
                student=request.user, payment_status__in=paid_statuses
            )
            .select_related("hostel__owner")
            .order_by("-created_at")
            .first()
        )
        if not booking:
            return Response(
                {"detail": "No active booking found. You can only report issues for hostels you are currently booked at."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        manager = booking.hostel.owner
        sender_name = request.user.get_full_name() or request.user.username
        notify(
            manager,
            notif_type=NotifType.REPORT,
            title=f"Maintenance Report: {title}",
            body=f"From {sender_name} ({booking.hostel.name}): {body}",
            sender=request.user,
            link="/manager",
        )
        return Response({"detail": "Report submitted successfully."})
