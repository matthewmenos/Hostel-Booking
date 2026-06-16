"""Serializers for tenant-scoped resources (rooms, beds, announcements)."""
from rest_framework import serializers

from .models import Room, BedSpace, TenantAnnouncement


class BedSpaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BedSpace
        fields = ("id", "room", "bed_label", "is_occupied", "occupant_ref", "booking_ref")
        read_only_fields = ("id", "occupant_ref", "booking_ref")


class RoomSerializer(serializers.ModelSerializer):
    beds = BedSpaceSerializer(many=True, read_only=True)
    room_type_display = serializers.CharField(
        source="get_room_type_display", read_only=True
    )
    capacity = serializers.IntegerField(read_only=True)

    class Meta:
        model = Room
        fields = (
            "id", "block", "room_number", "room_type", "room_type_display",
            "capacity", "has_ac", "has_wifi", "has_generator", "beds", "created_at",
        )
        read_only_fields = ("id", "created_at")


class TenantAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantAnnouncement
        fields = ("id", "title", "body", "created_at")
        read_only_fields = ("id", "created_at")
