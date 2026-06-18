"""Serializers for hostels, bookings, and payments (global DB)."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import TenantHostel, HostelImage, GlobalBooking, Payment


class HostelImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelImage
        fields = ("id", "image", "caption", "order", "uploaded_at")
        read_only_fields = ("id", "uploaded_at")


class TenantHostelSerializer(serializers.ModelSerializer):
    campus_display = serializers.CharField(source="get_campus_display", read_only=True)
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    booking_count = serializers.IntegerField(source="bookings.count", read_only=True)
    gallery = HostelImageSerializer(many=True, read_only=True)
    active_bookings_count = serializers.SerializerMethodField()

    class Meta:
        model = TenantHostel
        fields = (
            "id", "name", "slug", "campus", "campus_display", "location",
            "total_capacity", "base_price", "description", "image",
            "owner", "owner_username", "booking_count",
            "active_bookings_count",
            # Amenities
            "has_wifi", "has_ac", "has_electricity", "has_water",
            "utilities_included", "has_security", "has_parking",
            "has_laundry", "has_kitchen",
            # Policy
            "gender_policy", "min_stay_months",
            "is_active", "is_verified", "gallery", "created_at",
        )
        read_only_fields = ("id", "owner", "created_at")

    def get_active_bookings_count(self, obj):
        """Count beds currently occupied (pending or paid — not expired/refunded)."""
        from .models import PaymentStatus
        return obj.bookings.filter(
            payment_status__in=[
                PaymentStatus.PENDING,
                PaymentStatus.PAID_AWAITING_APPROVAL,
                PaymentStatus.PAID,
            ]
        ).count()


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id", "booking", "provider", "amount", "status",
            "reference", "authorization_url",
            "transfer_code", "platform_commission", "manager_payout",
            "created_at",
        )
        read_only_fields = (
            "id", "status", "reference", "authorization_url",
            "transfer_code", "platform_commission", "manager_payout", "created_at",
        )


class GlobalBookingSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    hostel_name = serializers.CharField(source="hostel.name", read_only=True)
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = GlobalBooking
        fields = (
            "id", "student", "student_username", "hostel", "hostel_name", "room_type",
            "bed_space_ref", "amount", "payment_status",
            "expiry_timestamp", "approved_at", "created_at", "payments",
        )
        read_only_fields = (
            "id", "student", "amount", "payment_status",
            "bed_space_ref", "expiry_timestamp", "approved_at", "created_at",
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


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = (
            "id", "username", "email", "first_name", "last_name",
            "role", "is_active", "phone", "university",
            "paystack_recipient_code", "date_joined",
        )
        read_only_fields = ("id", "username", "email", "date_joined")
