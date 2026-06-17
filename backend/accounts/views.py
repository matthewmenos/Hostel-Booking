"""Authentication & profile endpoints."""
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)


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
