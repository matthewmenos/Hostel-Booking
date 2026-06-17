"""
Management command: expire_bookings

Finds all GlobalBooking rows that are:
  - still in PENDING status
  - past their expiry_timestamp

For each one it frees the reserved BedSpace in the tenant DB (same pattern as
CancelBookingView) then flips payment_status → EXPIRED.

Run via cron or Render's cron job feature:
    python manage.py expire_bookings
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from global_app.models import GlobalBooking, PaymentStatus
from tenants import tenant_manager
from tenants.context import set_current_tenant, clear_current_tenant


class Command(BaseCommand):
    help = "Expire pending bookings whose reservation window has passed."

    def handle(self, *args, **options):
        now = timezone.now()
        expired_qs = GlobalBooking.objects.filter(
            payment_status=PaymentStatus.PENDING,
            expiry_timestamp__lt=now,
        ).select_related("hostel")

        count = 0
        for booking in expired_qs:
            self._expire(booking)
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Expired {count} booking(s)."))

    def _expire(self, booking):
        if booking.bed_space_ref:
            try:
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
                        if bed and bed.is_occupied:
                            bed.is_occupied = False
                            bed.occupant_ref = None
                            bed.booking_ref = None
                            bed.save(using=alias)
                            tenant_manager.mark_dirty(booking.hostel.slug)
                finally:
                    tenant_manager.sync_tenant_db(booking.hostel.slug)
                    clear_current_tenant()
            except Exception as exc:
                self.stderr.write(
                    f"Could not free bed for booking #{booking.pk}: {exc}"
                )

        booking.payment_status = PaymentStatus.EXPIRED
        booking.save(update_fields=["payment_status"])
        self.stdout.write(f"  Expired booking #{booking.pk} ({booking.hostel.slug})")
