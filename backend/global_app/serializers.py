"""Serializers for hostels, bookings, and payments (global DB)."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    TenantHostel, HostelImage, GlobalBooking, Payment, ManagerVerification,
    Notification, ChatRoom, ChatMembership, ChatMessage, MessageReaction,
    HostelReview,
)


class HostelImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelImage
        fields = ("id", "image", "caption", "order", "uploaded_at")
        read_only_fields = ("id", "uploaded_at")


class HostelReviewSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = HostelReview
        fields = (
            "id", "hostel", "student", "student_username", "student_name",
            "booking", "rating", "comment", "created_at", "updated_at",
        )
        read_only_fields = ("id", "student", "created_at", "updated_at")

    def get_student_name(self, obj):
        fn, ln = obj.student.first_name, obj.student.last_name
        if fn or ln:
            return f"{fn} {ln}".strip()
        return obj.student.username

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value


class TenantHostelSerializer(serializers.ModelSerializer):
    campus_display = serializers.CharField(source="get_campus_display", read_only=True)
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    booking_count = serializers.IntegerField(source="bookings.count", read_only=True)
    gallery = HostelImageSerializer(many=True, read_only=True)
    active_bookings_count = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    review_count = serializers.IntegerField(source="reviews.count", read_only=True)

    class Meta:
        model = TenantHostel
        fields = (
            "id", "name", "slug", "campus", "campus_display", "location",
            "total_capacity", "base_price", "description", "image",
            "owner", "owner_username", "booking_count",
            "active_bookings_count",
            "avg_rating", "review_count",
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

    def get_avg_rating(self, obj):
        from django.db.models import Avg
        result = obj.reviews.aggregate(avg=Avg("rating"))["avg"]
        return round(result, 1) if result else None


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
    hostel_slug = serializers.CharField(source="hostel.slug", read_only=True)
    student_username = serializers.CharField(source="student.username", read_only=True)
    has_review = serializers.SerializerMethodField()

    def get_has_review(self, obj):
        return hasattr(obj, "review")

    class Meta:
        model = GlobalBooking
        fields = (
            "id", "student", "student_username", "hostel", "hostel_name", "hostel_slug",
            "room_type", "bed_space_ref", "amount", "payment_status",
            "expiry_timestamp", "approved_at", "created_at", "payments", "has_review",
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
            "role", "is_active", "is_verified", "phone", "university",
            "paystack_recipient_code", "date_joined",
        )
        read_only_fields = ("id", "username", "email", "date_joined", "is_verified")


class ManagerVerificationSerializer(serializers.ModelSerializer):
    """Manager's own view of their verification record."""
    class Meta:
        model = ManagerVerification
        fields = (
            "id", "nationality",
            "id_front", "id_back", "selfie",
            "latitude", "longitude", "address",
            "payment_ref", "payment_confirmed",
            "status", "rejection_reason", "submitted_at",
        )
        read_only_fields = (
            "id", "payment_ref", "payment_confirmed",
            "status", "rejection_reason", "submitted_at",
        )


class ManagerVerificationAdminSerializer(serializers.ModelSerializer):
    """Superadmin view — includes manager username and full image URLs."""
    manager_username = serializers.CharField(source="manager.username", read_only=True)
    manager_email    = serializers.CharField(source="manager.email",    read_only=True)

    class Meta:
        model = ManagerVerification
        fields = (
            "id", "manager_username", "manager_email",
            "nationality",
            "id_front", "id_back", "selfie",
            "latitude", "longitude", "address",
            "payment_ref", "payment_confirmed",
            "status", "rejection_reason", "submitted_at", "reviewed_at",
        )
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    sender_username = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id", "notif_type", "title", "body",
            "is_read", "link", "created_at", "sender_username",
        )
        read_only_fields = (
            "id", "notif_type", "title", "body",
            "link", "created_at", "sender_username",
        )

    def get_sender_username(self, obj):
        return obj.sender.username if obj.sender_id else None


# ---------------------------------------------------------------------------
# Chat serializers
# ---------------------------------------------------------------------------

class ChatMemberSerializer(serializers.ModelSerializer):
    user_id    = serializers.IntegerField(source="user.id", read_only=True)
    username   = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name  = serializers.CharField(source="user.last_name", read_only=True)
    initials   = serializers.SerializerMethodField()

    class Meta:
        model = ChatMembership
        fields = ("user_id", "username", "first_name", "last_name", "initials", "joined_at")

    def get_initials(self, obj):
        fn = obj.user.first_name
        ln = obj.user.last_name
        if fn and ln:
            return f"{fn[0]}{ln[0]}".upper()
        return obj.user.username[:2].upper()


class ChatMessageSerializer(serializers.ModelSerializer):
    author_id        = serializers.IntegerField(source="author.id", read_only=True)
    author_username  = serializers.SerializerMethodField()
    author_initials  = serializers.SerializerMethodField()
    reply_to_preview = serializers.SerializerMethodField()
    reactions_summary = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = (
            "id", "room", "author_id", "author_username", "author_initials",
            "body", "reply_to", "reply_to_preview",
            "reactions_summary", "created_at", "edited_at",
        )
        read_only_fields = (
            "id", "room", "author_id", "author_username", "author_initials",
            "reply_to_preview", "reactions_summary", "created_at", "edited_at",
        )

    def get_author_username(self, obj):
        return obj.author.username if obj.author_id else "deleted"

    def get_author_initials(self, obj):
        if not obj.author_id:
            return "??"
        fn, ln = obj.author.first_name, obj.author.last_name
        if fn and ln:
            return f"{fn[0]}{ln[0]}".upper()
        return (obj.author.username[:2]).upper()

    def get_reply_to_preview(self, obj):
        if not obj.reply_to_id:
            return None
        parent = obj.reply_to
        return {
            "id": parent.id,
            "author_username": parent.author.username if parent.author_id else "deleted",
            "body_preview": parent.body[:100],
        }

    def get_reactions_summary(self, obj):
        from django.db.models import Count
        request = self.context.get("request")
        current_user_id = request.user.id if request else None
        agg = (
            MessageReaction.objects.filter(message=obj)
            .values("emoji")
            .annotate(count=Count("id"))
        )
        my_emojis = set()
        if current_user_id:
            my_emojis = set(
                MessageReaction.objects.filter(message=obj, user_id=current_user_id)
                .values_list("emoji", flat=True)
            )
        return [
            {"emoji": row["emoji"], "count": row["count"], "reacted": row["emoji"] in my_emojis}
            for row in agg
        ]


class ChatRoomSerializer(serializers.ModelSerializer):
    hostel_name  = serializers.CharField(source="hostel.name", read_only=True)
    hostel_slug  = serializers.CharField(source="hostel.slug", read_only=True)
    member_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    members      = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = (
            "id", "room_type", "name", "unique_key",
            "hostel", "hostel_name", "hostel_slug",
            "block", "room_number",
            "member_count", "last_message", "unread_count",
            "members", "created_at",
        )

    def get_member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()

    def get_last_message(self, obj):
        msg = obj.messages.select_related("author").last()
        if not msg:
            return None
        return {
            "id": msg.id,
            "author_username": msg.author.username if msg.author_id else "deleted",
            "body_preview": msg.body[:80],
            "created_at": msg.created_at.isoformat(),
        }

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request:
            return 0
        membership = obj.memberships.filter(user=request.user, is_active=True).first()
        if not membership:
            return 0
        if not membership.last_read_at:
            return obj.messages.count()
        return obj.messages.filter(created_at__gt=membership.last_read_at).count()

    def get_members(self, obj):
        memberships = obj.memberships.filter(is_active=True).select_related("user")
        return ChatMemberSerializer(memberships, many=True).data
