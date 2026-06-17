"""Global routes, mounted at /api/."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    HostelViewSet,
    MyHostelsView,
    BookingViewSet,
    CancelBookingView,
    CreateBookingView,
    ManagerBookingsView,
    AdminUserListView,
    AdminUserUpdateView,
    AdminHostelListView,
    AdminHostelActivateView,
    AdminHostelDeactivateView,
    AdminBookingsView,
    AdminRefundBookingView,
)

router = DefaultRouter()
router.register("hostels", HostelViewSet, basename="hostel")
router.register("bookings", BookingViewSet, basename="booking")

urlpatterns = [
    path("my-hostels/", MyHostelsView.as_view(), name="my-hostels"),
    path("book/", CreateBookingView.as_view(), name="create-booking"),
    path("bookings/<int:pk>/cancel/", CancelBookingView.as_view(), name="cancel-booking"),
    # Manager
    path("manager/bookings/", ManagerBookingsView.as_view(), name="manager-bookings"),
    # Superadmin
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", AdminUserUpdateView.as_view(), name="admin-user-update"),
    path("admin/hostels/", AdminHostelListView.as_view(), name="admin-hostels"),
    path("admin/hostels/<slug:slug>/activate/", AdminHostelActivateView.as_view(), name="admin-hostel-activate"),
    path("admin/hostels/<slug:slug>/deactivate/", AdminHostelDeactivateView.as_view(), name="admin-hostel-deactivate"),
    path("admin/bookings/", AdminBookingsView.as_view(), name="admin-bookings"),
    path("admin/bookings/<int:pk>/refund/", AdminRefundBookingView.as_view(), name="admin-booking-refund"),
    path("", include(router.urls)),
]
