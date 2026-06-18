"""
Custom user model (global database).

A single user table serves the whole platform; the ``role`` field distinguishes
students (who book beds) from managers (who own/operate hostels) and the
super-admin. Managers are linked to the hostels they own via
``global_app.TenantHostel.owner``.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    MANAGER = "manager", "Hostel Manager"
    SUPERADMIN = "superadmin", "Super Admin"


class User(AbstractUser):
    role = models.CharField(
        max_length=20, choices=UserRole.choices, default=UserRole.STUDENT
    )
    phone = models.CharField(max_length=20, blank=True)
    # University the student is affiliated with (e.g. KNUST, Legon).
    university = models.CharField(max_length=120, blank=True)
    # Paystack recipient code for manager payouts (e.g. RCP_xxxx).
    paystack_recipient_code = models.CharField(max_length=100, blank=True)

    @property
    def is_manager(self) -> bool:
        return self.role == UserRole.MANAGER

    @property
    def is_student(self) -> bool:
        return self.role == UserRole.STUDENT

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
