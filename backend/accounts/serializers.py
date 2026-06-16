"""Serializers for authentication and user profiles."""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserRole

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
        return user


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
