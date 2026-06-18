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
    # Public universities
    UG       = "UG",       "University of Ghana, Legon"
    KNUST    = "KNUST",    "Kwame Nkrumah University of Science and Technology (KNUST)"
    UCC      = "UCC",      "University of Cape Coast (UCC)"
    UDS      = "UDS",      "University for Development Studies (UDS)"
    UEW      = "UEW",      "University of Education, Winneba (UEW)"
    UPSA     = "UPSA",     "University of Professional Studies, Accra (UPSA)"
    UHAS     = "UHAS",     "University of Health and Allied Sciences (UHAS)"
    UESD     = "UESD",     "University of Environment and Sustainable Development (UESD)"
    CKTCUTAS = "CKTCUTAS", "C.K. Tedam University of Technology and Applied Sciences (CKT-UTAS)"
    SDDBIDS  = "SDDBIDS",  "SD Dombo University of Business and Integrated Development Studies (SDD-UBIDS)"
    AAMUSTED = "AAMUSTED", "Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development (AAMUSTED)"
    UMAT     = "UMAT",     "University of Mines and Technology (UMaT)"
    GIMPA    = "GIMPA",    "Ghana Institute of Management and Public Administration (GIMPA)"
    ATU      = "ATU",      "Accra Technical University"
    HTU      = "HTU",      "Ho Technical University"
    KTU      = "KTU",      "Kumasi Technical University"
    CCTU     = "CCTU",     "Cape Coast Technical University"
    STU      = "STU",      "Sunyani Technical University"
    TTTU     = "TTTU",     "Tamale Technical University"
    TATU     = "TATU",     "Takoradi Technical University"
    WTU      = "WTU",      "Wa Technical University"
    KofTU    = "KofTU",    "Koforidua Technical University"
    BTU      = "BTU",      "Bolgatanga Technical University"
    # Private universities
    ASHESI   = "ASHESI",   "Ashesi University"
    CENTRAL  = "CENTRAL",  "Central University"
    VVU      = "VVU",      "Valley View University"
    GCUC     = "GCUC",     "Ghana Christian University College"
    MUG      = "MUG",      "Methodist University Ghana"
    TTS      = "TTS",      "Trinity Theological Seminary"
    REGENT   = "REGENT",   "Regent University College of Science and Technology"
    PACU     = "PACU",     "Pan-African Christian University College"
    ACC      = "ACC",      "Academic City College"
    WIUC     = "WIUC",     "Wisconsin International University College"
    GCTU     = "GCTU",     "Ghana Communication Technology University (GCTU)"
    CUCG     = "CUCG",     "Catholic University College of Ghana"
    PUCG     = "PUCG",     "Presbyterian University College Ghana"
    PU       = "PU",       "Pentecost University"
    HCC      = "HCC",      "Heritage Christian College"
    AIT      = "AIT",      "Accra Institute of Technology (AIT)"
    BLUECREST = "BLUECREST", "BlueCrest University College"
    ANOVA    = "ANOVA",    "ANova Education"
    MOUNT    = "MOUNT",    "Mountcrest University College"
    DOMINION = "DOMINION", "Dominion University College"
    ANU      = "ANU",      "All Nations University"
    GBUC     = "GBUC",     "Ghana Baptist University College"
    ZENITH   = "ZENITH",   "Zenith University College"
    SPIRITAN = "SPIRITAN", "Spiritan University College"
    IUCG     = "IUCG",     "Islamic University College Ghana"
    LANCASTER = "LANCASTER", "Lancaster University Ghana"
    WEBSTER  = "WEBSTER",  "Webster University Ghana"
    SMC      = "SMC",      "Swiss Management Centre (SMC) University Ghana"
    OTHER    = "OTHER",    "Other"


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


class VerificationStatus(models.TextChoices):
    PENDING  = "pending",  "Pending Review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class ManagerVerification(models.Model):
    """One-time identity verification a manager must complete before listing hostels."""

    manager   = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name="verification", on_delete=models.CASCADE
    )
    # Nationality
    nationality = models.CharField(max_length=80)
    # Ghana Card images
    id_front  = models.ImageField(upload_to="verifications/id/")
    id_back   = models.ImageField(upload_to="verifications/id/")
    # Selfie
    selfie    = models.ImageField(upload_to="verifications/selfie/")
    # Location
    latitude  = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    address   = models.CharField(max_length=500)
    # Paystack activation fee (GHS 5)
    payment_ref       = models.CharField(max_length=100, blank=True)
    payment_confirmed = models.BooleanField(default=False)
    # Admin decision
    status           = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    rejection_reason = models.TextField(blank=True)
    submitted_at     = models.DateTimeField(auto_now_add=True)
    reviewed_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-submitted_at",)

    def __str__(self):
        return f"Verification — {self.manager.username} [{self.status}]"
