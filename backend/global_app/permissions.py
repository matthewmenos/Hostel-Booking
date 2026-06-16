"""Reusable DRF permissions."""
from rest_framework import permissions


class IsManager(permissions.BasePermission):
    """Allow only authenticated hostel managers."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_manager", False)
        )


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Object-level: only the hostel's owner may modify it."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(obj, "owner_id", None) == getattr(request.user, "id", None)
