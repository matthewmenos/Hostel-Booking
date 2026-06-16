"""Serializers for hostels, bookings, and payments (global DB)."""
from rest_framework import serializers

from .models import TenantHostel, GlobalBooking, Payment


class TenantHostelSerializer(serializers.ModelSerializer):
    campus_display = serializers.CharField(source="get_campus_display", read_only=True)
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TenantHostel
        fields = (
            "id", "name", "slug", "campus", "campus_display", "location",
            "total_capacity", "base_price", "description", "image",
            "owner", "is_active", "created_at",
        )
        read_only_fields = ("id", "owner", "created_at")


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id", "booking", "provider", "amount", "status",
            "reference", "created_at",
        )
        read_only_fields = ("id", "status", "reference", "created_at")


class GlobalBookingSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    hostel_name = serializers.CharField(source="hostel.name", read_only=True)

    class Meta:
        model = GlobalBooking
        fields = (
            "id", "student", "hostel", "hostel_name", "room_type",
            "bed_space_ref", "amount", "payment_status",
            "expiry_timestamp", "created_at", "payments",
        )
        read_only_fields = (
            "id", "student", "amount", "payment_status",
            "bed_space_ref", "expiry_timestamp", "created_at",
        )


class CreateBookingSerializer(serializers.Serializer):
    """Input for the booking pipeline."""

    hostel = serializers.SlugField()
    bed_space_id = serializers.IntegerField(
        help_text="BedSpace id within the hostel's tenant database."
    )
    provider = serializers.ChoiceField(
        choices=["paystack", "hubtel", "manual"], default="paystack"
    )
