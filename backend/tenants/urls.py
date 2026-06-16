"""Tenant-scoped routes, mounted at /api/ (all require X-Tenant-Slug)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import RoomViewSet, BedSpaceViewSet, AnnouncementViewSet

router = DefaultRouter()
router.register("rooms", RoomViewSet, basename="room")
router.register("beds", BedSpaceViewSet, basename="bed")
router.register("announcements", AnnouncementViewSet, basename="announcement")

urlpatterns = [
    path("tenant/", include(router.urls)),
]
