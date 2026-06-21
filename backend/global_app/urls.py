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
    ManagerAnalyticsView,
    ManagerVerificationView,
    AdminUserListView,
    AdminUserUpdateView,
    AdminHostelListView,
    AdminHostelActivateView,
    AdminHostelDeactivateView,
    AdminBookingsView,
    AdminRefundBookingView,
    AdminApproveBookingView,
    AdminVerifyHostelView,
    AdminVerificationListView,
    AdminVerificationDecideView,
    AdminOverviewView,
    AdminPaystackBalanceView,
    AdminPaystackTransfersView,
    AdminManagerListView,
    AdminSetRecipientView,
    AdminSettingsView,
    PaystackWebhookView,
    HostelImageListView,
    HostelImageDeleteView,
    BookingReceiptView,
    NotificationListView,
    NotificationUnreadCountView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    SendNotificationView,
    SendReportView,
    HostelReviewListView,
    HostelReviewDeleteView,
)

router = DefaultRouter()
router.register("hostels", HostelViewSet, basename="hostel")
router.register("bookings", BookingViewSet, basename="booking")

urlpatterns = [
    # Public / student
    path("my-hostels/", MyHostelsView.as_view(), name="my-hostels"),
    path("book/", CreateBookingView.as_view(), name="create-booking"),
    path("bookings/<int:pk>/cancel/", CancelBookingView.as_view(), name="cancel-booking"),
    path("bookings/<int:pk>/receipt/", BookingReceiptView.as_view(), name="booking-receipt"),
    # Paystack webhook (no JWT — verified by HMAC signature)
    path("webhooks/paystack/", PaystackWebhookView.as_view(), name="paystack-webhook"),
    # Hostel gallery
    path("hostels/<slug:slug>/gallery/", HostelImageListView.as_view(), name="hostel-gallery"),
    path("gallery/<int:pk>/", HostelImageDeleteView.as_view(), name="hostel-gallery-delete"),
    # Manager
    path("manager/bookings/", ManagerBookingsView.as_view(), name="manager-bookings"),
    path("manager/analytics/", ManagerAnalyticsView.as_view(), name="manager-analytics"),
    path("manager/verification/", ManagerVerificationView.as_view(), name="manager-verification"),
    # Superadmin — overview & platform
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/settings/", AdminSettingsView.as_view(), name="admin-settings"),
    # Superadmin — Paystack
    path("admin/paystack/balance/", AdminPaystackBalanceView.as_view(), name="admin-paystack-balance"),
    path("admin/paystack/transfers/", AdminPaystackTransfersView.as_view(), name="admin-paystack-transfers"),
    # Superadmin — manager payouts
    path("admin/managers/", AdminManagerListView.as_view(), name="admin-managers"),
    path("admin/managers/<int:pk>/recipient/", AdminSetRecipientView.as_view(), name="admin-set-recipient"),
    # Superadmin — users
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", AdminUserUpdateView.as_view(), name="admin-user-update"),
    # Superadmin — hostels
    path("admin/hostels/", AdminHostelListView.as_view(), name="admin-hostels"),
    path("admin/hostels/<slug:slug>/activate/", AdminHostelActivateView.as_view(), name="admin-hostel-activate"),
    path("admin/hostels/<slug:slug>/deactivate/", AdminHostelDeactivateView.as_view(), name="admin-hostel-deactivate"),
    path("admin/hostels/<slug:slug>/verify/", AdminVerifyHostelView.as_view(), name="admin-hostel-verify"),
    # Superadmin — verifications
    path("admin/verifications/", AdminVerificationListView.as_view(), name="admin-verifications"),
    path("admin/verifications/<int:pk>/<str:action>/", AdminVerificationDecideView.as_view(), name="admin-verification-decide"),
    # Reviews
    path("hostels/<slug:slug>/reviews/", HostelReviewListView.as_view(), name="hostel-reviews"),
    path("reviews/<int:pk>/", HostelReviewDeleteView.as_view(), name="review-delete"),
    # Notifications
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("notifications/unread-count/", NotificationUnreadCountView.as_view(), name="notifications-unread-count"),
    path("notifications/read-all/", NotificationMarkAllReadView.as_view(), name="notifications-read-all"),
    path("notifications/<int:pk>/read/", NotificationMarkReadView.as_view(), name="notification-read"),
    path("notifications/send/", SendNotificationView.as_view(), name="notifications-send"),
    path("notifications/report/", SendReportView.as_view(), name="notifications-report"),
    # Superadmin — bookings
    path("admin/bookings/", AdminBookingsView.as_view(), name="admin-bookings"),
    path("admin/bookings/<int:pk>/refund/", AdminRefundBookingView.as_view(), name="admin-booking-refund"),
    path("admin/bookings/<int:pk>/approve/", AdminApproveBookingView.as_view(), name="admin-booking-approve"),
    path("", include(router.urls)),
]
