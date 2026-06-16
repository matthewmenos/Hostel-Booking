from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User

UserAdmin.fieldsets = UserAdmin.fieldsets + (
    ("Hostel platform", {"fields": ("role", "phone", "university")}),
)
admin.site.register(User, UserAdmin)
