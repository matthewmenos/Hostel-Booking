"""
Global models. These live in the GLOBAL ``default`` database and hold all
shared, cross-tenant, high-concurrency data:

  * ``TenantHostel``  -> the public listing/metadata for each hostel (tenant).
  * ``GlobalBooking`` -> the consolidated booking ledger. Keeping bookings in
        ONE authoritative database (rather than scattered across per-tenant
        files) is what lets us reserve beds and reason about availability
        without race conditions between distributed SQLite files.
  * ``Payment``       -> payment records, designed to plug into Ghanaian
        gateways (Paystack / Hubtel) later.

Note on references: bed spaces live in per-tenant databases, so a booking
stores the bed as a loose integer (``bed_space_ref``) rather than a cross-DB
foreign key.
"""
from django.conf import settings
from django.db import models


class Campus(models.TextChoices):
    KNUST = "KNUST", "KNUST (Kumasi)"
    LEGON = "LEGON", "University of Ghana, Legon"
    UCC = "UCC", "University of Cape Coast"
    UPSA = "UPSA", "University of Professional Studies"
    OTHER = "OTHER", "Other"


class TenantHostel(models.Model):
    """Global listing metadata for a single hostel/tenant."""

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True, db_index=True)
    campus = models.CharField(max_length=20, choices=Campus.choices)
    location = models.CharField(max_length=255, help_text="Area / landmark")
    total_capacity = models.PositiveIntegerField(default=0)
    base_price = models.DecimalField(
        max_digits=10, decimal_places=2, help_text="Base price per bed (GHS)"
    )
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="hostels/", null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="hostels",
        on_delete=models.CASCADE,
    )
    # Amenities
    has_wifi = models.BooleanField(default=False)
    has_ac = models.BooleanField(default=False)
    has_electricity = models.BooleanField(default=True)
    has_water = models.BooleanField(default=True)
    utilities_included = models.BooleanField(
        default=False, help_text="Are utility bills included in the listed price?"
    )
    has_security = models.BooleanField(default=False)
    has_parking = models.BooleanField(default=False)
    has_laundry = models.BooleanField(default=False)
    has_kitchen = models.BooleanField(default=False)
    # House rules / policy
    gender_policy = models.CharField(
        max_length=10,
        choices=[("mixed", "Mixed"), ("male", "Male only"), ("female", "Female only")],
        default="mixed",
    )
    min_stay_months = models.PositiveSmallIntegerField(
        default=1, help_text="Minimum stay in months"
    )

    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} — {self.get_campus_display()}"


class HostelImage(models.Model):
    """Additional gallery images for a hostel (managed by the hostel owner)."""

    hostel = models.ForeignKey(
        TenantHostel, related_name="gallery", on_delete=models.CASCADE
    )
    image = models.ImageField(upload_to="hostel_gallery/")
    caption = models.CharField(max_length=200, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("order", "uploaded_at")

    def __str__(self):
        return f"Image #{self.pk} for {self.hostel.slug}"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PAID_AWAITING_APPROVAL = "paid_awaiting_approval", "Paid — Awaiting Admin Approval"
    PAID = "paid", "Paid & Approved"
    FAILED = "failed", "Failed"
    EXPIRED = "expired", "Expired"
    REFUNDED = "refunded", "Refunded"


class GlobalBooking(models.Model):
    """Consolidated booking ledger entry (authoritative, global DB)."""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="bookings", on_delete=models.CASCADE
    )
    hostel = models.ForeignKey(
        TenantHostel, related_name="bookings", on_delete=models.CASCADE
    )
    room_type = models.CharField(max_length=20)
    # Loose reference to a BedSpace row inside the hostel's tenant database.
    bed_space_ref = models.IntegerField(null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(
        max_length=30, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    # A pending reservation expires if not paid in time; frees the bed.
    expiry_timestamp = models.DateTimeField(null=True, blank=True)
    # Set when admin approves the booking and triggers payout to manager.
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["hostel", "payment_status"])]

    def __str__(self):
        return f"Booking #{self.pk} — {self.student} @ {self.hostel.slug}"


class PaymentProvider(models.TextChoices):
    PAYSTACK = "paystack", "Paystack"
    HUBTEL = "hubtel", "Hubtel"
    MANUAL = "manual", "Manual / Offline"


class Payment(models.Model):
    """A payment attempt against a booking (gateway-ready, stubbed)."""

    booking = models.ForeignKey(
        GlobalBooking, related_name="payments", on_delete=models.CASCADE
    )
    provider = models.CharField(
        max_length=20, choices=PaymentProvider.choices, default=PaymentProvider.PAYSTACK
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=30, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    # Gateway transaction reference (filled in by the gateway integration).
    reference = models.CharField(max_length=100, blank=True, db_index=True)
    # Authorization URL returned by the gateway for the customer to complete payment.
    authorization_url = models.URLField(blank=True)
    # Paystack transfer fields (filled after admin approves and payout is initiated).
    transfer_reference = models.CharField(max_length=100, blank=True)
    transfer_code = models.CharField(max_length=100, blank=True)
    platform_commission = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    manager_payout = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Payment #{self.pk} — {self.get_provider_display()} [{self.status}]"
