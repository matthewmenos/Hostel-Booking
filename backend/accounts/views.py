"""Authentication & profile endpoints."""
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    """Public endpoint: create a student or manager account."""

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class RoleTokenObtainPairView(TokenObtainPairView):
    """Login: returns access/refresh tokens plus the user profile."""

    serializer_class = RoleTokenObtainPairSerializer


class MeView(APIView):
    """Return or update the currently authenticated user's profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordResetRequestView(APIView):
    """POST {email} → send a reset link if the account exists. Always 200 to avoid enumeration."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Return 200 regardless to prevent account enumeration
            return Response({"detail": "If that email is registered, a reset link has been sent."})

        uid   = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
        reset_url = f"{frontend_url}/reset-password/{uid}/{token}/"

        try:
            send_mail(
                subject="Reset your HostelHub password",
                message=(
                    f"Hi {user.first_name or user.username},\n\n"
                    f"Click the link below to reset your password. "
                    f"This link expires in 1 hour.\n\n"
                    f"{reset_url}\n\n"
                    "If you didn't request a password reset, you can ignore this email.\n\n"
                    "— The HostelHub Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as exc:
            logger.error("Password reset email failed for %s: %s", email, exc)
            return Response(
                {"detail": "Could not send reset email. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"detail": "If that email is registered, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    """POST {uid, token, new_password} → set new password if token is valid."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid      = request.data.get("uid", "")
        token    = request.data.get("token", "")
        password = request.data.get("new_password", "")

        if not uid or not token or not password:
            return Response(
                {"detail": "uid, token, and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pk   = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "This reset link has expired or already been used."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save()
        return Response({"detail": "Password reset successfully. You can now log in."})
