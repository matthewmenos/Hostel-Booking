"""
Management command: ensure_superadmin

Reads ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD from the environment
and creates (or updates) the platform superadmin account.

- Safe to run on every deploy — idempotent.
- If the account already exists, only the password is updated when
  ADMIN_PASSWORD_FORCE=true is set (opt-in, to avoid silent resets).
- The account is always given role="superadmin" and is_staff=is_superuser=True.

Usage (called automatically from build.sh):
    python manage.py ensure_superadmin
"""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Create or verify the platform superadmin account from environment variables."

    def handle(self, *args, **options):
        username = os.getenv("ADMIN_USERNAME", "").strip()
        email    = os.getenv("ADMIN_EMAIL",    "").strip()
        password = os.getenv("ADMIN_PASSWORD", "").strip()

        if not username or not email or not password:
            raise CommandError(
                "ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD must all be set "
                "in the environment before running ensure_superadmin."
            )

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )

        user.email        = email
        user.role         = "superadmin"
        user.is_staff     = True
        user.is_superuser = True

        force_pw = os.getenv("ADMIN_PASSWORD_FORCE", "").strip().lower() in {"1", "true", "yes"}

        if created or force_pw:
            user.set_password(password)
            pw_msg = "Password set."
        else:
            pw_msg = "Password unchanged (set ADMIN_PASSWORD_FORCE=true to reset)."

        user.save()

        action = "Created" if created else "Verified"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} superadmin '{username}' ({email}). {pw_msg}"
            )
        )
