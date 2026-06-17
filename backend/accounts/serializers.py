"""Serializers for authentication and user profiles."""
import logging

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserRole

logger = logging.getLogger(__name__)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name",
            "role", "phone", "university",
        )
        read_only_fields = ("id", "role")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    # Restrict self-registration to student/manager (no self-made superadmins).
    role = serializers.ChoiceField(
        choices=[(UserRole.STUDENT, "Student"), (UserRole.MANAGER, "Hostel Manager")],
        default=UserRole.STUDENT,
    )

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "password", "role",
            "first_name", "last_name", "phone", "university",
        )

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        self._send_welcome(user)
        return user

    def _send_welcome(self, user):
        role_label = "Hostel Manager" if user.role == UserRole.MANAGER else "Student"
        name = user.first_name or user.username
        try:
            send_mail(
                subject="Welcome to HostelHub Ghana!",
                message=(
                    f"Hi {name},\n\n"
                    f"Welcome to HostelHub Ghana. Your {role_label} account has been created.\n\n"
                    "You can now log in and start using the platform.\n\n"
                    "— The HostelHub Team"
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@hostelhub.gh"),
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception as exc:
            logger.warning("Welcome email failed for %s: %s", user.email, exc)


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embeds the user's role/identity in the JWT and the login response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
