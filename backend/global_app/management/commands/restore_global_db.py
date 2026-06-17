"""
Management command: restore_global_db

Downloads global_system.db from Cloudflare R2 if it is missing locally.
Idempotent — safe to run on every deploy even if the file already exists.

Usage (called from build.sh before migrate):
    python manage.py restore_global_db
"""
import os

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Restore global_system.db from R2 if missing (Render ephemeral-disk fix)."

    def handle(self, *args, **options):
        path = str(settings.DATA_DIR / "global_system.db")

        if os.path.exists(path):
            self.stdout.write("Global DB already present — skipping restore.")
            return

        if not settings.R2_ENABLED:
            self.stdout.write("R2 not configured — skipping restore (fresh DB will be created by migrate).")
            return

        self.stdout.write("Global DB missing — attempting restore from R2…")
        from core import r2_client
        restored = r2_client.download_global_db(path)
        if restored:
            self.stdout.write(self.style.SUCCESS("Global DB restored from R2 successfully."))
        else:
            self.stdout.write(
                self.style.WARNING(
                    "No backup found in R2 (first deploy or bucket empty). "
                    "A fresh DB will be created by migrate."
                )
            )
