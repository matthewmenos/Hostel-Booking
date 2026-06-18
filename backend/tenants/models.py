"""
Tenant-scoped models. These live in the PER-TENANT SQLite ``.db`` files, never
in the global database (enforced by :class:`tenants.routers.TenantRouter`).

They describe a single hostel's private operational data: its physical rooms,
the individual bed spaces within them, and announcements to residents.

Because each tenant has its own database file, primary keys and FKs here are
local to that one hostel — there is no cross-tenant mixing.
"""
from django.db import models


CAPACITY_MAP = {
    "1_in_a_room": 1,
    "2_in_a_room": 2,
    "3_in_a_room": 3,
    "4_in_a_room": 4,
    "6_in_a_room": 6,
}

BED_LETTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


class RoomType(models.TextChoices):
    SINGLE = "1_in_a_room", "1-in-a-room"
    DOUBLE = "2_in_a_room", "2-in-a-room"
    TRIPLE = "3_in_a_room", "3-in-a-room"
    QUAD   = "4_in_a_room", "4-in-a-room"
    SIX    = "6_in_a_room", "6-in-a-room"


class Room(models.Model):
    """A physical room within the hostel."""

    block = models.CharField(max_length=50, help_text="e.g. Block A")
    room_number = models.CharField(max_length=20)
    room_type = models.CharField(
        max_length=20, choices=RoomType.choices, default=RoomType.DOUBLE
    )
    # Amenities
    has_ac = models.BooleanField(default=False)
    has_wifi = models.BooleanField(default=True)
    has_generator = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("block", "room_number")
        ordering = ("block", "room_number")

    def __str__(self):
        return f"{self.block}-{self.room_number} ({self.get_room_type_display()})"

    @property
    def capacity(self) -> int:
        return CAPACITY_MAP.get(self.room_type, 1)


class BedSpace(models.Model):
    """An individual bed within a room; the unit a student actually books."""

    room = models.ForeignKey(Room, related_name="beds", on_delete=models.CASCADE)
    bed_label = models.CharField(max_length=20, help_text="e.g. Bed 1")
    is_occupied = models.BooleanField(default=False)
    # Loose reference to the global User id of the occupant (no cross-DB FK).
    occupant_ref = models.IntegerField(null=True, blank=True)
    # Loose reference to the GlobalBooking id that reserved this bed.
    booking_ref = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ("room", "bed_label")
        ordering = ("room", "bed_label")

    def __str__(self):
        status = "occupied" if self.is_occupied else "free"
        return f"{self.room} / {self.bed_label} [{status}]"


class TenantAnnouncement(models.Model):
    """A notice posted by the hostel manager to their residents."""

    title = models.CharField(max_length=200)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.title
