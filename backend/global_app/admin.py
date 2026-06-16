from django.contrib import admin

from .models import TenantHostel, GlobalBooking, Payment


@admin.register(TenantHostel)
class TenantHostelAdmin(admin.ModelAdmin):
    list_display = ("name", "campus", "slug", "base_price", "owner", "is_active")
    list_filter = ("campus", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "location")


@admin.register(GlobalBooking)
class GlobalBookingAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "hostel", "payment_status", "amount", "created_at")
    list_filter = ("payment_status",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "provider", "amount", "status", "reference")
    list_filter = ("provider", "status")
