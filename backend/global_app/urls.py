"""Global routes, mounted at /api/."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    HostelViewSet,
    MyHostelsView,
    BookingViewSet,
    CreateBookingView,
)

router = DefaultRouter()
router.register("hostels", HostelViewSet, basename="hostel")
router.register("bookings", BookingViewSet, basename="booking")

urlpatterns = [
    path("my-hostels/", MyHostelsView.as_view(), name="my-hostels"),
    path("book/", CreateBookingView.as_view(), name="create-booking"),
    path("", include(router.urls)),
]
